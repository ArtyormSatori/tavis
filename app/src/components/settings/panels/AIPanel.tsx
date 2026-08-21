/*
 * AI settings — three orthogonal sections:
 *   1. Cloud providers (credentials + primary selection)
 *   2. Local provider (Ollama runtime + installed models)
 *   3. Workload routing (8-row matrix; per-workload provider + model)
 *
 * "Primary cloud" is an abstraction: any workload set to "Primary" inherits
 * whichever cloud provider is currently marked primary. Overrides are explicit
 * per row, so the resolved provider+model is always rendered inline.
 *
 * This file is a thin composition — every section lives in `./ai/*`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { LuCircleAlert, LuKeyRound, LuPencil } from 'react-icons/lu';

import { useT } from '../../../lib/i18n/I18nContext';
import {
  type AISettings as ApiAISettings,
  classifyProviderVerificationFailure,
  clearCloudProviderKey,
  describeProviderVerificationFailure,
  flushCloudProviders,
  importOpenAiCodexCliAuth,
  listProviderModels,
  loadProviderAuthErrors,
  OPENAI_CODEX_OAUTH_MISSING_AUTH_URL,
  OPENAI_CODEX_OAUTH_MISSING_CALLBACK_URL,
  type ProviderAuthError,
  setCloudProviderKey,
  upsertModelRegistryVision,
} from '../../../services/api/aiSettingsApi';
import { connectOpenRouterViaOAuth } from '../../../utils/openrouterOAuth';
import {
  openhumanUpdateLocalAiSettings,
} from '../../../utils/tauriCommands/config';
import { ConfirmationModal } from '../../intelligence/ConfirmationModal';
import PanelPage from '../../layout/PanelPage';
import Button from '../../ui/Button';
import { SettingsStatusLine } from '../controls';
import SettingsBackButton from '../components/SettingsBackButton';
import { useSettingsNavigation } from '../hooks/useSettingsNavigation';
import { ai_reexports } from './ai/_reexports';
import { BackgroundLoopControls } from './ai/BackgroundLoopControls';
import { ClaudeCodeConnect } from './ai/ClaudeCodeStatusCard';
import { CloudProviderEditor } from './ai/CloudProviderEditor';
import { CustomRoutingDialog } from './ai/CustomRoutingDialog';
import { GlobalOwnModelSelector } from './ai/GlobalOwnModelSelector';
import { ProviderKeyDialog, ProviderToggleChip } from './ai/ProviderConnectControls';
import { RoutingModeCards } from './ai/RoutingModeCards';
import { SaveBar } from './ai/SaveBar';
import { useAISettings, useInstalledModels, useOllamaStatus } from './ai/useAISettingsState';
import { WorkloadRow } from './ai/WorkloadRow';
import {
  authStyleForSlug,
  BUILTIN_PROVIDER_META,
  BUILTIN_RESERVED_SLUGS,
  buildRoutingDiffSummary,
  type CloudProvider,
  defaultEndpointFor,
  inferRoutingMode,
  inferSharedModelRef,
  LOCAL_CHIP_LABEL,
  LOCAL_CHIP_TONE,
  type LocalChipSlug,
  maskKeyLabel,
  providerToggleAriaLabel,
  ROUTING_WORKLOAD_IDS,
  routingWithAllWorkloads,
  WORKLOADS,
  type WorkloadId,
} from './ai/aiPanelTypes';
import {
  authStyleForBuiltinCloudProvider as _unused_authStyleForBuiltinCloudProvider,
  BUILTIN_CLOUD_PROVIDER_SLUGS,
} from './builtinCloudProviders';
import { routingWithProviderRemoved } from './aiRouting';
import { presentProviderSetupError, ProviderSetupErrorNotice } from './ProviderSetupErrorNotice';
import { useReembedBackfillModal } from './useReembedBackfillModal';

export type { CloudProvider, ProviderRef, RoutingMap } from './ai/aiPanelTypes';
export { buildRoutingDiffSummary, BackgroundLoopControls };
void ai_reexports;
void _unused_authStyleForBuiltinCloudProvider;
void authStyleForSlug;

interface AIPanelProps {
  /** When true, the panel is rendered embedded inside another flow (e.g. the
   *  onboarding custom wizard) and skips its own SettingsHeader chrome so the
   *  host frame's title/back controls aren't duplicated. */
  embedded?: boolean;
}

const AIPanel = ({ embedded = false }: AIPanelProps = {}) => {
  const { t } = useT();
  const { navigateBack } = useSettingsNavigation();
  const { saved, draft, isDirty, save, persist, discard, loading, error, reload } = useAISettings();
  // #1574 §4b: advisory re-embed modal, driven by the backend status RPC.
  // Logic lives in a unit-testable hook (see useReembedBackfillModal).
  const { reembed, handleSave, dismissReembed } = useReembedBackfillModal(save);
  const ollama = useOllamaStatus();
  const installed = useInstalledModels(ollama.snapshot);
  const [editing, setEditing] = useState<CloudProvider | 'new' | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [codexAuthError, setCodexAuthError] = useState<string | null>(null);
  // Which workload's "Custom" dialog is currently open (null = closed).
  const [customDialogFor, setCustomDialogFor] = useState<WorkloadId | null>(null);
  const [routingEditorMode, setRoutingEditorMode] = useState<'own' | 'custom' | null>(null);
  // Which provider slug's API-key dialog is currently open (null = closed).
  const [keyDialogFor, setKeyDialogFor] = useState<string | null>(null);
  // When the user toggles LM Studio / Ollama (local runtimes), we
  // need to remember which label to attach to the upserted provider so the
  // chip can find it again. Cleared when the dialog closes.
  const [pendingLocalLabel, setPendingLocalLabel] = useState<string | null>(null);
  const openRouterOauthAbortRef = useRef<AbortController | null>(null);
  // BYO provider keys that the provider rejected at runtime (401/403). The
  // raw error is demoted from Sentry as unactionable user-state, so this
  // inline notice is how the user learns a key broke — most often in a silent
  // background loop (memory summarization, TAURI-RUST-4RC) that never surfaces
  // an error on its own. Re-fetched whenever settings reload (a key
  // save/remove clears the matching entry core-side).
  const [providerAuthErrors, setProviderAuthErrors] = useState<ProviderAuthError[]>([]);
  // #5339: non-fatal "the key was saved, but the provider was unreachable"
  // advisory. Set when an add-time reachability probe fails for a *non-auth*
  // reason (timeout / unreachable / unknown): the key is plausibly valid, so it
  // is kept and the provider saved rather than rolled back. Distinct from
  // `providerAuthErrors` (runtime 401/403) and from a hard save error.
  //
  // Keyed by slug (#5341) so it is cleared only for the provider it belongs to —
  // removing or reconnecting a *different* provider must not wipe it, and
  // removing *this* provider must.
  const [providerSaveNotice, setProviderSaveNotice] = useState<{
    slug: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadProviderAuthErrors()
      .then(errs => {
        if (!cancelled) {
          setProviderAuthErrors(errs);
        }
      })
      .catch(() => {
        // Best-effort surface — a fetch failure must not break the panel.
        // Drop any prior notice too: a key save/remove already cleared the
        // entry core-side, so keeping a stale banner would misreport a
        // rejection the user has resolved.
        if (!cancelled) {
          setProviderAuthErrors([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const connectProvider = useCallback(
    async ({
      slug,
      localLabel = null,
      value,
      endpoint: endpointOverride,
      credentialMode,
    }: {
      slug: string;
      localLabel?: string | null;
      value: string;
      /**
       * For `endpoint_key` runtimes (OMLX): the endpoint URL. `value` carries
       * the API key in that mode, so the endpoint comes in separately. Ignored
       * for `endpoint` mode, where `value` IS the endpoint.
       */
      endpoint?: string | null;
      credentialMode:
        | 'api_key'
        | 'oauth'
        | 'codex_oauth'
        | 'endpoint'
        | 'endpoint_key'
        | 'cli_login';
    }) => {
      const isLocalRuntime = credentialMode === 'endpoint' || credentialMode === 'endpoint_key';
      // `endpoint_key` (OMLX) carries the API key in `value` and the endpoint
      // separately; `endpoint` mode carries the endpoint URL in `value`.
      const isEndpointKey = credentialMode === 'endpoint_key';
      const isCodexOAuth = credentialMode === 'codex_oauth';
      // CLI-backed login (Claude Code): no API key is written and no HTTP
      // /models probe is made — auth + execution both go through the local
      // `claude` CLI. Mirrors the Codex skip, but also skips model listing.
      const isCliLogin = credentialMode === 'cli_login';
      setBusyAction(`toggle-${localLabel ? localLabel.toLowerCase().replace(/\s/g, '') : slug}`);
      // A fresh attempt on THIS provider clears only its own prior advisory —
      // an advisory about a different provider must survive (#5341).
      setProviderSaveNotice(prev => (prev?.slug === slug ? null : prev));

      try {
        const trimmed = value.trim();
        // For `endpoint_key` (OMLX), the endpoint URL arrives via `endpointOverride`
        // (the dialog's endpoint field) and `trimmed` is the API key. For plain
        // `endpoint` runtimes, `trimmed` itself is the endpoint URL.
        const rawEndpoint = isEndpointKey ? (endpointOverride ?? '').trim() : trimmed;
        const endpoint = isLocalRuntime
          ? (() => {
              const url = new URL(rawEndpoint);
              if (!/^https?:$/.test(url.protocol)) {
                throw new Error('Endpoint must start with http:// or https://');
              }
              if (url.pathname === '' || url.pathname === '/') {
                url.pathname = '/v1';
              }
              return url.toString().replace(/\/$/, '');
            })()
          : defaultEndpointFor(slug);

        const upserted: CloudProvider = {
          id: `p_${slug}_${Math.random().toString(36).slice(2, 7)}`,
          slug,
          label: localLabel ?? BUILTIN_PROVIDER_META[slug]?.label ?? slug,
          endpoint,
          authStyle: authStyleForSlug(slug),
          // CLI-login providers hold no API key — reflect that honestly so
          // the entry matches its reloaded (has_api_key === false) shape.
          maskedKey: maskKeyLabel(!isCliLogin),
        };

        const priorWireProviders = saved.cloudProviders.map(p => ({
          id: p.id,
          slug: p.slug,
          label: p.label,
          endpoint: p.endpoint,
          auth_style: p.authStyle,
        }));

        if (!isLocalRuntime && !isCodexOAuth && !isCliLogin && slug !== 'openhuman') {
          await setCloudProviderKey(slug, trimmed);
        } else if (isLocalRuntime && slug === 'ollama') {
          const baseUrl = endpoint.replace(/\/v1\/?$/, '');
          await openhumanUpdateLocalAiSettings({
            base_url: baseUrl,
            provider: 'ollama',
            runtime_enabled: true,
            opt_in_confirmed: true,
          });
        } else if (isLocalRuntime && slug === 'lmstudio') {
          await openhumanUpdateLocalAiSettings({
            base_url: endpoint,
            provider: 'lm_studio',
            runtime_enabled: true,
            opt_in_confirmed: true,
          });
        } else if (isLocalRuntime && slug === 'omlx') {
          // OMLX: OpenAI-compatible local runtime that also requires a Bearer
          // key. Persist both the endpoint and the key into local_ai (the Rust
          // factory's omlx branch reads `local_ai.api_key` as the Bearer token).
          await openhumanUpdateLocalAiSettings({
            base_url: endpoint,
            api_key: trimmed,
            provider: 'omlx',
            runtime_enabled: true,
            opt_in_confirmed: true,
          });
        }

        if (slug !== 'openhuman') {
          const nextWireProviders = [
            ...priorWireProviders.filter(p => p.slug !== slug),
            {
              id: upserted.id,
              slug: upserted.slug,
              label: upserted.label,
              endpoint: upserted.endpoint,
              auth_style: upserted.authStyle,
            },
          ];
          await flushCloudProviders(nextWireProviders);
          if (!isCodexOAuth && !isCliLogin) {
            try {
              await listProviderModels(slug);
            } catch (probeErr) {
              const msg = probeErr instanceof Error ? probeErr.message : String(probeErr);
              const reason = classifyProviderVerificationFailure(msg);
              // Only a cloud KEY provider (a key written to auth-profiles.json at
              // `setCloudProviderKey` above) gets the non-fatal treatment. Local
              // runtimes (ollama/lmstudio/omlx) keep the original reject-on-probe
              // behaviour: an unreachable local runtime is a genuine setup error
              // the user should fix, not route chat to a dead host.
              //
              // NOTE: OMLX (`endpoint_key`) IS a local runtime that *does* write a
              // key — into `local_ai.api_key` via `openhumanUpdateLocalAiSettings`,
              // not auth-profiles.json. That `local_ai` write is NOT rolled back
              // here (pre-existing behaviour, unchanged by this branch); restoring
              // it on a failed local probe is tracked as a separate follow-up.
              const isKeyProvider = !isLocalRuntime && slug !== 'openhuman';
              if (isKeyProvider && reason !== 'auth') {
                // #5339: transient / unreachable / unknown — the key is plausibly
                // valid, so do NOT discard it or block the save. Keep the key +
                // provider entry, record a non-fatal advisory, and fall through to
                // persist. Prevents a valid key being lost/orphaned over a momentary
                // `/models` hiccup (the built-in key dialog has no "add anyway"
                // escape hatch the custom-provider editor got in #5213).
                console.warn(
                  `[ai-settings] provider=${slug} add-time probe non-fatal reason=${reason}`
                );
                setProviderSaveNotice({
                  slug,
                  message: describeProviderVerificationFailure(slug, msg, t),
                });
              } else {
                // Auth failure (wrong key), or a local runtime that isn't up:
                // roll both stores back and reject so the user fixes it. Rollback
                // failures are LOGGED, never swallowed — a silently failed
                // key-clear is exactly what orphans a key on disk (#5339).
                await flushCloudProviders(priorWireProviders).catch(rollbackErr =>
                  console.warn(`[ai-settings] rollback flush failed slug=${slug}`, rollbackErr)
                );
                if (isKeyProvider) {
                  await clearCloudProviderKey(slug).catch(rollbackErr =>
                    console.warn(
                      `[ai-settings] rollback clearCloudProviderKey failed slug=${slug}`,
                      rollbackErr
                    )
                  );
                }
                throw new Error(`Could not reach ${upserted.label}: ${msg}`);
              }
            }
          }
        }

        const nextDraft = {
          ...draft,
          cloudProviders: [...draft.cloudProviders.filter(p => p.slug !== slug), upserted],
        };
        await persist(nextDraft);
        if (isCodexOAuth && slug === 'openai') {
          await clearCloudProviderKey(slug);
        }
        if (slug === 'openai') {
          setCodexAuthError(null);
        }
        setKeyDialogFor(null);
        setPendingLocalLabel(null);
      } finally {
        setBusyAction(null);
      }
    },
    [draft, persist, saved.cloudProviders, t]
  );

  const connectOpenAiViaCodexAuth = useCallback(async () => {
    setCodexAuthError(null);
    setBusyAction('codex-auth');
    try {
      await importOpenAiCodexCliAuth();
      await connectProvider({ slug: 'openai', value: 'oauth', credentialMode: 'codex_oauth' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const localizedMessage =
        message === OPENAI_CODEX_OAUTH_MISSING_AUTH_URL
          ? t('settings.ai.codexOauthMissingAuthUrl')
          : message === OPENAI_CODEX_OAUTH_MISSING_CALLBACK_URL
            ? t('settings.ai.codexOauthMissingCallbackUrl')
            : message;
      console.warn('[ai-settings] codex auth import failed', {
        summary: presentProviderSetupError(localizedMessage, t).summary,
      });
      setCodexAuthError(localizedMessage);
    } finally {
      setBusyAction(null);
    }
  }, [connectProvider, t]);

  const diffSummary = buildRoutingDiffSummary(saved.routing, draft.routing, t);
  const chatRows = WORKLOADS.filter(w => w.group === 'chat');
  const bgRows = WORKLOADS.filter(w => w.group === 'background');
  const inferredRoutingModeRaw = inferRoutingMode(draft.routing);
  // Routing mode is derived purely from the workload routing map, not from the
  // set of configured providers: saving a provider key only adds a
  // `cloudProviders` entry, it does not rewrite `routing`. So "managed while a
  // provider key is configured" is an expected state — the user must pick a
  // route to actually use their provider. Surfaced for support diagnostics
  // (the recurring "my key is added but not used" question).
  const configuredWithKey = draft.cloudProviders.filter(p => p.maskedKey.startsWith('••••'));
  console.debug('[ai-settings][routing] inferred mode', {
    mode: inferredRoutingModeRaw,
    routing: ROUTING_WORKLOAD_IDS.map(id => `${id}:${draft.routing[id]?.kind}`),
    configured_providers: draft.cloudProviders.map(p => p.slug),
    configured_with_key: configuredWithKey.map(p => p.slug),
    // A provider key is configured but routing is still managed → the provider
    // is not used until the user selects a custom route.
    configured_but_managed: inferredRoutingModeRaw === 'managed' && configuredWithKey.length > 0,
  });
  const effectiveRoutingMode =
    routingEditorMode === 'own'
      ? 'own'
      : routingEditorMode === 'custom'
        ? 'custom'
        : inferredRoutingModeRaw;
  const sharedModelRef = inferSharedModelRef(draft.routing);

  return (
    <PanelPage
      className="z-10"
      contentClassName=""
      description={embedded ? undefined : t('pages.settings.ai.llmDesc')}
      leading={embedded ? undefined : <SettingsBackButton onBack={navigateBack} />}>
      <div className={embedded ? 'space-y-5' : 'space-y-5 p-4'}>
        {/* ═══════════════════════════════════════════════════════════════
            AUTH — provider authentication (cloud providers + local Ollama
            setup). Everything the user needs to wire a model up.
            ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-5">
          <div className="border-b border-line pb-2">
            <h2 className="text-base font-semibold text-content">
              {t('settings.ai.llmProviders')}
            </h2>
            <p className="text-xs text-content-muted mt-0.5">{t('settings.ai.llmProvidersDesc')}</p>
          </div>

          {/* ─── Rejected-key notices ─────────────────────────────────────────
              A BYO key the provider rejected at runtime (401/403). Surfaced
              here, next to the key editor, because the failing path is often a
              silent background loop and the raw error is demoted from Sentry. */}
          {providerAuthErrors.length > 0 && (
            <div className="space-y-2">
              {providerAuthErrors.map(err => (
                <ProviderSetupErrorNotice key={err.provider} error={err.message} />
              ))}
            </div>
          )}

          {/* #5339: non-fatal "key saved, but provider unreachable" advisory.
              Amber (not coral): the save succeeded, only reachability is in
              question. */}
          {providerSaveNotice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <LuCircleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex-1">{providerSaveNotice.message}</span>
              <Button
                type="button"
                variant="tertiary"
                size="xs"
                className="shrink-0 font-medium normal-case underline-offset-2 hover:underline"
                onClick={() => setProviderSaveNotice(null)}>
                {t('common.dismiss')}
              </Button>
            </div>
          )}

          {/* ─── Provider chip-toggle list ────────────────────────────────── */}
          <section className="space-y-3">
            {loading && <div className="text-xs text-content-muted">{t('common.loading')}</div>}
            {error && (
              <SettingsStatusLine saving={false} error={error} savedNote={null} savingLabel="" />
            )}

            <div className="flex flex-wrap gap-1.5">
              <ProviderToggleChip
                key="openhuman"
                slug="openhuman"
                label={t('settings.ai.routing.managed')}
                enabled
                alwaysOn
              />

              {/* Built-in cloud providers */}
              {BUILTIN_CLOUD_PROVIDER_SLUGS.map(slug => {
                const meta = BUILTIN_PROVIDER_META[slug];
                const label = meta?.label ?? slug;
                const existing = draft.cloudProviders.find(cp => cp.slug === slug);
                const enabled = !!existing;
                return (
                  <ProviderToggleChip
                    key={slug}
                    slug={slug}
                    label={label}
                    enabled={enabled}
                    busy={busyAction === `toggle-${slug}`}
                    onToggle={async () => {
                      if (enabled && existing) {
                        // Toggle OFF: remove the provider + scrub any
                        // routing entries that pin to it. Drop its advisory too,
                        // so a stale notice can't name a provider that is gone
                        // (#5341) — but only if the advisory is about THIS one.
                        setProviderSaveNotice(prev => (prev?.slug === existing.slug ? null : prev));
                        const remaining = draft.cloudProviders.filter(cp => cp.id !== existing.id);
                        const nextRouting = routingWithProviderRemoved(
                          draft.routing,
                          { slug: existing.slug, isLocalRuntime: false },
                          remaining
                        );
                        await persist({
                          ...draft,
                          cloudProviders: remaining,
                          routing: nextRouting,
                        });
                      } else {
                        // Toggle ON: open the API-key popup. The chip
                        // only flips after the dialog saves.
                        setKeyDialogFor(slug);
                      }
                    }}
                  />
                );
              })}

              {draft.cloudProviders
                .filter(cp => !BUILTIN_RESERVED_SLUGS.includes(cp.slug))
                .map(existing => (
                  <ProviderToggleChip
                    key={existing.id}
                    slug="custom"
                    label={existing.label}
                    enabled
                    busy={busyAction === `toggle-${existing.slug}`}
                    onToggle={async () => {
                      // Removing this provider clears only its own advisory (#5341).
                      setProviderSaveNotice(prev => (prev?.slug === existing.slug ? null : prev));
                      const remaining = draft.cloudProviders.filter(cp => cp.id !== existing.id);
                      const nextRouting = routingWithProviderRemoved(
                        draft.routing,
                        { slug: existing.slug, isLocalRuntime: false },
                        remaining
                      );
                      await persist({ ...draft, cloudProviders: remaining, routing: nextRouting });
                    }}
                  />
                ))}

              {/* LM Studio + Ollama — local runtimes stored with a slug of
                  "lmstudio" / "ollama" so they're distinct from generic custom. */}
              {(['lmstudio', 'ollama', 'omlx'] as const).map(localKind => {
                const label = LOCAL_CHIP_LABEL[localKind as LocalChipSlug];
                const tone = LOCAL_CHIP_TONE[localKind as LocalChipSlug];
                const existing = draft.cloudProviders.find(cp => cp.slug === localKind);
                const enabled = !!existing;
                // Use a styled chip directly for local runtimes — they have
                // non-standard tones not in BUILTIN_PROVIDER_META.
                return (
                  <div
                    key={localKind}
                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${tone}`}>
                    <span>{label}</span>
                    {enabled && (
                      <Button
                        type="button"
                        iconOnly
                        variant="tertiary"
                        size="xs"
                        aria-label={t('settings.ai.editEndpoint')}
                        title={t('settings.ai.editEndpoint')}
                        onClick={() => {
                          setKeyDialogFor(localKind);
                          setPendingLocalLabel(label);
                        }}>
                        <LuPencil className="h-3 w-3" />
                      </Button>
                    )}
                    <ProviderToggleChip
                      slug={localKind}
                      label=""
                      enabled={enabled}
                      alwaysOn={false}
                      busy={busyAction === `toggle-${localKind}`}
                      onToggle={async () => {
                        if (enabled && existing) {
                          const remaining = draft.cloudProviders.filter(
                            cp => cp.id !== existing.id
                          );
                          const nextRouting = routingWithProviderRemoved(
                            draft.routing,
                            { slug: localKind, isLocalRuntime: true },
                            remaining
                          );
                          await persist({
                            ...draft,
                            cloudProviders: remaining,
                            routing: nextRouting,
                          });
                        } else {
                          setKeyDialogFor(localKind);
                          setPendingLocalLabel(label);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* #3760: Managed is always-on and can't be turned off; point users
                who want a local model at the Routing card below instead of
                letting them fight the (now badge, formerly locked) Managed chip. */}
            <p className="text-xs text-content-muted">{t('settings.ai.routing.managedHint')}</p>

            <div className="flex flex-col gap-2 pt-1">
              {/* Codex — imports the existing Codex CLI login as an OpenAI credential. */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  leadingIcon={<LuKeyRound className="h-3.5 w-3.5" />}
                  onClick={() => void connectOpenAiViaCodexAuth()}
                  disabled={busyAction === 'codex-auth' || busyAction === 'toggle-openai'}>
                  {busyAction === 'codex-auth' || busyAction === 'toggle-openai'
                    ? t('settings.ai.connecting')
                    : t('settings.ai.codexAuthButton', 'Connect Codex')}
                </Button>
                <span className="text-xs text-content-muted">
                  {t(
                    'settings.ai.codexAuthHelper',
                    'Uses the existing Codex CLI login from ~/.codex/auth.json.'
                  )}
                </span>
              </div>
              {codexAuthError ? <ProviderSetupErrorNotice error={codexAuthError} /> : null}

              {/* Claude Code CLI — connect control (peer of Codex). A "Claude
                  Code" button + status text; the button opens a modal with the
                  enable/sign-in/disconnect controls. No API key: routes chat
                  through the local `claude` CLI using the CLI's own login. */}
              <ClaudeCodeConnect
                connected={draft.cloudProviders.some(cp => cp.slug === 'claude-code')}
                busy={busyAction === 'toggle-claude-code'}
                onConnect={() =>
                  connectProvider({
                    slug: 'claude-code',
                    value: 'cli_login',
                    credentialMode: 'cli_login',
                  })
                }
                onDisconnect={async () => {
                  const existing = draft.cloudProviders.find(cp => cp.slug === 'claude-code');
                  if (!existing) return;
                  const remaining = draft.cloudProviders.filter(cp => cp.id !== existing.id);
                  const nextRouting = routingWithProviderRemoved(
                    draft.routing,
                    { slug: existing.slug, isLocalRuntime: false },
                    remaining
                  );
                  await persist({ ...draft, cloudProviders: remaining, routing: nextRouting });
                }}
              />
            </div>

            <div className="pt-1">
              <Button type="button" variant="primary" size="xs" onClick={() => setEditing('new')}>
                {t('settings.ai.routing.addCustomProvider')}
              </Button>
            </div>
          </section>
        </div>
        {/* end of Auth section */}

        {/* ═══════════════════════════════════════════════════════════════
            ROUTING — top-level routing mode. Managed = OpenHuman decides.
            Own = one provider/model for everything. Custom = fine-grained
            per-workload routing.
            ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-5">
          <div className="border-b border-line pb-2">
            <h2 className="text-base font-semibold text-content">{t('settings.ai.routing')}</h2>
            <p className="text-xs text-content-muted mt-0.5">{t('settings.ai.routingDesc')}</p>
          </div>

          <section className="space-y-3">
            <RoutingModeCards
              effectiveRoutingMode={effectiveRoutingMode}
              onSelectManaged={() => {
                setRoutingEditorMode(null);
                void persist({
                  ...draft,
                  routing: routingWithAllWorkloads({ kind: 'openhuman' }),
                });
              }}
              onSelectOwn={() => setRoutingEditorMode('own')}
              onSelectCustom={() => setRoutingEditorMode('custom')}
            />

            {effectiveRoutingMode === 'own' ? (
              <GlobalOwnModelSelector
                current={sharedModelRef}
                saved={inferSharedModelRef(saved.routing)}
                cloudProviders={draft.cloudProviders}
                localModels={installed}
                ollamaRunning={ollama.state === 'running'}
                modelRegistry={draft.modelRegistry}
                onApply={async (next, vision) => {
                  const reg =
                    next.kind === 'cloud'
                      ? { slug: next.providerSlug, model: next.model }
                      : next.kind === 'local'
                        ? { slug: 'ollama', model: next.model }
                        : next.kind === 'claude-code'
                          ? { slug: 'claude-code', model: next.model }
                          : null;
                  await persist({
                    ...draft,
                    routing: routingWithAllWorkloads(next),
                    modelRegistry: reg
                      ? upsertModelRegistryVision(draft.modelRegistry, reg.slug, reg.model, vision)
                      : draft.modelRegistry,
                  });
                }}
              />
            ) : null}

            {effectiveRoutingMode === 'custom' ? (
              <>
                <div className="rounded-xl border border-primary-200 bg-primary-50/70 px-4 py-3 text-sm text-primary-900 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-100">
                  {t('settings.ai.routing.customDesc')}
                </div>

                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-line bg-surface-muted px-3">
                    <div className="border-b border-line py-3">
                      <div className="text-sm font-semibold text-content">
                        {t('settings.ai.routing.chatAndConversations')}
                      </div>
                      <div className="mt-1 text-xs text-content-muted">
                        {t('settings.ai.routing.chatDesc')}
                      </div>
                    </div>
                    <div className="divide-y divide-line">
                      {chatRows.map(w => (
                        <WorkloadRow
                          key={w.id}
                          workload={w}
                          ref_={draft.routing[w.id]}
                          cloudProviders={draft.cloudProviders}
                          onCustomClick={() => setCustomDialogFor(w.id)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-line bg-surface-muted px-3">
                    <div className="border-b border-line py-3">
                      <div className="text-sm font-semibold text-content">
                        {t('settings.ai.routing.backgroundTasks')}
                      </div>
                      <div className="mt-1 text-xs text-content-muted">
                        {t('settings.ai.routing.bgTasksDesc')}
                      </div>
                    </div>
                    <div className="divide-y divide-line">
                      {bgRows.map(w => (
                        <WorkloadRow
                          key={w.id}
                          workload={w}
                          ref_={draft.routing[w.id]}
                          cloudProviders={draft.cloudProviders}
                          onCustomClick={() => setCustomDialogFor(w.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
        {/* end of Routing section */}
      </div>

      {isDirty && (
        <SaveBar
          diffSummary={diffSummary}
          changeCount={diffSummary.length}
          onSave={() => void handleSave()}
          onDiscard={discard}
        />
      )}

      <ConfirmationModal
        modal={{
          isOpen: reembed.open,
          title: t('settings.ai.reindexingMemory'),
          message: t('settings.ai.reindexingMemoryMessage').replace(
            '{pending}',
            String(reembed.pending)
          ),
          confirmText: t('common.ok'),
          onConfirm: dismissReembed,
          onCancel: dismissReembed,
        }}
        onClose={dismissReembed}
      />

      {editing && (
        <CloudProviderEditor
          initial={editing === 'new' ? null : editing}
          existingSlugs={draft.cloudProviders
            .filter(p => p.id !== (editing === 'new' ? '' : editing.id))
            .map(p => p.slug)}
          onClose={() => setEditing(null)}
          onSubmit={async (next, apiKey, opts) => {
            setBusyAction('save-provider');
            try {
              const id =
                editing === 'new' || !editing.id
                  ? `p_${next.slug}_${Math.random().toString(36).slice(2, 7)}`
                  : editing.id;
              const upserted: CloudProvider = {
                ...next,
                id,
                maskedKey: maskKeyLabel(apiKey ? true : next.maskedKey.startsWith('••••')),
              };

              // Snapshot the prior persisted cloud_providers list so we can
              // restore it if the live probe fails.
              const priorWireProviders = saved.cloudProviders.map(p => ({
                id: p.id,
                slug: p.slug,
                label: p.label,
                endpoint: p.endpoint,
                auth_style: p.authStyle,
              }));

              // Persist the credential BEFORE the probe so the factory has it
              // available. Let setCloudProviderKey throw — the editor's
              // button-click handler catches and surfaces the error inline.
              if (apiKey && upserted.slug !== 'openhuman') {
                await setCloudProviderKey(upserted.slug, apiKey);
              }

              // Live verification — flush the new cloud_providers list and
              // call `/models` through the Rust controller. Skip for the
              // OpenHuman backend (session JWT, no probe-able endpoint).
              if (upserted.slug !== 'openhuman') {
                const list =
                  editing === 'new'
                    ? [...draft.cloudProviders, upserted]
                    : draft.cloudProviders.map(p => (p.id === editing.id ? upserted : p));
                const nextWireProviders = list
                  .filter(p => !['', 'cloud', 'openhuman', 'pid'].includes(p.slug))
                  .map(p => ({
                    id: p.id,
                    slug: p.slug,
                    label: p.label,
                    endpoint: p.endpoint,
                    auth_style: p.authStyle,
                  }));
                await flushCloudProviders(nextWireProviders);
                // `skipProbe` is the user's explicit "add it anyway" after a
                // failed verification. A provider whose `/models` listing is
                // absent or auth-shaped differently (Azure's classic
                // `api-version` surface is both) is still perfectly usable for
                // inference — gating creation on the probe made the deployment
                // name field unreachable for exactly those users (#5213).
                if (!opts?.skipProbe) {
                  try {
                    await listProviderModels(upserted.slug);
                  } catch (probeErr) {
                    // Roll back both stores. Failures are LOGGED, never swallowed:
                    // a silently failed key-clear orphans the key on disk (#5339).
                    // The user can still "add anyway" (`skipProbe`) to keep it.
                    await flushCloudProviders(priorWireProviders).catch(rollbackErr =>
                      console.warn(
                        `[ai-settings] rollback flush failed slug=${upserted.slug}`,
                        rollbackErr
                      )
                    );
                    if (apiKey) {
                      await clearCloudProviderKey(upserted.slug).catch(rollbackErr =>
                        console.warn(
                          `[ai-settings] rollback clearCloudProviderKey failed slug=${upserted.slug}`,
                          rollbackErr
                        )
                      );
                    }
                    const msg = probeErr instanceof Error ? probeErr.message : String(probeErr);
                    console.warn('[ai-settings] provider /models probe failed', {
                      slug: upserted.slug,
                      summary: presentProviderSetupError(msg, t).summary,
                    });
                    const { ProviderProbeError } = await import('./ai/aiPanelTypes');
                    throw new ProviderProbeError(`Could not reach ${upserted.label}: ${msg}`);
                  }
                }
              }

              const list =
                editing === 'new'
                  ? [...draft.cloudProviders, upserted]
                  : draft.cloudProviders.map(p => (p.id === editing.id ? upserted : p));
              await persist({ ...draft, cloudProviders: list });
              setEditing(null);
            } finally {
              setBusyAction(null);
            }
          }}
          onClearKey={async slug => {
            // Clearing this provider's key drops its own advisory (#5341).
            setProviderSaveNotice(prev => (prev?.slug === slug ? null : prev));
            try {
              await clearCloudProviderKey(slug);
              await reload();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn('[ai-settings] clearCloudProviderKey failed', msg);
            }
          }}
        />
      )}

      {customDialogFor &&
        (() => {
          const w = WORKLOADS.find(x => x.id === customDialogFor);
          if (!w) return null;
          return (
            <CustomRoutingDialog
              workload={w}
              initial={draft.routing[customDialogFor]}
              cloudProviders={draft.cloudProviders}
              localModels={installed}
              ollamaRunning={ollama.state === 'running'}
              modelRegistry={draft.modelRegistry}
              onClose={() => setCustomDialogFor(null)}
              onSubmit={async (next, vision) => {
                // (provider slug, model id) the vision flag keys on.
                const reg =
                  next.kind === 'cloud'
                    ? { slug: next.providerSlug, model: next.model }
                    : next.kind === 'local'
                      ? { slug: 'ollama', model: next.model }
                      : next.kind === 'claude-code'
                        ? { slug: 'claude-code', model: next.model }
                        : null;
                const nextDraft = {
                  ...draft,
                  routing: { ...draft.routing, [customDialogFor]: next },
                  modelRegistry: reg
                    ? upsertModelRegistryVision(draft.modelRegistry, reg.slug, reg.model, vision)
                    : draft.modelRegistry,
                };
                await persist(nextDraft);
                setCustomDialogFor(null);
              }}
            />
          );
        })()}

      {keyDialogFor && (
        <ProviderKeyDialog
          slug={keyDialogFor}
          label={pendingLocalLabel ?? BUILTIN_PROVIDER_META[keyDialogFor]?.label ?? keyDialogFor}
          isLocalRuntime={Boolean(pendingLocalLabel)}
          // OMLX is the only endpoint+key local runtime: render both an endpoint
          // field (prefilled with the localhost default) and an API key field.
          endpointKeyMode={keyDialogFor === 'omlx'}
          initialValue={
            pendingLocalLabel
              ? (draft.cloudProviders.find(cp => cp.slug === keyDialogFor)?.endpoint ??
                (keyDialogFor === 'omlx' ? defaultEndpointFor('omlx') : undefined))
              : undefined
          }
          oauthAction={
            keyDialogFor === 'openrouter' && !pendingLocalLabel
              ? {
                  label: t('settings.ai.signInWithOpenRouter'),
                  onClick: async () => {
                    const controller = new AbortController();
                    openRouterOauthAbortRef.current = controller;
                    try {
                      const apiKey = await connectOpenRouterViaOAuth({ signal: controller.signal });
                      await connectProvider({
                        slug: 'openrouter',
                        value: apiKey,
                        credentialMode: 'oauth',
                      });
                    } finally {
                      if (openRouterOauthAbortRef.current === controller) {
                        openRouterOauthAbortRef.current = null;
                      }
                    }
                  },
                }
              : null
          }
          onCancel={() => {
            openRouterOauthAbortRef.current?.abort();
            openRouterOauthAbortRef.current = null;
            setKeyDialogFor(null);
            setPendingLocalLabel(null);
          }}
          onSubmit={async (value, endpoint) =>
            await connectProvider({
              slug: keyDialogFor,
              localLabel: pendingLocalLabel,
              // In endpoint_key (OMLX) mode the dialog hands back the API key as
              // `value` and the endpoint URL as `endpoint`.
              value,
              endpoint,
              credentialMode:
                keyDialogFor === 'omlx'
                  ? 'endpoint_key'
                  : pendingLocalLabel
                    ? 'endpoint'
                    : 'api_key',
            })
          }
        />
      )}
    </PanelPage>
  );
};

export default AIPanel;
