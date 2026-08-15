//! Tests for the two-lane preference helpers.
//!
//! The Lane-A helper runs against the real [`InMemoryProvider`] through a real
//! guard, so it exercises the same `list` → `get` pair production uses. The
//! vector-filtered helpers need a driver that advertises
//! [`Capability::Retrieval`], which the in-memory provider deliberately does
//! not, so those use a purpose-built stub — the point under test is the
//! *filter*, not the retrieval.

use std::sync::Arc;

use async_trait::async_trait;

use super::*;
use crate::openhuman::memory::api::capabilities::Capabilities;
use crate::openhuman::memory::api::error::MemoryError;
use crate::openhuman::memory::api::health::MemoryHealth;
use crate::openhuman::memory::api::provider::retrieval::MemoryRetrieval;
use crate::openhuman::memory::api::provider::MemoryProvider;
use crate::openhuman::memory::api::types::{
    MemoryCategory, MemoryItemKind, MemoryTaint, NamespaceMemoryHit, RetrievalScoreBreakdown,
};
use crate::openhuman::memory::guard::in_memory::{guarded_in_memory, InMemoryProvider};

#[tokio::test]
async fn load_general_preferences_returns_bodies_not_topic_keys_and_honours_the_limit() {
    let (_provider, guard) = guarded_in_memory();

    for (key, value) in [
        ("reply_language", "Reply in British English."),
        ("tone", "Be terse."),
    ] {
        guard
            .store(
                USER_PREF_GENERAL_NAMESPACE,
                key,
                value,
                MemoryCategory::Core,
                None,
                MemoryTaint::Internal,
            )
            .await
            .unwrap();
    }

    let general = load_general_preferences(&guard, 10).await;
    assert!(general.iter().any(|v| v.contains("British English")));
    assert!(general.iter().any(|v| v.contains("Be terse")));
    // The bodies, never the topic keys — the bug this helper exists to avoid.
    assert!(!general.iter().any(|v| v == "reply_language"));

    assert_eq!(load_general_preferences(&guard, 1).await.len(), 1);
}

/// A driver whose only real family is retrieval, answering with hits whose
/// vector component is set per-entry so the filter can be observed.
struct ScriptedRetrieval {
    hits: Vec<(String, String, f64)>,
}

#[async_trait]
impl MemoryRetrieval for ScriptedRetrieval {
    async fn recall_namespace_scored(
        &self,
        namespace: &str,
        _query: &str,
        limit: usize,
        _exclude_session_id: Option<&str>,
    ) -> Result<Vec<NamespaceMemoryHit>, MemoryError> {
        Ok(self
            .hits
            .iter()
            .take(limit)
            .map(|(key, content, vector)| NamespaceMemoryHit {
                id: key.clone(),
                kind: MemoryItemKind::Document,
                namespace: namespace.to_string(),
                key: key.clone(),
                title: None,
                content: content.clone(),
                category: "core".to_string(),
                source_type: None,
                updated_at: 0.0,
                // Deliberately high, and independent of the vector component:
                // a filter that read this instead would pass everything.
                score: 1.0,
                score_breakdown: RetrievalScoreBreakdown {
                    vector_similarity: *vector,
                    final_score: 1.0,
                    ..Default::default()
                },
                document_id: None,
                chunk_id: None,
                ..Default::default()
            })
            .collect())
    }
}

/// Wraps [`InMemoryProvider`] so the mandatory three are real, and adds
/// retrieval on top.
struct RetrievalProvider {
    base: InMemoryProvider,
    retrieval: ScriptedRetrieval,
}

crate::impl_memory_core_by_delegation!(RetrievalProvider, base);

#[async_trait]
impl MemoryProvider for RetrievalProvider {
    fn driver_id(&self) -> &str {
        "scripted-retrieval"
    }

    fn capabilities(&self) -> Capabilities {
        Capabilities::mandatory() | Capabilities::from(
            crate::openhuman::memory::api::capabilities::Capability::Retrieval,
        )
    }

    fn as_retrieval(&self) -> Option<&dyn MemoryRetrieval> {
        Some(&self.retrieval)
    }

    async fn health(&self) -> MemoryHealth {
        MemoryHealth::Ready
    }
}

fn scripted(hits: Vec<(&str, &str, f64)>) -> Arc<MemoryGuard> {
    let provider = Arc::new(RetrievalProvider {
        base: InMemoryProvider::new(),
        retrieval: ScriptedRetrieval {
            hits: hits
                .into_iter()
                .map(|(k, c, v)| (k.to_string(), c.to_string(), v))
                .collect(),
        },
    });
    crate::openhuman::memory::guard::in_memory::guard_over(provider)
}

#[tokio::test]
async fn situational_recall_filters_on_the_vector_component_not_the_final_score() {
    // Every hit has final_score 1.0; only the vector component separates them.
    let guard = scripted(vec![
        ("editor", "Prefers vim.", 0.9),
        ("lexical_only", "Shares words, means nothing.", 0.1),
    ]);

    let out = recall_situational_preferences(&guard, "which editor?").await;
    assert_eq!(out, vec!["Prefers vim.".to_string()]);
}

#[tokio::test]
async fn an_empty_query_recalls_nothing_without_asking_the_driver() {
    let guard = scripted(vec![("editor", "Prefers vim.", 0.99)]);
    assert!(recall_situational_preferences(&guard, "   ").await.is_empty());
}

#[tokio::test]
async fn a_driver_without_retrieval_yields_no_preferences_rather_than_an_error() {
    let (_provider, guard) = guarded_in_memory();
    assert!(recall_situational_preferences(&guard, "anything")
        .await
        .is_empty());
    assert!(recall_related_preferences(&guard, "some value", "topic", 4)
        .await
        .is_empty());
}

#[tokio::test]
async fn related_preferences_exclude_the_just_saved_topic() {
    let guard = scripted(vec![
        ("tone", "Be terse.", 0.9),
        ("verbosity", "Be brief.", 0.9),
    ]);

    let related = recall_related_preferences(&guard, "Be brief.", "verbosity", 4).await;
    let topics: Vec<&str> = related.iter().map(|(t, _)| t.as_str()).collect();
    assert!(topics.contains(&"tone"));
    assert!(
        !topics.contains(&"verbosity"),
        "the preference just written must not be surfaced as contradicting itself"
    );
}

#[tokio::test]
async fn the_limit_is_a_budget_shared_across_both_lanes() {
    // The stub answers identically for both namespaces, so an unshared budget
    // would return `limit` per lane — twice what the caller asked for.
    let guard = scripted(vec![
        ("a", "Alpha.", 0.9),
        ("b", "Bravo.", 0.9),
        ("c", "Charlie.", 0.9),
    ]);

    let related = recall_related_preferences(&guard, "anything", "none", 2).await;
    assert_eq!(related.len(), 2);
}
