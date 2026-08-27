//! TAVIS capability map over OpenHuman-native execution surfaces.
//!
//! This module does not introduce a second browser, desktop, or vision runtime.
//! It records which existing OpenHuman subsystem owns execution and exposes
//! thin TAVIS facades over the existing OpenHuman implementations.

use std::sync::Arc;

use tinyagents::harness::model::ChatModel;

use crate::openhuman::config::Config;
use crate::openhuman::inference::provider::factory::create_chat_model_with_model_id;
use crate::openhuman::security::SecurityPolicy;
use crate::openhuman::tools::implementations::browser::{BrowserTool, ComputerUseConfig};
use crate::openhuman::tools::ops::browser_allowed_domains;
use crate::openhuman::tools::Tool;

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

/// Construct TAVIS Browser with OpenHuman's native BrowserTool and the same
/// fail-safe web/computer-use policy used by the default tool registry.
pub fn tavis_browser_tool(config: &Config, security: Arc<SecurityPolicy>) -> Box<dyn Tool> {
    let browser = &config.browser;
    let allowed_domains = browser_allowed_domains(&config.http_request.allowed_domains);

    Box::new(BrowserTool::new_with_backend(
        security,
        allowed_domains,
        browser.session_name.clone(),
        browser.backend.clone(),
        browser.native_headless,
        browser.native_webdriver_url.clone(),
        browser.native_chrome_path.clone(),
        ComputerUseConfig {
            endpoint: browser.computer_use.endpoint.clone(),
            api_key: None,
            timeout_ms: browser.computer_use.timeout_ms,
            allow_remote_endpoint: browser.computer_use.allow_remote_endpoint,
            window_allowlist: browser.computer_use.window_allowlist.clone(),
            max_coordinate_x: browser.computer_use.max_coordinate_x,
            max_coordinate_y: browser.computer_use.max_coordinate_y,
        },
    ))
}

/// Construct TAVIS Vision through OpenHuman's unified role-based inference
/// factory. The TAVIS config policy resolves the `vision` role to OmniRoute.
pub fn tavis_vision_model(
    config: &Config,
    temperature: f64,
) -> anyhow::Result<(Arc<dyn ChatModel<()>>, String)> {
    create_chat_model_with_model_id("vision", config, temperature)
}
