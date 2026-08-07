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
//!
//! # Why the metadata-bearing write does not cross the crate trait
//!
//! S4 of the design doc is worded as "the turn path takes `Arc<dyn
//! ChatHistory>`", but that wording conflicts with S4's own exit criterion
//! ("`threads/transcript_view` projection output unchanged"). The crate trait
//! (`vendor/tinyagents/src/harness/memory/types.rs`) has exactly four methods,
//! and every one of them carries only a `thread_id: &str` plus `Message` /
//! `Vec<Message>`. Three things the turn path persists therefore have **no
//! channel**:
//!
//! - **`request_id`** — stamped on every line of a turn. It drives
//!   `DisplayItem::TurnBoundary` (`threads/transcript_view/project.rs`,
//!   `maybe_emit_turn_boundary`) and the `(request_id, ts)` root-turn segments
//!   that anchor every `DisplayItem::Subagent`. Lose it and the transcript view
//!   silently stops showing turn structure.
//! - **`turn_usage`** — attributed to the last assistant row. It carries
//!   `model`, `iteration`, `ts`, `reasoning_content` and the native
//!   `tool_calls`. The projection reads **every** `DisplayItem::ToolCall` off
//!   `turn_usage.tool_calls`, so losing it does not degrade the tool rows, it
//!   deletes them — after which each following `role:"tool"` line falls through
//!   to the orphan branch. `Reasoning` items vanish with it, and
//!   `AssistantMessage.{model,iteration}` / `interim` collapse.
//! - **`TranscriptMeta`'s cumulative fields** — `turn_count` and the four
//!   token/cost rollups that `read_thread_usage_summary` (`threads/ops.rs`)
//!   reports. The turn path computes these fresh each turn;
//!   [`SessionTranscriptHistory::meta_for_write`] deliberately re-reads the
//!   file's existing `_meta` instead, which is right for the generic trait path
//!   but would freeze the rollups at the previous turn's values if the turn
//!   path used it.
//!
//! So the turn path goes through [`SessionHistory::append_turn`] — an
//! OpenHuman-side supertrait of `ChatHistory` whose one method forwards the
//! same six arguments `append_transcript_turn` already takes. The indirection
//! is real (`Arc<dyn SessionHistory>`), the on-disk bytes are unchanged by
//! construction, and `ChatHistory` stays in the bound so the handle is still a
//! genuine crate-side history for any future consumer.
//!
//! ## Two alternatives, rejected — recorded so they are not re-litigated
//!
//! 1. **Per-message `ChatHistory::append`.** One `append_transcript_turn` per
//!    message means one `_meta` line and one full-file re-read per message:
//!    an on-disk change *and* O(n²) I/O on a file that grows without bound.
//! 2. **Widening `ChatHistory` upstream.** It does not close the gap either.
//!    The crate's `Usage` has no `cost_usd` / `context_window`;
//!    `TranscriptMeta` is a cumulative *file header*, not turn provenance; and
//!    the per-message tool-failure `extra_metadata` that
//!    `message_to_chat_message` drops is untouchable by any turn-level record.
//!    You would pay a tinyagents release and still need a
//!    `serde_json::Value` escape hatch, for a trait that has no consumer inside
//!    the vendored crate outside `harness/memory/`.

use std::path::{Path, PathBuf};

use async_trait::async_trait;
use tinyagents::harness::memory::ChatHistory;
use tinyagents::harness::message::Message;
use tinyagents::{Result as TaResult, TinyAgentsError};

use crate::openhuman::agent::message_convert::{history_to_messages, message_to_chat_message};
use crate::openhuman::agent::messages::ChatMessage;

use super::transcript::{
    append_transcript_turn, read_transcript, resolve_keyed_transcript_path,
    resolve_keyed_transcript_path_in_dir, SessionTranscript, TranscriptMeta, TurnUsage,
};

/// One turn's worth of transcript write, borrowed.
///
/// The fields mirror [`append_transcript_turn`]'s argument list one-for-one and
/// in order, so [`SessionHistory::append_turn`]'s forwarding is visually
/// checkable against the format's own signature. Nothing is transformed on the
/// way through; that is the entire correctness claim of this seam and
/// `append_turn_is_byte_identical_to_the_free_function` in the tests pins it.
///
/// `prev` is a field rather than handle state on purpose: the turn path tracks
/// the previously-persisted logical set in memory on `Agent`
/// (`persisted_transcript_messages`) precisely so it never has to re-read a
/// growing file, and a disk re-read is not a faithful substitute — see
/// [`SessionTranscriptHistory::write_logical_set`].
pub struct TranscriptTurn<'a> {
    /// Logical message set already persisted, for the extension-vs-compaction diff.
    pub prev: &'a [ChatMessage],
    /// Logical message set after this turn.
    pub next: &'a [ChatMessage],
    /// `_meta` header to append after this turn's lines.
    pub meta: &'a TranscriptMeta,
    /// Usage + provenance attributed to the turn's last assistant row.
    pub turn_usage: Option<&'a TurnUsage>,
    /// Web-chat request id, stamped on every line of the turn.
    pub request_id: Option<&'a str>,
}

/// The seam the live turn path holds as `Arc<dyn SessionHistory>`.
///
/// `ChatHistory` is a supertrait rather than a sibling for two reasons: it
/// supplies the `Send + Sync + 'static` bounds the shared handle needs, and it
/// keeps the crate-side surface (S2/S3) live rather than orphaned. See this
/// module's header for why the turn write cannot simply *be* a `ChatHistory`
/// call.
///
/// `append_turn` is deliberately **sync**: `persist_session_transcript` is a
/// sync `&mut self` method and the whole write chain under it is sync, so an
/// async method here would ripple `.await` through the turn loop for no gain.
pub(crate) trait SessionHistory: ChatHistory {
    /// Appends one turn, forwarding every argument to the format owner.
    fn append_turn(&self, turn: TranscriptTurn<'_>) -> anyhow::Result<()>;
}

/// A [`ChatHistory`] backed by one `session_raw/{stem}.jsonl` transcript.
///
/// Construct with [`SessionTranscriptHistory::new`] (workspace-rooted, i.e.
/// `{workspace}/session_raw/`) or [`SessionTranscriptHistory::new_in_dir`] (an
/// explicit raw dir — **required** for a dedicated-memory profile, whose
/// sessions live in `session_raw-<id>/`). The `seed_meta` is used only when the
/// transcript file does not exist yet; for an existing file the authoritative
/// cumulative `_meta` is read back from disk so turn counts and token rollups
/// keep accumulating rather than resetting.
pub struct SessionTranscriptHistory {
    /// Fully-resolved transcript file, fixed at construction.
    ///
    /// Resolved eagerly rather than derived per call from a `(workspace, stem)`
    /// pair: the old shape hardcoded `{workspace}/session_raw/`, which is the
    /// **wrong directory** for a profile-scoped session and would have silently
    /// cross-written into the shared profile's transcripts the moment this
    /// handle was wired into the turn path.
    path: PathBuf,
    /// `_meta` used for the very first write, before a file exists.
    seed_meta: TranscriptMeta,
}

impl SessionTranscriptHistory {
    /// Binds a history handle to `{workspace_dir}/session_raw/{stem}.jsonl`.
    ///
    /// Use [`Self::new_in_dir`] when the session is profile-scoped; this
    /// convenience constructor always resolves under the shared `session_raw/`.
    pub fn new(
        workspace_dir: impl AsRef<Path>,
        stem: &str,
        seed_meta: TranscriptMeta,
    ) -> anyhow::Result<Self> {
        let path = resolve_keyed_transcript_path(workspace_dir.as_ref(), stem)?;
        log::debug!(
            "[transcript-history] bound stem={stem} path={}",
            path.display()
        );
        Ok(Self { path, seed_meta })
    }

    /// Binds a history handle to `{session_raw_dir}/{stem}.jsonl`.
    ///
    /// `session_raw_dir` is `{workspace}/{session_raw_subdir}` — `session_raw`
    /// for the shared profile, `session_raw-<id>` for a dedicated-memory one.
    /// The turn path must use this constructor; see [`Self::path`]'s note.
    pub fn new_in_dir(
        session_raw_dir: impl AsRef<Path>,
        stem: &str,
        seed_meta: TranscriptMeta,
    ) -> anyhow::Result<Self> {
        let path = resolve_keyed_transcript_path_in_dir(session_raw_dir.as_ref(), stem)?;
        log::debug!(
            "[transcript-history] bound stem={stem} path={}",
            path.display()
        );
        Ok(Self { path, seed_meta })
    }

    /// This handle's transcript file.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Reads the current transcript, or `None` when no file exists yet.
    ///
    /// A missing transcript is the normal first-turn state, not an error.
    fn read(&self) -> TaResult<Option<SessionTranscript>> {
        if !self.path.exists() {
            return Ok(None);
        }
        read_transcript(&self.path).map(Some).map_err(memory_err)
    }

    /// The logical (model-context) message set currently on disk.
    ///
    /// Routes through [`read_transcript`], so compaction records have already
    /// replaced the accumulator and `interrupted: true` partials are skipped.
    fn persisted(&self) -> TaResult<Vec<ChatMessage>> {
        Ok(self.read()?.map(|t| t.messages).unwrap_or_default())
    }

    /// The `_meta` to write: the file's own cumulative meta when it exists,
    /// otherwise this handle's seed.
    ///
    /// Correct for the generic `ChatHistory` path, which has no channel for a
    /// caller-computed meta. The **turn path must never route through here** —
    /// it computes `turn_count` and the four token/cost rollups fresh each turn,
    /// and re-reading the file's `_meta` would freeze them at the previous
    /// turn's values, silently breaking `read_thread_usage_summary`.
    fn meta_for_write(&self) -> TaResult<TranscriptMeta> {
        Ok(self
            .read()?
            .map(|t| t.meta)
            .unwrap_or_else(|| self.seed_meta.clone()))
    }

    /// Writes `next` as the new logical set, diffing against what is persisted.
    ///
    /// Routes through [`SessionHistory::append_turn`] so every write in this
    /// module — trait-driven and turn-path alike — funnels through one call to
    /// [`append_transcript_turn`], and the extension-vs-compaction decision
    /// stays with the format owner rather than drifting here.
    ///
    /// The `self.persisted()` disk re-read is what the generic trait path has
    /// to do, and is deliberately **not** what the turn path does.
    /// [`read_transcript`] reconstructs `ChatMessage`s from line records: the
    /// `failure` / `failure_detail` fields have been lifted out of
    /// `extra_metadata` and turn-usage fields hoisted to top-level line fields.
    /// Feeding that back in as `prev` would make `common_prefix_len` mismatch
    /// at the first such message, so the writer would emit a full compaction
    /// record — re-appending the entire message set — on every single turn.
    fn write_logical_set(&self, next: &[ChatMessage]) -> TaResult<()> {
        let prev = self.persisted()?;
        let meta = self.meta_for_write()?;
        self.append_turn(TranscriptTurn {
            prev: &prev,
            next,
            meta: &meta,
            turn_usage: None,
            request_id: None,
        })
        .map_err(memory_err)
    }
}

impl SessionHistory for SessionTranscriptHistory {
    /// Pure forwarder: every argument reaches [`append_transcript_turn`]
    /// untouched, so the bytes this writes are identical to what the free
    /// function would have written at the call site.
    fn append_turn(&self, turn: TranscriptTurn<'_>) -> anyhow::Result<()> {
        log::debug!(
            "[transcript-history] append_turn prev={} next={} usage={} request_id={:?} path={}",
            turn.prev.len(),
            turn.next.len(),
            turn.turn_usage.is_some(),
            turn.request_id,
            self.path.display()
        );
        append_transcript_turn(
            &self.path,
            turn.prev,
            turn.next,
            turn.meta,
            turn.turn_usage,
            turn.request_id,
        )
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
        Ok(history_to_messages(&self.persisted()?))
    }

    /// Appends one message to the end of the transcript.
    ///
    /// Extending the persisted set writes only the new tail line.
    async fn append(&self, _thread_id: &str, message: Message) -> TaResult<()> {
        let mut next = self.persisted()?;
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
        if !self.path.exists() {
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
