//! Host implementations of the seam traits `tinymemory-core` declares.
//!
//! The extracted memory subsystem reaches back into OpenHuman through nine
//! traits (see `tinymemory_api::host` and the `*_host` modules in
//! `tinymemory_core`). [`super::host`] carries the two that are about *data* —
//! `MemoryHostConfig` and `MemoryEventSink`. This module carries the seven that
//! are about *capability*: building providers, loading config, running spaCy,
//! throttling background work, reporting errors.
//!
//! # They are process-globals, installed once
//!
//! Every one is reached through a `set_*` installer that
//! [`install_memory_host_seams`] calls during startup wiring, before any memory
//! work begins. That mirrors the shape the subsystem had before the extraction,
//! when these were free functions it called directly.
//!
//! # Why several of them capture an `Arc<Config>`
//!
//! Four of the seams take a config on the seam side but delegate to a host
//! function whose signature does not (`resolve_api_key`, `ollama_base_url`,
//! `api_key`). Those impls hold the config the installer was given. It is the
//! startup config: a mid-session settings change is *not* reflected, which
//! matches how the pre-extraction call sites behaved — they read the same
//! ambient config — but is worth knowing before adding a seam method that
//! should be live. Seams that must be live (`ComposioHost`, `ConfigLoader`)
//! take a `&Config` argument and re-read instead.

use std::sync::Arc;

use async_trait::async_trait;
use tinyagents::harness::model::{ChatModel, ModelResponse};
use tinymemory_api::host::{EmbeddingHost, EmbeddingProvider, ErrorReporter, UsageInfo};
use tinymemory_core::chat_host::ChatHost;
use tinymemory_core::composio_host::{ComposioConnection, ComposioExecuteResponse, ComposioHost};
use tinymemory_core::config_loader::ConfigLoader;
use tinymemory_core::nlp_host::{NlpHost, SpacyResponse};
use tinymemory_core::scheduler_gate::{Policy, SchedulerGate};
use tinymemory_core::shutdown::{ShutdownHook, ShutdownHost};
use tokio::sync::Notify;

use crate::openhuman::config::Config;

/// Type alias for the seam's config trait object, to keep signatures readable.
type SeamConfig = tinymemory_core::Config;

// ── Embeddings ──────────────────────────────────────────────────────────────

/// Builds embedding providers for the memory subsystem.
#[derive(Debug)]
pub struct OpenHumanEmbeddingHost {
    config: Arc<Config>,
}

impl EmbeddingHost for OpenHumanEmbeddingHost {
    fn resolve_api_key(&self, provider: &str) -> Option<String> {
        let key = crate::openhuman::inference::embeddings::resolve_api_key(&self.config, provider);
        // The host returns "" for "no credential stored"; the seam distinguishes
        // absence from an empty key so callers can report the difference.
        (!key.is_empty()).then_some(key)
    }

    fn ollama_base_url(&self) -> String {
        crate::openhuman::inference::local::ollama_base_url_from_config(&self.config)
    }

    fn default_embedding_provider(&self) -> Arc<dyn EmbeddingProvider> {
        crate::openhuman::inference::embeddings::default_embedding_provider()
    }

    fn create_embedding_provider_with_credentials(
        &self,
        provider: &str,
        model: &str,
        dims: usize,
        api_key: &str,
        custom_endpoint: Option<&str>,
    ) -> Result<Box<dyn EmbeddingProvider>, String> {
        crate::openhuman::inference::embeddings::create_embedding_provider_with_credentials(
            provider,
            model,
            dims,
            api_key,
            custom_endpoint,
        )
        .map_err(|e| format!("{e:#}"))
    }

    fn model_supports_dimensions(&self, model: &str) -> bool {
        crate::openhuman::inference::embeddings::model_supports_dimensions(model)
    }

    fn cloud_embedding_provider(
        &self,
        model: &str,
        dims: usize,
    ) -> Result<Box<dyn EmbeddingProvider>, String> {
        Ok(Box::new(
            crate::openhuman::inference::embeddings::cloud::OpenHumanCloudEmbedding::new(
                None,
                self.config.config_path.parent().map(std::path::PathBuf::from),
                self.config.secrets.encrypt,
                model,
                dims,
            ),
        ))
    }

    fn default_cloud_embedding_model(&self) -> &str {
        crate::openhuman::inference::embeddings::DEFAULT_CLOUD_EMBEDDING_MODEL
    }

    fn default_cloud_embedding_dimensions(&self) -> usize {
        crate::openhuman::inference::embeddings::DEFAULT_CLOUD_EMBEDDING_DIMENSIONS
    }

    fn ollama_embedding_provider(
        &self,
        base_url: &str,
        model: &str,
        dims: usize,
    ) -> Result<Box<dyn EmbeddingProvider>, String> {
        self.create_embedding_provider_with_credentials("ollama", model, dims, "", Some(base_url))
    }
}

// ── Chat models ─────────────────────────────────────────────────────────────

/// Builds chat models for summarisation and the memory chat helper.
#[derive(Debug)]
pub struct OpenHumanChatHost;

impl ChatHost for OpenHumanChatHost {
    fn provider_for_role(&self, role: &str, config: &SeamConfig) -> String {
        match downcast_config(config) {
            Some(config) => {
                crate::openhuman::inference::provider::provider_for_role(role, &config)
            }
            None => "unknown".to_string(),
        }
    }

    fn create_chat_model_with_model_id(
        &self,
        role: &str,
        config: &SeamConfig,
        temperature: f64,
    ) -> Result<(Arc<dyn ChatModel<()>>, String), String> {
        let config = downcast_config(config).ok_or_else(|| CONFIG_UNAVAILABLE.to_string())?;
        crate::openhuman::inference::provider::create_chat_model_with_model_id(
            role,
            &config,
            temperature,
        )
        .map_err(|e| format!("{e:#}"))
    }

    fn usage_from_response(&self, response: &ModelResponse) -> Option<UsageInfo> {
        crate::openhuman::agent::tinyagents::model::usage_info_from_response(response)
    }

    fn summarizer_available(&self, config: &SeamConfig) -> (bool, &'static str) {
        match downcast_config(config) {
            Some(config) => {
                crate::openhuman::memory::tree::tree_runtime::ops::summarizer_available(&config)
            }
            None => (false, CONFIG_UNAVAILABLE),
        }
    }
}

// ── Composio ────────────────────────────────────────────────────────────────

/// Runs Composio calls for the memory sync pipelines.
#[derive(Debug)]
pub struct OpenHumanComposioHost;

#[async_trait]
impl ComposioHost for OpenHumanComposioHost {
    async fn list_connections(&self, config: &SeamConfig) -> Result<Vec<ComposioConnection>, String> {
        use crate::openhuman::integrations::composio::client::{
            create_composio_client, direct_list_connections, ComposioClientKind,
        };
        let config = downcast_config(config).ok_or_else(|| CONFIG_UNAVAILABLE.to_string())?;
        let response = match create_composio_client(&config)
            .map_err(|e| format!("create_composio_client: {e:#}"))?
        {
            ComposioClientKind::Backend(client) => client
                .list_connections()
                .await
                .map_err(|e| format!("list_connections (backend): {e:#}"))?,
            ComposioClientKind::Direct(direct) => {
                direct_list_connections(&direct).await.map_err(|e| {
                    // [#1166 / Sentry TAURI-RUST-X9] The v3 `/connected_accounts`
                    // 401 shape has to reach the observability classifier, and it
                    // only fires on a message carrying the `[composio-direct]`
                    // anchor. Render it here, where the direct client lives.
                    let rendered = format!("[composio-direct] list_connections (direct): {e:#}");
                    crate::openhuman::integrations::composio::ops::report_composio_op_error(
                        "list_connections",
                        &rendered,
                    );
                    rendered
                })?
            }
        };
        Ok(response.connections)
    }

    async fn execute(
        &self,
        config: &SeamConfig,
        tool: &str,
        arguments: Option<serde_json::Value>,
        entity_id: &str,
        connection_id: Option<&str>,
    ) -> Result<ComposioExecuteResponse, String> {
        use crate::openhuman::integrations::composio::client::{
            create_composio_client, direct_execute, ComposioClientKind,
        };
        let config = downcast_config(config).ok_or_else(|| CONFIG_UNAVAILABLE.to_string())?;
        match create_composio_client(&config).map_err(|e| format!("{e:#}"))? {
            ComposioClientKind::Backend(client) => client
                .execute_tool(tool, arguments)
                .await
                .map_err(|e| format!("{e:#}")),
            ComposioClientKind::Direct(direct) => {
                direct_execute(&direct, tool, arguments, entity_id, connection_id)
                    .await
                    .map_err(|e| format!("{e:#}"))
            }
        }
    }

    fn api_key(&self, config: &SeamConfig) -> Option<String> {
        let config = downcast_config(config)?;
        crate::openhuman::security::credentials::get_composio_api_key(&config)
            .ok()
            .flatten()
    }

    fn is_available(&self, config: &SeamConfig) -> bool {
        use crate::openhuman::integrations::composio::client::create_composio_client;
        downcast_config(config).is_some_and(|config| create_composio_client(&config).is_ok())
    }
}

// ── Config loading ──────────────────────────────────────────────────────────

/// Loads host configs for the memory subsystem's background loops.
#[derive(Debug)]
pub struct OpenHumanConfigLoader;

#[async_trait]
impl ConfigLoader for OpenHumanConfigLoader {
    async fn load(&self) -> Result<Box<SeamConfig>, String> {
        Ok(Box::new(
            crate::openhuman::config::rpc::load_config_with_timeout().await?,
        ))
    }

    async fn reload_snapshot(&self, snapshot: &SeamConfig) -> Result<Arc<SeamConfig>, String> {
        // Addressed by path, not by the whole config: the caller holds the
        // seam's trait object and cannot hand us a concrete `Config`.
        let config = crate::openhuman::config::rpc::reload_config_from_paths(
            snapshot.config_path(),
            snapshot.workspace_dir(),
        )
        .await?;
        Ok(Arc::new(config))
    }
}

// ── spaCy ───────────────────────────────────────────────────────────────────

/// Runs spaCy extraction through the host's Python runtime.
#[derive(Debug)]
pub struct OpenHumanNlpHost;

#[async_trait]
impl NlpHost for OpenHumanNlpHost {
    async fn extract_spacy(&self, config: &SeamConfig, text: &str) -> Result<SpacyResponse, String> {
        let config = downcast_config(config).ok_or_else(|| CONFIG_UNAVAILABLE.to_string())?;
        crate::openhuman::runtime::python_server::extract_spacy(&config, text)
            .await
            .map_err(|e| format!("{e:#}"))
    }
}

// ── Scheduler gate ──────────────────────────────────────────────────────────

/// Exposes the host's background-AI throttle.
#[derive(Debug)]
pub struct OpenHumanSchedulerGate;

#[async_trait]
impl SchedulerGate for OpenHumanSchedulerGate {
    fn current_policy(&self) -> Policy {
        crate::openhuman::cron::scheduler_gate::gate::current_policy()
    }

    fn resume_notify(&self) -> Arc<Notify> {
        crate::openhuman::cron::scheduler_gate::gate::resume_notify()
    }

    async fn wait_for_capacity(&self) -> Option<Box<dyn Send>> {
        crate::openhuman::cron::scheduler_gate::wait_for_capacity()
            .await
            .map(|permit| Box::new(permit) as Box<dyn Send>)
    }
}

// ── Shutdown ────────────────────────────────────────────────────────────────

/// Registers memory shutdown hooks with the host's shutdown sequencer.
#[derive(Debug)]
pub struct OpenHumanShutdownHost;

impl ShutdownHost for OpenHumanShutdownHost {
    fn register(&self, hook: ShutdownHook) {
        let hook = Arc::new(hook);
        crate::core::shutdown::register(move || {
            let hook = Arc::clone(&hook);
            async move { hook().await }
        });
    }
}

// ── Error reporting ─────────────────────────────────────────────────────────

/// Routes memory error reports into the host's observability pipeline.
#[derive(Debug)]
pub struct OpenHumanErrorReporter;

impl ErrorReporter for OpenHumanErrorReporter {
    fn report_error(&self, rendered: &str, domain: &str, operation: &str, tags: &[(&str, &str)]) {
        crate::core::observability::report_error(rendered, domain, operation, tags);
    }

    fn report_error_or_expected(
        &self,
        rendered: &str,
        domain: &str,
        operation: &str,
        tags: &[(&str, &str)],
    ) {
        crate::core::observability::report_error_or_expected(rendered, domain, operation, tags);
    }
}

// ── Wiring ──────────────────────────────────────────────────────────────────

/// Message used when a seam receives a config it cannot turn back into the
/// host's concrete `Config`.
const CONFIG_UNAVAILABLE: &str =
    "memory host seam received a config it cannot resolve to the host's Config";

/// Recover the host's concrete `Config` from the seam's trait object.
///
/// The seam is `dyn MemoryHostConfig`, and the host functions these impls
/// delegate to want `&Config`. Rather than downcast — which would fail for any
/// other implementor, including `TestHostConfig` — this re-reads the config the
/// seam points at. That is a file read per call on the paths that use it, which
/// is why the hot seams (embeddings) capture an `Arc<Config>` instead.
fn downcast_config(config: &SeamConfig) -> Option<Config> {
    crate::openhuman::config::Config::load_from_config_path_blocking(
        config.config_path(),
        config.workspace_dir(),
    )
    .ok()
}

/// Install every host seam into `tinymemory-core`.
///
/// Call once during startup wiring, **before any memory work begins** — the
/// embedding, chat, Composio and config seams all fail loudly when unwired, by
/// design, because degrading quietly would corrupt an embedding space or make a
/// sync run look empty rather than broken.
pub fn install_memory_host_seams(config: Arc<Config>) {
    tinymemory_core::embedding_host::set_embedding_host(Arc::new(OpenHumanEmbeddingHost {
        config,
    }));
    tinymemory_core::chat_host::set_chat_host(Arc::new(OpenHumanChatHost));
    tinymemory_core::composio_host::set_composio_host(Arc::new(OpenHumanComposioHost));
    tinymemory_core::config_loader::set_config_loader(Arc::new(OpenHumanConfigLoader));
    tinymemory_core::nlp_host::set_nlp_host(Arc::new(OpenHumanNlpHost));
    tinymemory_core::scheduler_gate::set_scheduler_gate(Arc::new(OpenHumanSchedulerGate));
    tinymemory_core::shutdown::set_shutdown_host(Arc::new(OpenHumanShutdownHost));
    tinymemory_core::observability::set_error_reporter(Arc::new(OpenHumanErrorReporter));
    super::host::install_memory_event_sink();
    log::debug!("[memory:host] all seam implementations installed");
}
