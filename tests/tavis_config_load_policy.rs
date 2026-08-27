use openhuman_core::openhuman::config::{apply_tavis_defaults, Config, TAVIS_OMNIROUTE_PROVIDER_ID, TAVIS_OMNIROUTE_URL};

#[tokio::test]
async fn config_reload_reapplies_tavis_fail_closed_policy() {
    let temp = tempfile::tempdir().expect("tempdir");
    let config_path = temp.path().join("config.toml");
    let workspace = temp.path().join("workspace");

    let mut persisted = Config::default();
    apply_tavis_defaults(&mut persisted);
    persisted.config_path = config_path.clone();
    persisted.workspace_dir = workspace.clone();
    persisted.inference_url = Some("https://api.openai.com/v1".into());
    persisted.primary_cloud = Some("external".into());
    persisted.chat_provider = Some("openai:gpt-5".into());
    persisted.reasoning_provider = Some("anthropic:claude-opus-4".into());
    persisted.vision_provider = Some("external:vision".into());

    let serialized = toml::to_string_pretty(&persisted).expect("serialize config");
    tokio::fs::write(&config_path, serialized)
        .await
        .expect("write config");

    let loaded = Config::load_from_config_path(&config_path, &workspace)
        .await
        .expect("reload config");

    assert_eq!(loaded.inference_url.as_deref(), Some(TAVIS_OMNIROUTE_URL));
    assert_eq!(
        loaded.primary_cloud.as_deref(),
        Some(TAVIS_OMNIROUTE_PROVIDER_ID)
    );
    assert!(loaded.chat_provider.as_deref().unwrap_or_default().starts_with("omniroute:"));
    assert!(loaded.reasoning_provider.as_deref().unwrap_or_default().starts_with("omniroute:"));
    assert!(loaded.vision_provider.as_deref().unwrap_or_default().starts_with("omniroute:"));
}
