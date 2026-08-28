//! TAVIS execution evidence and bounded verification policy.
//!
//! This module is intentionally host-local: it layers task-verification
//! semantics on top of OpenHuman's existing agent runtime without creating a
//! second agent engine.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionStatus {
    Succeeded,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionEvidence {
    pub action_id: String,
    pub capability: String,
    pub status: ActionStatus,
    pub summary: String,
    pub side_effects: Vec<String>,
    pub artifacts: Vec<String>,
    pub verified: bool,
}

impl ActionEvidence {
    pub fn new(
        action_id: impl Into<String>,
        capability: impl Into<String>,
        status: ActionStatus,
        summary: impl Into<String>,
    ) -> Self {
        Self {
            action_id: action_id.into(),
            capability: capability.into(),
            status,
            summary: summary.into(),
            side_effects: Vec::new(),
            artifacts: Vec::new(),
            verified: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VerificationPolicy {
    pub max_replans: u8,
}

impl Default for VerificationPolicy {
    fn default() -> Self {
        Self { max_replans: 2 }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvidenceError {
    ActionNotFound(String),
    ReplanLimitReached { limit: u8 },
}

impl std::fmt::Display for EvidenceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ActionNotFound(action_id) => write!(f, "action evidence not found: {action_id}"),
            Self::ReplanLimitReached { limit } => {
                write!(f, "verification replan limit reached: {limit}")
            }
        }
    }
}

impl std::error::Error for EvidenceError {}

#[derive(Debug, Clone)]
pub struct ExecutionLedger {
    policy: VerificationPolicy,
    replans_used: u8,
    actions: Vec<ActionEvidence>,
}

impl ExecutionLedger {
    pub fn new(policy: VerificationPolicy) -> Self {
        Self {
            policy,
            replans_used: 0,
            actions: Vec::new(),
        }
    }

    pub fn record(&mut self, evidence: ActionEvidence) {
        if let Some(existing) = self
            .actions
            .iter_mut()
            .find(|entry| entry.action_id == evidence.action_id)
        {
            *existing = evidence;
        } else {
            self.actions.push(evidence);
        }
    }

    pub fn mark_verified(&mut self, action_id: &str) -> Result<(), EvidenceError> {
        let evidence = self
            .actions
            .iter_mut()
            .find(|entry| entry.action_id == action_id)
            .ok_or_else(|| EvidenceError::ActionNotFound(action_id.to_string()))?;
        evidence.verified = true;
        Ok(())
    }

    pub fn is_complete(&self) -> bool {
        !self.actions.is_empty()
            && self
                .actions
                .iter()
                .all(|entry| entry.status == ActionStatus::Succeeded && entry.verified)
    }

    pub fn request_replan(&mut self) -> Result<u8, EvidenceError> {
        if self.replans_used >= self.policy.max_replans {
            return Err(EvidenceError::ReplanLimitReached {
                limit: self.policy.max_replans,
            });
        }
        self.replans_used += 1;
        Ok(self.replans_used)
    }

    pub fn replans_used(&self) -> u8 {
        self.replans_used
    }

    pub fn actions(&self) -> &[ActionEvidence] {
        &self.actions
    }
}
