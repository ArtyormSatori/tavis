//! The `tinymcp` service this process holds, and the conversion into it.
//!
//! The MCP client lives in `tinymcp` now. What is left here is the host half:
//! this holder, the RPC surface over it, the agent-facing tools, and the
//! prompt-injection scan over remote tool definitions.
//!
//! # Why a holder exists at all
//!
//! Before the extraction the connection map, the pending-authorization map and
//! the secret vault were process globals, so every caller reached them by
//! calling a free function. `tinymcp` owns them instead — a library that
//! installed globals would make two hosts in one process share connections, and
//! would make its own tests order-dependent. So one instance lives here, and
//! the free functions callers used become methods on it.
//!
//! # It is initialised once, at boot
//!
//! [`init`] is called from the core startup path, before anything that might
//! reach for a server. A caller that arrives before then gets `None` rather
//! than a lazily-built service on a configuration nobody chose.
//!
//! # The proxy decision is made here
//!
//! `tinymcp` takes an already-resolved proxy rather than a policy: whether a
//! proxy applies to a given service is decided by this application's scope
//! setting, its per-service list and its no-proxy list, and all three live
//! here. [`proxy_for_mcp`] consults them and hands over the answer.

use std::sync::OnceLock;

use tinymcp::{
    AuditStore, McpClientConfig, McpProxyConfig, McpRegistry, McpServerConfig, McpServerRegistry,
    Store,
};

use crate::openhuman::config::Config;

/// The service key MCP traffic is scoped under for proxy decisions.
const PROXY_SERVICE_KEY: &str = "tool.mcp_client";

/// The port the core serves on when nothing says otherwise.
const DEFAULT_CORE_PORT: u16 = 7788;

/// The one service this process holds.
static SERVICE: OnceLock<McpHost> = OnceLock::new();

/// The three pieces of `tinymcp` this application drives.
///
/// Held together rather than separately because they are initialised from one
/// configuration and share a lifetime. This is the same shape `tinymcp`'s own
/// bus adapter assembles; that adapter is not used here, because a host calling
/// the library directly has no use for a bus inside it.
#[derive(Debug)]
pub struct McpHost {
    dynamic: McpRegistry,
    static_servers: McpServerRegistry,
    audit: AuditStore,
}

impl McpHost {
    /// Builds a host from `config`, without installing it as the process one.
    ///
    /// [`init`] uses this and then installs the result. It is public so a test
    /// can drive a host over its own workspace: the process-wide one is a
    /// `OnceLock`, and a suite that needs a fresh store per case cannot share
    /// it.
    ///
    /// # Errors
    ///
    /// Returns an error when either store cannot be opened, or when an HTTP
    /// client cannot be built.
    pub fn open(config: &Config) -> anyhow::Result<Self> {
        let client = client_config(config);
        let workspace = config.workspace_dir.as_path();

        Ok(Self {
            dynamic: McpRegistry::new(
                Store::open(workspace)
                    .map_err(|error| anyhow::anyhow!("failed to open the mcp store: {error}"))?,
                client.registry_auth.clone(),
                client.client_identity.clone(),
                client.proxy.clone(),
            )
            .map_err(|error| anyhow::anyhow!("failed to start the mcp registry: {error}"))?,
            static_servers: McpServerRegistry::from_config(&client).map_err(|error| {
                anyhow::anyhow!("failed to build the static server set: {error}")
            })?,
            audit: AuditStore::open(workspace)
                .map_err(|error| anyhow::anyhow!("failed to open the mcp audit log: {error}"))?,
        })
    }

    /// The user-installed servers, their connections, and the catalogs.
    #[must_use]
    pub fn dynamic(&self) -> &McpRegistry {
        &self.dynamic
    }

    /// The servers declared in this application's own configuration.
    #[must_use]
    pub fn static_servers(&self) -> &McpServerRegistry {
        &self.static_servers
    }

    /// The write-audit log.
    #[must_use]
    pub fn audit(&self) -> &AuditStore {
        &self.audit
    }
}

/// Builds the service from `config` and installs it.
///
/// Called once, from the core startup path. A second call is a no-op and is
/// reported, rather than silently replacing a service that already holds live
/// connections.
///
/// # Errors
///
/// Returns an error when the stores cannot be opened or an HTTP client cannot
/// be built. A caller should log and continue: MCP being unavailable must not
/// stop the core coming up.
pub fn init(config: &Config) -> anyhow::Result<()> {
    if SERVICE.get().is_some() {
        tracing::debug!("[mcp] the service was already initialised; leaving it alone");
        return Ok(());
    }

    let service = McpHost::open(config)?;

    SERVICE
        .set(service)
        .map_err(|_| anyhow::anyhow!("the mcp service was initialised concurrently"))?;

    tracing::info!("[mcp] service initialised");
    Ok(())
}

/// The service, or `None` before [`init`] has run.
///
/// Callers on a path that can run before boot completes should handle `None`
/// rather than assume it.
pub fn try_service() -> Option<&'static McpHost> {
    SERVICE.get()
}

/// The service, erroring when it is not up yet.
///
/// # Errors
///
/// Returns a message naming the state, so an RPC caller learns the core is
/// still starting rather than that their server does not exist.
pub fn service() -> Result<&'static McpHost, String> {
    try_service().ok_or_else(|| "the mcp service is not initialised yet".to_string())
}

/// Converts the MCP section of this application's configuration.
pub fn client_config(config: &Config) -> McpClientConfig {
    let mut client = McpClientConfig {
        enabled: config.mcp_client.enabled,
        servers: config
            .mcp_client
            .servers
            .iter()
            .map(server_config)
            .collect(),
        proxy: proxy_for_mcp(),
        ..McpClientConfig::default()
    };

    client.client_identity.name = config.mcp_client.client_identity.name.clone();
    client.client_identity.title = config.mcp_client.client_identity.title.clone();
    client.client_identity.version = config.mcp_client.client_identity.version.clone();

    client
        .registry_auth
        .smithery_api_key
        .clone_from(&config.mcp_client.registry_auth.smithery_api_key);
    client
        .registry_auth
        .mcp_official_base
        .clone_from(&config.mcp_client.registry_auth.mcp_official_base);
    client
        .registry_auth
        .mcp_official_token
        .clone_from(&config.mcp_client.registry_auth.mcp_official_token);

    // The documentation server is seeded here rather than by the module: it is
    // this application's own, and `tinymcp` has no business knowing about it.
    if config.gitbooks.enabled
        && !client
            .servers
            .iter()
            .any(|server| server.name == GITBOOKS_SERVER_NAME)
    {
        client.servers.push(McpServerConfig {
            name: GITBOOKS_SERVER_NAME.to_string(),
            endpoint: config.gitbooks.endpoint.clone(),
            description: Some("OpenHuman GitBook documentation MCP server.".to_string()),
            timeout_secs: config.gitbooks.timeout_secs,
            ..McpServerConfig::default()
        });
    }

    client
}

/// The name the documentation server is registered under.
pub const GITBOOKS_SERVER_NAME: &str = "gitbooks";

/// Converts one declared server.
fn server_config(server: &crate::openhuman::config::McpServerConfig) -> McpServerConfig {
    McpServerConfig {
        name: server.name.clone(),
        endpoint: server.endpoint.clone(),
        command: server.command.clone(),
        args: server.args.clone(),
        // Ordered on the way across, so the serialized form does not depend on
        // hash iteration order.
        env: server
            .env
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
        cwd: server.cwd.clone(),
        description: server.description.clone(),
        enabled: server.enabled,
        allowed_tools: server.allowed_tools.clone(),
        disallowed_tools: server.disallowed_tools.clone(),
        timeout_secs: server.timeout_secs,
        auth: auth_config(&server.auth),
    }
}

/// Converts one server's credentials.
fn auth_config(auth: &crate::openhuman::config::McpAuthConfig) -> tinymcp::McpAuthConfig {
    use crate::openhuman::config::McpAuthConfig as Host;
    use tinymcp::McpAuthConfig as Module;

    match auth {
        Host::None => Module::None,
        Host::BearerToken { token } => Module::BearerToken {
            token: token.clone(),
        },
        Host::Basic { username, password } => Module::Basic {
            username: username.clone(),
            password: password.clone(),
        },
        Host::Header { name, value } => Module::Header {
            name: name.clone(),
            value: value.clone(),
        },
        Host::Headers { headers } => Module::Headers {
            headers: headers
                .iter()
                .map(|header| tinymcp::HttpHeader::new(&header.name, &header.value))
                .collect(),
        },
        Host::QueryParam { name, value } => Module::QueryParam {
            name: name.clone(),
            value: value.clone(),
        },
    }
}

/// The statically declared server set, built from this application's
/// configuration.
///
/// A set that cannot be built — a malformed proxy, an unusable TLS setting — is
/// logged and reported as empty. Those conditions affect every server equally,
/// and taking the whole tool surface down over one of them helps nobody: the
/// agent loses its MCP tools either way, and an empty set says so without also
/// failing whatever else was being assembled.
#[must_use]
pub fn static_registry(config: &Config) -> McpServerRegistry {
    match McpServerRegistry::from_config(&client_config(config)) {
        Ok(registry) => registry,
        Err(error) => {
            tracing::warn!("[mcp] could not build the static server set: {error}");
            McpServerRegistry::default()
        }
    }
}

/// The loopback address a browser sign-in redirects back to.
///
/// `tinymcp` takes this rather than deriving it, and correctly: only this
/// application knows which port it actually bound, which may not be the one it
/// asked for. A wrong guess sends the browser to a dead listener, where sign-in
/// simply hangs with nothing to explain it.
///
/// In order: the address the core advertised after binding, then the requested
/// port, then the default.
pub fn oauth_redirect_uri() -> String {
    let port = advertised_port()
        .or_else(|| {
            std::env::var("OPENHUMAN_CORE_PORT")
                .ok()
                .and_then(|value| value.trim().parse::<u16>().ok())
        })
        .unwrap_or(DEFAULT_CORE_PORT);

    format!("http://127.0.0.1:{port}/oauth/mcp/callback")
}

/// The port the core actually bound, read from what it advertised.
///
/// Authoritative when present: it reflects any fallback the core took when its
/// preferred port was busy.
fn advertised_port() -> Option<u16> {
    let advertised = std::env::var("OPENHUMAN_CORE_RPC_URL").ok()?;
    explicit_port(&advertised)
}

/// The explicit port in a URL, or `None` when it names none.
///
/// Kept separate so it is testable without touching the process environment.
fn explicit_port(url: &str) -> Option<u16> {
    reqwest::Url::parse(url).ok().and_then(|url| url.port())
}

/// The proxy MCP traffic should use, or `None` to connect directly.
///
/// Resolved here because the *policy* lives here: the scope setting, the
/// per-service list and the no-proxy list are this application's, and sending
/// the decision rather than the policy keeps them in the one place that owns
/// them.
pub fn proxy_for_mcp() -> Option<McpProxyConfig> {
    let proxy = crate::openhuman::config::runtime_proxy_config();

    if !proxy.should_apply_to_service(PROXY_SERVICE_KEY) {
        return None;
    }

    Some(McpProxyConfig {
        http_proxy: proxy.http_proxy.clone(),
        https_proxy: proxy.https_proxy.clone(),
        all_proxy: proxy.all_proxy.clone(),
        no_proxy: proxy.no_proxy.clone(),
    })
}

#[cfg(test)]
#[path = "host_tests.rs"]
mod tests;
