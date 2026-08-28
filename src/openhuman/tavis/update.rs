use crate::openhuman::platform::health::HealthSnapshot;
use crate::openhuman::tavis::supervisor::{
    supervisor_decision, SupervisorDecision, SupervisorPolicy,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateState {
    Backup,
    Verify,
    Stage,
    Migrate,
    HealthCheck,
    Commit,
    Rollback,
}

fn health_allows_commit(snapshot: &HealthSnapshot) -> bool {
    matches!(
        supervisor_decision(snapshot, SupervisorPolicy::default()),
        SupervisorDecision::Healthy | SupervisorDecision::Degraded
    )
}

pub fn next_update_state(state: UpdateState, snapshot: &HealthSnapshot) -> UpdateState {
    match state {
        UpdateState::Backup => UpdateState::Verify,
        UpdateState::Verify => UpdateState::Stage,
        UpdateState::Stage => UpdateState::Migrate,
        UpdateState::Migrate => UpdateState::HealthCheck,
        UpdateState::HealthCheck if health_allows_commit(snapshot) => UpdateState::Commit,
        UpdateState::HealthCheck => UpdateState::Rollback,
        UpdateState::Commit => UpdateState::Commit,
        UpdateState::Rollback => UpdateState::Rollback,
    }
}
