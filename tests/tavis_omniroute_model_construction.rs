use openhuman_core::openhuman::config::{apply_tavis_defaults, Config};
use openhuman_core::openhuman::inference::provider::factory::create_chat_model_from_string_with_model_id;

#[test]
fn omniroute_abstract_hint_constructs_through_native_factory() {
    let mut config = Config::default();
    apply_tavis_defaults(&mut config);

    let result = create_chat_model_from_string_with_model_id(
        "chat",
        "omniroute:hint:chat",
        &config,
        0.2,
    );

    let (_, model_id) = match result {
        Ok(value) => value,
        Err(error) => panic!(
            "TAVIS OmniRoute hint must be accepted by the native OpenHuman factory: {error}"
        ),
    };
    assert_eq!(model_id, "hint:chat");
}
