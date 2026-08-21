//! The two always-on tools that stand in for every packed tool.
//!
//! `load_skill` pulls a pack's schemas into the conversation as text;
//! `use_skill` executes one of them. Together they cost ~150 tokens of
//! advertised schema in place of the ~4.1k the packed tools would spend.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::{json, Value};

use super::registry;
use crate::openhuman::tools::traits::{
    PermissionLevel, Tool, ToolCallOptions, ToolContent, ToolResult,
};

/// Shared map of packed tool name -> tool. Built once by
/// [`super::ops::split_packed_tools`] and handed to both tools below.
pub type PackedTools = Arc<HashMap<String, Box<dyn Tool>>>;

fn render_pack(id: &str, packed: &PackedTools) -> Option<String> {
    let pack = registry::pack(id)?;
    let mut out = format!("# Skill `{}`\n\n{}\n\n", pack.id, pack.summary);
    out.push_str(
        "Call these through `use_skill { skill: \"",
    );
    out.push_str(pack.id);
    out.push_str("\", tool: \"<name>\", args: { … } }`. `args` is the tool's own argument object, exactly as documented below.\n\n");
    for name in pack.tools {
        let Some(tool) = packed.get(*name) else {
            // A pack naming a tool this build does not compile (feature-gated
            // out) is normal, not an error: report the pack that exists.
            continue;
        };
        out.push_str(&format!("## `{}`\n\n{}\n\n", tool.name(), tool.description()));
        let schema = serde_json::to_string_pretty(&tool.parameters_schema())
            .unwrap_or_else(|_| "{}".to_string());
        out.push_str("```json\n");
        out.push_str(&schema);
        out.push_str("\n```\n\n");
    }
    Some(out)
}

/// Loads one pack's tool schemas into the conversation.
pub struct LoadSkillTool {
    packed: PackedTools,
    description: String,
}

impl LoadSkillTool {
    pub fn new(packed: PackedTools) -> Self {
        let description = format!(
            "Load a skill's tools into this conversation. Their schemas are not in your \
             context until you do. Call this BEFORE `use_skill` for a skill you have not \
             loaded in this conversation, then call `use_skill` with the tool and arguments \
             it describes.\n\nAvailable skills:\n{}",
            registry::pack_index_markdown()
        );
        Self { packed, description }
    }
}

#[async_trait]
impl Tool for LoadSkillTool {
    fn name(&self) -> &str {
        "load_skill"
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "skill": {
                    "type": "string",
                    "enum": registry::PACKS.iter().map(|p| p.id).collect::<Vec<_>>(),
                    "description": "Which skill to load."
                }
            },
            "required": ["skill"]
        })
    }

    async fn execute(&self, args: Value) -> anyhow::Result<ToolResult> {
        let Some(id) = args.get("skill").and_then(Value::as_str) else {
            return Ok(ToolResult::error("`skill` is required."));
        };
        match render_pack(id, &self.packed) {
            Some(text) => Ok(ToolResult::success(text)),
            None => Ok(ToolResult::error(format!(
                "Unknown skill `{id}`. Available:\n{}",
                registry::pack_index_markdown()
            ))),
        }
    }

    fn permission_level(&self) -> PermissionLevel {
        PermissionLevel::ReadOnly
    }
}

/// Executes a tool that lives inside a pack.
///
/// **Permission forwarding is load-bearing.** The harness gates a call on the
/// tool's `permission_level_with_args`, so a proxy that reported its own level
/// would launder every packed tool's risk down to this one's. Both the
/// arg-aware and arg-less accessors resolve the inner tool and defer to it; the
/// arg-less one has no call to resolve from, so it reports the highest level any
/// packed tool requires rather than guessing low.
pub struct UseSkillTool {
    packed: PackedTools,
    description: String,
}

impl UseSkillTool {
    pub fn new(packed: PackedTools) -> Self {
        let description = format!(
            "Execute a tool belonging to a skill. Call `load_skill` first to see the skill's \
             tools and their arguments.\n\nSkills:\n{}",
            registry::pack_index_markdown()
        );
        Self { packed, description }
    }

    fn resolve(&self, args: &Value) -> Option<&Box<dyn Tool>> {
        let skill = args.get("skill").and_then(Value::as_str)?;
        let tool = args.get("tool").and_then(Value::as_str)?;
        // The tool must belong to the named skill. Without this check `use_skill`
        // would be a universal dispatcher into any packed tool, and the skill
        // argument would be decoration rather than scoping.
        registry::pack(skill).filter(|p| p.owns(tool))?;
        self.packed.get(tool)
    }
}

#[async_trait]
impl Tool for UseSkillTool {
    fn name(&self) -> &str {
        "use_skill"
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "skill": {
                    "type": "string",
                    "enum": registry::PACKS.iter().map(|p| p.id).collect::<Vec<_>>(),
                    "description": "The skill owning the tool."
                },
                "tool": {
                    "type": "string",
                    "description": "Tool name, as listed by `load_skill`."
                },
                "args": {
                    "type": "object",
                    "description": "The tool's own arguments, as documented by `load_skill`.",
                    "additionalProperties": true
                }
            },
            "required": ["skill", "tool"]
        })
    }

    async fn execute(&self, args: Value) -> anyhow::Result<ToolResult> {
        self.execute_with_context(args, ToolCallOptions::default(), None)
            .await
    }

    async fn execute_with_context(
        &self,
        args: Value,
        options: ToolCallOptions,
        context: Option<&tinyagents::harness::tool::ToolExecutionContext>,
    ) -> anyhow::Result<ToolResult> {
        let Some(tool) = self.resolve(&args) else {
            let skill = args.get("skill").and_then(Value::as_str).unwrap_or("");
            let name = args.get("tool").and_then(Value::as_str).unwrap_or("");
            return Ok(ToolResult::error(format!(
                "No tool `{name}` in skill `{skill}`. Call `load_skill {{ skill: \"{skill}\" }}` \
                 to see what it contains.\n\nSkills:\n{}",
                registry::pack_index_markdown()
            )));
        };
        let inner_args = args.get("args").cloned().unwrap_or_else(|| json!({}));
        tracing::debug!(
            tool = tool.name(),
            "[toolpacks] use_skill dispatching to packed tool"
        );
        tool.execute_with_context(inner_args, options, context).await
    }

    fn supports_markdown(&self) -> bool {
        // Any packed tool may render markdown; the result is forwarded verbatim,
        // so advertise the capability rather than suppressing a saving.
        true
    }

    fn permission_level(&self) -> PermissionLevel {
        self.packed
            .values()
            .map(|t| t.permission_level())
            .max()
            .unwrap_or(PermissionLevel::ReadOnly)
    }

    fn permission_level_with_args(&self, args: &Value) -> PermissionLevel {
        match self.resolve(args) {
            Some(tool) => {
                let inner = args.get("args").cloned().unwrap_or_else(|| json!({}));
                tool.permission_level_with_args(&inner)
            }
            // Unresolvable call: it will fail anyway, but report the ceiling so a
            // malformed call can never be admitted on a channel the real tool
            // would have been refused on.
            None => self.permission_level(),
        }
    }
}

/// Silence the unused-import warning for `ToolContent` in builds where no
/// packed tool is compiled in.
#[allow(dead_code)]
fn _unused(_: ToolContent) {}
