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

old_session_gate = '''    // Preserve the `Provider` path's gate for custom/cloud providers.\n    if let Err(e) = enforce_local_only_inference(role, &p) {\n        return Some(Err(e));\n    }\n    #[cfg(not(test))]\n    if let Err(e) = verify_session_active(config) {\n        return Some(Err(e));\n    }\n\n    let CloudSlugResolution {'''
new_session_gate = '''    // Preserve the `Provider` path's privacy gate for custom/cloud providers.\n    if let Err(e) = enforce_local_only_inference(role, &p) {\n        return Some(Err(e));\n    }\n\n    // TAVIS is an always-on local system: its loopback OmniRoute gateway must\n    // remain usable before/without an OpenHuman account login. Keep the legacy\n    // session requirement for every other custom/cloud slug.\n    let is_tavis_omniroute =\n        config.primary_cloud.as_deref() == Some(TAVIS_OMNIROUTE_PROVIDER_ID) && slug == "omniroute";\n    #[cfg(not(test))]\n    if !is_tavis_omniroute {\n        if let Err(e) = verify_session_active(config) {\n            return Some(Err(e));\n        }\n    }\n\n    let CloudSlugResolution {'''
found = text.count(old_session_gate)
if found != 1:
    raise SystemExit(f"cloud session-gate patch target mismatch: expected 1, found {found}")
text = text.replace(old_session_gate, new_session_gate, 1)

path.write_text(text)
