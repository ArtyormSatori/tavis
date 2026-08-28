use openhuman_core::openhuman::config::{apply_tavis_defaults, Config};
use openhuman_core::openhuman::inference::provider::factory::provider_for_role;

const DEFAULT_TAVIS_OMNIROUTE_URL: &str = "http://127.0.0.1:20128/v1";

#[test]
fn tavis_defaults_llm_inference_to_omniroute() {
    let config = Config::default();

    assert_eq!(
        config.inference_url.as_deref(),
        Some(DEFAULT_TAVIS_OMNIROUTE_URL),
        "TAVIS must fail closed to the local OmniRoute gateway instead of leaving inference routing unset"
    );
}

#[test]
fn tavis_policy_routes_all_llm_workloads_through_omniroute() {
    let mut config = Config::default();
    apply_tavis_defaults(&mut config);

    for role in [
        "chat",
        "reasoning",
        "agentic",
        "coding",
        "vision",
        "memory",
        "heartbeat",
        "learning",
        "subconscious",
    ] {
        let provider = provider_for_role(role, &config);
        assert!(
            provider.starts_with("omniroute:"),
            "TAVIS workload {role} must resolve through OmniRoute, got {provider:?}"
        );
    }
}

#[test]
fn tavis_policy_registers_omniroute_as_no_auth_local_gateway() {
    let mut config = Config::default();
    apply_tavis_defaults(&mut config);

    let provider = config
        .cloud_providers
        .iter()
        .find(|provider| provider.slug == "omniroute")
        .expect("TAVIS must register OmniRoute in OpenHuman's provider registry");

    assert_eq!(provider.endpoint, DEFAULT_TAVIS_OMNIROUTE_URL);
    assert_eq!(provider.auth_style.as_str(), "none");
    assert_eq!(config.primary_cloud.as_deref(), Some("tavis-omniroute"));
}

#[test]
fn tavis_runtime_router_rejects_direct_provider_bypass() {
    let mut config = Config::default();
    apply_tavis_defaults(&mut config);

    // Simulate a stale config, UI bug, or malicious mutation after startup.
    // The inference chokepoint must still fail closed to OmniRoute.
    config.chat_provider = Some("openai:gpt-5".to_string());
    config.reasoning_provider = Some("anthropic:claude-opus-4".to_string());

    assert!(provider_for_role("chat", &config).starts_with("omniroute:"));
    assert!(provider_for_role("reasoning", &config).starts_with("omniroute:"));
}
