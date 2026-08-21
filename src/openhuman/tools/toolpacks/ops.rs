//! Splitting a built registry into "advertised" and "packed".

use std::collections::HashMap;
use std::sync::Arc;

use super::registry;
use super::tools::{LoadSkillTool, PackedTools, UseSkillTool};
use crate::openhuman::tools::traits::Tool;

/// Move every packed tool out of `tools` and replace them with `load_skill` +
/// `use_skill`.
///
/// Runs on the fully-built registry rather than at each construction site on
/// purpose: pack membership is one table, and a tool that gains a new
/// construction site cannot silently escape its pack.
pub fn split_packed_tools(tools: Vec<Box<dyn Tool>>) -> Vec<Box<dyn Tool>> {
    let packed_names = registry::all_packed_tool_names();
    let mut advertised: Vec<Box<dyn Tool>> = Vec::with_capacity(tools.len());
    let mut packed: HashMap<String, Box<dyn Tool>> = HashMap::new();

    for tool in tools {
        if packed_names.contains(&tool.name()) {
            packed.insert(tool.name().to_string(), tool);
        } else {
            advertised.push(tool);
        }
    }

    if packed.is_empty() {
        // Nothing to hide (every packed tool is feature-gated out of this
        // build), so do not advertise a pair of tools that can only fail.
        tracing::debug!("[toolpacks] no packed tools present — skipping load_skill/use_skill");
        return advertised;
    }

    tracing::info!(
        packed = packed.len(),
        advertised = advertised.len(),
        "[toolpacks] moved tools behind load_skill/use_skill"
    );

    let shared: PackedTools = Arc::new(packed);
    advertised.push(Box::new(LoadSkillTool::new(Arc::clone(&shared))));
    advertised.push(Box::new(UseSkillTool::new(shared)));
    advertised
}
