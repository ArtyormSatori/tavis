#!/usr/bin/env python3
from pathlib import Path

path = Path("src/openhuman/inference/provider/factory.rs")
text = path.read_text()

old_import = "use crate::openhuman::config::Config;"
new_import = "use crate::openhuman::config::{Config, TAVIS_OMNIROUTE_PROVIDER_ID};"
if old_import not in text:
    raise SystemExit("expected Config import not found")
text = text.replace(old_import, new_import, 1)

old_fn = '''pub fn provider_for_role(role: &str, config: &Config) -> String {\n    let opt = configured_route_for_role(role, config);'''
new_fn = '''pub fn provider_for_role(role: &str, config: &Config) -> String {\n    // TAVIS production mode is fail-closed: once OmniRoute is the primary cloud,\n    // mutable per-role fields cannot redirect LLM workloads around the gateway.\n    if config.primary_cloud.as_deref() == Some(TAVIS_OMNIROUTE_PROVIDER_ID) {\n        let hint = match role {\n            "chat" | "subconscious" => Some("chat"),\n            "reasoning" | "heartbeat" | "learning" => Some("reasoning"),\n            "agentic" | "burst" => Some("agentic"),\n            "coding" => Some("coding"),\n            "vision" => Some("vision"),\n            "memory" | "summarization" => Some("summarization"),\n            _ => None,\n        };\n        if let Some(hint) = hint {\n            return format!("omniroute:hint:{hint}");\n        }\n    }\n\n    let opt = configured_route_for_role(role, config);'''
if old_fn not in text:
    raise SystemExit("provider_for_role patch target not found")
text = text.replace(old_fn, new_fn, 1)

explicit_marker = '''/// Build an `Arc<dyn ChatModel>` from an explicit provider string and config.\n///\n/// The explicit-string counterpart of [`create_chat_model`].\npub fn create_chat_model_from_string('''
explicit_helper = '''fn enforce_tavis_omniroute_explicit_provider(\n    provider: &str,\n    config: &Config,\n) -> anyhow::Result<()> {\n    if config.primary_cloud.as_deref() != Some(TAVIS_OMNIROUTE_PROVIDER_ID) {\n        return Ok(());\n    }\n\n    let provider = provider.trim();\n    if provider.is_empty()\n        || provider == "cloud"\n        || provider == "omniroute"\n        || provider.starts_with("omniroute:")\n    {\n        return Ok(());\n    }\n\n    anyhow::bail!(\n        "TAVIS_OMNIROUTE_ONLY: explicit provider '{}' is not allowed while TAVIS OmniRoute-only mode is active",\n        provider\n    )\n}\n\n/// Build an `Arc<dyn ChatModel>` from an explicit provider string and config.\n///\n/// The explicit-string counterpart of [`create_chat_model`].\npub fn create_chat_model_from_string('''
if explicit_marker not in text:
    raise SystemExit("explicit-provider helper insertion target not found")
text = text.replace(explicit_marker, explicit_helper, 1)

standard_guard_target = '''    let test_override_active = {\n        #[cfg(any(test, feature = "e2e-test-support", feature = "rss-bench"))]\n        {\n            test_provider_override::current().is_some()\n        }\n        #[cfg(not(any(test, feature = "e2e-test-support", feature = "rss-bench")))]\n        {\n            false\n        }\n    };\n    if !test_override_active {\n        let mut resolved = provider.trim().to_string();'''
standard_guard_replacement = '''    let test_override_active = {\n        #[cfg(any(test, feature = "e2e-test-support", feature = "rss-bench"))]\n        {\n            test_provider_override::current().is_some()\n        }\n        #[cfg(not(any(test, feature = "e2e-test-support", feature = "rss-bench")))]\n        {\n            false\n        }\n    };\n    enforce_tavis_omniroute_explicit_provider(provider, config)?;\n    if !test_override_active {\n        let mut resolved = provider.trim().to_string();'''
found = text.count(standard_guard_target)
if found != 1:
    raise SystemExit(f"standard explicit guard target mismatch: expected 1, found {found}")
text = text.replace(standard_guard_target, standard_guard_replacement, 1)

turn_guard_target = '''    let test_override_active = {\n        #[cfg(any(test, feature = "e2e-test-support", feature = "rss-bench"))]\n        {\n            test_provider_override::current().is_some()\n        }\n        #[cfg(not(any(test, feature = "e2e-test-support", feature = "rss-bench")))]\n        {\n            false\n        }\n    };\n    let p = provider_string.trim();\n    let is_managed = p.is_empty() || p == "cloud" || p == PROVIDER_OPENHUMAN;'''
turn_guard_replacement = '''    let test_override_active = {\n        #[cfg(any(test, feature = "e2e-test-support", feature = "rss-bench"))]\n        {\n            test_provider_override::current().is_some()\n        }\n        #[cfg(not(any(test, feature = "e2e-test-support", feature = "rss-bench")))]\n        {\n            false\n        }\n    };\n    enforce_tavis_omniroute_explicit_provider(provider_string, config)?;\n    let p = provider_string.trim();\n    let is_managed = p.is_empty() || p == "cloud" || p == PROVIDER_OPENHUMAN;'''
found = text.count(turn_guard_target)
if found != 1:
    raise SystemExit(f"turn explicit guard target mismatch: expected 1, found {found}")
text = text.replace(turn_guard_target, turn_guard_replacement, 1)

old_session_gate = '''    // Preserve the `Provider` path's gate for custom/cloud providers.\n    if let Err(e) = enforce_local_only_inference(role, &p) {\n        return Some(Err(e));\n    }\n    #[cfg(not(test))]\n    if let Err(e) = verify_session_active(config) {\n        return Some(Err(e));\n    }\n\n    let CloudSlugResolution {'''
new_session_gate = '''    // Preserve the `Provider` path's privacy gate for custom/cloud providers.\n    if let Err(e) = enforce_local_only_inference(role, &p) {\n        return Some(Err(e));\n    }\n\n    // TAVIS is an always-on local system: its loopback OmniRoute gateway must\n    // remain usable before/without an OpenHuman account login. Keep the legacy\n    // session requirement for every other custom/cloud slug.\n    let is_tavis_omniroute =\n        config.primary_cloud.as_deref() == Some(TAVIS_OMNIROUTE_PROVIDER_ID) && slug == "omniroute";\n    #[cfg(not(test))]\n    if !is_tavis_omniroute {\n        if let Err(e) = verify_session_active(config) {\n            return Some(Err(e));\n        }\n    }\n\n    let CloudSlugResolution {'''
found = text.count(old_session_gate)
if found != 1:
    raise SystemExit(f"cloud session-gate patch target mismatch: expected 1, found {found}")
text = text.replace(old_session_gate, new_session_gate, 1)

path.write_text(text)
