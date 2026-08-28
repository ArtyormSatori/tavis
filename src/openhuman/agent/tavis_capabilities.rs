//! TAVIS capability map over OpenHuman-native execution surfaces.
//!
//! This module does not introduce a second browser, desktop, or vision runtime.
//! It records which existing OpenHuman subsystem owns execution and which
//! existing security boundary remains authoritative for each TAVIS capability.

/// Native capabilities TAVIS exposes through OpenHuman.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TavisNativeCapability {
    BrowserAutomation,
    DesktopAutomation,
    VisionAnalysis,
}

/// Static description of the OpenHuman-native surface used by a TAVIS capability.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TavisCapabilityDescriptor {
    pub execution_surface: &'static str,
    pub security_boundary: &'static str,
    pub requires_omniroute: bool,
}

/// Resolve a TAVIS capability to its existing OpenHuman execution surface.
///
/// LLM-backed analysis must still obey the TAVIS OmniRoute-only inference
/// policy. Deterministic browser and computer-use actions execute through
/// OpenHuman's native tools and their existing security controls.
pub fn tavis_native_capability(capability: TavisNativeCapability) -> TavisCapabilityDescriptor {
    match capability {
        TavisNativeCapability::BrowserAutomation => TavisCapabilityDescriptor {
            execution_surface: "openhuman.tools.browser",
            security_boundary: "http_request.allowed_domains",
            requires_omniroute: false,
        },
        TavisNativeCapability::DesktopAutomation => TavisCapabilityDescriptor {
            execution_surface: "openhuman.tools.browser.computer_use",
            security_boundary: "browser.computer_use.window_allowlist",
            requires_omniroute: false,
        },
        TavisNativeCapability::VisionAnalysis => TavisCapabilityDescriptor {
            execution_surface: "openhuman.agent.vision_agent",
            security_boundary: "openhuman.security.egress",
            requires_omniroute: true,
        },
    }
}
