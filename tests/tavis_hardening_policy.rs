use openhuman_core::openhuman::tavis::hardening::{failure_action, FailureAction, FailureScenario};

#[test]
fn critical_failures_have_deterministic_actions() {
    assert_eq!(failure_action(FailureScenario::OmniRouteUnavailable), FailureAction::DegradeAndRetry);
    assert_eq!(failure_action(FailureScenario::UpdateHealthCheckFailed), FailureAction::Rollback);
    assert_eq!(failure_action(FailureScenario::SecurityPolicyTamper), FailureAction::Lockdown);
    assert_eq!(failure_action(FailureScenario::CoreProcessCrash), FailureAction::RestartWithBackoff);
}
