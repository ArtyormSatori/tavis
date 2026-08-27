use openhuman_core::openhuman::tavis::voice::{default_tts_catalog, TtsExecutionKind};

#[test]
fn initial_tts_catalog_contains_exact_required_engines() {
    let catalog = default_tts_catalog();
    let ids: Vec<_> = catalog.iter().map(|entry| entry.id).collect();
    assert_eq!(ids, vec![
        "edge-tts", "openai", "elevenlabs", "kokoro-82m", "supertonic-3", "piper", "styletts2-lite"
    ]);
}

#[test]
fn tts_catalog_declares_real_execution_surface_for_every_engine() {
    for entry in default_tts_catalog() {
        assert_ne!(entry.execution, TtsExecutionKind::Unimplemented, "{} must have an execution path", entry.id);
    }
}
