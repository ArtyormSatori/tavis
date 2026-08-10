//! Interface for embedding providers that convert text into numerical vectors.
//!
//! [`EmbeddingProvider`] and [`format_embedding_signature`] are **defined in
//! `tinymemory_api::host`** and re-exported here. The extracted memory subsystem
//! takes an `Arc<dyn EmbeddingProvider>` from this host, so the trait has to live
//! somewhere both sides can name — and it has to be *one* trait, not two
//! structurally identical ones, or the trait objects would not be
//! interchangeable.
//!
//! Every existing `inference::embeddings::EmbeddingProvider` path in this crate
//! keeps resolving, and keeps naming the same type.
//!
//! What stays here is [`TinyAgentsEmbeddingProvider`], the adapter from
//! tinyagents' own embedding-model trait. That belongs on this side: the
//! contract crate must not depend on tinyagents.


pub use tinymemory_api::host::{format_embedding_signature, EmbeddingProvider};
pub use tinymemory_core::embedding_adapter::TinyAgentsEmbeddingProvider;

