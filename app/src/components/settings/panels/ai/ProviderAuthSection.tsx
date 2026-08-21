/*
 * Provider authentication section — the chip-toggle list (Managed, built-in
 * cloud providers, custom providers, local runtimes), the Codex/Claude Code
 * connect controls, and the rejected-key / non-fatal-advisory banners.
 */
import { LuCircleAlert, LuKeyRound, LuPencil } from 'react-icons/lu';

import { useT } from '../../../../lib/i18n/I18nContext';
import type { ProviderAuthError } from '../../../../services/api/aiSettingsApi';
import Button from '../../../ui/Button';
import { SettingsStatusLine, SettingsSwitch } from '../../controls';
import { routingWithProviderRemoved } from '../aiRouting';
import { BUILTIN_CLOUD_PROVIDER_SLUGS } from '../builtinCloudProviders';
import { ProviderSetupErrorNotice } from '../ProviderSetupErrorNotice';
import {
  type AISettings,
  BUILTIN_PROVIDER_META,
  BUILTIN_RESERVED_SLUGS,
  LOCAL_CHIP_LABEL,
  LOCAL_CHIP_TONE,
  type LocalChipSlug,
  providerToggleAriaLabel,
} from './aiPanelTypes';
import { ClaudeCodeConnect } from './ClaudeCodeStatusCard';
import { ProviderToggleChip } from './ProviderConnectControls';
import type { ConnectCredentialMode } from './useProviderConnect';

export const ProviderAuthSection = ({
  draft,
  persist,
  loading,
  error,
  busyAction,
  providerAuthErrors,
  providerSaveNotice,
  onDismissProviderSaveNotice,
  onProviderRemoved,
  codexAuthError,
  onConnectCodex,
  onConnectProvider,
  onOpenKeyDialog,
  onAddCustomProvider,
}: {
  draft: AISettings;
  persist: (next: AISettings) => Promise<void>;
  loading: boolean;
  error: string;
  busyAction: string | null;
  providerAuthErrors: ProviderAuthError[];
  providerSaveNotice: { slug: string; message: string } | null;
  /** Unconditional dismiss — the banner's own "Dismiss" button. */
  onDismissProviderSaveNotice: () => void;
  /** Clears the advisory only if it's about the given slug (#5341) — called
   *  when that provider is removed, so an unrelated advisory survives. */
  onProviderRemoved: (slug: string) => void;
  codexAuthError: string | null;
  onConnectCodex: () => void;
  onConnectProvider: (args: {
    slug: string;
    localLabel?: string | null;
    value: string;
    credentialMode: ConnectCredentialMode;
  }) => Promise<void>;
  onOpenKeyDialog: (slug: string, localLabel: string | null) => void;
  onAddCustomProvider: () => void;
}) => {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <div className="border-b border-line pb-2">
        <h2 className="text-base font-semibold text-content">{t('settings.ai.llmProviders')}</h2>
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
            onClick={onDismissProviderSaveNotice}>
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
                    // Toggle OFF: remove the provider + scrub any routing
                    // entries that pin to it. Drop its advisory too (#5341).
                    onProviderRemoved(existing.slug);
                    const remaining = draft.cloudProviders.filter(cp => cp.id !== existing.id);
                    const nextRouting = routingWithProviderRemoved(
                      draft.routing,
                      { slug: existing.slug, isLocalRuntime: false },
                      remaining
                    );
                    await persist({ ...draft, cloudProviders: remaining, routing: nextRouting });
                  } else {
                    // Toggle ON: open the API-key popup. The chip only flips
                    // after the dialog saves.
                    onOpenKeyDialog(slug, null);
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
                  onDismissProviderSaveNoticeIfMatching(existing.slug, onDismissProviderSaveNotice);
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
                    onClick={() => onOpenKeyDialog(localKind, label)}>
                    <LuPencil className="h-3 w-3" />
                  </Button>
                )}
                <SettingsSwitch
                  id={`local-runtime-toggle-${localKind}`}
                  checked={enabled}
                  onCheckedChange={async () => {
                    if (enabled && existing) {
                      const remaining = draft.cloudProviders.filter(cp => cp.id !== existing.id);
                      const nextRouting = routingWithProviderRemoved(
                        draft.routing,
                        { slug: localKind, isLocalRuntime: true },
                        remaining
                      );
                      await persist({ ...draft, cloudProviders: remaining, routing: nextRouting });
                    } else {
                      onOpenKeyDialog(localKind, label);
                    }
                  }}
                  disabled={busyAction === `toggle-${localKind}`}
                  aria-label={providerToggleAriaLabel(t, enabled, label)}
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
              onClick={onConnectCodex}
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

          {/* Claude Code CLI — connect control (peer of Codex). */}
          <ClaudeCodeConnect
            connected={draft.cloudProviders.some(cp => cp.slug === 'claude-code')}
            busy={busyAction === 'toggle-claude-code'}
            onConnect={() =>
              onConnectProvider({
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
          <Button type="button" variant="primary" size="xs" onClick={onAddCustomProvider}>
            {t('settings.ai.routing.addCustomProvider')}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ProviderAuthSection;
