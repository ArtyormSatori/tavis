//! Scheduler-gate configuration — controls when background AI work runs.
//!
//! Consumed by [`crate::openhuman::cron::scheduler_gate`]. The definitions moved
//! to [`crate::openhuman::memory::api::host`] alongside the rest of the memory-adjacent config
//! sections, because `tinymemory-core`'s sync and summarizer loops consult the
//! gate directly. Re-exported here so existing paths keep resolving.

pub use crate::openhuman::memory::api::host::scheduler_gate::{SchedulerGateConfig, SchedulerGateMode};
