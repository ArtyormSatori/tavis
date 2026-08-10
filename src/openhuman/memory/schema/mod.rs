//! Host layer over [`tinymemory_core::schema`].
//!
//! The domain itself lives in the extracted crate; what stays here is its
//! JSON-RPC surface — handlers and controller schemas name OpenHuman's
//! `RpcOutcome` and `ControllerSchema`, which the engine crate cannot see.
//! The glob re-export keeps every historical `memory::schema::…` path resolving.

pub use tinymemory_core::schema::*;

mod handlers;
mod registry;

pub use registry::{all_controller_schemas, all_registered_controllers};
