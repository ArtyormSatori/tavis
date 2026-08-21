//! Unit tests for the configuration conversion.
//!
//! This is the one place two vocabularies meet, and a field dropped in the
//! conversion is silent: the server simply behaves as though the user never set
//! it. Each field is checked individually for that reason.

use super::*;
use crate::openhuman::config::{Config, HttpHeader, McpAuthConfig, McpServerConfig as HostServer};
use std::collections::HashMap;

/// A configuration with the documentation server turned off, so the tests that
/// count servers are not counting it.
fn config_without_docs() -> Config {
    let mut config = Config::default();
    config.gitbooks.enabled = false;
    config
}

/// A declared server with every field set to something distinguishable.
fn populated_server() -> HostServer {
    HostServer {
        name: "weather".into(),
        endpoint: "https://example.test/mcp".into(),
        command: "npx".into(),
        args: vec!["-y".into(), "weather-mcp".into()],
        env: HashMap::from([("API_KEY".to_string(), "secret".to_string())]),
        cwd: Some("/tmp".into()),
        description: Some("Weather lookups".into()),
        enabled: false,
        allowed_tools: vec!["forecast".into()],
        disallowed_tools: vec!["debug".into()],
        timeout_secs: 9,
        auth: McpAuthConfig::BearerToken { token: "t".into() },
    }
}

#[test]
fn every_field_of_a_declared_server_survives_the_conversion() {
    let mut config = config_without_docs();
    config.mcp_client.servers.push(populated_server());

    let converted = client_config(&config);
    let server = converted.servers.first().expect("the server");

    assert_eq!(server.name, "weather");
    assert_eq!(server.endpoint, "https://example.test/mcp");
    assert_eq!(server.command, "npx");
    assert_eq!(server.args, ["-y", "weather-mcp"]);
    assert_eq!(
        server.env.get("API_KEY").map(String::as_str),
        Some("secret")
    );
    assert_eq!(server.cwd.as_deref(), Some("/tmp"));
    assert_eq!(server.description.as_deref(), Some("Weather lookups"));
    assert!(!server.enabled);
    assert_eq!(server.allowed_tools, ["forecast"]);
    assert_eq!(server.disallowed_tools, ["debug"]);
    assert_eq!(server.timeout_secs, 9);
    assert_eq!(
        server.auth,
        tinymcp::McpAuthConfig::BearerToken { token: "t".into() }
    );
}

#[test]
fn every_credential_kind_converts() {
    // A variant dropped here silently sends no credential at all, which
    // surfaces as an unexplained 401.
    let cases = [
        (McpAuthConfig::None, tinymcp::McpAuthConfig::None),
        (
            McpAuthConfig::BearerToken { token: "t".into() },
            tinymcp::McpAuthConfig::BearerToken { token: "t".into() },
        ),
        (
            McpAuthConfig::Basic {
                username: "u".into(),
                password: "p".into(),
            },
            tinymcp::McpAuthConfig::Basic {
                username: "u".into(),
                password: "p".into(),
            },
        ),
        (
            McpAuthConfig::Header {
                name: "X-Key".into(),
                value: "v".into(),
            },
            tinymcp::McpAuthConfig::Header {
                name: "X-Key".into(),
                value: "v".into(),
            },
        ),
        (
            McpAuthConfig::QueryParam {
                name: "key".into(),
                value: "v".into(),
            },
            tinymcp::McpAuthConfig::QueryParam {
                name: "key".into(),
                value: "v".into(),
            },
        ),
    ];

    for (host, expected) in cases {
        let mut config = config_without_docs();
        config.mcp_client.servers.push(HostServer {
            auth: host,
            ..populated_server()
        });

        assert_eq!(client_config(&config).servers[0].auth, expected);
    }
}

#[test]
fn a_multi_header_credential_keeps_every_header() {
    // A server wanting a client key and a client secret needs both; keeping
    // only the first is a 401 nobody can explain.
    let mut config = config_without_docs();
    config.mcp_client.servers.push(HostServer {
        auth: McpAuthConfig::Headers {
            headers: vec![
                HttpHeader {
                    name: "X-Client-Key".into(),
                    value: "k".into(),
                },
                HttpHeader {
                    name: "Authorization".into(),
                    value: "Bearer s".into(),
                },
            ],
        },
        ..populated_server()
    });

    match &client_config(&config).servers[0].auth {
        tinymcp::McpAuthConfig::Headers { headers } => {
            assert_eq!(headers.len(), 2);
            assert!(headers.iter().any(|header| header.name == "X-Client-Key"));
            assert!(headers.iter().any(|header| header.name == "Authorization"));
        }
        other => panic!("expected several headers, got {other:?}"),
    }
}

#[test]
fn the_client_identity_survives_the_conversion() {
    // A remote server sees these and may log or display them.
    let mut config = config_without_docs();
    config.mcp_client.client_identity.name = "openhuman-core".into();
    config.mcp_client.client_identity.title = "OpenHuman Core MCP Client".into();
    config.mcp_client.client_identity.version = "9.9.9".into();

    let identity = client_config(&config).client_identity;

    assert_eq!(identity.name, "openhuman-core");
    assert_eq!(identity.title, "OpenHuman Core MCP Client");
    assert_eq!(identity.version, "9.9.9");
}

#[test]
fn the_registry_credentials_survive_the_conversion() {
    let mut config = config_without_docs();
    config.mcp_client.registry_auth.smithery_api_key = Some("smithery".into());
    config.mcp_client.registry_auth.mcp_official_base = Some("https://registry.test".into());
    config.mcp_client.registry_auth.mcp_official_token = Some("official".into());

    let auth = client_config(&config).registry_auth;

    assert_eq!(auth.smithery_api_key.as_deref(), Some("smithery"));
    assert_eq!(
        auth.mcp_official_base.as_deref(),
        Some("https://registry.test")
    );
    assert_eq!(auth.mcp_official_token.as_deref(), Some("official"));
}

#[test]
fn the_documentation_server_is_seeded_when_it_is_enabled() {
    // It is this application's own server. `tinymcp` has no business knowing
    // about it, so the seeding happens here.
    let mut config = Config::default();
    config.gitbooks.enabled = true;

    let converted = client_config(&config);
    let docs = converted
        .servers
        .iter()
        .find(|server| server.name == GITBOOKS_SERVER_NAME)
        .expect("the documentation server");

    assert_eq!(docs.endpoint, config.gitbooks.endpoint);
    assert_eq!(docs.timeout_secs, config.gitbooks.timeout_secs);
}

#[test]
fn the_documentation_server_is_not_seeded_when_it_is_disabled() {
    let converted = client_config(&config_without_docs());

    assert!(!converted
        .servers
        .iter()
        .any(|server| server.name == GITBOOKS_SERVER_NAME));
}

#[test]
fn a_user_declared_server_of_the_same_name_wins_over_the_seeded_one() {
    // Someone who deliberately pointed that name somewhere else keeps it.
    let mut config = Config::default();
    config.gitbooks.enabled = true;
    config.mcp_client.servers.push(HostServer {
        name: GITBOOKS_SERVER_NAME.into(),
        endpoint: "https://mine.test/mcp".into(),
        ..HostServer::default()
    });

    let converted = client_config(&config);
    let matching: Vec<_> = converted
        .servers
        .iter()
        .filter(|server| server.name == GITBOOKS_SERVER_NAME)
        .collect();

    assert_eq!(matching.len(), 1);
    assert_eq!(matching[0].endpoint, "https://mine.test/mcp");
}

#[test]
fn a_disabled_mcp_section_carries_across() {
    let mut config = config_without_docs();
    config.mcp_client.enabled = false;

    assert!(!client_config(&config).enabled);
}

#[test]
fn a_host_opens_its_store_under_the_workspace() {
    // It lives there, so the servers a user installed are found again after a
    // restart.
    let temporary = tempfile::tempdir().expect("tempdir");
    let mut config = config_without_docs();
    config.workspace_dir = temporary.path().to_path_buf();

    let _host = McpHost::open(&config).expect("the host opens");

    assert!(tinymcp::Store::path_for(temporary.path()).exists());
}

#[test]
fn an_audit_log_is_opened_under_the_workspace_it_is_asked_for() {
    // Keyed by workspace rather than held by the host: this process can serve
    // more than one over its life, and a write must land under the workspace
    // its caller named rather than whichever booted first.
    let temporary = tempfile::tempdir().expect("tempdir");
    let mut config = config_without_docs();
    config.workspace_dir = temporary.path().to_path_buf();

    let log = super::audit_log(&config).expect("the audit log opens");

    assert!(tinymcp::AuditStore::path_for(temporary.path()).exists());
    // A second ask reuses the open log rather than re-running its migrations.
    let again = super::audit_log(&config).expect("the audit log opens again");
    assert!(std::sync::Arc::ptr_eq(&log, &again));
}

#[test]
fn two_workspaces_get_two_audit_logs() {
    let first = tempfile::tempdir().expect("tempdir");
    let second = tempfile::tempdir().expect("tempdir");

    let mut config = config_without_docs();
    config.workspace_dir = first.path().to_path_buf();
    let first_log = super::audit_log(&config).expect("the first log opens");

    config.workspace_dir = second.path().to_path_buf();
    let second_log = super::audit_log(&config).expect("the second log opens");

    assert!(!std::sync::Arc::ptr_eq(&first_log, &second_log));
    assert!(tinymcp::AuditStore::path_for(first.path()).exists());
    assert!(tinymcp::AuditStore::path_for(second.path()).exists());
}
