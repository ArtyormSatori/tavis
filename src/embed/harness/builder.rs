//! Assembling a [`Harness`].
//!
//! The builder's whole job is to turn typed inputs into one in-memory
//! [`Config`] plus a [`DomainSet`]/[`ServiceSet`] pair, then hand them to
//! [`CoreBuilder`]. Nothing here mutates the process environment — which is the
//! point, and the difference from every hand-rolled embedder in this tree.

use std::path::PathBuf;
use std::sync::Arc;

use super::access::Access;
use super::error::HarnessError;
use super::provider::Provider;
use super::workspace::{ResolvedWorkspace, Workspace};
use super::{Harness, HARNESS_LIVE};
use crate::core::runtime::{CoreBuilder, DomainSet, ServiceSet, TokenSource};
use crate::core::types::HostKind;
use crate::embed::{Core, Session};
use crate::openhuman::config::Config;

/// Builder for a [`Harness`]. Obtain with [`Harness::builder`].
pub struct HarnessBuilder {
    workspace: Workspace,
    action_dir: Option<PathBuf>,
    provider: Provider,
    access: Access,
    skills_dir: Option<PathBuf>,
    #[cfg(feature = "mcp")]
    mcp_servers: Vec<super::mcp::McpServer>,
    services: Option<ServiceSet>,
    domains: Option<DomainSet>,
    host_kind: HostKind,
    config: Option<Config>,
    session: Option<Session>,
}

impl Default for HarnessBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl HarnessBuilder {
    /// A builder with safe defaults: an ephemeral workspace, the machine's
    /// configured inference, and the supervised access tier.
    pub fn new() -> Self {
        Self {
            workspace: Workspace::default(),
            action_dir: None,
            provider: Provider::inherit(),
            access: Access::default(),
            skills_dir: None,
            #[cfg(feature = "mcp")]
            mcp_servers: Vec::new(),
            services: None,
            domains: None,
            host_kind: HostKind::Cli,
            config: None,
            session: None,
        }
    }

    /// Where the harness keeps sessions, memory and skills.
    pub fn workspace(mut self, workspace: Workspace) -> Self {
        self.workspace = workspace;
        self
    }

    /// The agent's read/write root for acting tools.
    ///
    /// Defaults to a directory alongside the workspace. Set it to point the
    /// agent at a project you want it to work in — this is the directory whose
    /// contents it can change.
    pub fn action_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.action_dir = Some(dir.into());
        self
    }

    /// Which model answers, and where the request goes.
    pub fn provider(mut self, provider: Provider) -> Self {
        self.provider = provider;
        self
    }

    /// What the agent is allowed to do. Defaults to [`Access::supervised`].
    pub fn access(mut self, access: Access) -> Self {
        self.access = access;
        self
    }

    /// Make the skill bundles in `dir` available to the agent.
    ///
    /// The bundles are **copied** into the workspace's skills root — see the
    /// [`skills`](super::skills) module docs for why linking cannot work. Not
    /// permitted with [`Workspace::Inherit`], which would leave them in the
    /// operator's own install.
    #[cfg(feature = "skills")]
    pub fn skills_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.skills_dir = Some(dir.into());
        self
    }

    /// Declare an MCP server the agent may call tools on.
    ///
    /// Call repeatedly to add several. Servers are fixed once the harness is
    /// built; the static registry has no add-at-runtime path.
    #[cfg(feature = "mcp")]
    pub fn mcp(mut self, server: super::mcp::McpServer) -> Self {
        self.mcp_servers.push(server);
        self
    }

    /// Override which background services run.
    ///
    /// The default is deliberately minimal — see [`Harness`] — because cron,
    /// heartbeat and the memory queue are what make a second core in the same
    /// process corrupt shared state. Widen it only if you need what they do.
    pub fn services(mut self, services: ServiceSet) -> Self {
        self.services = Some(services);
        self
    }

    /// Override which domain families exist at runtime.
    ///
    /// The default derives from what you configured — enabling `mcp` when you
    /// declared a server, `skills` when you pointed at a directory — so this is
    /// for narrowing further or for reaching a family the builder does not
    /// model.
    pub fn domains(mut self, domains: DomainSet) -> Self {
        self.domains = Some(domains);
        self
    }

    /// Identify the host to the core. Defaults to [`HostKind::Cli`], the
    /// standalone bootstrap path.
    pub fn host_kind(mut self, host_kind: HostKind) -> Self {
        self.host_kind = host_kind;
        self
    }

    /// Install a session before the first turn.
    ///
    /// Routing a turn at a custom provider is gated on an active app session
    /// (`verify_session_active`), so a harness given its own endpoint and key
    /// **still needs one** — the gate cannot distinguish a library host from an
    /// unregistered desktop user trying to skip registration.
    ///
    /// [`Session::backend`] for a real JWT; [`Session::local`] for a host that
    /// brings its own provider credentials and needs nothing from the backend.
    pub fn session(mut self, session: Session) -> Self {
        self.session = Some(session);
        self
    }

    /// Start from a caller-supplied [`Config`] instead of the default.
    ///
    /// Every other builder method is applied **on top** of it, so this is the
    /// escape hatch for the ~200 config fields the harness does not model — not
    /// a way to bypass them.
    pub fn config(mut self, config: Config) -> Self {
        self.config = Some(config);
        self
    }

    /// Build the core and return a harness ready to run turns.
    ///
    /// # Errors
    ///
    /// [`HarnessError::AlreadyRunning`] if this process already has one; see
    /// that variant's docs for why that is a property of the core rather than
    /// of the harness.
    pub async fn build(self) -> Result<Harness, HarnessError> {
        // Claim the process slot before doing any work, so a losing racer
        // neither creates a temp dir nor half-initializes global state.
        if HARNESS_LIVE.swap(true, std::sync::atomic::Ordering::AcqRel) {
            return Err(HarnessError::AlreadyRunning);
        }
        // From here on every early return must release the slot, or a failed
        // build would permanently poison the process against retrying.
        match self.build_inner().await {
            Ok(harness) => Ok(harness),
            Err(e) => {
                HARNESS_LIVE.store(false, std::sync::atomic::Ordering::Release);
                Err(e)
            }
        }
    }

    async fn build_inner(self) -> Result<Harness, HarnessError> {
        let inherit = self.workspace.is_operator_owned();

        if self.skills_dir.is_some() && inherit {
            return Err(HarnessError::Invalid(
                "skills_dir cannot be used with Workspace::Inherit: installing them would \
                 write bundles into the operator's own skills root, where they would \
                 outlive this process and shadow installed skills. Use \
                 Workspace::Ephemeral or Workspace::Dir."
                    .to_string(),
            ));
        }

        let resolved = ResolvedWorkspace::resolve(&self.workspace, self.action_dir.as_deref())?;

        // Build the config the core will run on. Under `Inherit` we pass no
        // config at all, so `Config::load_or_init` resolves the operator's the
        // usual way — then the knobs are applied to what it produced.
        let mut config = match (&self.workspace, self.config) {
            (Workspace::Inherit, Some(config)) => Some(config),
            (Workspace::Inherit, None) => None,
            (_, supplied) => {
                let mut config = supplied.unwrap_or_default();
                config.workspace_dir = resolved.workspace_dir.clone();
                config.action_dir = resolved.action_dir.clone();
                // Credential state, auth profiles and the keyring file backend
                // all resolve against this path's parent, not against
                // `workspace_dir`. Setting only the workspace produces a
                // harness that looks hermetic and reads the operator's real
                // credentials.
                config.config_path = resolved.config_path.clone();
                Some(config)
            }
        };

        if let Some(config) = config.as_mut() {
            self.access.apply(config);
            apply_provider(config, &self.provider);

            #[cfg(feature = "mcp")]
            if !self.mcp_servers.is_empty() {
                config.mcp_client.enabled = true;
                config.mcp_client.servers.extend(
                    self.mcp_servers
                        .iter()
                        .cloned()
                        .map(super::mcp::McpServer::into_config),
                );
            }
        }

        #[cfg(feature = "skills")]
        if let Some(dir) = self.skills_dir.as_deref() {
            super::skills::install(dir, &resolved.workspace_dir)?;
        }

        let domains = self.domains.unwrap_or_else(|| {
            let mut domains = DomainSet::embedded();
            // `embedded()` leaves both off. Turn on only what was asked for:
            // an MCP domain with no servers costs ~19 agent tools of prompt
            // budget on every turn for nothing.
            #[cfg(feature = "mcp")]
            {
                domains.mcp = !self.mcp_servers.is_empty();
            }
            #[cfg(feature = "skills")]
            {
                domains.skills = self.skills_dir.is_some();
            }
            domains
        });

        let services = self.services.unwrap_or_else(default_services);

        log::debug!(
            "[embed][harness] building host_kind={:?} inherit_workspace={inherit} \
             routed_provider={} domains={domains:?}",
            self.host_kind,
            self.provider.is_routed(),
        );

        let mut builder = CoreBuilder::new(self.host_kind)
            .domains(domains)
            .services(services)
            .token(TokenSource::EnvOrFile);
        if let Some(config) = config {
            builder = builder.config(config);
        }

        let runtime = builder.build().await.map_err(HarnessError::Build)?;
        let core = Core::from_runtime(Arc::new(runtime));

        // After the build, because storing a session is an ordinary RPC and
        // needs a dispatchable core. Before returning, so the harness a caller
        // receives is one whose first turn will not fail the provider gate.
        if let Some(session) = self.session {
            core.auth().store(session).await?;
        }

        Ok(Harness {
            core,
            provider: self.provider,
            access: self.access,
            _workspace: resolved,
        })
    }
}

/// Apply a [`Provider`]'s model to the config.
///
/// Only the model: the *route* is a per-turn parameter, never a config write,
/// because config routes persist. See the [`provider`](super::provider) module
/// docs. The model does belong here — the route pins its roles to
/// `"<slug>:<model>"` using the model the call resolved, so the endpoint is
/// ignored outright when no model resolves.
fn apply_provider(config: &mut Config, provider: &Provider) {
    if let Some(model) = provider.model_id() {
        config.default_model = Some(model.to_string());
    }
}

/// Background services a harness runs by default.
///
/// Starts from [`ServiceSet::none`] and adds only `harness_init`, the step that
/// prepares the agent harness itself. Notably **not**
/// [`ServiceSet::embedded`]: its cron, heartbeat and memory-queue services each
/// write to the workspace on their own schedule, which turns a library call
/// into a background process the caller did not ask for and makes concurrent
/// harnesses unsafe.
fn default_services() -> ServiceSet {
    ServiceSet {
        harness_init: true,
        ..ServiceSet::none()
    }
}

#[cfg(test)]
#[path = "builder_tests.rs"]
mod tests;
