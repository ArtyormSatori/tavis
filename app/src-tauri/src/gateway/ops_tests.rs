//! Tests for gateway provisioning.
//!
//! The decisions worth pinning are the ones made *before* anything runs: which
//! placement a spec names, whether the network policy actually permits the
//! publish it asks for, and what the core is started with. Those are pure, so
//! they are asserted as values rather than observed by creating a container.
//!
//! Provisioning end to end needs a Docker daemon and is `#[ignore]`d below.

use std::collections::BTreeMap;

use super::ops::{box_spec, core_command, endpoint_of, is_port_conflict};
use super::types::{Confinement, Reach, SshReach, CORE_PORT_IN_BOX};

fn docker() -> Confinement {
    Confinement::Docker {
        image: "openhuman-core:latest".to_owned(),
    }
}

fn passthrough() -> Confinement {
    Confinement::Passthrough {
        binary: "/usr/local/bin/openhuman-core".into(),
        workspace: Some("/srv/openhuman".into()),
    }
}

fn ssh() -> Reach {
    Reach::Ssh(SshReach {
        destination: "builder@example.com".to_owned(),
        port: Some(2222),
        identity: None,
        accept_new_host_key: true,
    })
}

#[test]
fn a_docker_box_permits_the_network_its_published_port_needs() {
    // tinybox drops the `--publish` flags entirely on a box whose network is
    // denied — a container with no network has nowhere for a published port to
    // lead. Denied here would produce a box that looks configured, publishes
    // nothing, and is unreachable with no error anywhere.
    let spec = box_spec(&Reach::Local, &docker(), &BTreeMap::new(), 54321)
        .expect("a spec");

    assert!(spec.network.allows_egress());
    let published = spec
        .ports
        .iter()
        .find(|mapping| mapping.guest == CORE_PORT_IN_BOX);
    assert_eq!(published.and_then(|mapping| mapping.host), Some(54321));
}

#[test]
fn the_host_port_is_named_rather_than_left_to_docker() {
    // `PortMapping::dynamic` would let Docker choose, and the number it chose
    // would live only in Docker's own state — tinybox has no call that reports
    // it back, and a forward needs that number.
    let spec = box_spec(&Reach::Local, &docker(), &BTreeMap::new(), 54321)
        .expect("a spec");

    assert!(spec.ports.iter().all(|mapping| mapping.host.is_some()));
}

#[test]
fn a_passthrough_box_publishes_nothing_because_there_is_no_boundary() {
    // The core listens on the machine's own port; there is nothing to publish
    // across and nothing that could collide beyond the core itself.
    let spec = box_spec(&Reach::Local, &passthrough(), &BTreeMap::new(), 54321)
        .expect("a spec");

    assert!(spec.ports.is_empty());
}

#[test]
fn the_placement_records_both_axes_independently() {
    // Which is what makes "a container on the build server" need no code of
    // its own: it is these two fields, chosen separately.
    let spec =
        box_spec(&ssh(), &docker(), &BTreeMap::new(), 54321).expect("a spec");

    assert_eq!(spec.workspace.host.as_str(), "ssh");
    assert_eq!(spec.workspace.sandbox.as_str(), "docker");
}

#[test]
fn a_passthrough_box_runs_in_the_configured_workspace() {
    let spec = box_spec(&Reach::Local, &passthrough(), &BTreeMap::new(), 1)
        .expect("a spec");

    assert_eq!(
        spec.source,
        tinybox_core::WorkspaceSource::LocalDir("/srv/openhuman".into())
    );
}

#[test]
fn configured_environment_reaches_the_box() {
    let mut env = BTreeMap::new();
    env.insert("BACKEND_URL".to_owned(), "https://api.example.com".to_owned());

    let spec = box_spec(&Reach::Local, &docker(), &env, 1).expect("a spec");

    assert_eq!(
        spec.env.get("BACKEND_URL").map(String::as_str),
        Some("https://api.example.com")
    );
}

#[test]
fn the_core_is_started_bound_to_every_interface_inside_the_box() {
    // Loopback inside a container is reachable only from inside it, which is
    // the one place nothing is asking. The published port would lead nowhere.
    let request = core_command(&docker(), "deadbeef");

    assert_eq!(
        request.env.get("OPENHUMAN_CORE_HOST").map(String::as_str),
        Some("0.0.0.0")
    );
    assert_eq!(
        request.env.get("OPENHUMAN_CORE_PORT").map(String::as_str),
        Some(CORE_PORT_IN_BOX.to_string().as_str())
    );
}

#[test]
fn the_bearer_is_handed_over_as_environment_rather_than_written_down() {
    // It is minted per activation and never persisted, so a stored gateway
    // record cannot leak a credential for a core that is still running.
    let request = core_command(&docker(), "deadbeef");

    assert_eq!(
        request.env.get("OPENHUMAN_CORE_TOKEN").map(String::as_str),
        Some("deadbeef")
    );
}

#[test]
fn a_docker_box_runs_the_image_s_own_core_rather_than_a_named_path() {
    // Naming a path would tie the gateway to one image's layout.
    let request = core_command(&docker(), "t");

    assert_eq!(request.program(), Some("openhuman-core"));
    assert_eq!(request.argv.get(1).map(String::as_str), Some("serve"));
}

#[test]
fn a_passthrough_box_runs_the_binary_the_user_named() {
    let request = core_command(&passthrough(), "t");

    assert_eq!(request.program(), Some("/usr/local/bin/openhuman-core"));
}

#[test]
fn a_taken_port_is_recognised_from_the_backend_s_own_words() {
    // tinybox passes Docker's diagnostic through verbatim, so this is what a
    // collision actually looks like coming back.
    assert!(is_port_conflict(
        "driver failed programming external connectivity on endpoint: \
         Bind for 0.0.0.0:54321 failed: port is already allocated"
    ));
    assert!(is_port_conflict("address already in use"));
}

#[test]
fn an_unrelated_failure_is_not_mistaken_for_a_taken_port() {
    // Retrying a missing image seven more times would turn one clear error
    // into a slow, confusing one.
    assert!(!is_port_conflict(
        "Unable to find image 'openhuman-core:latest' locally"
    ));
    assert!(!is_port_conflict(
        "Cannot connect to the Docker daemon"
    ));
}

#[test]
fn a_remote_gateway_resolves_to_its_url_without_provisioning() {
    use super::types::{Gateway, GatewaySpec};

    let gateway = Gateway {
        id: "cloud".to_owned(),
        label: "Cloud".to_owned(),
        spec: GatewaySpec::Remote {
            url: "https://core.example.com/rpc".to_owned(),
            token: Some("bearer".to_owned()),
        },
    };

    // The handle is irrelevant for a remote gateway and is never consulted;
    // it is required only because the desktop arm of the same function needs
    // one.
    let unused = crate::core_process::CoreProcessHandle::new(7788);
    let resolved = endpoint_of(&gateway, &unused).expect("an endpoint");

    assert_eq!(resolved.rpc_url, "https://core.example.com/rpc");
    assert_eq!(resolved.token.as_deref(), Some("bearer"));
}
