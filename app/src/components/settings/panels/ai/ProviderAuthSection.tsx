/*
 * Provider authentication section — the grouped provider list (Default, Cloud,
 * Local runtimes, CLI logins) plus the rejected-key / non-fatal-advisory
 * banners.
 *
 * The list shape and why it replaced the chip row are documented on
 * `ProviderListRow`. What matters here is that the four groups are the real
 * taxonomy of this surface: a cloud provider is a stored API key, a local
 * runtime is an endpoint on this machine, and a CLI login is a credential
 * another tool already owns. They fail differently and are fixed differently,
 * so they are no longer interleaved by wrap order.
 */
import { LuCircleAlert } from 'react-icons/lu';

import { useT } from '../../../../lib/i18n/I18nContext';
import type { ProviderAuthError } from '../../../../services/api/aiSettingsApi';
import Alert from '../../../ui/Alert';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import Card from '../../../ui/Card';
import StatusLine from '../../../ui/StatusLine';
import Switch from '../../../ui/Switch';
import { routingWithProviderRemoved } from '../aiRouting';
import { BUILTIN_CLOUD_PROVIDER_SLUGS } from '../builtinCloudProviders';
import { ProviderSetupErrorNotice } from '../ProviderSetupErrorNotice';
import {
  type AISettings,
  BUILTIN_PROVIDER_META,
  BUILTIN_RESERVED_SLUGS,
  type CloudProvider,
  formatI18n,
  LOCAL_CHIP_LABEL,
  LOCAL_CHIP_TONE,
  type LocalChipSlug,
  providerToggleAriaLabel,
} from './aiPanelTypes';
import { ClaudeCodeConnect } from './ClaudeCodeStatusCard';
import { ProviderGroup, ProviderListRow, type ProviderRowAction } from './ProviderListRow';

const LOCAL_RUNTIME_SLUGS = ['lmstudio', 'ollama', 'omlx'] as const;

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
  onEditCustomProvider,
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
    credentialMode: 'api_key' | 'endpoint' | 'endpoint_key' | 'cli_login' | 'oauth';
  }) => Promise<void>;
  onOpenKeyDialog: (slug: string, localLabel: string | null) => void;
  onAddCustomProvider: () => void;
  /** Opens the full editor for a user-defined provider (name, endpoint, key). */
  onEditCustomProvider: (provider: CloudProvider) => void;
}) => {
  const { t } = useT();

  /** Drop a provider and scrub every routing entry pinned to it, so a workload
   *  cannot keep pointing at a provider that no longer exists. */
  const removeProvider = async (existing: CloudProvider, isLocalRuntime: boolean) => {
    onProviderRemoved(existing.slug);
    const remaining = draft.cloudProviders.filter(cp => cp.id !== existing.id);
    const nextRouting = routingWithProviderRemoved(
      draft.routing,
      { slug: existing.slug, isLocalRuntime },
      remaining
    );
    await persist({ ...draft, cloudProviders: remaining, routing: nextRouting });
  };

  const codexBusy = busyAction === 'codex-auth' || busyAction === 'toggle-openai';
  const claudeCodeConnected = draft.cloudProviders.some(cp => cp.slug === 'claude-code');
  const customProviders = draft.cloudProviders.filter(
    cp => !BUILTIN_RESERVED_SLUGS.includes(cp.slug)
  );

  return (
    <Card title={t('settings.ai.llmProviders')} description={t('settings.ai.llmProvidersDesc')}>
      <div className="flex w-full flex-col gap-4 py-4">
        <div className="flex w-full flex-col gap-4 px-4">
          {/* ─── Rejected-key notices ───────────────────────────────────────
            A BYO key the provider rejected at runtime (401/403). Surfaced
            here, next to the key editor, because the failing path is often a
            silent background loop and the raw error is demoted from Sentry. */}
          {providerAuthErrors.length > 0 && (
            <div className="flex w-full flex-col gap-2">
              {providerAuthErrors.map(err => (
                <ProviderSetupErrorNotice key={err.provider} error={err.message} />
              ))}
            </div>
          )}

          {/* #5339: non-fatal "key saved, but provider unreachable" advisory.
            Amber (not coral): the save succeeded, only reachability is in
            question. */}
          {providerSaveNotice && (
            <Alert variant="warning" role="status" className="items-start gap-2 px-3 py-2 text-xs">
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
            </Alert>
          )}

          {loading && <div className="text-xs text-content-muted">{t('common.loading')}</div>}
          {error && <StatusLine saving={false} error={error} savedNote={null} savingLabel="" />}
        </div>

        {/* ─── Default ──────────────────────────────────────────────────────
          #3760: Managed is always-on and can't be turned off. It renders a
          badge, not a disabled toggle — a locked switch reads as
          switchable-but-broken and invites a fight the user cannot win. */}
        <ProviderGroup
          title={t('settings.ai.providers.groupDefault')}
          data-testid="provider-group-default">
          <ProviderListRow
            label={t('settings.ai.routing.managed')}
            tone={BUILTIN_PROVIDER_META.openhuman?.tone ?? ''}
            detail={t('settings.ai.providers.managedDetail')}
            control={
              <Badge variant="success">{t('settings.ai.routing.managedAlwaysOn')}</Badge>
            }
            data-testid="provider-row-openhuman"
          />
        </ProviderGroup>

        {/* ─── Cloud ─────────────────────────────────────────────────────── */}
        <ProviderGroup
          title={t('settings.ai.providers.groupCloud')}
          data-testid="provider-group-cloud">
          {BUILTIN_CLOUD_PROVIDER_SLUGS.map(slug => {
            const meta = BUILTIN_PROVIDER_META[slug];
            const label = meta?.label ?? slug;
            const existing = draft.cloudProviders.find(cp => cp.slug === slug);
            const enabled = !!existing;
            const actions: ProviderRowAction[] = enabled
              ? [
                  {
                    label: t('settings.ai.providers.replaceKey'),
                    onSelect: () => onOpenKeyDialog(slug, null),
                  },
                ]
              : [];
            return (
              <ProviderListRow
                key={slug}
                label={label}
                tone={meta?.tone ?? ''}
                detail={
                  enabled
                    ? existing.maskedKey || t('settings.ai.providers.connected')
                    : t('settings.ai.providers.notConnected')
                }
                detailMono={enabled}
                control={
                  <Switch
                    id={`provider-toggle-${slug}`}
                    checked={enabled}
                    onCheckedChange={async () => {
                      // OFF removes the provider outright; ON only opens the
                      // key dialog — the row flips once the dialog saves, so
                      // a cancelled dialog leaves nothing half-connected.
                      if (enabled && existing) await removeProvider(existing, false);
                      else onOpenKeyDialog(slug, null);
                    }}
                    disabled={busyAction === `toggle-${slug}`}
                    aria-label={providerToggleAriaLabel(t, enabled, label)}
                  />
                }
                actions={actions}
                actionsLabel={formatI18n(t('settings.ai.providers.rowActions'), { provider: label })}
                data-testid={`provider-row-${slug}`}
              />
            );
          })}

          {customProviders.map(existing => (
            <ProviderListRow
              key={existing.id}
              label={existing.label}
              tone={BUILTIN_PROVIDER_META.custom?.tone ?? ''}
              detail={existing.endpoint || existing.maskedKey}
              detailMono
              badge={<Badge variant="primary">{t('settings.ai.providers.custom')}</Badge>}
              control={
                <Switch
                  id={`provider-toggle-${existing.slug}`}
                  checked
                  onCheckedChange={async () => await removeProvider(existing, false)}
                  disabled={busyAction === `toggle-${existing.slug}`}
                  aria-label={providerToggleAriaLabel(t, true, existing.label)}
                />
              }
              actions={[
                { label: t('common.edit'), onSelect: () => onEditCustomProvider(existing) },
                {
                  label: t('common.remove'),
                  destructive: true,
                  onSelect: () => void removeProvider(existing, false),
                },
              ]}
              actionsLabel={formatI18n(t('settings.ai.providers.rowActions'), { provider: existing.label })}
              data-testid={`provider-row-${existing.slug}`}
            />
          ))}
        </ProviderGroup>

        {/* ─── Local runtimes ────────────────────────────────────────────────
          LM Studio / Ollama / OMLX are stored as providers with a reserved
          slug so they stay distinct from a generic custom endpoint. What the
          user needs to see is the endpoint, which is the thing that breaks. */}
        <ProviderGroup
          title={t('settings.ai.providers.groupLocal')}
          data-testid="provider-group-local">
          {LOCAL_RUNTIME_SLUGS.map(localKind => {
            const label = LOCAL_CHIP_LABEL[localKind as LocalChipSlug];
            const existing = draft.cloudProviders.find(cp => cp.slug === localKind);
            const enabled = !!existing;
            return (
              <ProviderListRow
                key={localKind}
                label={label}
                tone={LOCAL_CHIP_TONE[localKind as LocalChipSlug]}
                detail={
                  enabled
                    ? existing.endpoint || t('settings.ai.providers.connected')
                    : t('settings.ai.providers.notConnected')
                }
                detailMono={enabled}
                control={
                  <Switch
                    id={`local-runtime-toggle-${localKind}`}
                    checked={enabled}
                    onCheckedChange={async () => {
                      if (enabled && existing) await removeProvider(existing, true);
                      else onOpenKeyDialog(localKind, label);
                    }}
                    disabled={busyAction === `toggle-${localKind}`}
                    aria-label={providerToggleAriaLabel(t, enabled, label)}
                  />
                }
                actions={
                  enabled
                    ? [
                        {
                          label: t('settings.ai.editEndpoint'),
                          onSelect: () => onOpenKeyDialog(localKind, label),
                        },
                      ]
                    : []
                }
                actionsLabel={formatI18n(t('settings.ai.providers.rowActions'), { provider: label })}
                data-testid={`provider-row-${localKind}`}
              />
            );
          })}
        </ProviderGroup>

        {/* ─── CLI logins ────────────────────────────────────────────────────
          Neither of these stores a key here: they import a credential another
          tool already holds. Both keep their existing controls as the row's
          action — Claude Code owns its own status probe and modal, and
          rebuilding that to fit a Switch would trade working, tested behaviour
          for visual symmetry. */}
        <ProviderGroup title={t('settings.ai.providers.groupCli')} data-testid="provider-group-cli">
          <ProviderListRow
            label={t('settings.ai.claudeCode.button')}
            tone={BUILTIN_PROVIDER_META['claude-code']?.tone ?? BUILTIN_PROVIDER_META.custom?.tone ?? ''}
            detail={
              claudeCodeConnected
                ? t('settings.ai.providers.connected')
                : t('settings.ai.providers.notConnected')
            }
            control={
              <ClaudeCodeConnect
                connected={claudeCodeConnected}
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
                  if (existing) await removeProvider(existing, false);
                }}
              />
            }
            data-testid="provider-row-claude-code"
          />

          <ProviderListRow
            label={t('settings.ai.codexAuthButton')}
            tone={BUILTIN_PROVIDER_META.openai?.tone ?? ''}
            detail={t('settings.ai.codexAuthHelper')}
            control={
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onConnectCodex}
                disabled={codexBusy}>
                {codexBusy ? t('settings.ai.connecting') : t('settings.ai.codexAuthButton')}
              </Button>
            }
            data-testid="provider-row-codex"
          />
        </ProviderGroup>

        <div className="flex flex-col gap-3 px-4">
          {codexAuthError ? <ProviderSetupErrorNotice error={codexAuthError} /> : null}

          {/* #3760: point users who want a local model at the Routing card
            below, rather than letting them hunt for a Managed off switch. */}
          <p className="text-xs text-content-muted">{t('settings.ai.routing.managedHint')}</p>

          <div className="flex">
            <Button type="button" variant="primary" size="xs" onClick={onAddCustomProvider}>
              {t('settings.ai.routing.addCustomProvider')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProviderAuthSection;
