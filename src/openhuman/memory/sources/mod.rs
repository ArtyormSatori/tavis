//! Host layer over [`tinymemory_core::sources`].
//!
//! The domain itself lives in the extracted crate; what stays here is its
//! JSON-RPC surface — handlers and controller schemas name OpenHuman's
//! `RpcOutcome` and `ControllerSchema`, which the engine crate cannot see.
//! The glob re-export keeps every historical `memory::sources::…` path resolving.

pub use tinymemory_core::sources::*;

pub mod rpc;
pub mod schemas;

pub use rpc::apply_kind_defaults;
