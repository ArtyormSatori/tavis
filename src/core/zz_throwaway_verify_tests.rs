//! THROWAWAY adversarial verification for the CLI capability-degradation
//! milestone. Delete before shipping.

use crate::core::cli_capability::CAPABILITY_UNAVAILABLE_PREFIX;

// ---------------------------------------------------------------------------
// Path 1 — the generic `openhuman <namespace> <function>` dispatcher.
// ---------------------------------------------------------------------------

/// Is the new arm in `run_namespace_command` reachable on a real CLI
/// invocation? It only fires when `grouped_schemas()` has ALREADY dropped the
/// namespace/function, and that map is filtered by the ambient
/// `CoreContext::current_memory_capabilities()`.
#[test]
fn zz_grouped_schemas_is_unfiltered_without_a_core_context() {
    assert!(
        crate::core::runtime::context::CoreContext::current().is_none(),
        "no context should be ambient in this filtered test run"
    );
    let grouped = super::grouped_schemas();
    // Every gated memory namespace is STILL present, i.e. the missing-schema
    // arm cannot be taken for any of them.
    for ns in [
        "memory_tree",
        "memory_diff",
        "memory_goals",
        "memory_sources",
    ] {
        assert!(
            grouped.contains_key(ns),
            "`{ns}` present ⇒ the capability arm is unreachable for it"
        );
    }
    // And the gated function inside the mixed `memory` namespace too.
    assert!(
        grouped["memory"]
            .iter()
            .any(|s| s.function == "doc_ingest"),
        "memory.doc_ingest present ⇒ the function arm is unreachable for it"
    );
}

/// Even with a null driver bound in config, a bare CLI process still sees the
/// full namespace list — proving the filter, not the gate, is the blocker.
#[test]
fn zz_grouped_schemas_stays_full_even_with_a_null_driver_in_env() {
    let tmp = std::env::temp_dir().join("zz-verify-null-ws");
    std::fs::create_dir_all(&tmp).unwrap();
    std::env::set_var("OPENHUMAN_WORKSPACE", &tmp);
    std::env::set_var("OPENHUMAN_MEMORY_DRIVER", "null");

    let grouped = super::grouped_schemas();
    let still_listed = grouped.contains_key("memory_tree");

    std::env::remove_var("OPENHUMAN_MEMORY_DRIVER");
    std::env::remove_var("OPENHUMAN_WORKSPACE");

    assert!(
        still_listed,
        "memory_tree must vanish for the CLI gate to ever fire; it does not"
    );
}

/// Default build: a gated namespace reports nothing new.
#[test]
fn zz_default_build_gated_namespace_is_not_an_error_path() {
    let grouped = super::grouped_schemas();
    // `--help` on a gated namespace still prints help, no error.
    assert!(
        super::run_namespace_command("memory_tree", &["--help".to_string()], &grouped).is_ok(),
        "default driver advertises everything; no new error path"
    );
}

/// A typo stays a typo through the real entry point.
#[test]
fn zz_typo_namespace_still_unknown_through_run_namespace_command() {
    let err = super::run_namespace_command(
        "zzz_not_a_namespace",
        &["zzz".to_string()],
        &super::grouped_schemas(),
    )
    .expect_err("must error");
    let msg = err.to_string();
    assert!(msg.contains("unknown namespace"), "{msg}");
    assert!(!msg.contains(CAPABILITY_UNAVAILABLE_PREFIX), "{msg}");
}

/// What DOES a user actually get today for a gated namespace on the generic
/// path, with the null driver bound? Print it.
#[test]
fn zz_probe_generic_path_under_null_driver() {
    let tmp = std::env::temp_dir().join("zz-verify-generic-ws");
    std::fs::create_dir_all(&tmp).unwrap();
    std::env::set_var("OPENHUMAN_WORKSPACE", &tmp);
    std::env::set_var("OPENHUMAN_MEMORY_DRIVER", "null");
    let grouped = super::grouped_schemas();
    let outcome = super::run_namespace_command(
        "memory_tree",
        &[
            "list_chunks".to_string(),
            "--limit".to_string(),
            "1".to_string(),
        ],
        &grouped,
    );
    std::env::remove_var("OPENHUMAN_MEMORY_DRIVER");
    std::env::remove_var("OPENHUMAN_WORKSPACE");
    match outcome {
        Ok(()) => eprintln!("ZZ-GENERIC: Ok(()) — command RAN, no config fact"),
        Err(e) => eprintln!("ZZ-GENERIC-ERR: {e}"),
    }
}

// ---------------------------------------------------------------------------
// Path 2 — `openhuman memory <sub>`, end to end through the real entry point.
// ---------------------------------------------------------------------------

fn with_null_driver_env<T>(tag: &str, f: impl FnOnce() -> T) -> T {
    let tmp = std::env::temp_dir().join(format!("zz-verify-memcli-{tag}"));
    std::fs::create_dir_all(&tmp).unwrap();
    std::env::set_var("OPENHUMAN_WORKSPACE", &tmp);
    std::env::set_var("OPENHUMAN_MEMORY_DRIVER", "null");
    let out = f();
    std::env::remove_var("OPENHUMAN_MEMORY_DRIVER");
    std::env::remove_var("OPENHUMAN_WORKSPACE");
    out
}

/// 3a — a capability-gated CLI command names the bound driver and the family.
#[test]
fn zz_memory_ingest_under_null_driver_reports_a_config_fact() {
    let doc = std::env::temp_dir().join("zz-verify-doc.md");
    std::fs::write(&doc, "hello world").unwrap();
    let args = vec![
        "ingest".to_string(),
        doc.to_string_lossy().to_string(),
        "-n".to_string(),
        "zzverify".to_string(),
    ];
    let err = with_null_driver_env("ingest", || {
        crate::core::memory_cli::run_memory_command(&args).expect_err("gated")
    });
    let msg = err.to_string();
    assert!(msg.starts_with(CAPABILITY_UNAVAILABLE_PREFIX), "{msg}");
    assert!(msg.contains("`null`"), "{msg}");
    assert!(msg.contains("`ingest`"), "{msg}");
    assert!(!msg.contains("unknown"), "{msg}");
    // 3e — no endpoint, credential ref, or document content leaks.
    assert!(!msg.contains("hello world"), "{msg}");
    assert!(!msg.contains("zz-verify-doc"), "{msg}");
    assert!(!msg.contains("credential"), "{msg}");
    assert!(!msg.contains("http"), "{msg}");
    eprintln!("ZZ-MESSAGE: {msg}");
}

/// 3b — a mistyped subcommand under the SAME null driver still says "unknown".
#[test]
fn zz_memory_typo_under_null_driver_still_reports_unknown() {
    let args = vec!["ingesst".to_string()];
    let err = with_null_driver_env("typo", || {
        crate::core::memory_cli::run_memory_command(&args).expect_err("typo")
    });
    let msg = err.to_string();
    assert!(msg.contains("unknown memory subcommand"), "{msg}");
    assert!(!msg.contains(CAPABILITY_UNAVAILABLE_PREFIX), "{msg}");
}

/// 3c — the default embedded driver reaches no new error path.
#[test]
fn zz_memory_ingest_under_default_driver_is_not_a_capability_error() {
    let tmp = std::env::temp_dir().join("zz-verify-default-ws");
    std::fs::create_dir_all(&tmp).unwrap();
    std::env::set_var("OPENHUMAN_WORKSPACE", &tmp);
    let doc = std::env::temp_dir().join("zz-verify-doc2.md");
    std::fs::write(&doc, "hello world").unwrap();
    let args = vec![
        "ingest".to_string(),
        doc.to_string_lossy().to_string(),
        "-n".to_string(),
        "zzverify".to_string(),
    ];
    let outcome = crate::core::memory_cli::run_memory_command(&args);
    std::env::remove_var("OPENHUMAN_WORKSPACE");
    if let Err(err) = outcome {
        let msg = err.to_string();
        assert!(
            !msg.starts_with(CAPABILITY_UNAVAILABLE_PREFIX),
            "default driver must never hit the capability gate: {msg}"
        );
        eprintln!("ZZ-DEFAULT-ERR (not a capability fact): {msg}");
    }
}
