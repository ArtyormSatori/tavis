//! Host layer over [`tinymemory_core::goals`].
//!
//! The domain itself lives in the extracted crate; what stays here is its
//! JSON-RPC surface — handlers and controller schemas name OpenHuman's
//! `RpcOutcome` and `ControllerSchema`, which the engine crate cannot see.
//! The glob re-export keeps every historical `memory::goals::…` path resolving.

pub use tinymemory_core::goals::*;

pub mod ops;
mod schemas;

pub use schemas::{all_memory_goals_controller_schemas, all_memory_goals_registered_controllers};
