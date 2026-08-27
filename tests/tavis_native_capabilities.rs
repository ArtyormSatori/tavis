use openhuman_core::openhuman::agent::tavis_capabilities::{
    tavis_native_capability, TavisNativeCapability,
};
use openhuman_core::openhuman::config::{apply_tavis_defaults, Config};

#[test]
fn browser_automation_reuses_openhuman_browser_tooling() {
    let capability = tavis_native_capability(TavisNativeCapability::BrowserAutomation);

    assert_eq!(capability.execution_surface, "openhuman.tools.browser");
    assert_eq!(capability.security_boundary, "http_request.allowed_domains");
    assert!(!capability.requires_omniroute);
}

#[test]
fn desktop_automation_reuses_openhuman_computer_use_backend() {
    let capability = tavis_native_capability(TavisNativeCapability::DesktopAutomation);

    assert_eq!(
        capability.execution_surface,
        "openhuman.tools.browser.computer_use"
    );
    assert_eq!(
        capability.security_boundary,
        "browser.computer_use.window_allowlist"
    );
    assert!(!capability.requires_omniroute);
}

#[test]
fn vision_analysis_reuses_openhuman_vision_agent_and_omniroute() {
    let capability = tavis_native_capability(TavisNativeCapability::VisionAnalysis);

    assert_eq!(capability.execution_surface, "openhuman.agent.vision_agent");
    assert_eq!(capability.security_boundary, "openhuman.security.egress");
    assert!(capability.requires_omniroute);
}

#[test]
fn tavis_defaults_enable_browser_with_persistent_session_without_weakening_security() {
    let mut config = Config::default();
    apply_tavis_defaults(&mut config);

    assert!(config.browser.enabled, "TAVIS Browser must be available after startup policy is applied");
    assert_eq!(config.browser.session_name.as_deref(), Some("tavis"));
    assert_eq!(config.browser.backend, "auto");
    assert!(
        !config.browser.computer_use.allow_remote_endpoint,
        "TAVIS must not silently allow a public remote computer-use endpoint"
    );
    assert!(
        config.browser.allowed_domains.is_empty(),
        "deprecated browser allowlist must not be used to bypass the unified web policy"
    );
}
