//! Calling the `tinyvoice` module: the voice primitives, over the bus.
//!
//! Each function here is the host half of one method on
//! `ai.tinyhumans.tinyvoice.Voice`. They exist so the voice domain does not
//! have to know about proxies, base64 framing, or wire error names — a caller
//! asks a question about a transcript or a buffer and gets an answer.
//!
//! # Everything here is per-utterance, on purpose
//!
//! A transcript in, a verdict out; a recording in, a container out. Nothing in
//! this file is called at frame rate, and that is the boundary the module was
//! designed around.
//!
//! **The VAD is the deliberate exception and stays host-side.**
//! [`crate::openhuman::voice::always_on`] drives a segmenter once per 20 ms
//! frame from inside a `cpal` callback, and routing that through a bus would
//! put a serialization round trip on the one path measured in milliseconds —
//! to move a sixty-line state machine that has no dependencies to shed. The
//! module offers a batch `Segment` for offline use; the always-on loop is not
//! that. See the note in `tinyvoice-module`'s crate docs.
//!
//! # Failure is not fatal here
//!
//! Every function returns a [`VoiceCallError`] the caller can fall back from,
//! and the callers do. A module that will not load must degrade voice to its
//! pre-module behaviour — deferring to the agent, or skipping a filter — rather
//! than taking dictation down with it. The one thing none of them may do is
//! guess: see [`is_hallucinated`].

use serde::Deserialize;

use super::{host, ops, registry};
use crate::openhuman::config::Config;

/// Registry id of the module these calls go to.
const MODULE_ID: &str = "tinyvoice";

/// Why a voice call did not produce an answer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VoiceCallError {
    /// The module is not loaded and cannot be: unsupported host, downloads off,
    /// disabled in config, or a load that already failed in this process.
    Unavailable(String),
    /// The call itself failed — a malformed payload, or a refused argument.
    Failed(String),
}

impl std::fmt::Display for VoiceCallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unavailable(message) | Self::Failed(message) => f.write_str(message),
        }
    }
}

/// Which hallucination list applies, mirroring `tinyvoice::transcript::Mode`.
///
/// Redeclared here rather than imported because this crate does not depend on
/// `tinyvoice` — the module is the only link, and its interface speaks strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HallucinationMode {
    /// Push-to-talk dictation. Aggressive.
    Dictation,
    /// Chat voice input. Conservative.
    Conversation,
}

impl HallucinationMode {
    /// The wire value the module expects.
    fn as_wire(self) -> &'static str {
        match self {
            Self::Dictation => "dictation",
            Self::Conversation => "conversation",
        }
    }
}

/// A recognised fast-path voice command, or `Unknown`.
///
/// Deserialized from the module's tagged JSON. The variants and their payload
/// names are the wire contract — renaming one here silently turns it into
/// `Unknown`, which is why [`VoiceIntent::Unknown`] carries the catch-all
/// `#[serde(other)]` and the tests below pin every tag.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "intent", rename_all = "snake_case")]
pub enum VoiceIntent {
    /// "play <song/artist>".
    Play {
        /// The cleaned search query.
        query: String,
    },
    /// Pause playback.
    Pause,
    /// Resume playback.
    Resume,
    /// Skip to the next track.
    Next,
    /// Go back to the previous track.
    Previous,
    /// "open/launch/start <app>".
    OpenApp {
        /// The cleaned application name.
        app: String,
    },
    /// "set volume to N", absolute `0..=100`.
    SetVolume {
        /// Target volume percentage.
        percent: u8,
    },
    /// Raise the volume.
    VolumeUp,
    /// Lower the volume.
    VolumeDown,
    /// Mute audio output.
    Mute,
    /// Unmute audio output.
    Unmute,
    /// Not a confident fast command — defer to the agent.
    #[serde(other)]
    Unknown,
}

/// Classify a command transcript into a fast-path intent.
///
/// The transcript should already have had its wake word removed by
/// [`extract_command`].
///
/// # Errors
///
/// [`VoiceCallError`] when the module is unavailable or the call fails. A
/// caller should treat that as [`VoiceIntent::Unknown`] and hand the transcript
/// to the agent — the fast path is an optimisation, and losing it costs a round
/// trip rather than the request.
pub async fn route(config: &Config, transcript: &str) -> Result<VoiceIntent, VoiceCallError> {
    let json: String = call(config, "Route", (transcript,)).await?;
    serde_json::from_str(&json)
        .map_err(|e| VoiceCallError::Failed(format!("could not decode intent: {e}")))
}

/// Apply the wake-word gate, returning the command that followed it.
///
/// `None` means the utterance was not addressed to the agent, or the wake word
/// arrived with nothing after it. Those are the same outcome for a caller, and
/// the module represents both as an empty string.
///
/// # Errors
///
/// [`VoiceCallError`] when the module is unavailable or the call fails.
pub async fn extract_command(
    config: &Config,
    transcript: &str,
    wake_word: &str,
) -> Result<Option<String>, VoiceCallError> {
    let command: String = call(config, "ExtractCommand", (transcript, wake_word)).await?;
    Ok(if command.is_empty() {
        None
    } else {
        Some(command)
    })
}

/// Whether the wake word appears near the start of a transcript.
///
/// Distinguished from [`extract_command`] so a caller can acknowledge a bare
/// "Hey Tiny", which otherwise reads to the user as a dead microphone.
///
/// # Errors
///
/// [`VoiceCallError`] when the module is unavailable or the call fails.
pub async fn wake_word_present(
    config: &Config,
    transcript: &str,
    wake_word: &str,
) -> Result<bool, VoiceCallError> {
    call(config, "WakeWordPresent", (transcript, wake_word)).await
}

/// Whether an STT transcript looks like a hallucination rather than speech.
///
/// # Errors
///
/// [`VoiceCallError`] when the module is unavailable or the call fails.
///
/// **A caller that cannot reach the module must not guess.** Treating an error
/// as "hallucinated" silently deletes real speech; treating it as "clean" lets
/// `[BLANK_AUDIO]` reach the agent as an instruction. Of the two, passing the
/// text through is recoverable and losing it is not, so callers here fall open
/// — and say so at the call site rather than burying it in a default.
pub async fn is_hallucinated(
    config: &Config,
    text: &str,
    mode: HallucinationMode,
) -> Result<bool, VoiceCallError> {
    call(config, "IsHallucinated", (text, mode.as_wire())).await
}

/// Downmix, resample to 16 kHz, optionally silence-gate, and frame as WAV.
///
/// This is the whole capture-side pipeline in one call. Three separate calls
/// would ship the same audio across the bus three times to do work that is
/// microseconds of arithmetic.
///
/// `samples` are interleaved `f32`; `gate_threshold` of zero disables the
/// silence gate.
///
/// # Errors
///
/// [`VoiceCallError`], including a `Failed` when `samples` is not a whole
/// number of frames for `channels`.
pub async fn prepare_capture(
    config: &Config,
    samples: &[f32],
    source_rate: u32,
    channels: u16,
    gate_threshold: f32,
) -> Result<Vec<u8>, VoiceCallError> {
    let encoded = encode_samples(samples);
    let wav: String = call(
        config,
        "PrepareCapture",
        (encoded, source_rate, channels, gate_threshold),
    )
    .await?;
    decode_audio(&wav)
}

/// Frame mono `f32` samples as a 16-bit PCM WAV file.
///
/// # Errors
///
/// [`VoiceCallError`] when the module is unavailable or the call fails.
pub async fn encode_wav(
    config: &Config,
    samples: &[f32],
    sample_rate: u32,
) -> Result<Vec<u8>, VoiceCallError> {
    let encoded = encode_samples(samples);
    let wav: String = call(config, "EncodeWav", (encoded, sample_rate)).await?;
    decode_audio(&wav)
}

/// Load the voice module if it is not already serving.
///
/// Callers do not have to invoke this — every operation above does it — but a
/// caller that wraps its work in a deadline should, *outside* that deadline. A
/// first use may download and verify an artifact, and charging that against a
/// dictation timeout means the first utterance a user ever speaks is the one
/// that fails.
///
/// # Errors
///
/// The same [`VoiceCallError::Unavailable`] the operations return.
pub async fn ensure_ready(config: &Config) -> Result<(), VoiceCallError> {
    ops::ensure_loaded(config, MODULE_ID)
        .await
        .map_err(VoiceCallError::Unavailable)
}

/// Base64 little-endian `f32`, which is how the interface carries samples.
fn encode_samples(samples: &[f32]) -> String {
    use base64::Engine as _;
    let bytes: Vec<u8> = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

/// Decode a base64 audio payload the module produced.
fn decode_audio(encoded: &str) -> Result<Vec<u8>, VoiceCallError> {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| VoiceCallError::Failed(format!("module returned invalid base64: {e}")))
}

/// Ensure the module is serving, then make one call on it.
async fn call<A, R>(config: &Config, method: &str, args: A) -> Result<R, VoiceCallError>
where
    A: serde::Serialize + Send,
    R: serde::de::DeserializeOwned,
{
    ops::ensure_loaded(config, MODULE_ID)
        .await
        .map_err(VoiceCallError::Unavailable)?;
    let record = registry::find(MODULE_ID)
        .ok_or_else(|| VoiceCallError::Unavailable(format!("unknown module '{MODULE_ID}'")))?;
    let runtime = host::runtime()
        .await
        .map_err(|_| VoiceCallError::Unavailable("the module bus is not running".to_string()))?;
    let proxy = runtime
        .proxy(record.bus_name, record.object_path)
        .map_err(|error| VoiceCallError::Failed(error.to_string()))?;

    proxy
        .call(method, args)
        .await
        .map_err(|error| classify(&error))
}

/// Map a wire error onto the two outcomes a caller distinguishes.
fn classify(error: &tinybus::Error) -> VoiceCallError {
    let message = error.to_string();
    match error.wire_name() {
        // Loaded but not answering: refused, faulted, or gone.
        name if name.contains("ModuleUnavailable") => VoiceCallError::Unavailable(message),
        _ => VoiceCallError::Failed(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The intent tags are a wire contract with the module. A rename on either
    /// side turns a real command into `Unknown`, which degrades silently — the
    /// user's "pause" simply goes to the agent instead — so every tag is
    /// pinned here rather than trusted to match by inspection.
    #[test]
    fn every_intent_tag_decodes() {
        let cases: &[(&str, VoiceIntent)] = &[
            (r#"{"intent":"pause"}"#, VoiceIntent::Pause),
            (r#"{"intent":"resume"}"#, VoiceIntent::Resume),
            (r#"{"intent":"next"}"#, VoiceIntent::Next),
            (r#"{"intent":"previous"}"#, VoiceIntent::Previous),
            (r#"{"intent":"volume_up"}"#, VoiceIntent::VolumeUp),
            (r#"{"intent":"volume_down"}"#, VoiceIntent::VolumeDown),
            (r#"{"intent":"mute"}"#, VoiceIntent::Mute),
            (r#"{"intent":"unmute"}"#, VoiceIntent::Unmute),
            (r#"{"intent":"unknown"}"#, VoiceIntent::Unknown),
            (
                r#"{"intent":"set_volume","percent":40}"#,
                VoiceIntent::SetVolume { percent: 40 },
            ),
            (
                r#"{"intent":"play","query":"numb"}"#,
                VoiceIntent::Play {
                    query: "numb".to_string(),
                },
            ),
            (
                r#"{"intent":"open_app","app":"slack"}"#,
                VoiceIntent::OpenApp {
                    app: "slack".to_string(),
                },
            ),
        ];
        for (json, expected) in cases {
            let decoded: VoiceIntent = serde_json::from_str(json).expect(json);
            assert_eq!(&decoded, expected, "decoding {json}");
        }
    }

    #[test]
    fn an_unrecognised_tag_degrades_to_unknown_rather_than_failing() {
        // A module newer than this host may name an intent we have never heard
        // of. Deferring to the agent is the correct handling; a decode error
        // would turn a forward-compatible addition into a broken call.
        let decoded: VoiceIntent =
            serde_json::from_str(r#"{"intent":"summon_helicopter"}"#).expect("decodes");
        assert_eq!(decoded, VoiceIntent::Unknown);
    }

    #[test]
    fn hallucination_modes_use_the_wire_spelling() {
        // The module rejects an unknown mode rather than defaulting, so a typo
        // here is a hard failure at runtime rather than a silent mode swap.
        assert_eq!(HallucinationMode::Dictation.as_wire(), "dictation");
        assert_eq!(HallucinationMode::Conversation.as_wire(), "conversation");
    }

    #[test]
    fn samples_encode_as_little_endian_f32() {
        use base64::Engine as _;
        let encoded = encode_samples(&[1.0f32, -1.0f32]);
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&encoded)
            .expect("valid base64");
        assert_eq!(bytes.len(), 8);
        assert_eq!(&bytes[0..4], &1.0f32.to_le_bytes());
        assert_eq!(&bytes[4..8], &(-1.0f32).to_le_bytes());
    }

    #[test]
    fn errors_render_as_their_message() {
        assert_eq!(
            VoiceCallError::Unavailable("downloads are off".to_string()).to_string(),
            "downloads are off"
        );
        assert_eq!(
            VoiceCallError::Failed("bad payload".to_string()).to_string(),
            "bad payload"
        );
    }
}
