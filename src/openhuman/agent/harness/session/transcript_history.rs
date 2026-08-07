//! [`ChatHistory`] over OpenHuman's durable `session_raw` transcript.
//!
//! This is the seam chosen in `docs/specs/2026-07-28-agent-session-transcript-to-tinyagents-design.md`
//! §4 Option A: the harness talks to the crate's
//! [`tinyagents::harness::memory::ChatHistory`] trait, while OpenHuman keeps
//! ownership of the on-disk format. Nothing about `session_raw` moves, so
//! there is no on-disk change and no migration risk — the previous parallel
//! abstraction is what goes away.
//!
//! [`SessionTranscriptHistory`] is a thin handle over the free functions in
//! [`super::transcript`]. It holds no state beyond the transcript's identity,
//! so it is cheap to construct per turn and safe to share.
//!
//! # Why the trait's `thread_id` is not used for path resolution
//!
//! `ChatHistory` is keyed by `thread_id`, but a `session_raw` transcript is
//! keyed by its **stem** (`{unix_ts}_{agent_id}`, or `{parent_chain}__…` for a
//! sub-agent). These are deliberately different: several transcripts can share
//! one `_meta.thread_id` — every sub-agent spawned within a thread does — so
//! resolving a path from `thread_id` would be ambiguous and could interleave
//! two agents' histories into one file.
//!
//! The handle is therefore bound to one transcript at construction, and the
//! `thread_id` argument is accepted for trait conformance only. Callers that
//! genuinely want thread-level lookup use
//! [`super::transcript::find_root_transcript_for_thread`].
//!
//! # Append-only, including `clear`
//!
//! Every mutation routes through
//! [`append_transcript_turn`][super::transcript::append_transcript_turn], which
//! never rewrites existing lines. A reduction in the logical message set
//! becomes a `{"kind":"compaction","replacement":[…]}` record rather than a
//! file rewrite. That includes [`SessionTranscriptHistory::clear`] — see its
//! doc comment for the semantics that were chosen and why.

use std::path::{Path, PathBuf};

use async_trait::async_trait;
use tinyagents::harness::memory::ChatHistory;
use tinyagents::harness::message::Message;
use tinyagents::{Result as TaResult, TinyAgentsError};

use crate::openhuman::agent::message_convert::{history_to_messages, message_to_chat_message};
use crate::openhuman::agent::messages::ChatMessage;

use super::transcript::{
    append_transcript_turn, read_transcript, resolve_keyed_transcript_path, SessionTranscript,
    TranscriptMeta,
};

/// A [`ChatHistory`] backed by one `session_raw/{stem}.jsonl` transcript.
///
/// Construct with [`SessionTranscriptHistory::new`]. The `seed_meta` is used
/// only when the transcript file does not exist yet; for an existing file the
/// authoritative cumulative `_meta` is read back from disk so turn counts and
/// token rollups keep accumulating rather than resetting.
pub struct SessionTranscriptHistory {
    /// Workspace root; `session_raw/` hangs off this.
    workspace_dir: PathBuf,
    /// Transcript stem identifying this session's file.
    stem: String,
    /// `_meta` used for the very first write, before a file exists.
    seed_meta: TranscriptMeta,
}

impl SessionTranscriptHistory {
    /// Binds a history handle to the transcript identified by `stem` under
    /// `workspace_dir`.
    pub fn new(
        workspace_dir: impl Into<PathBuf>,
        stem: impl Into<String>,
        seed_meta: TranscriptMeta,
    ) -> Self {
        Self {
            workspace_dir: workspace_dir.into(),
            stem: stem.into(),
            seed_meta,
        }
    }

    /// Resolves this handle's transcript path, creating `session_raw/` if
    /// needed.
    fn path(&self) -> TaResult<PathBuf> {
        resolve_keyed_transcript_path(&self.workspace_dir, &self.stem).map_err(memory_err)
    }

    /// Reads the current transcript, or `None` when no file exists yet.
    ///
    /// A missing transcript is the normal first-turn state, not an error.
    fn read(&self, path: &Path) -> TaResult<Option<SessionTranscript>> {
        if !path.exists() {
            return Ok(None);
        }
        read_transcript(path).map(Some).map_err(memory_err)
    }

    /// The logical (model-context) message set currently on disk.
    ///
    /// Routes through [`read_transcript`], so compaction records have already
    /// replaced the accumulator and `interrupted: true` partials are skipped.
    fn persisted(&self, path: &Path) -> TaResult<Vec<ChatMessage>> {
        Ok(self.read(path)?.map(|t| t.messages).unwrap_or_default())
    }

    /// The `_meta` to write: the file's own cumulative meta when it exists,
    /// otherwise this handle's seed.
    fn meta_for_write(&self, path: &Path) -> TaResult<TranscriptMeta> {
        Ok(self
            .read(path)?
            .map(|t| t.meta)
            .unwrap_or_else(|| self.seed_meta.clone()))
    }

    /// Writes `next` as the new logical set, diffing against what is persisted.
    ///
    /// Delegates the extension-vs-compaction decision to
    /// [`append_transcript_turn`] rather than deciding here, so this seam
    /// cannot drift from the format's own rule.
    fn write_logical_set(&self, next: &[ChatMessage]) -> TaResult<()> {
        let path = self.path()?;
        let prev = self.persisted(&path)?;
        let meta = self.meta_for_write(&path)?;
        append_transcript_turn(&path, &prev, next, &meta, None, None).map_err(memory_err)
    }
}

#[async_trait]
impl ChatHistory for SessionTranscriptHistory {
    /// Returns the **model-context** replay of this transcript.
    ///
    /// This is deliberately the same path the resume flow uses, not the raw
    /// line set: compaction records replace the accumulator and interrupted
    /// partials are dropped, so a resumed context never carries a truncated
    /// answer. Use
    /// [`read_transcript_display`][super::transcript::read_transcript_display]
    /// when rendering history for a human instead.
    ///
    /// An absent transcript yields an empty `Vec`, per the trait contract.
    async fn messages(&self, _thread_id: &str) -> TaResult<Vec<Message>> {
        let path = self.path()?;
        Ok(history_to_messages(&self.persisted(&path)?))
    }

    /// Appends one message to the end of the transcript.
    ///
    /// Extending the persisted set writes only the new tail line.
    async fn append(&self, _thread_id: &str, message: Message) -> TaResult<()> {
        let path = self.path()?;
        let mut next = self.persisted(&path)?;
        next.push(message_to_chat_message(&message));
        self.write_logical_set(&next)
    }

    /// Replaces the logical message set with `messages`.
    ///
    /// This maps onto the compaction-record path, **not** a file rewrite: when
    /// `messages` is no longer an extension of what is on disk,
    /// [`append_transcript_turn`] appends a single
    /// `{"kind":"compaction","replacement":[…]}` record carrying the full
    /// reduced set and leaves every earlier line in place. The trait's default
    /// implementation (clear-then-append) would destroy that history, which is
    /// why this override exists.
    async fn replace(&self, _thread_id: &str, messages: Vec<Message>) -> TaResult<()> {
        let next: Vec<ChatMessage> = messages.iter().map(message_to_chat_message).collect();
        self.write_logical_set(&next)
    }

    /// Empties the **model context** while preserving the transcript on disk.
    ///
    /// Semantics chosen (S3 requires this be explicit): `clear` appends a
    /// compaction record with an empty `replacement`. Afterwards
    /// [`messages`][Self::messages] returns empty, but every prior line — and
    /// so the display read, usage rollups, and audit trail — survives.
    ///
    /// The two rejected alternatives, recorded so this is not re-litigated:
    /// truncating the file breaks the append-only invariant that the whole
    /// format rests on, and starting a fresh stem would silently orphan the
    /// session's history from its thread. A no-op on an absent transcript, per
    /// the trait contract.
    async fn clear(&self, _thread_id: &str) -> TaResult<()> {
        let path = self.path()?;
        if !path.exists() {
            return Ok(());
        }
        self.write_logical_set(&[])
    }
}

/// Maps a transcript I/O failure into the crate's error type.
///
/// `ChatHistory` is a `harness::memory` surface, so its failures classify as
/// [`TinyAgentsError::Memory`]. The `anyhow` context chain is flattened into
/// the message via `{:#}` so the underlying cause is not lost.
fn memory_err(err: anyhow::Error) -> TinyAgentsError {
    TinyAgentsError::Memory(format!("session transcript: {err:#}"))
}

#[cfg(test)]
#[path = "transcript_history_tests.rs"]
mod tests;
