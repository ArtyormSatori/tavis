#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailureScenario {
    OmniRouteUnavailable,
    UpdateHealthCheckFailed,
    SecurityPolicyTamper,
    CoreProcessCrash,
    BrowserDriverFailure,
    VoiceEngineFailure,
    MemoryProjectionFailure,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailureAction {
    DegradeAndRetry,
    Rollback,
    Lockdown,
    RestartWithBackoff,
    Degrade,
}

pub const fn failure_action(scenario: FailureScenario) -> FailureAction {
    match scenario {
        FailureScenario::OmniRouteUnavailable => FailureAction::DegradeAndRetry,
        FailureScenario::UpdateHealthCheckFailed => FailureAction::Rollback,
        FailureScenario::SecurityPolicyTamper => FailureAction::Lockdown,
        FailureScenario::CoreProcessCrash => FailureAction::RestartWithBackoff,
        FailureScenario::BrowserDriverFailure
        | FailureScenario::VoiceEngineFailure
        | FailureScenario::MemoryProjectionFailure => FailureAction::Degrade,
    }
}
