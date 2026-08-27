use openhuman_core::openhuman::agent::tavis_capabilities::{
    tavis_native_capability, TavisNativeCapability,
};

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
