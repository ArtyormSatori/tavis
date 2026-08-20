use crate::openhuman::memory::Memory;
use crate::openhuman::util::provenance_tag;
use serde::{Deserialize, Serialize};

/// Maximum number of `[Prior conversations]` lines surfaced into the prompt
/// at the start of a fresh chat. Tight cap on purpose: this block is meant
/// to recover continuity for high-importance facts, not to dump session
/// history into context. See issue #1399.
const PRIOR_CONVERSATION_LIMIT: usize = 3;
/// Only the importance prefix `high.` survives into the prompt block.
/// Medium/low entries stay queryable via the on-demand memory tool but
/// do not auto-pollute every fresh chat.
const PRIOR_CONVERSATION_KEY_PREFIX: &str = "high.";

/// Parse a `MemoryEntry::timestamp` (RFC 3339) into an absolute
/// `YYYY-MM-DD` label for prompt injection, e.g. `2026-05-25`. Returns
/// `None` when the timestamp is missing or unparseable so callers omit
/// the stamp rather than emit a garbage date.
///
/// Time-sensitive memory ("finish the proposal by Wednesday") is a prime
/// vector for stale-as-current hallucinations: with no date the model
/// can't tell a four-day-old working fact from a present-tense one, so it
/// may serve it as today's — the same failure as the memory-tree path.
/// This block feeds the chat user message *and*, via
/// `last_memory_context`, every typed sub-agent including the cron
/// morning briefing (#2944). Reuses the prompt layer's absolute-date
/// formatter for one consistent date shape across surfaces.
fn memory_entry_date_label(timestamp: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(timestamp)
        .ok()
        .map(|dt| {
            crate::openhuman::agent::prompts::memory_date_label(dt.with_timezone(&chrono::Utc))
        })
}

/// Canonical header for the `[Cross-chat context]` block injected on
/// every turn that has FTS-surfaced hits from other threads.
///
/// The "historical" / "capabilities may have changed since" suffix is
/// deliberate: it tells the model these snippets are snapshots from
/// earlier moments and that capability claims (e.g. "I can't delete
/// emails") may be stale because the tool surface or per-toolkit scope
/// toggles can change between chats.
///
/// Single source of truth — all three call sites bind to this constant
/// so a wording tweak doesn't drift between (a) `memory_loader.rs`'s
/// primary JSONL path, (b) `harness/memory_context.rs`'s fallback
/// recall path, and (c) the orchestrator's "Capability questions"
/// prompt section that names the header verbatim. Tests assert on this
/// constant too — see `memory_loader::tests` and
/// `harness::memory_context::tests`.
pub const CROSS_CHAT_HEADER: &str =
    "[Cross-chat context — historical; capabilities may have changed since]\n";



/// Lightweight citation object derived from recalled memory entries.
///
/// These citations are attached to agent responses so the UI can show
/// provenance for memory-informed answers without exposing full raw memory.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MemoryCitation {
    pub id: String,
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
    pub timestamp: String,
    pub snippet: String,
}



/// Collect citation metadata from semantic memory recall for a user turn.
///
/// This mirrors the primary recall path used by `DefaultMemoryLoader` so the
/// UI can display trusted sources whenever memory context influenced a reply.
pub async fn collect_recall_citations(
    memory: &dyn Memory,
    user_message: &str,
    limit: usize,
    min_relevance_score: f64,
) -> anyhow::Result<Vec<MemoryCitation>> {
    // Routed through the tinyagents retrieval facade (issue #4249, 09.2): the
    // facade wraps `Memory::recall` verbatim (ranking engine unchanged) so the
    // citation set stays byte-identical, while making retrieval swappable and
    // emitting `MemoryLoaded`.
    let entries = crate::openhuman::agent::tinyagents::retriever::recall_through_facade(
        memory,
        user_message,
        limit.max(1),
        crate::openhuman::memory::RecallOpts::default(),
    )
    .await?;

    let citations = entries
        .into_iter()
        .filter(|entry| match entry.score {
            Some(score) => score >= min_relevance_score,
            None => true,
        })
        .map(|entry| {
            let snippet = if entry.content.chars().count() > 280 {
                crate::openhuman::util::truncate_with_ellipsis(&entry.content, 280)
            } else {
                entry.content
            };
            MemoryCitation {
                id: entry.id,
                key: entry.key,
                namespace: entry.namespace,
                score: entry.score,
                timestamp: entry.timestamp,
                snippet,
            }
        })
        .collect();

    Ok(citations)
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::openhuman::memory::{Memory, MemoryCategory, MemoryEntry};

    struct MockMemory {
        entries: Vec<MemoryEntry>,
        cross_chat: Vec<MemoryEntry>,
    }

    impl MockMemory {
        fn new(entries: Vec<MemoryEntry>) -> Self {
            Self {
                entries,
                cross_chat: Vec::new(),
            }
        }
    }

    #[async_trait]
    impl Memory for MockMemory {
        fn name(&self) -> &str {
            "mock"
        }

        async fn store(
            &self,
            _namespace: &str,
            _key: &str,
            _content: &str,
            _category: MemoryCategory,
            _session_id: Option<&str>,
        ) -> anyhow::Result<()> {
            Ok(())
        }

        async fn recall(
            &self,
            _query: &str,
            _limit: usize,
            opts: crate::openhuman::memory::RecallOpts<'_>,
        ) -> anyhow::Result<Vec<MemoryEntry>> {
            if opts.cross_session {
                return Ok(self.cross_chat.clone());
            }
            Ok(self.entries.clone())
        }

        async fn get(&self, _namespace: &str, _key: &str) -> anyhow::Result<Option<MemoryEntry>> {
            Ok(None)
        }

        async fn list(
            &self,
            _namespace: Option<&str>,
            _category: Option<&MemoryCategory>,
            _session_id: Option<&str>,
        ) -> anyhow::Result<Vec<MemoryEntry>> {
            Ok(Vec::new())
        }

        async fn forget(&self, _namespace: &str, _key: &str) -> anyhow::Result<bool> {
            Ok(false)
        }

        async fn namespace_summaries(
            &self,
        ) -> anyhow::Result<Vec<crate::openhuman::memory::NamespaceSummary>> {
            Ok(Vec::new())
        }

        async fn count(&self) -> anyhow::Result<usize> {
            Ok(self.entries.len())
        }

        async fn health_check(&self) -> bool {
            true
        }
    }

    fn entry(key: &str, content: &str, score: Option<f64>) -> MemoryEntry {
        MemoryEntry {
            id: format!("id-{key}"),
            key: key.to_string(),
            content: content.to_string(),
            namespace: Some("test".to_string()),
            category: MemoryCategory::Conversation,
            timestamp: "2026-04-22T00:00:00Z".to_string(),
            session_id: None,
            score,
            taint: Default::default(),
        }
    }

    #[test]
    fn memory_entry_date_label_parses_rfc3339_else_none() {
        assert_eq!(
            super::memory_entry_date_label("2026-05-25T07:00:00Z").as_deref(),
            Some("2026-05-25")
        );
        assert_eq!(super::memory_entry_date_label("not-a-date"), None);
        assert_eq!(super::memory_entry_date_label(""), None);
    }

    #[tokio::test]
    async fn loader_stamps_working_memory_with_date() {
        // #2944: working-memory facts must carry their last-updated date so
        // the model (and downstream sub-agents / the cron briefing, which
        // inherit this block) can tell a stale fact from a current one.
        let mem = MockMemory::new(vec![MemoryEntry {
            id: "id-tz".into(),
            key: "working.user.commitment".into(),
            content: "Finish the proposal by Wednesday.".into(),
            namespace: Some("test".into()),
            category: MemoryCategory::Conversation,
            timestamp: "2026-05-25T00:00:00Z".into(),
            session_id: None,
            score: None,
            taint: Default::default(),
        }]);

        let out = DefaultMemoryLoader::default()
            .load_context(&mem, "what's on my plate?")
            .await
            .expect("loader must succeed");

        assert!(
            out.contains("[User working memory]"),
            "expected working-memory block, got:\n{out}"
        );
        assert!(
            out.contains("(as of 2026-05-25)"),
            "working-memory fact must carry its date (#2944), got:\n{out}"
        );
    }

    #[tokio::test]
    async fn loader_stamps_prior_conversation_with_date() {
        // #2944: high-importance prior-chat facts must be dated so a
        // months-old statement isn't read as a present-tense commitment.
        let mem = MockMemory::new(vec![MemoryEntry {
            id: "id-1".into(),
            key: "high.preference.aaaaaaaaaaaa".into(),
            content: "[high preference] I prefer Postgres for new services.".into(),
            namespace: Some(super::CONVERSATION_MEMORY_NAMESPACE.to_string()),
            category: MemoryCategory::Conversation,
            timestamp: "2026-04-22T00:00:00Z".into(),
            session_id: Some("thr_old".into()),
            score: Some(0.9),
            taint: Default::default(),
        }]);

        let out = DefaultMemoryLoader::default()
            .load_context(&mem, "what should I default to for storage?")
            .await
            .expect("loader must succeed");

        assert!(
            out.contains("[Prior conversations]"),
            "expected prior conversations block, got:\n{out}"
        );
        assert!(
            out.contains("(noted 2026-04-22)"),
            "prior-conversation fact must carry its date (#2944), got:\n{out}"
        );
    }

    #[tokio::test]
    async fn loader_surfaces_prior_conversation_high_importance_only() {
        // Prior chat extracted two memories: one high-importance preference
        // and one medium-importance unresolved task. Only the high one
        // should make it into the loader's prompt block (#1399).
        let mem = MockMemory::new(vec![
                MemoryEntry {
                    id: "id-1".into(),
                    key: "high.preference.aaaaaaaaaaaa".into(),
                    content: "[high preference] I prefer Postgres for new services.\n[provenance] {\"thread_id\":\"thr_old\"}".into(),
                    namespace: Some(super::CONVERSATION_MEMORY_NAMESPACE.to_string()),
                    category: MemoryCategory::Conversation,
                    timestamp: "2026-04-22T00:00:00Z".into(),
                    session_id: Some("thr_old".into()),
                    score: Some(0.9),
                    taint: Default::default(),
                },
                MemoryEntry {
                    id: "id-2".into(),
                    key: "med.unresolved_task.bbbbbbbbbbbb".into(),
                    content: "[med unresolved_task] still need to migrate auth.".into(),
                    namespace: Some(super::CONVERSATION_MEMORY_NAMESPACE.to_string()),
                    category: MemoryCategory::Conversation,
                    timestamp: "2026-04-22T00:00:00Z".into(),
                    session_id: None,
                    score: Some(0.9),
                    taint: Default::default(),
                },
            ]);

        let loader = DefaultMemoryLoader::default();
        let out = loader
            .load_context(&mem, "what should I default to for storage?")
            .await
            .expect("loader must succeed");

        assert!(
            out.contains("[Prior conversations]"),
            "expected prior conversations block, got:\n{out}"
        );
        assert!(out.contains("Postgres"));
        assert!(
            !out.contains("migrate auth"),
            "med-importance entries must not auto-surface, got:\n{out}"
        );
        assert!(
            !out.contains("[provenance]"),
            "provenance is not rendered into the prompt block, got:\n{out}"
        );
    }

    #[tokio::test]
    async fn agent_conversations_toggle_suppresses_prior_and_cross_chat_blocks() {
        // A profile with include_agent_conversations = false must drop both the
        // [Prior conversations] and [Cross-chat context] blocks, while leaving
        // [User working memory] intact.
        let mut mem = MockMemory::new(vec![
            MemoryEntry {
                id: "id-work".into(),
                key: "working.user.timezone".into(),
                content: "Timezone is PT.".into(),
                namespace: Some("test".into()),
                category: MemoryCategory::Conversation,
                timestamp: "2026-05-25T00:00:00Z".into(),
                session_id: None,
                score: None,
                taint: Default::default(),
            },
            MemoryEntry {
                id: "id-prior".into(),
                key: "high.preference.aaaaaaaaaaaa".into(),
                content: "[high preference] I prefer Postgres.".into(),
                namespace: Some(super::CONVERSATION_MEMORY_NAMESPACE.to_string()),
                category: MemoryCategory::Conversation,
                timestamp: "2026-04-22T00:00:00Z".into(),
                session_id: Some("thr_old".into()),
                score: Some(0.9),
                taint: Default::default(),
            },
        ]);
        mem.cross_chat = vec![cross_chat_entry(
            "1",
            "thread-source",
            "Cross chat about Redis",
            Some(0.9),
        )];

        // Baseline: default loader surfaces all three blocks.
        let baseline = DefaultMemoryLoader::default()
            .load_context(&mem, "storage preferences")
            .await
            .expect("baseline loader");
        assert!(baseline.contains("[User working memory]"));
        assert!(baseline.contains("[Prior conversations]"));
        assert!(baseline.contains(CROSS_CHAT_HEADER.trim_end()));

        // Opted out: only working memory remains.
        let gated = DefaultMemoryLoader::default()
            .with_agent_conversations(false)
            .load_context(&mem, "storage preferences")
            .await
            .expect("gated loader");
        assert!(
            gated.contains("[User working memory]"),
            "working memory must survive the toggle, got:\n{gated}"
        );
        assert!(
            !gated.contains("[Prior conversations]"),
            "prior conversations must be suppressed, got:\n{gated}"
        );
        assert!(
            !gated.contains(CROSS_CHAT_HEADER.trim_end()),
            "cross-chat must be suppressed, got:\n{gated}"
        );
        assert!(!gated.contains("Postgres") && !gated.contains("Redis"));
    }

    #[tokio::test]
    async fn collect_recall_citations_filters_and_truncates_entries() {
        let mem = MockMemory::new(vec![
            entry("keep", "useful context", Some(0.9)),
            entry("drop", "too weak", Some(0.1)),
            entry("long", &"x".repeat(600), Some(0.8)),
        ]);

        let citations = collect_recall_citations(&mem, "hello", 5, 0.4)
            .await
            .expect("citation collection should succeed");
        assert_eq!(citations.len(), 2);
        assert_eq!(citations[0].key, "keep");
        assert_eq!(citations[1].key, "long");
        assert!(citations[1].snippet.ends_with("..."));
    }

    // ── Cross-chat context (#1505) ───────────────────────────────────────

    fn cross_chat_entry(
        cross_id: &str,
        session_id: &str,
        content: &str,
        score: Option<f64>,
    ) -> MemoryEntry {
        MemoryEntry {
            id: format!("episodic-cross:{cross_id}"),
            key: format!("{session_id}:user"),
            content: content.into(),
            namespace: None,
            category: MemoryCategory::Conversation,
            timestamp: "2026-05-15T00:00:00Z".into(),
            session_id: Some(session_id.into()),
            score,
            taint: Default::default(),
        }
    }

    #[tokio::test]
    async fn loader_surfaces_cross_chat_block_with_provenance_tag() {
        let mut mem = MockMemory::new(Vec::new());
        mem.cross_chat = vec![cross_chat_entry(
            "1",
            "thread-source",
            "I prefer Postgres for new services",
            Some(0.9),
        )];

        let loader = DefaultMemoryLoader::default();
        let out = loader
            .load_context(&mem, "what database should I use?")
            .await
            .expect("loader must succeed");
        assert!(
            out.contains(CROSS_CHAT_HEADER.trim_end()),
            "expected cross-chat header, got:\n{out}"
        );
        assert!(
            out.contains("Postgres"),
            "expected the cross-chat fact in the loader output, got:\n{out}"
        );
        assert!(
            out.contains("[chat:"),
            "expected provenance tag, got:\n{out}"
        );
        assert!(
            !out.contains("thread-source"),
            "raw session id MUST NOT leak into the prompt — render only the hashed tag, got:\n{out}"
        );
    }

    #[tokio::test]
    async fn loader_caps_cross_chat_block_at_limit() {
        let mut mem = MockMemory::new(Vec::new());
        mem.cross_chat = (0..10)
            .map(|i| {
                cross_chat_entry(
                    &format!("{i}"),
                    &format!("thread-{i}"),
                    &format!("Cross-chat fact #{i}"),
                    Some(0.9),
                )
            })
            .collect();

        let loader = DefaultMemoryLoader::default();
        let out = loader
            .load_context(&mem, "Cross-chat fact")
            .await
            .expect("loader must succeed");
        let cross_lines = out.lines().filter(|l| l.starts_with("- [chat:")).count();
        assert!(
            cross_lines <= CROSS_CHAT_LIMIT,
            "loader cross-chat block must be capped at {CROSS_CHAT_LIMIT}, saw {cross_lines}"
        );
    }

    #[tokio::test]
    async fn loader_drops_cross_chat_below_relevance_threshold() {
        let mut mem = MockMemory::new(Vec::new());
        mem.cross_chat = vec![
            cross_chat_entry("1", "thread-a", "low score chat fact", Some(0.05)),
            cross_chat_entry("2", "thread-b", "high score chat fact", Some(0.9)),
        ];

        let loader = DefaultMemoryLoader::default();
        let out = loader
            .load_context(&mem, "fact")
            .await
            .expect("loader must succeed");
        assert!(
            out.contains("high score chat fact"),
            "high-relevance cross-chat must surface, got:\n{out}"
        );
        assert!(
            !out.contains("low score chat fact"),
            "low-relevance cross-chat must be filtered, got:\n{out}"
        );
    }

    #[tokio::test]
    async fn loader_returns_empty_when_no_cross_chat_or_other_blocks_match() {
        let mem = MockMemory::new(Vec::new());
        let loader = DefaultMemoryLoader::default();
        let out = loader
            .load_context(&mem, "anything")
            .await
            .expect("loader must succeed");
        assert!(
            !out.contains(CROSS_CHAT_HEADER.trim_end()),
            "no cross-chat hits must produce no header, got:\n{out}"
        );
    }

    /// Exercises the **primary** cross-chat path (JSONL scan via
    /// `ConversationStore`, not the `Memory::recall` fallback). Writes
    /// two threads through `ConversationStore`, wires `workspace_dir`
    /// into the loader, and asserts the prompt picks up the hit from
    /// the inactive thread with a redacted provenance tag.
    ///
    /// Production-critical because the fallback `MockMemory` path is
    /// what the other loader tests cover — this is the one users
    /// actually run.
    #[tokio::test]
    async fn loader_surfaces_jsonl_primary_path_with_workspace_dir() {
        use tinycortex::memory::conversations::{
            ConversationMessage, ConversationStore, CreateConversationThread,
        };

        let temp = tempfile::TempDir::new().expect("tempdir");
        let store = ConversationStore::new(temp.path().to_path_buf());

        // Chat A — durable fact lives here.
        store
            .ensure_thread(CreateConversationThread {
                parent_thread_id: None,
                id: "thread-a".to_string(),
                title: "Chat A".to_string(),
                created_at: "2026-04-10T12:00:00Z".to_string(),
                labels: None,
                personality_id: None,
            })
            .expect("ensure thread-a");
        store
            .append_message(
                "thread-a",
                ConversationMessage {
                    id: "m-a-1".to_string(),
                    content: "Remember: my project Phoenix uses Go and PostgreSQL.".to_string(),
                    message_type: "text".to_string(),
                    extra_metadata: serde_json::json!({}),
                    sender: "user".to_string(),
                    created_at: "2026-04-10T12:01:00Z".to_string(),
                },
            )
            .expect("append a");

        // Chat B — active chat (excluded by current_thread_id wiring is
        // not exercised here; we just verify the JSONL path surfaces
        // hits from other threads).
        store
            .ensure_thread(CreateConversationThread {
                parent_thread_id: None,
                id: "thread-b".to_string(),
                title: "Chat B".to_string(),
                created_at: "2026-04-10T13:00:00Z".to_string(),
                labels: None,
                personality_id: None,
            })
            .expect("ensure thread-b");

        // MockMemory's cross_chat list is empty — if the loader fell
        // back to the Memory::recall path we'd render nothing. Forcing
        // a JSONL primary hit proves the workspace_dir branch ran.
        let mem = MockMemory::new(Vec::new());
        let loader = DefaultMemoryLoader::new(5, 0.4).with_workspace_dir(temp.path().to_path_buf());

        let out = loader
            .load_context(&mem, "What database does my project Phoenix use")
            .await
            .expect("loader must succeed");

        assert!(
            out.contains(CROSS_CHAT_HEADER.trim_end()),
            "JSONL primary path must emit the cross-chat header, got:\n{out}"
        );
        assert!(
            out.contains("PostgreSQL"),
            "cross-chat block must carry the matched snippet, got:\n{out}"
        );
        assert!(
            out.contains("chat:"),
            "cross-chat block must render a `chat:<hash>` provenance tag, got:\n{out}"
        );
        assert!(
            !out.contains("thread-a"),
            "raw thread_id must not leak into the prompt, got:\n{out}"
        );
    }
}
