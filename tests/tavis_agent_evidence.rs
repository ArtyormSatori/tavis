use openhuman_core::openhuman::agent::tavis_evidence::{
    ActionEvidence, ActionStatus, ExecutionLedger, VerificationPolicy,
};

#[test]
fn tavis_agent_requires_verified_success_before_task_completion() {
    let mut ledger = ExecutionLedger::new(VerificationPolicy { max_replans: 2 });
    ledger.record(ActionEvidence::new(
        "a1",
        "browser.navigate",
        ActionStatus::Succeeded,
        "Opened target page",
    ));

    assert!(
        !ledger.is_complete(),
        "unverified success must not complete a task"
    );

    ledger
        .mark_verified("a1")
        .expect("recorded action should be verifiable");
    assert!(ledger.is_complete());
}

#[test]
fn tavis_agent_failed_action_prevents_completion() {
    let mut ledger = ExecutionLedger::new(VerificationPolicy { max_replans: 2 });
    ledger.record(ActionEvidence::new(
        "a1",
        "desktop.click",
        ActionStatus::Failed,
        "Target was not found",
    ));

    assert!(!ledger.is_complete());
}

#[test]
fn tavis_agent_replanning_is_bounded() {
    let mut ledger = ExecutionLedger::new(VerificationPolicy { max_replans: 2 });

    assert!(ledger.request_replan().is_ok());
    assert!(ledger.request_replan().is_ok());
    assert!(
        ledger.request_replan().is_err(),
        "replanning must stop at the configured bound"
    );
    assert_eq!(ledger.replans_used(), 2);
}
