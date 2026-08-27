use openhuman_core::openhuman::config::schema::cloud_providers::{AuthStyle, CloudProviderCreds};
use openhuman_core::openhuman::config::{apply_tavis_defaults, Config};
use openhuman_core::openhuman::inference::provider::factory::create_chat_model_from_string_with_model_id;

#[test]
fn tavis_factory_rejects_explicit_external_provider_bypass() {
    let mut config = Config::default();
    apply_tavis_defaults(&mut config);
    config.cloud_providers.push(CloudProviderCreds {
        id: "external".into(),
        slug: "external".into(),
        label: "External".into(),
        endpoint: "http://127.0.0.1:9/v1".into(),
        auth_style: AuthStyle::None,
        default_model: Some("model".into()),
        ..CloudProviderCreds::default()
    });

    let result = create_chat_model_from_string_with_model_id(
        "chat",
        "external:model",
        &config,
        0.2,
    );

    assert!(
        result.is_err(),
        "TAVIS production mode must reject explicit provider strings that bypass OmniRoute"
    );
}
