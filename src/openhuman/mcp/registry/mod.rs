//! MCP Registry — the host half of the user-installed server surface.
//!
//! The registry itself moved to `tinymcp`: the Smithery and official catalogs,
//! the SQLite store, the live connection map, the subprocess supervisor, the
//! browser sign-in flow, and the setup secret vault all live there now. What is
//! left here is what belongs to *this* application.
//!
//! # Modules
//!
//! - [`bus`] — the lifecycle subscriber that logs this domain's events.
//! - [`ops`] — the `mcp_clients` RPC handlers, delegating to the service
//!   [`super::host`] holds and publishing this application's own events.
//! - [`setup_ops`] — the `mcp_setup` handlers, likewise.
//! - `schemas` — the controller schemas and dispatch.
//! - [`tools`] — the agent-facing tools.
//!
//! # The naming note still applies
//!
//! The RPC namespace and the database filename are `mcp_clients`, unchanged, so
//! existing frontend code and existing on-disk state keep working across the
//! move.
//!
//! # Types come from the contract
//!
//! Everything this module used to define — the install record, the tool shape,
//! the status summary, the catalog records — is re-exported from
//! `tinymcp_bus`. A parallel set of types here would mean a conversion at every
//! call site that nothing checks.

#[cfg(feature = "mcp")]
pub mod bus;
#[cfg(feature = "mcp")]
pub mod ops;
#[cfg(feature = "mcp")]
mod schemas;
#[cfg(feature = "mcp")]
pub mod setup_ops;
#[cfg(feature = "mcp")]
pub mod tools;

#[cfg(feature = "mcp")]
pub use schemas::{
    all_controller_schemas as all_mcp_registry_controller_schemas,
    all_registered_controllers as all_mcp_registry_registered_controllers,
    schemas as mcp_registry_schemas,
};

/// The payload vocabulary, from the wire contract.
///
/// Re-exported under the path this module used to define them at, so callers
/// keep their spelling.
pub mod types {
    pub use tinymcp_bus::{
        ChatTurn, CommandKind, ConnStatus, ConnectedServerOverview, InstalledServer, McpTool,
        RegistryConnection as SmitheryConnection, RegistryServerDetail as SmitheryServerDetail,
        RegistryServerSummary as SmitheryServerSummary, ServerStatus, Transport,
    };
}

pub use types::{ConnStatus, InstalledServer, McpTool};

/// The live connection map.
///
/// A thin view over the service [`super::host`] holds. It exists because the
/// map used to be a process global and callers reached it through free
/// functions; `tinymcp` owns it instead, so those functions become lookups
/// through the holder. Everything here answers as though nothing were connected
/// when the service is not up yet, which is what a caller running before boot
/// completes should see.
#[cfg(feature = "mcp")]
pub mod connections {
    pub use tinymcp_bus::ConnectedServerOverview;

    use crate::openhuman::mcp::host;

    /// Every connected server's identity and advertised tools.
    ///
    /// Sorted by qualified name, so a prompt built from this does not reshuffle
    /// between turns and cost its cached prefix.
    pub async fn connected_overview() -> Vec<ConnectedServerOverview> {
        match host::try_service() {
            Some(service) => service.dynamic().connected_overview().await,
            None => Vec::new(),
        }
    }

    /// Every tool on every connected server, paired with its server.
    pub async fn all_connected_tools() -> Vec<(String, String, tinymcp_bus::McpTool)> {
        match host::try_service() {
            Some(service) => service.dynamic().connections().all_connected_tools().await,
            None => Vec::new(),
        }
    }

    /// The tools one connected server advertises, or `None` when it is not
    /// connected.
    pub async fn tools_for(server_id: &str) -> Option<Vec<tinymcp_bus::McpTool>> {
        host::try_service()?
            .dynamic()
            .connections()
            .tools_for(server_id)
            .await
    }

    /// Whether a server has a live entry.
    pub async fn is_connected(server_id: &str) -> bool {
        match host::try_service() {
            Some(service) => {
                service
                    .dynamic()
                    .connections()
                    .is_connected(server_id)
                    .await
            }
            None => false,
        }
    }

    /// Why a server's most recent attempt hit a 401, as a stable code.
    pub async fn auth_hint_for(server_id: &str) -> Option<&'static str> {
        Some(
            host::try_service()?
                .dynamic()
                .connections()
                .auth_hint(server_id)
                .await?
                .as_code(),
        )
    }

    /// The most recent failure message for a server.
    pub async fn last_error_for(server_id: &str) -> Option<String> {
        host::try_service()?
            .dynamic()
            .connections()
            .last_error(server_id)
            .await
    }
}

/// Bringing installed servers up at startup.
#[cfg(feature = "mcp")]
pub mod boot {
    use crate::openhuman::config::Config;
    use crate::openhuman::mcp::host;

    /// Connects every enabled installed server.
    ///
    /// Never fails: a server that cannot connect is logged and skipped, because
    /// one broken third-party integration must not stop the core coming up.
    pub async fn spawn_installed_servers(config: &Config) {
        let Some(service) = host::try_service() else {
            tracing::warn!("[mcp] the service is not initialised; skipping the startup connect");
            return;
        };

        let client = host::client_config(config);
        let outcome = tinymcp::registry::connect_installed_servers(
            service.dynamic().store(),
            service.dynamic().connections(),
            service.dynamic().oauth(),
            &client.client_identity,
            client.proxy.as_ref(),
        )
        .await;

        tracing::info!(
            connected = outcome.connected,
            failed = outcome.failed,
            skipped = outcome.skipped,
            "[mcp] startup connect finished"
        );
    }
}

/// Keeping installed servers connected.
#[cfg(feature = "mcp")]
pub mod supervisor {
    use crate::openhuman::config::Config;
    use crate::openhuman::mcp::host;

    /// Runs the reconnect supervisor until the process ends.
    pub async fn run(config: Config) {
        let Some(service) = host::try_service() else {
            tracing::warn!("[mcp] the service is not initialised; the supervisor will not run");
            return;
        };

        let client = host::client_config(&config);
        let supervisor = tinymcp::Supervisor::new(
            tinymcp::SupervisorConfig::default(),
            client.client_identity.clone(),
            client.proxy.clone(),
        );

        supervisor
            .run(
                service.dynamic().store(),
                service.dynamic().connections(),
                service.dynamic().oauth(),
            )
            .await;
    }
}

/// Browser sign-in, from the callback route's point of view.
#[cfg(feature = "mcp")]
pub mod oauth {
    use crate::openhuman::config::Config;
    use crate::openhuman::mcp::host;

    /// Finishes a sign-in from the redirect and reconnects the server.
    ///
    /// # Errors
    ///
    /// Returns a message when the state is unknown or expired, or when the
    /// token exchange fails.
    pub async fn complete(_config: &Config, state: &str, code: &str) -> Result<String, String> {
        let outcome = host::service()?
            .dynamic()
            .oauth_complete(state, code)
            .await
            .map_err(|error| error.to_string())?;

        Ok(outcome.server_id)
    }
}

/// Applies this application's prompt-injection policy to remote tool
/// definitions.
///
/// `tinymcp` returns definitions verbatim: the detector, its rules, and what a
/// hit means are this application's, and a module dropping tools by criteria of
/// its own would be making a decision it cannot explain to anyone.
///
/// A tool whose description or title trips a rule is dropped, and the drop is
/// logged and published with the *rule code* only — the offending text is never
/// re-emitted, because the payload is the thing that was dangerous.
#[cfg(feature = "mcp")]
pub(crate) fn tools_safe_for_agent(
    server: &str,
    tools: Vec<tinymcp_bus::McpTool>,
) -> Vec<tinymcp_bus::McpTool> {
    use crate::core::bus::BUS;
    use crate::core::events::DomainEvent;
    use crate::openhuman::security::prompt_injection::scan_tool_definition;

    tools
        .into_iter()
        .filter(|tool| {
            let hit = tool
                .description
                .as_deref()
                .and_then(|text| scan_tool_definition("description", text));

            match hit {
                Some(hit) => {
                    tracing::warn!(
                        server,
                        tool = %tool.name,
                        reason = %hit.code,
                        "[mcp] dropped a remote tool that tripped the input-validation scan"
                    );
                    BUS.publish(DomainEvent::McpToolRejected {
                        server: server.to_string(),
                        tool: tool.name.clone(),
                        reason: hit.code.clone(),
                    });
                    false
                }
                None => true,
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Disabled facade — compiled only when the `mcp` feature is OFF.
// ---------------------------------------------------------------------------

#[cfg(not(feature = "mcp"))]
mod stub;
#[cfg(not(feature = "mcp"))]
pub use stub::*;
