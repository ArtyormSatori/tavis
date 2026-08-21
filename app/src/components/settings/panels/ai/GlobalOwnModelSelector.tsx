/*
 * "Use Your Own Models" card — a single provider+model applied to every
 * workload at once (the "own" routing mode).
 */
import { useEffect, useState } from 'react';

import { useT } from '../../../../lib/i18n/I18nContext';
import {
  listProviderModels,
  type ModelInfo,
  type ModelRegistryEntry,
  modelRegistryVision,
} from '../../../../services/api/aiSettingsApi';
import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import { SettingsSelect } from '../../controls';
import { isAzureFoundryEndpoint } from '../azureDeployment';
import {
  CLAUDE_CODE_DEFAULT_MODEL,
  type CloudProvider,
  type CustomDialogSource,
  type OllamaModel,
  type ProviderRef,
  providerRefSignature,
} from './aiPanelTypes';
import { ModelEntryField, useModelEntryMode } from './ModelEntryField';

export const GlobalOwnModelSelector = ({
  current,
  saved,
  cloudProviders,
  localModels,
  ollamaRunning,
  modelRegistry,
  onApply,
}: {
  current: ProviderRef | null;
  saved: ProviderRef | null;
  cloudProviders: CloudProvider[];
  localModels: OllamaModel[];
  ollamaRunning: boolean;
  modelRegistry: ModelRegistryEntry[];
  onApply: (next: ProviderRef, vision: boolean) => Promise<void>;
}) => {
  const { t } = useT();
  // Claude Code is excluded from the generic cloud list — it has its own
  // dedicated `claude-code:` option below (offered when connected).
  const customCloud = cloudProviders.filter(
    p => p.slug !== 'openhuman' && p.slug !== 'claude-code'
  );
  const localAvailable = ollamaRunning && localModels.length > 0;
  const claudeCodeEnabled = cloudProviders.some(p => p.slug === 'claude-code');

  const initialSource: CustomDialogSource | null =
    current?.kind === 'cloud'
      ? { kind: 'cloud', providerSlug: current.providerSlug }
      : current?.kind === 'local'
        ? { kind: 'local' }
        : current?.kind === 'claude-code'
          ? { kind: 'claude-code' }
          : customCloud[0]
            ? { kind: 'cloud', providerSlug: customCloud[0].slug }
            : localAvailable
              ? { kind: 'local' }
              : claudeCodeEnabled
                ? { kind: 'claude-code' }
                : null;

  const [source, setSource] = useState<CustomDialogSource | null>(initialSource);
  const [model, setModel] = useState<string>(() => {
    if (current?.kind === 'cloud' || current?.kind === 'local' || current?.kind === 'claude-code') {
      return current.model;
    }
    if (initialSource?.kind === 'claude-code') return CLAUDE_CODE_DEFAULT_MODEL;
    return '';
  });
  // Registry slug for the selected source — keys the per-model vision flag.
  const registrySlug =
    source?.kind === 'cloud'
      ? source.providerSlug
      : source?.kind === 'local'
        ? 'ollama'
        : source?.kind === 'claude-code'
          ? 'claude-code'
          : null;
  const [vision, setVision] = useState<boolean>(() =>
    registrySlug && model.trim()
      ? modelRegistryVision(modelRegistry, registrySlug, model.trim())
      : false
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVision(
      registrySlug && model.trim()
        ? modelRegistryVision(modelRegistry, registrySlug, model.trim())
        : false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrySlug, model]);
  const [cloudModels, setCloudModels] = useState<ModelInfo[]>([]);
  const [cloudModelsLoading, setCloudModelsLoading] = useState(false);
  const [cloudModelsError, setCloudModelsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedSlug = source?.kind === 'cloud' ? source.providerSlug : null;
  const selectedCloud = customCloud.find(c => c.slug === selectedSlug);
  // Azure deployment names are never in the probed catalog, so free text is the
  // only way to reach them (#5213). Same hook as CustomRoutingDialog — the two
  // pickers deliberately share one implementation.
  const modelEntry = useModelEntryMode({
    endpoint: selectedCloud?.endpoint,
    model,
    catalogIds: cloudModels.map(m => m.id),
  });

  useEffect(() => {
    if (!selectedSlug) {
      setCloudModels([]);
      setCloudModelsError(null);
      return;
    }
    const provider = customCloud.find(c => c.slug === selectedSlug);
    if (!provider) {
      setCloudModels([]);
      setCloudModelsError(null);
      return;
    }
    let active = true;
    setCloudModelsLoading(true);
    setCloudModels([]);
    setCloudModelsError(null);
    listProviderModels(provider.slug)
      .then(ms => {
        if (!active) return;
        setCloudModels(ms);
        setCloudModelsLoading(false);
        // Never auto-pick for Azure: the catalog holds base model ids, and
        // silently seeding one is exactly what produced "Model not found"
        // (#5213). Leave the field empty so the user supplies the deployment.
        if (!model.trim() && ms[0]?.id && !isAzureFoundryEndpoint(provider.endpoint)) {
          setModel(ms[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setCloudModelsError(err instanceof Error ? err.message : String(err));
        setCloudModelsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  useEffect(() => {
    if (source?.kind === 'local' && !model.trim()) {
      setModel(localModels[0]?.id ?? '');
    }
  }, [source, localModels, model]);

  const canApply = source !== null && model.trim().length > 0;
  const selectedRef =
    !source || !model.trim()
      ? null
      : source.kind === 'local'
        ? ({ kind: 'local', model: model.trim() } as const)
        : source.kind === 'claude-code'
          ? ({ kind: 'claude-code', model: model.trim() } as const)
          : ({ kind: 'cloud', providerSlug: source.providerSlug, model: model.trim() } as const);
  const isSaved =
    selectedRef !== null &&
    saved !== null &&
    providerRefSignature(selectedRef) === providerRefSignature(saved);

  const applySelection = async (nextSource: CustomDialogSource | null, nextModel: string) => {
    if (!nextSource || !nextModel.trim()) return;
    setSaving(true);
    try {
      if (nextSource.kind === 'local') {
        await onApply({ kind: 'local', model: nextModel.trim() }, vision);
      } else if (nextSource.kind === 'claude-code') {
        await onApply({ kind: 'claude-code', model: nextModel.trim() }, vision);
      } else {
        await onApply(
          { kind: 'cloud', providerSlug: nextSource.providerSlug, model: nextModel.trim() },
          vision
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-content">{t('settings.ai.globalModel.title')}</div>
        <p className="text-xs text-amber-700 dark:text-amber-200">
          {t('settings.ai.globalModel.desc')}
        </p>
      </div>

      {customCloud.length === 0 && !localAvailable && !claudeCodeEnabled ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          {t('settings.ai.globalModel.noProviders')}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-content-secondary">
                {t('settings.ai.globalModel.provider')}
              </label>
              <SettingsSelect
                value={
                  source
                    ? `${source.kind}:${source.kind === 'cloud' ? source.providerSlug : ''}`
                    : ''
                }
                onChange={e => {
                  const colonIdx = e.target.value.indexOf(':');
                  const kind = e.target.value.slice(0, colonIdx);
                  const slug = e.target.value.slice(colonIdx + 1);
                  if (kind === 'local') {
                    const nextSource = { kind: 'local' } as const;
                    const nextModel = localModels[0]?.id ?? '';
                    setSource(nextSource);
                    setModel(nextModel);
                    modelEntry.syncToEndpoint(undefined);
                  } else if (kind === 'claude-code') {
                    setSource({ kind: 'claude-code' });
                    setModel(CLAUDE_CODE_DEFAULT_MODEL);
                    modelEntry.syncToEndpoint(undefined);
                  } else {
                    const nextSource = { kind: 'cloud', providerSlug: slug } as const;
                    setSource(nextSource);
                    setModel('');
                    modelEntry.syncToEndpoint(customCloud.find(c => c.slug === slug)?.endpoint);
                  }
                }}
                className="w-full">
                {customCloud.map(p => (
                  <option key={p.slug} value={`cloud:${p.slug}`}>
                    {p.label}
                  </option>
                ))}
                {localAvailable ? (
                  <option value="local:">{t('settings.ai.provider.ollama')}</option>
                ) : null}
                {(claudeCodeEnabled || source?.kind === 'claude-code') && (
                  <option value="claude-code:">{t('settings.ai.claudeCode.modalTitle')}</option>
                )}
              </SettingsSelect>
            </div>

            {source?.kind === 'local' ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-content-secondary">
                  {t('settings.ai.globalModel.model')}
                </label>
                <SettingsSelect
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full">
                  {localModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </SettingsSelect>
              </div>
            ) : (
              <ModelEntryField
                mode={modelEntry}
                model={model}
                onModelChange={setModel}
                catalog={cloudModels}
                catalogLoading={cloudModelsLoading}
                catalogError={cloudModelsError}
                label={t('settings.ai.globalModel.model')}
                placeholder={t('settings.ai.globalModel.enterModelId')}
                analyticsId="ai-global-model-entry-mode-toggle"
              />
            )}
          </div>
          {registrySlug && model.trim().length > 0 && (
            <label className="flex items-start gap-2 text-xs font-medium text-content-secondary">
              <Checkbox
                checked={vision}
                onCheckedChange={setVision}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <span>
                {t('settings.ai.modelVision')}
                <span className="block font-normal text-[11px] text-content-faint">
                  {t('settings.ai.modelVisionDesc')}
                </span>
              </span>
            </label>
          )}

          <div className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-content-muted">
            {t('settings.ai.globalModel.appliesToAll')}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="xs"
              disabled={!canApply || saving || isSaved}
              onClick={() => void applySelection(source, model)}>
              {saving
                ? t('settings.ai.globalModel.saving')
                : isSaved
                  ? t('settings.ai.globalModel.saved')
                  : t('common.save')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default GlobalOwnModelSelector;
