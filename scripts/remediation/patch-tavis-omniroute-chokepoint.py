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
path.write_text(text)
