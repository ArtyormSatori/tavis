//! TAVIS-native policy and product integration over OpenHuman subsystems.
//!
//! This module intentionally contains only TAVIS policy/read-model layers.
//! Execution remains owned by existing OpenHuman domains.

pub mod control;
pub mod hardening;
pub mod update;
pub mod voice;
