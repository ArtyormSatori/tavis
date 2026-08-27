use openhuman_core::openhuman::security::credentials::responses::AuthStateResponse;
use openhuman_core::openhuman::tavis::control::{
    authorize_control_action, ControlAction, ControlProof,
};

#[test]
fn login_alone_cannot_authorize_sensitive_control_actions() {
    let auth = AuthStateResponse {
        is_authenticated: true,
        user_id: Some("user-1".into()),
        user: None,
        profile_id: Some("profile-1".into()),
    };
    let proof = ControlProof::from_auth_state(&auth);

    assert!(authorize_control_action(ControlAction::ViewStatus, &proof).is_ok());
    assert!(authorize_control_action(ControlAction::ChangeSecurityPolicy, &proof).is_err());
    assert!(authorize_control_action(ControlAction::InstallExtension, &proof).is_err());
}

#[test]
fn mfa_and_recent_reauth_unlock_sensitive_actions() {
    let proof = ControlProof {
        authenticated: true,
        mfa_verified: true,
        recent_reauth: true,
    };

    assert!(authorize_control_action(ControlAction::ChangeSecurityPolicy, &proof).is_ok());
    assert!(authorize_control_action(ControlAction::InstallExtension, &proof).is_ok());
}
