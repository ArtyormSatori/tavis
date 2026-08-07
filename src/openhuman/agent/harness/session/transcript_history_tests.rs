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
    SessionTranscriptHistory::new(dir.path(), STEM, meta())
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
    let path = h.path().unwrap();
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

    let path = h.path().unwrap();
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
    let path = h.path().unwrap();
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
    let reopened = SessionTranscriptHistory::new(dir.path(), STEM, stale_seed);
    reopened.append("thread-1", user("two")).await.unwrap();

    let persisted = read_transcript(&reopened.path().unwrap()).unwrap();
    assert_eq!(persisted.meta.agent_name, "tester");
    assert_ne!(persisted.meta.turn_count, 999);
}
