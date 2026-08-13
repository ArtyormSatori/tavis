# Porting the memory subsystem into the TinyMemory module

**Goal.** Reach memory only through the loaded `tinymemory` TinyBus module, and
drop `tinymemory`, `tinymemory-api`, `tinymemory-core`, `tinymemory-tinycortex`
and the direct `tinycortex` memory surface from this crate's dependency graph.

**Status.** Audit complete; port staged below.

---

## 1. What is already done

The module architecture is finished and correct. This port is not building it —
it is finishing a cutover that stopped half way.

- `tinymemory-module` ships as a released `cdylib`, pinned with per-platform
  digests in `src/openhuman/modules/registry.rs` (`TINYMEMORY`, v1.0.1).
- `src/openhuman/modules/memory.rs` implements `MemoryProvider` by forwarding
  ~53 methods — the full thirteen-family contract — one for one over the bus,
  lazily, with `memory::api::wire` mapping errors on **both** ends.
- The hard problem is solved. An out-of-crate engine still needs to embed,
  summarise and extract, so three reverse bus services carry those calls back:
  `ChatHost`, `EmbeddingHost` and `RuntimeHost`, served by
  `src/openhuman/modules/memory_host.rs`. Credentials never cross —
  `BusEmbeddingHost::resolve_api_key` returns `None` by construction.
- `src/openhuman/memory/binding.rs` already refuses embedded drivers outright
  and aliases the legacy `tinycortex` driver id onto the module.
- `src/openhuman/memory/api/` is a host-local copy of the contract, and the
  binding and the module client already compile against it rather than against
  `tinymemory-api`.

## 2. What actually blocks dropping the crates

**Roughly half the host's memory surface never went through `MemoryProvider`.**
It reaches the engine directly, in-process.

| Crate | References | Concentrated in |
| --- | --- | --- |
| `tinymemory_core` | 115 (30 real `use` sites) | `memory/{tools,query,tree,sync,host_impls}` |
| `tinymemory_api::host` | 46 | `config/schema/*`, `inference/`, `cron/`, `integrations/` |
| `tinycortex::memory` | 98 across 40 files | 56 of them **outside** `memory/` |

### 2.1 The consequence is a split brain, not a style problem

`memory_vector_search` calls `list_chunks(&config, &query)`
(`memory/tools/search/vector_search.rs:160`). That resolves the workspace path
and opens the same SQLite database the loaded module has already opened. With
the module driver bound — which is now the only supported binding — the process
runs **two independent engine instances over one database file**. The module is
not authoritative today.

### 2.2 The wire contract has real gaps

These direct call sites are not all "provider calls written the lazy way". Four
things they need have no representation in the thirteen families:

| Missing | Needed by |
| --- | --- |
| **People** — `PeopleStore`, `PersonId`, `Handle`, `Interaction`. No capability family exists. | `memory/tools/people.rs`, `memory/people/` |
| **Chunk-level store access** — `list_chunks`, `get_chunk`, `get_chunk_embeddings_for_signature_batch`, `ListChunksQuery`, `SourceKind` | `tools/search/{vector,hybrid,chunk_context}`, `tools/raw_store/*`, `query/*` |
| **Retrieval primitives** — `fast_retrieve`/`FastRetrieveOptions`, `cover_window`, `search_entities`/`EntityKind`, `RetrievalHit`/`QueryResponse` | `query/{fast_walk,cover_window,search_entities,backend}` |
| **Unified store types** — `MemoryKind`, `MemoryItemKind`, `UnifiedMemory` | `tools/search/hybrid_search.rs`, `tools/raw_store/kinds.rs` |

Each needs a decision: widen the contract, or keep it host-side over data the
provider already returns. Widening is not free — every method added to the wire
is engine semantics both ends must agree on forever.

### 2.3 Some of `tinymemory-core` belongs back in the host

`tinymemory_core::{sync, composio_host, chat, learning_candidate, nlp_host}`
and `memory/host_impls.rs` are orchestration, credentials and scheduling. By
TinyMemory's own README split those are host concerns. They move **back** into
OpenHuman rather than into the module, and `host_impls.rs` is deleted in favour
of the bus services in `modules/memory_host.rs`.

---

## 3. The landmine: two live copies of the embedding signature

`src/openhuman/memory/api/host/` is a near-duplicate of `tinymemory_api::host` —
11 of 17 files byte-identical, 6 diverged. One divergence is dangerous.

`format_embedding_signature` exists in **three** places with **two** behaviours:

| Copy | Form |
| --- | --- |
| `tinymemory_api::host::embeddings` (crate) | `provider={name};model={model};dims={dims}` |
| `tinycortex::memory::store::vectors` | byte-identical to the above, pinned by a parity test in `tinymemory/core/src/tinycortex/parity.rs` |
| `memory/api/host/embeddings.rs` (host-local) | **length-prefixed**: `provider={len}:{name};model={len}:{model};dims={dims}` |

The host-local copy is a *correctness fix* — it stops two distinct
(provider, model) pairs colliding onto one signature, and carries a regression
test for exactly that. It is also, right now, **dormant**:
`src/openhuman/inference/embeddings/provider_trait.rs:20` re-exports the **crate**
version, so every vector written today uses the naive form and matches the
engine.

**This port will make the host-local copy live.** Re-pointing
`inference/embeddings` at `memory::api::host` — which stage 1 does — silently
switches the signature format. Every stored embedding is keyed by that string,
so the effect is not a compile error or a test failure: recall quietly matches
nothing and the system re-embeds the entire corpus.

**Therefore:** the signature change must be landed as its own deliberate change,
upstream in TinyMemory first, so the crate, TinyCortex and the host move
together with a migration for stored vectors — *not* as a side effect of a
re-point. Until then the host-local copy must be reverted to the naive form so
the two copies agree.

Two lesser divergences, both harmless and both resolved in favour of host-local:
`subsystems.rs` defaults the driver to `"tinymemory"` (crate still says
`"tinycortex"`), and `mod.rs` gates test support on `#[cfg(test)]` rather than a
feature.

---

## 4. Staged plan

Each stage compiles and ships on its own.

**Stage 0 — neutralise the landmine.**
Revert `memory/api/host/embeddings.rs` to the naive signature form, keeping the
collision test as `#[ignore]` with a pointer to this section. Open a TinyMemory
issue for the real fix. *No behaviour change; makes every later stage safe.*

> **Ordering constraint — `tinymemory-api` goes last, not first.**
> `tinymemory_core::Config` is `dyn tinymemory_api::host::MemoryHostConfig`
> (`tinymemory/core/src/lib.rs:32`), and `memory/host_impls.rs` implements eight
> of these traits *for host types*. So for as long as `tinymemory-core` is a
> dependency, the host's config must implement the **crate's** trait, and
> re-pointing those references at the host-local copy would not compile. The
> contract crate can only be dropped after the engine crate. Stages 1 and 5 were
> the wrong way round in the first draft of this plan.

**Stage 1 — close the wire gaps.**

*Decision: all four surfaces are pushed down into TinyCortex and exposed through
the TinyMemory contract. None is rebuilt host-side.* The host calls them over
the bus like every other provider method, and the engine stays the single owner
of storage and scoring.

The audit shows this is far less new code than it looks, and **three of the four
surfaces need no migration at all** — a first reading of the file lists suggested
`tinymemory-core` carried a parallel implementation of retrieval and chunks. It
does not:

| Surface | Where it is today | Work |
| --- | --- | --- |
| Retrieval primitives | Algorithms already in `tinycortex::memory::retrieval`. `tinymemory-core/tree/retrieval/{cover,fast,search,drill_down,fetch,source}.rs` are 26–64 line **shims** that add source-scope filtering, limit truncation and logging — a policy layer, not a fork. | Expose only |
| Chunk-level access | `tinymemory-core/store/chunks/store.rs` is a pure delegating wrapper — `engine_config(config)` then straight through to `tinycortex::memory::chunks`. | Expose only |
| Unified store types | Same shim relationship over `tinycortex::memory::store`. | Expose only |
| **People** | `tinymemory-core/people` — 2,138 LOC, its own SQLite database, its own migrations, a workspace-keyed process-global store, and **zero** TinyCortex references. | Genuine migration down into TinyCortex, then a new People capability family |

### 1a. People migration — landed

`tinymemory-core/people` (2,138 LOC, 34 tests) now lives at
`tinycortex::memory::people`, behind a default-off `people` feature that implies
`tokio` (the store shares its connection as an `Arc<tokio::sync::Mutex<_>>`).
`tinymemory-core/people/mod.rs` is a re-export shim, matching `store/chunks`.
Six `tracing::` calls became `log::` — all plain format strings, no structured
fields — so `people` pulls in no dependency TinyCortex did not already have.

**A live bug fell out of it.** The `contacts` gate was never forwarded. The
reader has always lived below this crate, but `contacts` enabled four `objc2`
crates *in the host* — which no file in `src/` names — and never reached
`tinymemory-core`, where the `#[cfg]` is. So the macOS arm of `address_book.rs`
was always compiled out: `SystemContactsSource` returned the empty stub,
`people.refresh_address_book` reported success having seeded nothing, and macOS
paid to compile four unused crates for it.

This is the `voice` (#4901) / `tokenjuice-treesitter` (#4918) failure shape
exactly — an unforwarded gate does not break the build, it silently does
nothing. Fixed by forwarding (`contacts = ["tinymemory-core/contacts"]` →
`tinycortex/contacts`), deleting the host's four unused `objc2` declarations,
and adding `contacts_feature_reaches_the_engine_reader`, which asserts the
property that was missing: that enabling the feature *here* changes what the
reader does *there*. A `cfg!(feature = ...)` self-assertion would have passed
throughout the bug.

**Verification.** TinyCortex: 34 people tests pass; default and `contacts`
builds clean. Host: builds clean both ways; feature-forwarding gate passes;
`openhuman::memory::` is 711 passed / 26 failed / 1 ignored against `main`'s
710 / 26 / 0 — the 26 are pre-existing and identical on a clean `main`
checkout (they need the module artifact, which is not fetched locally), so this
adds one passing test and one deliberately ignored one, and no new failures.

### 1b. The People capability family — landed in the contract

`Capability::People` is family fourteen, appended (never inserted — declaration
order is bit order in the `Capabilities` bitset, so moving a variant would
silently re-interpret an already-transmitted set). `CONTRACT_VERSION` goes
`(2, 0)` → `(2, 1)`.

**A new family, not methods on an existing one — the version rule forces this.**
Adding these calls to `MemoryEntities` would have been a **major** bump, because
a new method on a family a driver may already advertise is breaking: negotiation
cannot protect a caller from a method an older driver never implemented. A new
family is a minor bump, and an older driver simply does not advertise it.

`MemoryPeople` carries seven methods, derived from the seven agent tools and
four RPC controllers that exist today rather than guessed at: `list_people`,
`get_person`, `resolve_handle`, `add_handle_alias`, `score_person`,
`record_interaction`, `seed_from_address_book`. Its types are the contract's
own — TinyCortex's `Person`/`Handle`/`Interaction` never cross — and identity
travels as an opaque `PersonRef` string, since the contract does not promise
every engine identifies people by UUID.

Wired through: both contract copies, `NullMemoryProvider`, the `MemoryGuard`
decorator (`GuardedPeople`), and the recording test fixture. In the guard,
`resolve_handle` takes the **write** tier check when `create_if_missing` is set
and the read check otherwise — classifying the whole method as a read would have
handed a `readonly` operator a working insert through the back door.

**A drift guard now holds the two contract copies together.** There are two
copies of this contract — the host-local one the module *client* compiles
against, and `tinymemory-api` which the module *service* compiles against — and
they meet only over a bus, where a mismatch is not a type error but a method
never called or a capability filtered away on one side. That duplication already
produced one live defect (§3). Two tests now pin the families and the version
across both copies; both were verified to actually fail by temporarily diverging
a wire string, then to go green again. They are deleted with the
`tinymemory-api` dependency in stage 5, when one copy remains.

**Verification.** `openhuman::memory::api` 190 passed / 0 failed;
`openhuman::memory::guard` 56 / 0; `core::all` 91 / 0; `openhuman::memory::`
back to exactly the 26 pre-existing failures with no new ones; `cargo fmt`
clean. (The full `--lib` run aborts on a pre-existing stack overflow in
`agent::harness::session::runtime`, identical on a clean `main` checkout.)

### 1c. Engine implementation, module service, host client — landed

**Not in `tinymemory-tinycortex`.** That adapter holds only an
`Arc<dyn Memory>` and documents its own scope as the mandatory three, because
the optional families need a host's configuration. The implementation belongs
to `tinymemory-module`'s `ModuleMemoryProvider`, which already holds
`workspace_dir` and implements the other ten.

**Conversions destructure; they do not round-trip through serde.** The module's
`Self::cross` helper is a serde value round-trip, and it would have compiled
and then failed at runtime on the first call: the engine's `Interaction` names
its timestamp `ts` where the contract names it `at`. Explicit destructuring
makes a renamed or added field a compile error instead — the rule
`tinymemory-tinycortex::convert` already follows.

Two smaller decisions worth keeping:

- A malformed `PersonRef` is `Invalid`, not `NotFound`. `NotFound` would tell a
  caller their id was well-formed but absent, sending them to look for a deleted
  person rather than at the id they built.
- Ranking sorts with `total_cmp`, not `partial_cmp`. A NaN from a degenerate
  score makes `partial_cmp` return `None`, and `sort_by` on a non-total ordering
  may panic or produce garbage order.

Service side: seven methods on `ai.tinyhumans.tinymemory.Memory`, with
`ListPeople` size-checked like the other list-returning methods — `limit` bounds
the count but not the bytes. Host side: seven forwards through `module_call!`
and an `as_people()` accessor.

**The nested TinyCortex submodule was fast-forwarded** (`be7b395` → `566804c`,
verified as an ancestor first) so the module crate can actually build and test
against the engine change. That pointer bump is part of the release anyway.

### Release-ordering hazard — read before shipping stage 2

`ModuleMemoryProvider::capabilities()` answers `Capabilities::all()`
**statically**. That set grew with the contract; the *artifact* only grows when a
release is cut and `modules/registry.rs` is re-pinned. Between those moments the
host over-claims, and `verify()` logs the disagreement without narrowing the
advertised set.

`people` is in that window now: served by the module source in this tree, not by
the pinned `1.0.1` artifact. It is **inert today** because nothing in the host
reaches `as_people()` yet. It stops being inert the moment the people RPC
handlers are routed through the driver, so **that change and the module release
must land together**. Documented at the `capabilities()` call site too.

### 1d. The `Chunks` and `Retrieval` families — landed

Families fifteen and sixteen, contract now `(2, 1)` with three additions (one
minor bump covers all three — capability negotiation is what makes each safe).

- **`MemoryChunks`** — `list_chunks`, `get_chunk`, `chunk_embeddings`. A
  deliberately lower-level surface than the rest of the contract: it exists so a
  host doing its *own* ranking (cosine + MMR, hybrid keyword/vector) can get the
  rows without reaching around the driver into the engine's tables — which is
  the split-brain this port exists to end.
- **`MemoryRetrieval`** — `fast_retrieve`, `cover_window`, `search_entities`.

Three decisions worth keeping:

**Source scope had to become an explicit wire argument.** `tinymemory-core`'s
in-process entry points read it from a **task-local**. That task-local belongs to
the host's task and does not exist on the module's side of a bus call, so it
would have read as `None` there — and `None` means *unrestricted*. A
per-profile source gate would have failed open, silently, on every scoped
retrieval. So `cover_window_scoped` and `fast_retrieve_scoped` were added
alongside the ambient-scope originals (mirroring TinyCortex's own
`cover_window_scoped`), and every scoped method on the wire takes `scope` as an
argument and never infers it.

**Entity kinds travel as strings, not as an enum.** The engine's `EntityKind` is
`#[non_exhaustive]` and has grown twice. A closed enum on the wire means the
first time the engine emits a kind this build has not heard of, the **response
fails to deserialize** — a new entity category would break retrieval outright
rather than showing up as an unfamiliar label. Responses therefore carry an open
snake_case vocabulary. Requests are the opposite case and *are* validated: an
unknown kind in a filter is `Invalid`, because silently matching nothing is
indistinguishable from a genuine empty result.

**`chunk_embeddings` sorts its result.** The engine returns a `HashMap`, whose
iteration order varies per process; an otherwise-identical call would return a
differently-ordered list. It is also the largest thing this interface returns —
a 1536-dimension vector is roughly 10 KiB of JSON — so it is size-checked and
refused by name rather than truncated, since a short batch is indistinguishable
from "those chunks have no vector".

**Verification.** Module crate 34/0 · host `memory::api` 190/0 ·
`memory::guard` 56/0 · `core::all` 91/0 · `openhuman::memory::` failing set
byte-identical to the pre-existing 26 · `cargo fmt` clean across all four
crates.

### Still open in stage 1

- Routing the host's people / chunk / retrieval RPC + agent tools through the
  driver (stage 2) — that is what makes these three families load-bearing and
  what ends the split brain.
- A module release, the digest update in `modules/registry.rs`, and the
  TinyMemory-side submodule pointer commit.

**Why People moves rather than staying put.** `tinymemory-core` survives this
port — it is the module's own implementation crate, it just stops being an
*OpenHuman* dependency — so leaving People there would compile. But the contract
defines a capability and each engine implements it; a second engine binding in
TinyCortex's place must bring its own People store. Storage belongs to the
engine, which is exactly the split that makes the contract engine-neutral.

Then: widen `MemoryProvider` and the capability set, extend the module service
and the host client in `modules/memory.rs`, cut a TinyMemory module release and
update the digests in `modules/registry.rs`.

This is the largest stage and the only cross-repo-blocking one — it needs a
published module release, taken verbatim from the release's `checksum.toml`,
never recomputed from a local build.

**Stage 2 — cut the direct engine calls over.**
Rewrite the 30 `tinymemory_core` call sites in `memory/{tools,query,tree}` onto
the provider. Ends the split brain.

**Stage 3 — the 98 `tinycortex::memory` references.**
56 sit outside `memory/` (`agent/`, `threads/`, `subconscious/`, `channels/`,
`security/`), mostly `tinycortex::memory::conversations`. Route through the
provider or through a host-owned conversation store.

**Stage 4 — bring host-layer code home, and drop `tinymemory-core`.**
Move `sync`, `composio_host`, `chat`, `learning_candidate`, `nlp_host` out of
`tinymemory-core` into `memory/`. Delete `host_impls.rs` in favour of the bus
services in `modules/memory_host.rs`.

**Stage 5 — retire `tinymemory-api`.**
Only reachable once stage 4 lands, per the ordering constraint above. Re-point
the 46 `tinymemory_api::host` references at the host-local `memory::api::host`
and reconcile the 6 diverged files. Touches `config/schema/*`, `inference/`,
`cron/scheduler_gate`, `integrations/composio`. These config types are persisted
serde — field names, defaults and `#[serde(...)]` attributes must not move.
Drop the crate cross-check test in `memory/api/host/embeddings.rs`; the golden
test beside it is what carries the format guarantee afterwards.

**Stage 6 — drop the deps and ratchet.**
Remove all five entries from `Cargo.toml`, forward the gate to
`app/src-tauri/Cargo.toml`, and re-baseline `scripts/kernel-floor.limits` —
`libsqlite3-sys` should leave the kernel profile with the engine.

## 5. Verification

- Both-ways gate tests in `src/core/all_tests.rs` for any new feature gating.
- A regression test per stage, failing before and passing after.
- `scripts/check-kernel-floor.sh` re-baselined only at stage 6, and the shed
  written back — an unratcheted improvement grows back unnoticed.
- Prove each claimed shed with `scripts/assert-shed.sh`, never `cargo tree -i`.
