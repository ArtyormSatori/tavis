//! Deterministic TAVIS supervision policy over OpenHuman's native health model.

use crate::openhuman::platform::health::{verdict, HealthSnapshot};

const TAVIS_CRITICAL_COMPONENTS: &[&str] = &["omniroute"];

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

fn is_unhealthy(status: &str) -> bool {
    status != "ok" && status != "starting"
}

pub fn supervisor_decision(
    snapshot: &HealthSnapshot,
    policy: SupervisorPolicy,
) -> SupervisorDecision {
    let health = verdict(snapshot);
    let tavis_critical_unhealthy: Vec<&str> = TAVIS_CRITICAL_COMPONENTS
        .iter()
        .copied()
        .filter(|name| {
            snapshot
                .components
                .get(*name)
                .is_some_and(|component| is_unhealthy(&component.status))
        })
        .collect();

    if health.healthy && tavis_critical_unhealthy.is_empty() {
        return if health.degraded {
            SupervisorDecision::Degraded
        } else {
            SupervisorDecision::Healthy
        };
    }

    let native_restarts = health
        .critical_unhealthy
        .iter()
        .filter_map(|name| snapshot.components.get(name))
        .map(|component| component.restart_count);
    let tavis_restarts = tavis_critical_unhealthy
        .iter()
        .filter_map(|name| snapshot.components.get(*name))
        .map(|component| component.restart_count);
    let restart_count = native_restarts.chain(tavis_restarts).max().unwrap_or(0);

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
