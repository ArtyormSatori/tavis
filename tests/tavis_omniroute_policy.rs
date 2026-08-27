use openhuman_core::openhuman::config::Config;

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
