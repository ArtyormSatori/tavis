import { type ReactNode, useState } from 'react';

import { useT } from '../../../../lib/i18n/I18nContext';
import {
  type ApplyPresetResult,
  openhumanLocalAiApplyPreset,
  type PresetsResponse,
} from '../../../../utils/tauriCommands';
import { Alert, AlertDescription } from '../../../ui/Alert';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import Card from '../../../ui/Card';
import { Spinner } from '../../../ui/icons';
import Progress from '../../../ui/Progress';

interface DeviceCapabilitySectionProps {
  presetsData: PresetsResponse | null;
  presetsLoading: boolean;
  presetError: string;
  presetSuccess: ApplyPresetResult | null;
  formatRamGb: (bytes: number) => string;
  onPresetApplied?: (result: ApplyPresetResult) => void;
  /**
   * When `false`, the external Ollama runtime isn't reachable yet. Local tiers
   * stay disabled until the user runs Ollama themselves. The "Disabled (cloud
   * fallback)" option stays enabled since it doesn't depend on Ollama.
   */
  ollamaAvailable?: boolean;
  onTriggerOllamaInstall?: () => void;
  isTriggeringInstall?: boolean;
  installState?: string;
  installWarning?: string | null;
  installError?: string | null;
}

const DISABLED_TIER_ID = 'disabled';

/** One selectable model-tier tile. Semantically a `Button` — clicking it always
 * applies the tier, even if it is already the active one — so this cannot be a
 * `ToggleGroup` (which would swallow the click as a no-op deselect). */
function TierTile({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-auto w-full items-stretch justify-start gap-0 rounded-lg border p-3 text-left font-normal transition-colors',
        active
          ? 'border-primary-400 bg-primary-50 dark:bg-primary-500/10'
          : 'border-line bg-surface-muted hover:bg-surface-hover'
      )}>
      {children}
    </Button>
  );
}

const DeviceCapabilitySection = ({
  presetsData,
  presetsLoading,
  presetError,
  presetSuccess,
  formatRamGb,
  onPresetApplied,
  ollamaAvailable = true,
  onTriggerOllamaInstall,
  isTriggeringInstall = false,
  installState,
  installWarning,
  installError,
}: DeviceCapabilitySectionProps) => {
  const { t } = useT();
  void onTriggerOllamaInstall;
  void isTriggeringInstall;
  void installState;
  void installWarning;
  void installError;
  const installInProgress = false;
  const installFailed = false;
  const [applying, setApplying] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string>('');
  const [applySuccess, setApplySuccess] = useState<ApplyPresetResult | null>(null);

  const isDisabledActive = presetsData ? presetsData.local_ai_enabled === false : false;

  const handleApply = async (tierId: string) => {
    setApplying(tierId);
    setApplyError('');
    try {
      const result = await openhumanLocalAiApplyPreset(tierId);
      setApplySuccess(result);
      onPresetApplied?.(result);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t('settings.localModel.deviceCapability.failedToApplyPreset');
      setApplyError(msg);
    } finally {
      setApplying(null);
    }
  };

  const resolvedSuccess = applySuccess ?? presetSuccess;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-content">
        {t('settings.localModel.deviceCapability.modelTier')}
      </h3>

      {presetsLoading && !presetsData && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted p-4 text-sm text-content-muted">
          <Spinner className="h-4 w-4" />
          {t('settings.localModel.deviceCapability.loadingDeviceInfo')}
        </div>
      )}
      {!presetsLoading && !presetsData && presetError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('settings.localModel.deviceCapability.couldNotLoadPresets')} {presetError}
          </AlertDescription>
        </Alert>
      )}

      {presetsData?.device && (
        <Card>
          <div className="grid grid-cols-3 gap-3 p-3 text-xs">
            <div>
              <div className="text-content-muted uppercase tracking-wide">
                {t('settings.localModel.deviceCapability.ram')}
              </div>
              <div className="text-content mt-0.5 font-medium">
                {formatRamGb(presetsData.device.total_ram_bytes)}
              </div>
            </div>
            <div>
              <div className="text-content-muted uppercase tracking-wide">
                {t('settings.localModel.deviceCapability.cpu')}
              </div>
              <div
                className="text-content mt-0.5 font-medium truncate"
                title={presetsData.device.cpu_brand}>
                {t('settings.localModel.deviceCapability.cores').replace(
                  '{count}',
                  String(presetsData.device.cpu_count)
                )}
              </div>
            </div>
            <div>
              <div className="text-content-muted uppercase tracking-wide">
                {t('settings.localModel.deviceCapability.gpu')}
              </div>
              <div
                className="text-content mt-0.5 font-medium truncate"
                title={presetsData.device.gpu_description ?? undefined}>
                {presetsData.device.has_gpu
                  ? (presetsData.device.gpu_description ??
                    t('settings.localModel.deviceCapability.detected'))
                  : t('settings.localModel.deviceCapability.notDetected')}
              </div>
            </div>
          </div>
        </Card>
      )}

      {presetsData && !ollamaAvailable && (
        <Alert
          variant={installFailed ? 'destructive' : installInProgress ? 'info' : 'warning'}
          className="flex-col items-stretch gap-2">
          {installInProgress ? (
            <>
              <div className="flex items-center gap-2">
                <Spinner className="h-3 w-3" />
                <div className="text-sm font-semibold">
                  {t('settings.localModel.deviceCapability.installingOllama')}
                  {installState === 'downloading'
                    ? ` (${t('settings.localModel.deviceCapability.downloadingModels')})`
                    : '…'}
                </div>
              </div>
              <AlertDescription>
                {installWarning ?? t('settings.localModel.deviceCapability.downloadingSetupDesc')}
              </AlertDescription>
              <Progress value={null} className="h-1.5" />
            </>
          ) : installFailed ? (
            <>
              <div className="text-sm font-semibold">
                {t('settings.localModel.deviceCapability.installFailed')}
              </div>
              <AlertDescription>
                {installWarning ?? t('settings.localModel.deviceCapability.installFailedDesc')}
              </AlertDescription>
              {installError && (
                <pre className="max-h-40 overflow-auto rounded border border-coral-200 bg-coral-100 p-2 text-[10px] leading-tight text-coral-700 whitespace-pre-wrap break-words dark:border-coral-500/30 dark:bg-coral-500/20 dark:text-coral-300">
                  {installError}
                </pre>
              )}
              <div className="flex items-center gap-2 pt-1">
                {onTriggerOllamaInstall && (
                  <Button
                    variant="primary"
                    tone="danger"
                    size="sm"
                    onClick={onTriggerOllamaInstall}
                    disabled={isTriggeringInstall}>
                    {isTriggeringInstall
                      ? t('settings.localModel.deviceCapability.retrying')
                      : t('settings.localModel.deviceCapability.retryInstall')}
                  </Button>
                )}
                <Button variant="secondary" size="sm" tone="danger" asChild>
                  <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">
                    {t('settings.localModel.status.installManually')}
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <>
              <AlertDescription>
                <span className="font-semibold">
                  {t('settings.localModel.deviceCapability.installFirst')}
                </span>{' '}
                {t('settings.localModel.deviceCapability.installFirstDesc')}
              </AlertDescription>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">
                    {t('settings.localModel.status.ollamaDocs')}
                  </a>
                </Button>
              </div>
            </>
          )}
        </Alert>
      )}

      {presetsData && (
        <div className="space-y-2">
          {/* Disabled — Cloud fallback tile (always available, recommended on low-RAM) */}
          <TierTile
            active={isDisabledActive}
            disabled={applying !== null}
            onClick={() => void handleApply(DISABLED_TIER_ID)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-content">
                  {t('settings.localModel.deviceCapability.disabled')}
                </span>
                {isDisabledActive && (
                  <Badge variant="primary">
                    {t('settings.localModel.deviceCapability.active')}
                  </Badge>
                )}
                {(presetsData.recommend_disabled || !ollamaAvailable) && !isDisabledActive && (
                  <Badge variant="warning">
                    {t('settings.localModel.deviceCapability.recommended')}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-content-muted">0 GB</span>
            </div>
            <div className="text-xs text-content-muted mt-1">
              {t('settings.localModel.deviceCapability.disabledDesc')}
            </div>
          </TierTile>

          {presetsData.presets.map(preset => {
            const isCurrent = !isDisabledActive && preset.tier === presetsData.current_tier;
            const isApplying = applying === preset.tier;
            const locked = !ollamaAvailable;
            return (
              <TierTile
                key={preset.tier}
                active={isCurrent}
                locked={locked}
                disabled={applying !== null || locked}
                onClick={() => void handleApply(preset.tier)}
                title={
                  locked ? t('settings.localModel.deviceCapability.installOllamaFirst') : undefined
                }>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-content">{preset.label}</span>
                    {isCurrent && (
                      <Badge variant="primary">
                        {t('settings.localModel.deviceCapability.active')}
                      </Badge>
                    )}
                    {isApplying && (
                      <Badge variant="neutral">
                        {t('settings.localModel.deviceCapability.applying')}
                      </Badge>
                    )}
                    {locked && (
                      <Badge variant="warning">
                        {t('settings.localModel.deviceCapability.needsOllama')}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-content-muted">
                    ~{Number(preset.approx_download_gb).toFixed(1)} GB
                  </span>
                </div>
                <div className="text-xs text-content-faint mt-1">{preset.description}</div>
                <div className="text-[10px] text-content-muted mt-1">
                  {t('settings.localModel.deviceCapability.presetDetails')
                    .replace('{chatModel}', preset.chat_model_id)
                    .replace(
                      '{visionModel}',
                      preset.vision_mode === 'disabled'
                        ? t('settings.localModel.deviceCapability.disabledLowercase')
                        : preset.vision_model_id || preset.vision_mode
                    )
                    .replace('{targetRamGb}', String(preset.target_ram_gb))}
                </div>
              </TierTile>
            );
          })}

          {presetsData.current_tier === 'custom' && !isDisabledActive && (
            <Alert variant="warning">
              <AlertDescription>
                {t('settings.localModel.deviceCapability.customModelIds')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {applyError && (
        <Alert variant="destructive">
          <AlertDescription>{applyError}</AlertDescription>
        </Alert>
      )}
      {presetError && !(!presetsLoading && !presetsData) && (
        <Alert variant="destructive">
          <AlertDescription>{presetError}</AlertDescription>
        </Alert>
      )}
      {resolvedSuccess && (
        <Alert variant="success">
          <AlertDescription>
            {resolvedSuccess.applied_tier === DISABLED_TIER_ID
              ? t('settings.localModel.deviceCapability.localAiDisabled')
              : t('settings.localModel.deviceCapability.appliedTier')
                  .replace('{tier}', resolvedSuccess.applied_tier ?? '')
                  .replace(
                    '{model}',
                    resolvedSuccess.chat_model_id ? `: ${resolvedSuccess.chat_model_id}` : ''
                  )}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
};

export default DeviceCapabilitySection;
