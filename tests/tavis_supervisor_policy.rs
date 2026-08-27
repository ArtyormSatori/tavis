use std::collections::BTreeMap;

use openhuman_core::openhuman::platform::health::{ComponentHealth, HealthSnapshot};
use openhuman_core::openhuman::tavis::supervisor::{
    supervisor_decision, SupervisorDecision, SupervisorPolicy,
};

fn component(status: &str, restarts: u64) -> ComponentHealth {
    ComponentHealth {
        status: status.into(),
        updated_at: "now".into(),
        last_ok: None,
        last_error: None,
        restart_count: restarts,
    }
}

#[test]
fn supervisor_restarts_critical_failure_with_bounded_backoff() {
    let mut components = BTreeMap::new();
    components.insert("core".into(), component("error", 2));
    let snapshot = HealthSnapshot {
        pid: 1,
        updated_at: "now".into(),
        uptime_seconds: 10,
        components,
    };
    let policy = SupervisorPolicy {
        max_restarts: 3,
        base_backoff_secs: 2,
        max_backoff_secs: 30,
    };
    assert_eq!(
        supervisor_decision(&snapshot, policy),
        SupervisorDecision::RestartAfter { seconds: 8 }
    );
}

#[test]
fn supervisor_locks_down_after_restart_budget_is_exhausted() {
    let mut components = BTreeMap::new();
    components.insert("core".into(), component("error", 3));
    let snapshot = HealthSnapshot {
        pid: 1,
        updated_at: "now".into(),
        uptime_seconds: 10,
        components,
    };
    let policy = SupervisorPolicy {
        max_restarts: 3,
        base_backoff_secs: 2,
        max_backoff_secs: 30,
    };
    assert_eq!(
        supervisor_decision(&snapshot, policy),
        SupervisorDecision::Lockdown
    );
}

#[test]
fn supervisor_degrades_noncritical_failure_without_restart() {
    let mut components = BTreeMap::new();
    components.insert("scheduler".into(), component("error", 99));
    let snapshot = HealthSnapshot {
        pid: 1,
        updated_at: "now".into(),
        uptime_seconds: 10,
        components,
    };
    assert_eq!(
        supervisor_decision(&snapshot, SupervisorPolicy::default()),
        SupervisorDecision::Degraded
    );
}
