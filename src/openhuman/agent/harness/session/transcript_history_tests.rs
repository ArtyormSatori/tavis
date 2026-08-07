//! Tests for the [`ChatHistory`] seam over the durable transcript.
//!
//! These pin the three properties S3 of the design doc calls out as hard
//! requirements, because each one is a place where a plausible-looking
//! implementation would silently corrupt a user's transcript:
//!
//! 1. `messages()` reads the **model-context** replay, not the raw line set.
//! 2. `replace()` compacts rather than rewriting, so history survives.
//! 3. `clear()` empties the context without destroying the file.

use tempfile::TempDir;

use super::*;
use crate::openhuman::agent::harness::session::transcript::read_transcript_display;

/// Stem every test writes under; the file lands at
/// `{workspace}/session_raw/{STEM}.jsonl`.
const STEM: &str = "1760000000_tester";

fn meta() -> TranscriptMeta {
    TranscriptMeta {
        agent_name: "tester".into(),
        agent_id: Some("tester".into()),
        agent_type: Some("root".into()),
        dispatcher: "native".into(),
        provider: None,
        model: None,
        created: "2026-08-07T10:00:00Z".into(),
        updated: "2026-08-07T10:00:00Z".into(),
        turn_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        cached_input_tokens: 0,
        charged_amount_usd: 0.0,
        thread_id: Some("thread-1".into()),
        task_id: None,
    }
}

fn history(dir: &TempDir) -> SessionTranscriptHistory {
    SessionTranscriptHistory::new(dir.path(), STEM, meta()).unwrap()
}

fn user(text: &str) -> Message {
    Message::User(tinyagents::harness::message::UserMessage {
        content: vec![tinyagents::harness::message::ContentBlock::Text(
            text.to_string(),
        )],
    })
}

/// Visible text of each message, for order-sensitive assertions.
fn texts(messages: &[Message]) -> Vec<String> {
    messages.iter().map(Message::text).collect()
}

#[tokio::test]
async fn messages_on_absent_transcript_is_empty_not_an_error() {
    let dir = TempDir::new().unwrap();
    assert!(history(&dir).messages("thread-1").await.unwrap().is_empty());
}

#[tokio::test]
async fn append_extends_and_reads_back_in_order() {
    let dir = TempDir::new().unwrap();
    let h = history(&dir);

    h.append("thread-1", user("one")).await.unwrap();
    h.append("thread-1", user("two")).await.unwrap();

    let got = h.messages("thread-1").await.unwrap();
    assert_eq!(texts(&got), vec!["one", "two"]);
}

/// S3 requirement 1: `messages()` must be the model-context replay.
///
/// After a reduction, the raw file still holds the pre-compaction lines. A
/// reader that returned the raw line set would hand the model a context that
/// includes text the compaction was meant to drop.
#[tokio::test]
async fn messages_replays_compaction_rather_than_returning_raw_lines() {
    let dir = TempDir::new().unwrap();
    let h = history(&dir);

    h.append("thread-1", user("first")).await.unwrap();
    h.append("thread-1", user("second")).await.unwrap();
    h.append("thread-1", user("third")).await.unwrap();

    // Reduce to a set that is not a prefix extension → compaction record.
    h.replace("thread-1", vec![user("summary")]).await.unwrap();

    // The model-context read sees only the replacement.
    assert_eq!(
        texts(&h.messages("thread-1").await.unwrap()),
        vec!["summary"]
    );

    // ...while the file itself still carries the superseded lines, proving the
    // reduction was a compaction record and not a rewrite.
    let path = h.path();
    let display = read_transcript_display(&path).unwrap();
    let rendered = format!("{display:?}");
    assert!(
        rendered.contains("first") && rendered.contains("second"),
        "pre-compaction lines must survive on disk; display read was: {rendered}"
    );

    // And the seam agrees with the format's own model-context reader.
    assert_eq!(
        texts(&h.messages("thread-1").await.unwrap()),
        read_transcript(&path)
            .unwrap()
            .messages
            .iter()
            .map(|m| m.content.clone())
            .collect::<Vec<_>>()
    );
}

/// S3 requirement 2: `replace()` must not rewrite the file.
///
/// The trait's default `replace` is clear-then-append; if that default were
/// ever inherited here it would destroy the append-only history. This asserts
/// the file only ever grows.
#[tokio::test]
async fn replace_appends_a_compaction_record_and_never_shrinks_the_file() {
    let dir = TempDir::new().unwrap();
    let h = history(&dir);

    h.append("thread-1", user("alpha")).await.unwrap();
    h.append("thread-1", user("beta")).await.unwrap();

    let path = h.path();
    let before = std::fs::read_to_string(&path).unwrap();

    h.replace("thread-1", vec![user("condensed")])
        .await
        .unwrap();

    let after = std::fs::read_to_string(&path).unwrap();
    assert!(
        after.starts_with(&before),
        "replace must append; earlier bytes were modified"
    );
    assert!(
        after.contains("\"kind\":\"compaction\""),
        "replace must write a compaction record, got: {after}"
    );
}

/// S3 requirement 3: `clear()` semantics are explicit and non-destructive.
#[tokio::test]
async fn clear_empties_the_context_but_preserves_the_file() {
    let dir = TempDir::new().unwrap();
    let h = history(&dir);

    h.append("thread-1", user("kept on disk")).await.unwrap();
    let path = h.path();
    let before = std::fs::read_to_string(&path).unwrap();

    h.clear("thread-1").await.unwrap();

    assert!(h.messages("thread-1").await.unwrap().is_empty());
    assert!(path.exists(), "clear must not delete the transcript");

    let after = std::fs::read_to_string(&path).unwrap();
    assert!(
        after.starts_with(&before),
        "clear must append, not truncate"
    );
    assert!(
        after.contains("kept on disk"),
        "clear must preserve prior lines for the display read"
    );
}

#[tokio::test]
async fn clear_on_absent_transcript_is_a_noop_not_an_error() {
    let dir = TempDir::new().unwrap();
    history(&dir).clear("thread-1").await.unwrap();
}

/// Appending after a compaction continues from the replacement set, not from
/// the superseded lines — otherwise dropped context would resurrect itself.
#[tokio::test]
async fn append_after_compaction_extends_the_replacement_set() {
    let dir = TempDir::new().unwrap();
    let h = history(&dir);

    h.append("thread-1", user("old")).await.unwrap();
    h.replace("thread-1", vec![user("summary")]).await.unwrap();
    h.append("thread-1", user("new")).await.unwrap();

    assert_eq!(
        texts(&h.messages("thread-1").await.unwrap()),
        vec!["summary", "new"]
    );
}

/// An existing transcript's cumulative `_meta` wins over the handle's seed, so
/// reopening a session does not reset its turn/token rollups to zero.
#[tokio::test]
async fn existing_meta_is_preferred_over_the_seed() {
    let dir = TempDir::new().unwrap();
    history(&dir).append("thread-1", user("one")).await.unwrap();

    let mut stale_seed = meta();
    stale_seed.turn_count = 999;
    stale_seed.agent_name = "wrong".into();
    let reopened = SessionTranscriptHistory::new(dir.path(), STEM, stale_seed).unwrap();
    reopened.append("thread-1", user("two")).await.unwrap();

    let persisted = read_transcript(reopened.path()).unwrap();
    assert_eq!(persisted.meta.agent_name, "tester");
    assert_ne!(persisted.meta.turn_count, 999);
}

// ── S4: the `SessionHistory` write seam ──────────────────────────────

fn chat(role: &str, content: &str) -> ChatMessage {
    ChatMessage {
        id: None,
        role: role.into(),
        content: content.into(),
        extra_metadata: None,
    }
}

/// A turn's worth of provenance, with fixed timestamps so byte comparison is
/// not clock-dependent.
fn turn_usage() -> TurnUsage {
    TurnUsage {
        provider: "anthropic".into(),
        model: "claude-x".into(),
        usage: super::transcript::MessageUsage {
            input: 20,
            output: 8,
            cached_input: 0,
            context_window: 200_000,
            cost_usd: 0.002,
        },
        ts: "2026-08-07T10:00:05Z".into(),
        reasoning_content: Some("thinking".into()),
        tool_calls: vec![crate::openhuman::inference::provider::ToolCall {
            id: "call-1".into(),
            name: "get_weather".into(),
            arguments: r#"{"city":"NYC"}"#.into(),
            extra_content: None,
        }],
        iteration: 2,
    }
}

/// The core S4 correctness claim: `append_turn` is a **pure forwarder**.
///
/// The turn path stopped calling `append_transcript_turn` directly and now goes
/// through the handle. That is only safe if the handle changes nothing, so this
/// writes the same turn twice — once each way — and compares the files byte for
/// byte. Cheaper and stricter than re-projecting the result: it fails on any
/// transformation at all, not just ones the projection happens to notice.
#[test]
fn append_turn_is_byte_identical_to_the_free_function() {
    let direct_dir = TempDir::new().unwrap();
    let seam_dir = TempDir::new().unwrap();

    let messages = vec![
        chat("user", "what's the weather?"),
        chat("assistant", "72F and sunny."),
    ];
    let usage = turn_usage();

    let direct_path = resolve_keyed_transcript_path(direct_dir.path(), STEM).unwrap();
    append_transcript_turn(
        &direct_path,
        &[],
        &messages,
        &meta(),
        Some(&usage),
        Some("req-1"),
    )
    .unwrap();

    let seam = SessionTranscriptHistory::new(seam_dir.path(), STEM, meta()).unwrap();
    seam.append_turn(TranscriptTurn {
        prev: &[],
        next: &messages,
        meta: &meta(),
        turn_usage: Some(&usage),
        request_id: Some("req-1"),
    })
    .unwrap();

    assert_eq!(
        std::fs::read(&direct_path).unwrap(),
        std::fs::read(seam.path()).unwrap(),
        "append_turn must forward every argument unchanged"
    );
}

/// `new_in_dir` addresses a profile-scoped raw dir.
///
/// `new` hardcodes `{workspace}/session_raw/`, which is the wrong directory for
/// a dedicated-memory profile (`session_raw-<id>/`). Before this constructor
/// existed, wiring the handle into the turn path would have silently written a
/// profile session into the shared profile's transcripts.
#[test]
fn new_in_dir_writes_into_the_profile_scoped_directory() {
    let dir = TempDir::new().unwrap();
    let profile_dir = dir.path().join("session_raw-1");

    let h = SessionTranscriptHistory::new_in_dir(&profile_dir, STEM, meta()).unwrap();
    h.append_turn(TranscriptTurn {
        prev: &[],
        next: &[chat("user", "profile scoped")],
        meta: &meta(),
        turn_usage: None,
        request_id: None,
    })
    .unwrap();

    assert_eq!(
        h.path(),
        profile_dir.join(format!("{STEM}.jsonl")),
        "handle must be bound to the profile-scoped dir"
    );
    assert!(h.path().exists());
    assert!(
        !dir.path().join("session_raw").join(format!("{STEM}.jsonl")).exists(),
        "nothing may be written into the shared profile's session_raw/"
    );
    assert_eq!(
        read_transcript(h.path()).unwrap().messages[0].content,
        "profile scoped"
    );
}

/// The executable form of this module's "why the write does not cross the crate
/// trait" note: the same logical message set, written through `append_turn`
/// versus through `ChatHistory::replace`, produces display lines that differ in
/// exactly the three fields the trait cannot carry.
///
/// The trait-path assertions are not a bug being pinned — `replace` genuinely
/// has nowhere to put this data. They are here so that anyone tempted to route
/// the turn path through `ChatHistory` sees the cost first.
#[tokio::test]
async fn trait_path_loses_the_provenance_that_append_turn_preserves() {
    let usage = turn_usage();
    let messages = vec![chat("assistant", "72F and sunny.")];

    // Seam path: request_id + turn_usage reach the line.
    let seam_dir = TempDir::new().unwrap();
    let seam = history(&seam_dir);
    seam.append_turn(TranscriptTurn {
        prev: &[],
        next: &messages,
        meta: &meta(),
        turn_usage: Some(&usage),
        request_id: Some("req-1"),
    })
    .unwrap();
    let seam_line = first_display_message(seam.path());
    assert_eq!(seam_line.message.request_id.as_deref(), Some("req-1"));
    let seam_usage = seam_line.message.turn_usage.expect("turn_usage persisted");
    assert_eq!(seam_usage.model, "claude-x");
    assert_eq!(seam_usage.iteration, 2);
    assert_eq!(seam_usage.tool_calls.len(), 1);

    // Trait path: the same messages, none of the provenance.
    let trait_dir = TempDir::new().unwrap();
    let trait_history = history(&trait_dir);
    trait_history
        .replace(
            "thread-1",
            vec![Message::Assistant(
                tinyagents::harness::message::AssistantMessage {
                    content: vec![tinyagents::harness::message::ContentBlock::Text(
                        "72F and sunny.".into(),
                    )],
                    tool_calls: vec![],
                },
            )],
        )
        .await
        .unwrap();
    let trait_line = first_display_message(trait_history.path());
    assert!(
        trait_line.message.request_id.is_none(),
        "ChatHistory has no channel for request_id — no turn boundary"
    );
    assert!(
        trait_line.message.turn_usage.is_none(),
        "ChatHistory has no channel for turn_usage — no model/iteration/tool calls"
    );
}

/// First `role != "system"` display message line of a transcript.
fn first_display_message(
    path: &Path,
) -> crate::openhuman::agent::harness::session::transcript::DisplayMessage {
    read_transcript_display(path)
        .unwrap()
        .records
        .into_iter()
        .find_map(|r| match r {
            crate::openhuman::agent::harness::session::transcript::DisplayRecord::Message(m)
                if m.message.role != "system" =>
            {
                Some(m)
            }
            _ => None,
        })
        .expect("a display message line")
}
