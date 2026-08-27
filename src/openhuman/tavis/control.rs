use crate::openhuman::security::credentials::responses::AuthStateResponse;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControlAction {
    ViewStatus,
    ChangeSecurityPolicy,
    InstallExtension,
    ManageProviderSecrets,
    ApplyUpdate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ControlProof {
    pub authenticated: bool,
    pub mfa_verified: bool,
    pub recent_reauth: bool,
}

impl ControlProof {
    pub fn from_auth_state(auth: &AuthStateResponse) -> Self {
        Self {
            authenticated: auth.is_authenticated,
            // OpenHuman session authentication alone does not prove TAVIS MFA
            // or a recent sensitive-action re-authentication ceremony.
            mfa_verified: false,
            recent_reauth: false,
        }
    }
}

pub fn authorize_control_action(
    action: ControlAction,
    proof: &ControlProof,
) -> Result<(), &'static str> {
    if !proof.authenticated {
        return Err("authentication required");
    }

    match action {
        ControlAction::ViewStatus => Ok(()),
        _ if proof.mfa_verified && proof.recent_reauth => Ok(()),
        _ => Err("MFA and recent re-authentication required"),
    }
}
