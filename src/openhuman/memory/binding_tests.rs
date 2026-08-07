//! Tests for the per-workspace memory-driver binding.
//!
//! The load-bearing ones are the trust pair (`admit_refuses_untrusted_external_driver`
//! / `admit_refuses_trusted_external_driver_until_transport_exists`) and
//! `capabilities_are_asked_exactly_once_per_bind`. The first two are written so
//! neither can pass for the other's reason; the third pins the contract's
//! "asked once at bind time and cached" rule, which the whole capability gate
//! depends on.

use super::*;

use std::sync::atomic::{AtomicUsize, Ordering};

use async_trait::async_trait;
use tinycortex_api::capabilities::Capability;
use tinycortex_api::error::MemoryError;
use tinycortex_api::provider::types::{ExportPage, ExportRecord, ImportOutcome, SourceScope};
use tinycortex_api::provider::{MemoryCore, MemoryPortability, MemoryRecall};
use tinycortex_api::recall::OwnedRecallOpts;
use tinycortex_api::types::{MemoryCategory, MemoryEntry, MemoryTaint, NamespaceSummary};

use crate::openhuman::config::schema::MemoryDriverConfig;

fn external_driver_cfg(trust_state: &str) -> MemorySubsystemConfig {
    let mut cfg = MemorySubsystemConfig {
        driver: "supermemory".into(),
        ..Default::default()
    };
    cfg.drivers.insert(
        "supermemory".into(),
        MemoryDriverConfig {
            class: Some("external".into()),
            transport: Some("http".into()),
            endpoint: Some("https://api.supermemory.ai".into()),
            credential_ref: Some("keychain:supermemory".into()),
            trust_state: trust_state.into(),
        },
    );
    cfg
}

#[test]
fn admit_default_config_binds_embedded_tinycortex() {
    let (id, class) = admit(&MemorySubsystemConfig::default()).expect("default config admits");
    assert_eq!(id, "tinycortex");
    assert_eq!(class, DriverClass::Embedded);
}

#[test]
fn admit_null_driver_binds_null_class() {
    let cfg = MemorySubsystemConfig {
        driver: "null".into(),
        ..Default::default()
    };
    let (id, class) = admit(&cfg).expect("null driver admits");
    assert_eq!(id, "null");
    assert_eq!(class, DriverClass::Null);
}

#[test]
fn admit_refuses_untrusted_external_driver() {
    // The default trust_state is "untrusted" (kernel.md §3.4, fail-closed).
    let cfg = external_driver_cfg(&MemoryDriverConfig::default().trust_state);
    let refusal = admit(&cfg).expect_err("untrusted external driver must be refused");
    assert_eq!(refusal.configured_driver, "supermemory");
    assert!(
        refusal.reason.contains("trust_state"),
        "refusal must name the trust rule: {}",
        refusal.reason
    );
}

#[test]
fn admit_refuses_trusted_external_driver_until_transport_exists() {
    let cfg = external_driver_cfg("trusted");
    let refusal = admit(&cfg).expect_err("no external transport exists yet");
    assert!(
        refusal.reason.contains("transport"),
        "refusal must name the missing transport: {}",
        refusal.reason
    );
    assert!(
        !refusal.reason.contains("trust_state"),
        "a trusted driver must not be refused for trust: {}",
        refusal.reason
    );
}

#[test]
fn admit_rejects_an_unknown_driver_class() {
    let mut cfg = external_driver_cfg("trusted");
    cfg.drivers.get_mut("supermemory").unwrap().class = Some("embeded".into());
    let refusal = admit(&cfg).expect_err("typo'd class must be refused");
    assert!(
        refusal.reason.contains("embeded"),
        "refusal must echo the typo: {}",
        refusal.reason
    );
}

#[test]
fn fallback_reason_never_contains_credential_ref_or_endpoint() {
    let mut cfg = external_driver_cfg("untrusted");
    cfg.drivers.get_mut("supermemory").unwrap().credential_ref =
        Some("keychain:super-secret-value".into());
    let refusal = admit(&cfg).expect_err("untrusted external driver must be refused");
    assert!(
        !refusal.reason.contains("super-secret-value"),
        "credential_ref leaked into an operator-facing string: {}",
        refusal.reason
    );
    assert!(
        !refusal.reason.contains("supermemory.ai"),
        "endpoint leaked into an operator-facing string: {}",
        refusal.reason
    );
}

#[test]
fn for_workspace_caches_binding_per_workspace() {
    let dir_a = tempfile::tempdir().unwrap();
    let dir_b = tempfile::tempdir().unwrap();
    let cfg = MemorySubsystemConfig::default();

    let a = for_workspace(dir_a.path(), &cfg).expect("bind workspace A");
    let b = for_workspace(dir_b.path(), &cfg).expect("bind workspace B");
    assert!(
        !Arc::ptr_eq(&a, &b),
        "different workspaces must get isolated bindings"
    );

    let a_again = for_workspace(dir_a.path(), &cfg).expect("re-resolve workspace A");
    assert!(
        Arc::ptr_eq(&a, &a_again),
        "same workspace must reuse the cached binding"
    );
}

#[test]
fn refused_driver_falls_back_to_the_null_placeholder() {
    let dir = tempfile::tempdir().unwrap();
    let binding =
        for_workspace(dir.path(), &external_driver_cfg("untrusted")).expect("bind falls back");
    assert_eq!(binding.driver_id(), "null");
    assert_eq!(binding.class(), DriverClass::Null);
    let fallback = binding.fallback().expect("fallback provenance recorded");
    assert_eq!(fallback.configured_driver, "supermemory");
}

#[test]
fn fallback_binding_advertises_only_mandatory_capabilities() {
    let dir = tempfile::tempdir().unwrap();
    let binding =
        for_workspace(dir.path(), &external_driver_cfg("untrusted")).expect("bind falls back");
    assert_eq!(binding.capabilities(), Capabilities::mandatory());
    // Even the fallback must be a *legal* bind: the mandatory three are present.
    assert!(binding.capabilities().validate().is_ok());
    assert!(!binding.capabilities().contains(Capability::Tree));
}

#[test]
fn unbound_default_is_the_full_capability_set() {
    let all = unbound_default_capabilities();
    assert_eq!(all, Capabilities::all());
    assert_eq!(all.len(), Capability::ALL.len());
}

#[test]
fn bound_driver_view_carries_class_capabilities_and_fallback() {
    let dir = tempfile::tempdir().unwrap();
    let binding =
        for_workspace(dir.path(), &external_driver_cfg("untrusted")).expect("bind falls back");
    let bound = binding.to_bound_driver();
    assert_eq!(bound.slot, SubsystemSlot::Memory);
    assert_eq!(bound.id, "null");
    assert_eq!(bound.class, DriverClass::Null);
    assert_eq!(bound.contract_version, CONTRACT_VERSION);
    assert_eq!(bound.fell_back_from.as_deref(), Some("supermemory"));
    assert!(bound.is_fallback());
    // The generic view carries the same families as opaque strings.
    assert!(bound.capabilities.contains("core"));
    assert!(!bound.capabilities.contains("tree"));
    assert_eq!(bound.capabilities.len(), binding.capabilities().len());
}

#[test]
fn health_converts_as_a_total_three_arm_match() {
    assert_eq!(to_driver_health(MemoryHealth::Ready), DriverHealth::Ready);
    assert_eq!(
        to_driver_health(MemoryHealth::degraded("reindexing")),
        DriverHealth::degraded("reindexing")
    );
    assert_eq!(
        to_driver_health(MemoryHealth::down("refused")),
        DriverHealth::down("refused")
    );
}

// ---- "capabilities asked once" ------------------------------------------
//
// The contract's `MemoryProvider::capabilities` doc says the kernel asks once
// at bind time and caches. Everything downstream (RPC registration, tool
// emission) is filtered from that cached answer, so a second ask would let the
// live surface and the advertised surface drift apart.

struct CountingProvider {
    inner: NullMemoryProvider,
    calls: AtomicUsize,
}

impl CountingProvider {
    fn new() -> Self {
        Self {
            inner: NullMemoryProvider::new(),
            calls: AtomicUsize::new(0),
        }
    }
}

#[async_trait]
impl MemoryCore for CountingProvider {
    async fn store(
        &self,
        namespace: &str,
        key: &str,
        content: &str,
        category: MemoryCategory,
        session_id: Option<&str>,
        taint: MemoryTaint,
    ) -> Result<(), MemoryError> {
        self.inner
            .store(namespace, key, content, category, session_id, taint)
            .await
    }

    async fn get(&self, namespace: &str, key: &str) -> Result<Option<MemoryEntry>, MemoryError> {
        self.inner.get(namespace, key).await
    }

    async fn forget(&self, namespace: &str, key: &str) -> Result<bool, MemoryError> {
        self.inner.forget(namespace, key).await
    }

    async fn list(
        &self,
        namespace: Option<&str>,
        category: Option<&MemoryCategory>,
        session_id: Option<&str>,
    ) -> Result<Vec<MemoryEntry>, MemoryError> {
        self.inner.list(namespace, category, session_id).await
    }

    async fn namespaces(&self) -> Result<Vec<NamespaceSummary>, MemoryError> {
        self.inner.namespaces().await
    }
}

#[async_trait]
impl MemoryRecall for CountingProvider {
    async fn recall(
        &self,
        query: &str,
        limit: usize,
        opts: &OwnedRecallOpts,
        scope: Option<&SourceScope>,
    ) -> Result<Vec<MemoryEntry>, MemoryError> {
        self.inner.recall(query, limit, opts, scope).await
    }
}

#[async_trait]
impl MemoryPortability for CountingProvider {
    async fn export_page(
        &self,
        cursor: Option<&str>,
        limit: usize,
    ) -> Result<ExportPage, MemoryError> {
        self.inner.export_page(cursor, limit).await
    }

    async fn import_records(
        &self,
        records: Vec<ExportRecord>,
    ) -> Result<ImportOutcome, MemoryError> {
        self.inner.import_records(records).await
    }
}

#[async_trait]
impl MemoryProvider for CountingProvider {
    fn driver_id(&self) -> &str {
        "counting"
    }

    fn capabilities(&self) -> Capabilities {
        self.calls.fetch_add(1, Ordering::SeqCst);
        Capabilities::all()
    }

    async fn health(&self) -> MemoryHealth {
        MemoryHealth::Ready
    }
}

#[test]
fn capabilities_are_asked_exactly_once_per_bind() {
    let provider = Arc::new(CountingProvider::new());
    let binding = bind_provider_for_test(provider.clone(), DriverClass::Embedded);

    for _ in 0..5 {
        assert_eq!(binding.capabilities(), Capabilities::all());
    }
    assert_eq!(binding.driver_id(), "counting");
    assert_eq!(
        provider.calls.load(Ordering::SeqCst),
        1,
        "capabilities() must be asked exactly once, at bind time"
    );
}
