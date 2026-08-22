//! MCP family — the host half of Model Context Protocol support.
//!
//! The client moved out to `tinymcp`: both transports, the static
//! config-declared server set, the dynamic registry with its store, supervisor
//! and browser sign-in, and the write-audit log all live there now.
//!
//! What is here is what belongs to this application.
//!
//! # Members
//!
//! - [`host`] — the one `tinymcp` service this process holds, and the
//!   conversion from this application's configuration into what it takes.
//! - [`registry`] — the `mcp_clients` and `mcp_setup` RPC surface, the
//!   agent-facing tools, and the prompt-injection scan over remote tool
//!   definitions.
//! - [`audit`] — the RPC surface over the write-audit log.
//! - [`server`] — the `openhuman mcp` stdio and HTTP server that exposes this
//!   application's own tools to external MCP hosts. This is the *server* side
//!   and did not move: it is bound to the tool registry, the permission model
//!   and the agent turn machinery, none of which a client library should know
//!   about.
//!
//! # Where the boundary fell
//!
//! Three things stayed on purpose, and each is host policy rather than
//! protocol:
//!
//! **Prompt-injection detection** over remote tool definitions. The detector,
//! its rules, and what a hit means belong to this application's threat model. A
//! module dropping tools by criteria of its own would be making a decision it
//! could not explain. The *lexical* half — control characters, prompt-template
//! fences, length caps — does live in the contract, applied by the display
//! accessors on every remote description.
//!
//! **Events.** `tinymcp` reports what happened in its return values. Turning
//! that into a `DomainEvent` happens here, where the vocabulary is known.
//!
//! **The proxy decision.** Whether a proxy applies to MCP traffic is decided by
//! this application's scope setting, per-service list and no-proxy list.
//! [`host::proxy_for_mcp`] consults them and hands `tinymcp` the answer.
//!
//! # Compile-time gate (`mcp` feature)
//!
//! `pub mod mcp;` is always compiled — the family root is a facade. `registry`
//! and `audit` keep their own gate and their `stub`, so a build without the
//! feature still serves `/rpc` without those namespaces.

pub mod audit;
// Ungated, like the transport below and for the same reason: `tinymcp` is an
// ordinary dependency, and the startup path calls `host::init` without a `cfg`
// of its own. Gating this would break the build with the domain turned off.
pub mod host;
pub mod registry;
pub mod server;

/// The Streamable HTTP transport, from the wire contract's implementation.
///
/// Re-exported under the path this module used to define it at. The bespoke
/// documentation tool and the observability classifier both name these, and
/// neither is gated — so this is not either, exactly as before the extraction.
pub mod http_client {
    pub use tinymcp::transport::http::{McpHttpClient, McpHttpClientBuilder};
    pub use tinymcp::{redact_endpoint, render_tool_result};
    pub use tinymcp_bus::{
        AuthorizationServerMetadata, McpAuthChallenge, McpAuthorizationContext,
        McpInitializeResult, McpRemoteTool, McpServerToolResult, McpSseEvent,
        ProtectedResourceMetadata,
    };
}

/// The statically declared server set, from the wire contract's
/// implementation.
#[cfg(feature = "mcp")]
pub mod config_servers {
    pub use tinymcp::transport::stdio::McpStdioClient;
    pub use tinymcp::{
        McpRegistrySource, McpServerDefinition, McpServerRegistry, McpTransportClient,
    };
}
