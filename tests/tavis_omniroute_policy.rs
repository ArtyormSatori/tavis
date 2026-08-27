use openhuman_core::openhuman::config::Config;
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
fn tavis_default_workloads_resolve_to_omniroute() {
    let config = Config::default();

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
