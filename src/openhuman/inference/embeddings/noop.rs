//! No-op embedding provider for keyword-only search fallback.
//!
//! Defined in `crate::openhuman::memory::api::host` and re-exported here. The extracted memory
//! subsystem binds this provider itself when embeddings are switched off, so it
//! has to be the same type on both sides of the seam rather than two structs
//! with the same name.

pub use crate::openhuman::memory::api::host::NoopEmbedding;
