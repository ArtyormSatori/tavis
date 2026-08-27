//! Deterministic TAVIS supervision policy over OpenHuman's native health model.

use crate::openhuman::platform::health::core::{verdict, HealthSnapshot};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SupervisorPolicy {
    pub max_restarts: u64,
    pub base_backoff_secs: u64,
    pub max_backoff_secs: u64,
}

impl Default for SupervisorPolicy {
    fn default() -> Self {
        Self {
            max_restarts: 3,
            base_backoff_secs: 2,
            max_backoff_secs: 60,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SupervisorDecision {
    Healthy,
    Degraded,
    RestartAfter { seconds: u64 },
    Lockdown,
}

pub fn supervisor_decision(
    snapshot: &HealthSnapshot,
    policy: SupervisorPolicy,
) -> SupervisorDecision {
    let health = verdict(snapshot);
    if health.healthy {
        return if health.degraded {
            SupervisorDecision::Degraded
        } else {
            SupervisorDecision::Healthy
        };
    }

    let restart_count = health
        .critical_unhealthy
        .iter()
        .filter_map(|name| snapshot.components.get(name))
        .map(|component| component.restart_count)
        .max()
        .unwrap_or(0);

    if restart_count >= policy.max_restarts {
        return SupervisorDecision::Lockdown;
    }

    let exponent = restart_count.min(63) as u32;
    let multiplier = 1_u64.checked_shl(exponent).unwrap_or(u64::MAX);
    let seconds = policy
        .base_backoff_secs
        .saturating_mul(multiplier)
        .min(policy.max_backoff_secs);
    SupervisorDecision::RestartAfter { seconds }
}
