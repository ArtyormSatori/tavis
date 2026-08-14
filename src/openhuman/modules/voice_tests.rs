//! Tests for the voice call client.
//!
//! Nothing here loads a module. What is testable without one is the part
//! that decides what a caller does next: the intent wire contract, the
//! mode spellings, and that the unavailable path is reached without a
//! broker. The round trips themselves are covered where they can be
//! honest — `tinyvoice`'s own loader E2E, which drives a real module over
//! a real broker against the published artifact.

use super::{encode_samples, HallucinationMode, VoiceCallError, VoiceIntent};
use crate::openhuman::config::Config;
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
