//! Turning a [`GatewaySpec`] into somewhere the frontend can send RPC.
//!
//! # The whole design in one sentence
//!
//! A gateway resolves to a URL and a bearer, and nothing downstream changes.
//! `core_rpc_url` and `core_rpc_token` answer from the active gateway, so every
//! existing caller — `coreRpcClient`, `relay_http_rpc`, every screen — reaches a
//! container on another machine through exactly the code that reached the core
//! in this process.
//!
//! # What tinybox contributes
//!
//! Two axes that compose: *reach* (`local` / `ssh`) and *confinement*
//! (`passthrough` / `docker`). Pairing them costs nothing, so "a container on
//! the build server" needs no code naming that combination — which is why
//! [`GatewaySpec::Box`] is one variant rather than three.
//!
//! Provisioning is then four steps, and each is one tinybox call:
//!
//! 1. `create` a box, publishing the core's port to whichever machine it runs on
//! 2. `spawn` the core in it, detached, with a freshly minted bearer
//! 3. `forward` that published port back to this machine
//! 4. poll the core's unauthenticated `/health` until it answers
//!
//! Step 3 is the one that is easy to leave out and impossible to notice
//! missing: publishing puts the port on the *box's* host, which for an SSH
//! placement is the far machine. Everything looks configured and nothing is
//! reachable.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use tinybox_core::{
    BoxId, BoxSpec, ExecRequest, Forward, Host, NetworkPolicy, PassthroughSandbox, Placement,
    PortMapping, ProcessId, Sandbox, WorkspaceSource,
};
use tinybox_docker::DockerSandbox;
use tinybox_host::LocalHost;
use tinybox_ssh::{SshHost, SshTarget};

use super::types::{
    ActiveGateway, CORE_PORT_IN_BOX, Confinement, Gateway, GatewaySpec, Reach, SshReach,
};

/// How long to wait for a provisioned core to answer `/health`.
///
/// Generous because this covers a container start, the core's own boot, and
/// possibly an image pull — and because polling returns the moment it answers,
/// so a high ceiling costs nothing when things are fast. Mirrors the embedded
/// core's own ceiling in `core_process`.
const HEALTH_TIMEOUT: Duration = Duration::from_secs(120);

/// How often to re-ask while waiting.
const HEALTH_POLL: Duration = Duration::from_millis(250);

/// A provisioned gateway, and everything that has to stay alive for it.
///
/// Holding this *is* the gateway existing: dropping it closes the tunnel and
/// the box stops being reachable. That is why the active one is kept in a
/// long-lived registry rather than returned to the caller.
pub struct Provisioned {
    /// Where the frontend should send RPC.
    pub active: ActiveGateway,
    /// The tunnel, if reaching the box needed one. Dropping it closes it.
    _forward: Option<Forward>,
    /// The sandbox the box lives in, for tearing it down.
    sandbox: Arc<dyn Sandbox>,
    /// The box.
    box_id: BoxId,
    /// The core process inside it.
    process: ProcessId,
}

impl std::fmt::Debug for Provisioned {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Hand-written because `ActiveGateway` carries a bearer, and a derived
        // `Debug` would put it in any log line that formats this.
        formatter
            .debug_struct("Provisioned")
            .field("id", &self.active.id)
            .field("box", &self.box_id.as_str())
            .field("process", &self.process.as_str())
            .finish_non_exhaustive()
    }
}

impl Provisioned {
    /// Stop the core and destroy the box.
    ///
    /// Best-effort throughout: this runs when the user is switching away, and
    /// a box that cannot be cleaned up must not block them from reaching a
    /// gateway that works. Every failure is logged and the next step is still
    /// attempted.
    pub async fn tear_down(self) {
        log::debug!(
            "[gateway][teardown] stopping {} in box {}",
            self.process,
            self.box_id
        );
        if let Err(error) = self.sandbox.stop(&self.box_id, &self.process).await {
            log::warn!("[gateway][teardown] stop failed: {error}");
        }
        if let Err(error) = self.sandbox.destroy(&self.box_id).await {
            log::warn!("[gateway][teardown] destroy failed: {error}");
        }
        // The forward's own `Drop` closes the tunnel as this returns.
    }
}

/// Progress, reported as each step completes.
///
/// Provisioning takes tens of seconds and the steps fail for different reasons,
/// so the UI shows which one is happening rather than an untimed spinner that
/// says nothing about whether an image pull is stuck.
pub type ProgressSink = dyn Fn(&str) + Send + Sync;

/// Resolve `gateway` into somewhere the frontend can send RPC.
///
/// `Desktop` and `Remote` resolve without provisioning anything, so they return
/// `None` for the second half of the pair — there is nothing to hold open and
/// nothing to tear down.
///
/// # Errors
///
/// Returns a user-facing message when the box cannot be created, the core
/// cannot be started, the tunnel cannot be opened, or the core never becomes
/// healthy. Every message is safe to display: no bearer, no key path.
pub async fn activate(
    gateway: &Gateway,
    desktop: &crate::core_process::CoreProcessHandle,
    progress: &ProgressSink,
) -> Result<Option<Provisioned>, String> {
    log::info!(
        "[gateway][activate] id={} kind={}",
        gateway.id,
        gateway.spec.kind()
    );

    match &gateway.spec {
        GatewaySpec::Desktop => {
            progress("starting the local core");
            desktop.ensure_running().await?;
            log::debug!("[gateway][activate] desktop core ready on {}", desktop.port());
            Ok(None)
        }
        GatewaySpec::Remote { url, .. } => {
            // Nothing to provision: someone else is running this core, and the
            // URL is the whole answer. Reachability is still the caller's to
            // check, exactly as it is for a provisioned one.
            log::debug!(
                "[gateway][activate] remote endpoint {}",
                crate::core_rpc::redact_url_for_log(url)
            );
            Ok(None)
        }
        GatewaySpec::Box {
            reach,
            confinement,
            env,
        } => provision(gateway, reach, confinement, env, progress)
            .await
            .map(Some),
    }
}

/// The URL and bearer a non-provisioning gateway resolves to.
///
/// Split from [`activate`] because these two need no async work at all: the
/// answer is already in the record (or in the handle), so making callers await
/// it would suggest otherwise.
#[must_use]
pub fn endpoint_of(
    gateway: &Gateway,
    desktop: &crate::core_process::CoreProcessHandle,
) -> Option<ActiveGateway> {
    match &gateway.spec {
        GatewaySpec::Desktop => Some(ActiveGateway {
            id: gateway.id.clone(),
            rpc_url: desktop.rpc_url(),
            token: Some(desktop.rpc_token().to_owned()),
        }),
        GatewaySpec::Remote { url, token } => Some(ActiveGateway {
            id: gateway.id.clone(),
            rpc_url: url.clone(),
            token: token.clone(),
        }),
        GatewaySpec::Box { .. } => None,
    }
}

/// Create a box, start a core in it, and make it reachable from here.
async fn provision(
    gateway: &Gateway,
    reach: &Reach,
    confinement: &Confinement,
    env: &BTreeMap<String, String>,
    progress: &ProgressSink,
) -> Result<Provisioned, String> {
    let host = build_host(reach)?;
    let sandbox = build_sandbox(confinement, &host);

    // Minted here and handed to the core as an environment variable, so it is
    // never written to disk and never reused across activations. The core
    // reads `OPENHUMAN_CORE_TOKEN` and gates `/rpc` on it; `/health` stays
    // unauthenticated, which is what makes the readiness poll below possible
    // before any credential is established.
    let token = crate::core_process::generate_rpc_token();

    progress("creating the box");
    let spec = box_spec(reach, confinement, env)?;
    let info = sandbox
        .create(&spec)
        .await
        .map_err(|error| format!("could not create the box: {error}"))?;
    log::info!(
        "[gateway][provision] box {} created ({})",
        info.id,
        sandbox.name()
    );

    progress("starting the core");
    let started = start_core(sandbox.as_ref(), &info.id, confinement, &token).await;
    let process = match started {
        Ok(process) => process,
        Err(error) => {
            // Do not leave a box behind for a core that never started.
            destroy_quietly(sandbox.as_ref(), &info.id).await;
            return Err(error);
        }
    };

    progress("opening the connection");
    let published = published_port(sandbox.as_ref(), &info.id).await?;
    let forwarded = host
        .forward(([127, 0, 0, 1], published).into())
        .await
        .map_err(|error| format!("could not reach the box: {error}"));
    let forwarded = match forwarded {
        Ok(forwarded) => forwarded,
        Err(error) => {
            destroy_quietly(sandbox.as_ref(), &info.id).await;
            return Err(error);
        }
    };

    let rpc_base = format!("http://{}", forwarded.local_addr());
    progress("waiting for the core");
    if let Err(error) = wait_until_healthy(&rpc_base).await {
        destroy_quietly(sandbox.as_ref(), &info.id).await;
        return Err(error);
    }

    log::info!("[gateway][provision] {} ready at {rpc_base}/rpc", gateway.id);
    Ok(Provisioned {
        active: ActiveGateway {
            id: gateway.id.clone(),
            rpc_url: format!("{rpc_base}/rpc"),
            token: Some(token),
        },
        _forward: Some(forwarded),
        sandbox,
        box_id: info.id,
        process,
    })
}

/// The host a box's commands run on.
fn build_host(reach: &Reach) -> Result<Arc<dyn Host>, String> {
    match reach {
        Reach::Local => Ok(Arc::new(LocalHost::new())),
        Reach::Ssh(ssh) => Ok(Arc::new(SshHost::new(
            // Always local: `SshHost` opens its tunnel from its inner host, and
            // a chained one would open it on the wrong machine. tinybox refuses
            // that case rather than reporting an address leading nowhere.
            Arc::new(LocalHost::new()),
            ssh_target(ssh)?,
        ))),
    }
}

fn ssh_target(ssh: &SshReach) -> Result<SshTarget, String> {
    let mut target = SshTarget::new(ssh.destination.clone())
        .map_err(|error| format!("that SSH destination is not usable: {error}"))?;
    if let Some(port) = ssh.port {
        target = target.with_port(port);
    }
    if let Some(identity) = &ssh.identity {
        target = target.with_identity(identity.clone());
    }
    if ssh.accept_new_host_key {
        target = target.accepting_new_host_key();
    }
    Ok(target)
}

/// The sandbox a box is created in.
fn build_sandbox(confinement: &Confinement, host: &Arc<dyn Host>) -> Arc<dyn Sandbox> {
    // An in-memory store: these boxes exist for as long as this process holds
    // the gateway open, and a file store would outlive that — leaving records
    // for containers a later run has no tunnel to and no reason to trust.
    let store = Arc::new(tinybox_core::MemoryStore::new());
    match confinement {
        Confinement::Passthrough { .. } => {
            Arc::new(PassthroughSandbox::new(host.clone(), store)) as Arc<dyn Sandbox>
        }
        Confinement::Docker { .. } => {
            Arc::new(DockerSandbox::new(host.clone(), store)) as Arc<dyn Sandbox>
        }
    }
}

/// The spec the box is created from.
fn box_spec(
    reach: &Reach,
    confinement: &Confinement,
    env: &BTreeMap<String, String>,
    host_port: u16,
) -> Result<BoxSpec, String> {
    let host_ref = match reach {
        Reach::Local => "local",
        Reach::Ssh(_) => "ssh",
    };
    let (sandbox_ref, source) = match confinement {
        Confinement::Passthrough { workspace, .. } => (
            "passthrough",
            WorkspaceSource::LocalDir(
                workspace
                    .clone()
                    .unwrap_or_else(|| std::path::PathBuf::from("/tmp")),
            ),
        ),
        Confinement::Docker { image } => ("docker", WorkspaceSource::OciImage(image.clone())),
    };

    let placement = Placement::new(
        tinybox_core::HostRef::new(host_ref)
            .map_err(|error| format!("invalid host reference: {error}"))?,
        tinybox_core::SandboxRef::new(sandbox_ref)
            .map_err(|error| format!("invalid sandbox reference: {error}"))?,
    );

    let mut spec = BoxSpec::new(placement, source);
    for (key, value) in env {
        spec = spec.with_env(key, value);
    }

    if matches!(confinement, Confinement::Docker { .. }) {
        // Publishing is how the core is reached at all, and tinybox drops the
        // `--publish` flags entirely on a box whose network is denied — a
        // container with no network has nowhere for a published port to lead.
        // `Egress` is the weakest policy that still publishes; the core needs
        // outbound anyway to reach the TinyHumans backend.
        spec = spec.with_network(NetworkPolicy::Egress);
        spec = spec.with_port(PortMapping::fixed(host_port, CORE_PORT_IN_BOX));
    }
    Ok(spec)
}

/// Start `openhuman-core` in the box, detached, and return its handle.
async fn start_core(
    sandbox: &dyn Sandbox,
    box_id: &BoxId,
    confinement: &Confinement,
    token: &str,
) -> Result<ProcessId, String> {
    let binary = match confinement {
        Confinement::Passthrough { binary, .. } => binary.display().to_string(),
        // The image's own core, on `PATH`. Naming a path here would tie the
        // gateway to one image's layout.
        Confinement::Docker { .. } => "openhuman-core".to_owned(),
    };

    let request = ExecRequest::new([binary.as_str(), "serve"])
        .with_env("OPENHUMAN_CORE_TOKEN", token)
        // Bind every interface *inside the box*, so the published port has
        // something to reach. Loopback there would be reachable only from
        // inside the container, which is the one place nothing is asking.
        .with_env("OPENHUMAN_CORE_HOST", "0.0.0.0")
        .with_env("OPENHUMAN_CORE_PORT", CORE_PORT_IN_BOX.to_string());

    sandbox
        .spawn(box_id, &request)
        .await
        .map_err(|error| format!("could not start the core in the box: {error}"))
}

/// Which port on the box's machine the core was published to.
async fn published_port(sandbox: &dyn Sandbox, box_id: &BoxId) -> Result<u16, String> {
    let info = sandbox
        .inspect(box_id)
        .await
        .map_err(|error| format!("could not inspect the box: {error}"))?;

    info.spec
        .ports
        .iter()
        .find(|mapping| mapping.guest == CORE_PORT_IN_BOX)
        .and_then(|mapping| mapping.host)
        // A passthrough box publishes nothing because there is no boundary to
        // publish across: the core is listening on the machine's own port.
        .or_else(|| info.spec.ports.is_empty().then_some(CORE_PORT_IN_BOX))
        .ok_or_else(|| {
            format!("the box did not publish port {CORE_PORT_IN_BOX} on its machine").to_owned()
        })
}

/// Poll `/health` until the core answers, or give up.
///
/// `/health` is unauthenticated by design, which is what makes this possible
/// before the bearer matters — and it is a genuinely necessary step rather than
/// a courtesy: a tunnel's local listener exists before the far side is proven,
/// so "the forward opened" is not "the core is up".
async fn wait_until_healthy(base_url: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|error| format!("could not build an HTTP client: {error}"))?;
    let url = format!("{base_url}/health");
    let deadline = tokio::time::Instant::now() + HEALTH_TIMEOUT;
    let mut last: Option<String> = None;

    loop {
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                log::debug!("[gateway][health] {base_url} is up");
                return Ok(());
            }
            Ok(response) => last = Some(format!("HTTP {}", response.status())),
            Err(error) => last = Some(error.to_string()),
        }

        if tokio::time::Instant::now() >= deadline {
            let detail = last.unwrap_or_else(|| "no response".to_owned());
            return Err(format!(
                "the core did not become reachable within {}s ({detail})",
                HEALTH_TIMEOUT.as_secs()
            ));
        }
        tokio::time::sleep(HEALTH_POLL).await;
    }
}

/// Destroy a box, logging rather than propagating a failure.
///
/// Used on the failure paths, where the error the caller is about to see is the
/// one that matters — a cleanup failure on top of it would bury the cause.
async fn destroy_quietly(sandbox: &dyn Sandbox, box_id: &BoxId) {
    if let Err(error) = sandbox.destroy(box_id).await {
        log::warn!("[gateway][provision] could not clean up box {box_id}: {error}");
    }
}

#[cfg(test)]
mod ops_tests;
