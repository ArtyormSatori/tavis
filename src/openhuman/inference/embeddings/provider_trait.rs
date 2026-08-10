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

use async_trait::async_trait;
use tinyagents::harness::embeddings::EmbeddingModel;

pub use tinymemory_api::host::{format_embedding_signature, EmbeddingProvider};

/// Compatibility adapter from the canonical tinyagents embedding model.
pub struct TinyAgentsEmbeddingProvider {
    model: Box<dyn EmbeddingModel>,
}

impl TinyAgentsEmbeddingProvider {
    pub fn new(model: impl EmbeddingModel + 'static) -> Self {
        Self {
            model: Box::new(model),
        }
    }

    pub fn boxed(model: impl EmbeddingModel + 'static) -> Box<dyn EmbeddingProvider> {
        Box::new(Self::new(model))
    }
}

#[async_trait]
impl EmbeddingProvider for TinyAgentsEmbeddingProvider {
    fn name(&self) -> &str {
        self.model.name()
    }

    fn model_id(&self) -> &str {
        self.model.model_id()
    }

    fn dimensions(&self) -> usize {
        self.model.dimensions()
    }

    fn signature(&self) -> String {
        self.model.signature()
    }

    async fn embed(&self, texts: &[&str]) -> anyhow::Result<Vec<Vec<f32>>> {
        let owned = texts
            .iter()
            .map(|text| (*text).to_owned())
            .collect::<Vec<_>>();
        self.model
            .embed(&owned)
            .await
            .map_err(|error| anyhow::anyhow!(error))
    }
}
