//! Host layer over [`tinymemory_core::sync::sync_status`].
//!
//! The domain itself lives in the extracted crate; what stays here is its
//! JSON-RPC surface — handlers and controller schemas name OpenHuman's
//! `RpcOutcome` and `ControllerSchema`, which the engine crate cannot see.
//! The glob re-export keeps every historical `memory::sync::sync_status::…` path resolving.

pub use tinymemory_core::sync::sync_status::*;

pub mod rpc;
pub mod schemas;

// The controller aggregators this domain's RPC surface defines.
pub use schemas::*;
