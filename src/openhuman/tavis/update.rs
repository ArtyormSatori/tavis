use crate::openhuman::platform::health::{verdict, HealthSnapshot};

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

pub fn next_update_state(state: UpdateState, snapshot: &HealthSnapshot) -> UpdateState {
    match state {
        UpdateState::Backup => UpdateState::Verify,
        UpdateState::Verify => UpdateState::Stage,
        UpdateState::Stage => UpdateState::Migrate,
        UpdateState::Migrate => UpdateState::HealthCheck,
        UpdateState::HealthCheck if verdict(snapshot).healthy => UpdateState::Commit,
        UpdateState::HealthCheck => UpdateState::Rollback,
        UpdateState::Commit => UpdateState::Commit,
        UpdateState::Rollback => UpdateState::Rollback,
    }
}
