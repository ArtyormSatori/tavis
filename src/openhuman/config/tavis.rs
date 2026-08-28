//! TAVIS-specific configuration policy layered on top of OpenHuman's schema.
//!
//! OpenHuman remains the source of truth for configuration types. This module
//! only applies TAVIS production invariants so we do not create a parallel
//! configuration system.

use super::schema::cloud_providers::{AuthStyle, CloudProviderCreds};
use super::Config;

pub const TAVIS_OMNIROUTE_PROVIDER_ID: &str = "tavis-omniroute";
pub const TAVIS_OMNIROUTE_SLUG: &str = "omniroute";
pub const TAVIS_OMNIROUTE_URL: &str = "http://127.0.0.1:20128/v1";

fn omniroute_provider() -> CloudProviderCreds {
    CloudProviderCreds {
        id: TAVIS_OMNIROUTE_PROVIDER_ID.to_string(),
        slug: TAVIS_OMNIROUTE_SLUG.to_string(),
        label: "OmniRoute".to_string(),
        endpoint: TAVIS_OMNIROUTE_URL.to_string(),
        auth_style: AuthStyle::None,
        ..CloudProviderCreds::default()
    }
}

/// Apply the fail-closed TAVIS production inference policy.
///
/// All LLM workloads are routed through the local OpenAI-compatible OmniRoute
/// gateway. Existing OpenHuman provider/factory code remains responsible for
/// transport, streaming, tool calls, and multimodal requests.
pub fn apply_tavis_defaults(config: &mut Config) {
    config.inference_url = Some(TAVIS_OMNIROUTE_URL.to_string());

    if let Some(existing) = config
        .cloud_providers
        .iter_mut()
        .find(|provider| provider.id == TAVIS_OMNIROUTE_PROVIDER_ID)
    {
        *existing = omniroute_provider();
    } else {
        config.cloud_providers.push(omniroute_provider());
    }

    config.primary_cloud = Some(TAVIS_OMNIROUTE_PROVIDER_ID.to_string());

    config.chat_provider = Some("omniroute:hint:chat".to_string());
    config.reasoning_provider = Some("omniroute:hint:reasoning".to_string());
    config.agentic_provider = Some("omniroute:hint:agentic".to_string());
    config.coding_provider = Some("omniroute:hint:coding".to_string());
    config.vision_provider = Some("omniroute:hint:vision".to_string());
    config.memory_provider = Some("omniroute:hint:summarization".to_string());
    config.heartbeat_provider = Some("omniroute:hint:reasoning".to_string());
    config.learning_provider = Some("omniroute:hint:reasoning".to_string());
    config.subconscious_provider = Some("omniroute:hint:chat".to_string());

    config.browser.enabled = true;
    config.browser.session_name = Some("tavis".to_string());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn application_is_idempotent() {
        let mut config = Config::default();
        apply_tavis_defaults(&mut config);
        apply_tavis_defaults(&mut config);

        let omniroute_entries = config
            .cloud_providers
            .iter()
            .filter(|provider| provider.id == TAVIS_OMNIROUTE_PROVIDER_ID)
            .count();

        assert_eq!(omniroute_entries, 1);
        assert_eq!(
            config.primary_cloud.as_deref(),
            Some(TAVIS_OMNIROUTE_PROVIDER_ID)
        );
    }
}
