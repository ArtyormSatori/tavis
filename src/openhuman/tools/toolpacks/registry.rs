//! The compiled-in pack table.
//!
//! Membership is a build-time decision, deliberately: a pack that config or RPC
//! could edit would let a caller move a dangerous tool out of the advertised
//! surface (or back into it) without review. Adding a pack is a source change.

use super::types::ToolPack;

/// Every pack this build knows about.
///
/// Chosen by measured schema cost against how often the orchestrator actually
/// needs them. The three below are ~4.1k tokens of the Master Agent's ~21.4k
/// tool-schema budget and are idle in the large majority of turns.
pub const PACKS: &[ToolPack] = &[
    ToolPack {
        id: "workflows",
        summary: "Build, discover, run and inspect saved automation workflows (flows) and their run logs.",
        tools: &[
            "build_workflow",
            "discover_workflows",
            "run_workflow",
            "await_workflow",
            "describe_workflow",
            "list_workflows",
            "list_workflow_runs",
            "read_workflow_run_log",
        ],
    },
    ToolPack {
        id: "crypto",
        summary: "Crypto wallet and market actions (balances, transfers, swaps, contract calls, exchange trades) and tiny.place agent-network operations.",
        tools: &["do_crypto", "use_tinyplace"],
    },
    ToolPack {
        id: "integrations",
        summary: "MCP server setup, connection status, and calling tools on a connected MCP server.",
        tools: &["use_mcp_server", "setup_mcp_server", "mcp_registry_status"],
    },
];

pub fn pack(id: &str) -> Option<&'static ToolPack> {
    PACKS.iter().find(|p| p.id == id)
}

/// The pack owning `tool`, if any.
pub fn pack_for_tool(tool: &str) -> Option<&'static ToolPack> {
    PACKS.iter().find(|p| p.owns(tool))
}

/// Every packed tool name across all packs.
pub fn all_packed_tool_names() -> Vec<&'static str> {
    PACKS.iter().flat_map(|p| p.tools.iter().copied()).collect()
}

/// The always-on index: one line per pack, rendered into `load_skill`'s own
/// description so the model can pick a pack without a round trip.
pub fn pack_index_markdown() -> String {
    let mut out = String::new();
    for p in PACKS {
        out.push_str(&format!("- `{}` — {}\n", p.id, p.summary));
    }
    out
}
