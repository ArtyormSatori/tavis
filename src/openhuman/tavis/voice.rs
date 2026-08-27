#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TtsExecutionKind {
    VoiceProviderRegistry,
    NativePiper,
    LocalCommandAdapter,
    Unimplemented,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TtsCatalogEntry {
    pub id: &'static str,
    pub execution: TtsExecutionKind,
}

pub fn default_tts_catalog() -> Vec<TtsCatalogEntry> {
    vec![
        TtsCatalogEntry {
            id: "edge-tts",
            execution: TtsExecutionKind::LocalCommandAdapter,
        },
        TtsCatalogEntry {
            id: "openai",
            execution: TtsExecutionKind::VoiceProviderRegistry,
        },
        TtsCatalogEntry {
            id: "elevenlabs",
            execution: TtsExecutionKind::VoiceProviderRegistry,
        },
        TtsCatalogEntry {
            id: "kokoro-82m",
            execution: TtsExecutionKind::LocalCommandAdapter,
        },
        TtsCatalogEntry {
            id: "supertonic-3",
            execution: TtsExecutionKind::LocalCommandAdapter,
        },
        TtsCatalogEntry {
            id: "piper",
            execution: TtsExecutionKind::NativePiper,
        },
        TtsCatalogEntry {
            id: "styletts2-lite",
            execution: TtsExecutionKind::LocalCommandAdapter,
        },
    ]
}
