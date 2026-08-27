use std::collections::BTreeMap;
use openhuman_core::openhuman::platform::health::{ComponentHealth, HealthSnapshot};
use openhuman_core::openhuman::tavis::update::{next_update_state, UpdateState};

fn snapshot(core_status: &str) -> HealthSnapshot {
    let mut components = BTreeMap::new();
    components.insert("core".into(), ComponentHealth {
        status: core_status.into(),
        updated_at: "now".into(),
        last_ok: None,
        last_error: None,
        restart_count: 0,
    });
    HealthSnapshot { pid: 1, updated_at: "now".into(), uptime_seconds: 1, components }
}

#[test]
fn update_cannot_commit_when_native_health_is_unhealthy() {
    assert_eq!(next_update_state(UpdateState::HealthCheck, &snapshot("error")), UpdateState::Rollback);
}

#[test]
fn update_commits_only_after_native_health_is_healthy() {
    assert_eq!(next_update_state(UpdateState::HealthCheck, &snapshot("ok")), UpdateState::Commit);
}
