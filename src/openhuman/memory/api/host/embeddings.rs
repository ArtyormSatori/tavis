//! [`EmbeddingProvider`] — text → vector, supplied by the host.
//!
//! The memory subsystem embeds chunks, summaries and queries, but it does not
//! decide *how*: which provider, which credentials, which rate limit and which
//! fallback are host policy. So the core takes an `Arc<dyn EmbeddingProvider>`
//! and never constructs one.
//!
//! This trait deliberately lives in the contract crate rather than in
//! `tinymemory-core`, so that a host implementing it does not have to depend on
//! the engine. It carries nothing heavier than `async-trait` and `anyhow`.

use async_trait::async_trait;

/// Formats the canonical embedding-space signature string.
///
/// This is the **single source of truth** for the signature format. Both the
/// live-provider [`EmbeddingProvider::signature`] and any config-derived
/// signature must route through here, so a signature computed from
/// configuration is byte-identical to one computed from an instantiated
/// provider. Drift between the two silently splits one embedding space into
/// two, and every vector written on the wrong side of the split becomes
/// unsearchable without a re-embed.
///
/// # This format is under-specified, and fixing it is not this copy's decision
///
/// The delimiters are not escaped, so two distinct `(name, model_id)` pairs can
/// collide onto one signature — see the ignored test below for a witness. A
/// length-prefixed form fixes it, and this file briefly carried one.
///
/// It was reverted, because **this is not the only copy**. The identical format
/// lives in `tinymemory_api::host::embeddings` and again in
/// `tinycortex::memory::store::vectors`, where a parity test asserts the two
/// agree byte for byte. A signature is the key every stored vector is written
/// under, so a copy that improves the format unilaterally does not fix a
/// collision — it splits the embedding space against the engine, and the
/// symptom is not a failing test but recall quietly matching nothing.
///
/// So the fix belongs upstream in TinyMemory, landed across the contract, the
/// engine and this host together with a migration for stored vectors. Until
/// then every copy stays byte-identical, deliberately including the flaw.
/// See `docs/specs/2026-08-13-memory-module-port.md` §3.
#[must_use]
pub fn format_embedding_signature(name: &str, model_id: &str, dims: usize) -> String {
    format!("provider={name};model={model_id};dims={dims}")
}

#[cfg(test)]
mod tests {
    use super::format_embedding_signature;

    /// Witness for the collision described on [`format_embedding_signature`].
    ///
    /// Ignored rather than deleted: it is the executable record of a known
    /// defect, and it must start passing in the same change that fixes the
    /// format across all three copies — not before.
    #[test]
    #[ignore = "known defect; fix belongs upstream in TinyMemory across all three copies"]
    fn delimiter_characters_cannot_make_distinct_spaces_collide() {
        let first = format_embedding_signature("a;model=b", "c", 3);
        let second = format_embedding_signature("a", "b;model=c", 3);
        assert_ne!(first, second);
    }

    /// The host-local copy must stay byte-identical to the contract crate's.
    ///
    /// This is the guard that would have caught the divergence: it fails the
    /// moment either copy is "improved" on its own.
    #[test]
    fn signature_is_byte_identical_to_the_contract_crate() {
        for (name, model, dims) in [
            ("ollama", "nomic-embed-text", 768usize),
            ("openai", "text-embedding-3-small", 1536),
            ("none", "none", 0),
        ] {
            assert_eq!(
                format_embedding_signature(name, model, dims),
                tinymemory_api::host::format_embedding_signature(name, model, dims),
                "host-local and contract-crate embedding signatures diverged"
            );
        }
    }
}

/// Converts text into numerical vectors.
#[async_trait]
pub trait EmbeddingProvider: Send + Sync {
    /// Provider name, e.g. `"ollama"`, `"openai"`.
    fn name(&self) -> &str;

    /// Stable model identifier used to generate embeddings.
    fn model_id(&self) -> &str;

    /// Number of dimensions in the generated embeddings.
    fn dimensions(&self) -> usize;

    /// Stable signature for the embedding space.
    ///
    /// Changing any component means existing vectors are no longer comparable
    /// with newly generated ones and must be stored and queried separately
    /// until a migration re-embeds them.
    fn signature(&self) -> String {
        format_embedding_signature(self.name(), self.model_id(), self.dimensions())
    }

    /// Generates embeddings for a batch of strings.
    ///
    /// # Errors
    /// Propagates transport, authentication and quota failures from the
    /// underlying provider.
    async fn embed(&self, texts: &[&str]) -> anyhow::Result<Vec<Vec<f32>>>;

    /// Generates an embedding for a single string.
    ///
    /// # Errors
    /// As [`Self::embed`], plus an error when the provider returns no vector.
    async fn embed_one(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        let mut results = self.embed(&[text]).await?;
        results
            .pop()
            .ok_or_else(|| anyhow::anyhow!("Empty embedding result"))
    }
}

/// The inert provider bound when semantic search is switched off or no
/// embedding backend is configured. Reports zero dimensions and returns one
/// empty vector per input, so keyword-only retrieval keeps working while
/// vector rerank degrades to a no-op rather than an error.
#[derive(Debug, Clone, Copy, Default)]
pub struct NoopEmbedding;

#[async_trait]
impl EmbeddingProvider for NoopEmbedding {
    fn name(&self) -> &str {
        "none"
    }

    fn model_id(&self) -> &str {
        "none"
    }

    fn dimensions(&self) -> usize {
        0
    }

    async fn embed(&self, texts: &[&str]) -> anyhow::Result<Vec<Vec<f32>>> {
        Ok(vec![Vec::new(); texts.len()])
    }
}
