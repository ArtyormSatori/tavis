//! Host layer over [`tinymemory_core::diff`].
//!
//! The domain itself lives in the extracted crate; what stays here is its
//! JSON-RPC surface — handlers and controller schemas name OpenHuman's
//! `RpcOutcome` and `ControllerSchema`, which the engine crate cannot see.
//! The glob re-export keeps every historical `memory::diff::…` path resolving.

pub use tinymemory_core::diff::*;

pub mod rpc;
pub mod schemas;
mod stub;

pub use stub::{all_memory_diff_controller_schemas, all_memory_diff_registered_controllers, ops};
