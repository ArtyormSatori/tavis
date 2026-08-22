/*
 * Custom-routing dialog — opened when the user clicks "Custom" on a workload.
 * Lets them pick a provider (cloud or local) and the specific model id.
 */
import { useEffect, useRef, useState } from 'react';

import { useT } from '../../../../lib/i18n/I18nContext';
import {
  describeProviderVerificationFailure,
  listProviderModels,
  type ModelInfo,
  type ModelRegistryEntry,
  modelRegistryVision,
  testProviderModel,
} from '../../../../services/api/aiSettingsApi';
import Alert from '../../../ui/Alert';
import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import Label from '../../../ui/Label';
import { ModalShell } from '../../../ui/ModalShell';
import NativeSelect from '../../../ui/NativeSelect';
import TextField from '../../../ui/TextField';
import {
  appendTemperatureToProviderString,
  CLAUDE_CODE_DEFAULT_MODEL,
  type CloudProvider,
  type CustomDialogSource,
  formatI18n,
  humanizeModelId,
  type OllamaModel,
  type ProviderRef,
  type Workload,
  WORKLOAD_MODEL_HINT_KEYS,
} from './aiPanelTypes';
import { ModelEntryField, useModelEntryMode } from './ModelEntryField';
import { ModelTestResultPanel } from './ModelTestResultPanel';
import { TemperatureOverrideField } from './TemperatureOverrideField';

export interface CustomRoutingDialogProps {
  workload: Workload;
  initial: ProviderRef;
  cloudProviders: CloudProvider[];
  localModels: OllamaModel[];
  ollamaRunning: boolean;
  /** Current per-model vision registry, used to prefill the vision checkbox. */
  modelRegistry: ModelRegistryEntry[];
  onClose: () => void;
  /** Emits the chosen provider ref plus the user's vision flag for that model. */
  onSubmit: (next: ProviderRef, vision: boolean) => void;
}

export const CustomRoutingDialog = ({
  workload,
  initial,
  cloudProviders,
  localModels,
  ollamaRunning,
  modelRegistry,
  onClose,
  onSubmit,
}: CustomRoutingDialogProps) => {
  const { t } = useT();
  // Non-openhuman cloud providers + local-ollama (if available) are the
  // "Custom" options. OpenHuman is its own Managed path; Default serializes
  // to the backend's `cloud` sentinel. Claude Code is excluded here — it has
  // its own dedicated `claude-code:` select option, not a generic cloud one.
  const customCloud = cloudProviders.filter(
    p => p.slug !== 'openhuman' && p.slug !== 'claude-code'
  );
  const localAvailable = ollamaRunning && localModels.length > 0;
  // Claude Code CLI is offered as a routing source only when its peer chip is
  // enabled (a cloud_providers entry exists).
  const claudeCodeEnabled = cloudProviders.some(p => p.slug === 'claude-code');

  const initialSource: CustomDialogSource | null =
    initial.kind === 'cloud'
      ? { kind: 'cloud', providerSlug: initial.providerSlug }
      : initial.kind === 'local'
        ? { kind: 'local' }
        : initial.kind === 'claude-code'
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
    if (initial.kind === 'cloud' || initial.kind === 'local' || initial.kind === 'claude-code')
      return initial.model;
    if (initialSource?.kind === 'claude-code') return CLAUDE_CODE_DEFAULT_MODEL;
    return localModels[0]?.id ?? '';
  });
  const [cloudModels, setCloudModels] = useState<ModelInfo[]>([]);
  const [cloudModelsLoading, setCloudModelsLoading] = useState(false);
  const [cloudModelsError, setCloudModelsError] = useState<string | null>(null);
  const [modelsKey, setModelsKey] = useState(0);
  const [testBusy, setTestBusy] = useState(false);
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testStartedAt, setTestStartedAt] = useState<string | null>(null);
  const testRequestIdRef = useRef(0);
  // Optional temperature override for this workload. `null` = use provider/global default;
  // a finite number means "send `temperature: X` upstream for this workload only".
  const [temperature, setTemperature] = useState<number | null>(
    initial.kind === 'cloud' || initial.kind === 'local' || initial.kind === 'claude-code'
      ? (initial.temperature ?? null)
      : null
  );

  // Registry slug for the selected source — keys the per-model vision flag.
  // Cloud uses the provider slug; local → `ollama`; claude-code → `claude-code`.
  const registrySlug =
    source?.kind === 'cloud'
      ? source.providerSlug
      : source?.kind === 'local'
        ? 'ollama'
        : source?.kind === 'claude-code'
          ? 'claude-code'
          : null;

  // The Vision workload always feeds the multimodal `vision-v1` path, so any
  // model routed here is treated as image-capable regardless of the per-model
  // registry flag. Force the flag on and lock the checkbox for this workload.
  const visionLocked = workload.id === 'vision';

  // User-set vision flag for this (provider, model). Prefilled from the registry,
  // re-prefilled whenever the selected provider/model changes. Always on (and
  // not user-editable) for the Vision workload.
  const [vision, setVision] = useState<boolean>(() =>
    visionLocked
      ? true
      : registrySlug && model.trim()
        ? modelRegistryVision(modelRegistry, registrySlug, model.trim())
        : false
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVision(
      visionLocked
        ? true
        : registrySlug && model.trim()
          ? modelRegistryVision(modelRegistry, registrySlug, model.trim())
          : false
    );
    // modelRegistry is stable for the dialog's lifetime (prop doesn't change mid-open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrySlug, model, visionLocked]);

  const selectedCloud =
    source?.kind === 'cloud' ? customCloud.find(c => c.slug === source.providerSlug) : undefined;
  // Azure routes inference by deployment name, so the model field is relabelled
  // and defaults to free text for these connections (#5213). Shared with the
  // global "Use Your Own Models" card so the two pickers cannot drift.
  const modelEntry = useModelEntryMode({
    endpoint: selectedCloud?.endpoint,
    model,
    catalogIds: cloudModels.map(m => m.id),
  });

  // Fetch available models whenever the selected cloud provider changes.
  const selectedSlug = source?.kind === 'cloud' ? source.providerSlug : null;
  useEffect(() => {
    if (!selectedSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    console.debug('[ai-settings] fetching models for provider', provider.slug);
    listProviderModels(provider.slug)
      .then(ms => {
        if (!active) return;
        console.debug('[ai-settings] fetched', ms.length, 'models for', provider.slug);
        setCloudModels(ms);
        setCloudModelsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[ai-settings] listProviderModels failed for', provider.slug, ':', msg);
        setCloudModelsError(msg);
        setCloudModelsLoading(false);
      });
    return () => {
      active = false;
    };
    // customCloud is stable for the dialog's lifetime (prop doesn't change mid-open)
    // modelsKey is the manual retry trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug, modelsKey]);

  const canSave = source !== null && model.trim().length > 0;
  const canTest = canSave && !cloudModelsLoading;

  const resetTestState = () => {
    testRequestIdRef.current += 1;
    setTestReply(null);
    setTestError(null);
    setTestStartedAt(null);
    setTestBusy(false);
  };

  const currentProviderString =
    source == null
      ? null
      : source.kind === 'cloud'
        ? appendTemperatureToProviderString(
            `${source.providerSlug}:${model.trim()}`,
            temperature == null || !Number.isFinite(temperature) ? null : temperature
          )
        : appendTemperatureToProviderString(
            `ollama:${model.trim()}`,
            temperature == null || !Number.isFinite(temperature) ? null : temperature
          );

  const handleSave = () => {
    if (!source || !canSave) return;
    const temp = temperature == null || !Number.isFinite(temperature) ? null : temperature;
    if (source.kind === 'cloud') {
      onSubmit(
        {
          kind: 'cloud',
          providerSlug: source.providerSlug,
          model: model.trim(),
          temperature: temp,
        },
        vision
      );
    } else if (source.kind === 'claude-code') {
      onSubmit({ kind: 'claude-code', model: model.trim(), temperature: temp }, vision);
    } else {
      onSubmit({ kind: 'local', model: model.trim(), temperature: temp }, vision);
    }
  };

  const handleTest = async () => {
    if (!currentProviderString || !canTest) return;
    const requestId = testRequestIdRef.current + 1;
    testRequestIdRef.current = requestId;
    setTestBusy(true);
    setTestReply(null);
    setTestError(null);
    setTestStartedAt(new Date().toLocaleTimeString());
    try {
      const result = await testProviderModel(workload.id, currentProviderString, 'Hello world');
      if (testRequestIdRef.current !== requestId) return;
      setTestReply(result.reply);
    } catch (err) {
      if (testRequestIdRef.current !== requestId) return;
      // #5146 §2.4: a raw upstream string ("401", "model_not_found", a bare
      // 404) tells the user nothing about what to change. Map the common
      // shapes onto a concrete next step; unrecognised errors pass through.
      const raw = err instanceof Error ? err.message : String(err);
      // The banner copy is deliberately generic (a provider error can echo
      // request material), so keep the raw text on the console where it is
      // still reachable for diagnosis.
      console.error(`[ai-settings][test] provider test failed workload=${workload.id}`, raw);
      // The bare slug, not `currentProviderString` — that is the composite
      // `provider:model[@temp]` and would read as "'openai:gpt-4o' rejected it".
      setTestError(describeProviderVerificationFailure(registrySlug ?? '', raw, t));
    } finally {
      if (testRequestIdRef.current === requestId) {
        setTestBusy(false);
      }
    }
  };

  // Empty state only when there's genuinely nothing to route to: no custom
  // cloud providers, no local Ollama, and the Claude Code peer chip is off.
  const noProviders = customCloud.length === 0 && !localAvailable && !claudeCodeEnabled;

  return (
    <ModalShell
      titleId="workload-routing-dialog-title"
      title={t('settings.ai.customRouting')}
      subtitle={<span id="workload-routing-dialog-subtitle">{t(workload.labelKey)}</span>}
      // The dialog used to name itself "Custom routing for <workload>"; the
      // title alone drops the workload, so keep the subtitle in the name.
      labelledBy="workload-routing-dialog-title workload-routing-dialog-subtitle"
      onClose={onClose}
      contentClassName="px-6 py-4"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleTest()}
            disabled={!canTest || testBusy}>
            {testBusy ? t('settings.ai.testing') : t('settings.ai.test')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!canSave}>
            {t('common.save')}
          </Button>
        </div>
      }>
      <p className="mt-2 text-xs leading-5 text-content-muted">
        {t(WORKLOAD_MODEL_HINT_KEYS[workload.id])}
      </p>
      {noProviders ? (
        <Alert variant="warning" className="p-3 text-xs">
          {t('settings.ai.noCustomProviders')}
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-content-secondary">
              {t('settings.ai.providerLabel')}
            </Label>
            <NativeSelect
              value={
                source ? `${source.kind}:${source.kind === 'cloud' ? source.providerSlug : ''}` : ''
              }
              onChange={e => {
                const colonIdx = e.target.value.indexOf(':');
                const kind = e.target.value.slice(0, colonIdx);
                const slug = e.target.value.slice(colonIdx + 1);
                resetTestState();
                if (kind === 'local') {
                  setSource({ kind: 'local' });
                  setModel(localModels[0]?.id ?? '');
                  modelEntry.syncToEndpoint(undefined);
                } else if (kind === 'cloud') {
                  setSource({ kind: 'cloud', providerSlug: slug });
                  setModel('');
                  // Azure connections need a deployment name, which the
                  // catalog never lists — start on free text (#5213).
                  modelEntry.syncToEndpoint(customCloud.find(c => c.slug === slug)?.endpoint);
                } else if (kind === 'claude-code') {
                  setSource({ kind: 'claude-code' });
                  setModel(CLAUDE_CODE_DEFAULT_MODEL);
                  modelEntry.syncToEndpoint(undefined);
                }
              }}
              className="w-full">
              {customCloud.map(p => (
                <option key={p.slug} value={`cloud:${p.slug}`}>
                  {p.label}
                </option>
              ))}
              {localAvailable && <option value="local:">{t('settings.ai.localOllama')}</option>}
              {/* Offered only when the peer chip is enabled — or when this
                    workload is already pinned to it (keeps the select value
                    valid). */}
              {(claudeCodeEnabled || source?.kind === 'claude-code') && (
                <option value="claude-code:">{t('settings.ai.claudeCode.modalTitle')}</option>
              )}
            </NativeSelect>
          </div>

          {source?.kind === 'local' ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-content-secondary">
                {t('settings.ai.modelLabel')}
              </Label>
              <NativeSelect
                value={model}
                onChange={e => {
                  resetTestState();
                  setModel(e.target.value);
                }}
                className="w-full">
                {localModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : source?.kind === 'claude-code' ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-content-secondary">
                {t('settings.ai.modelLabel')}
              </Label>
              <TextField
                type="text"
                mono
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="sonnet"
              />
              <p className="text-[11px] text-content-muted">
                {t('settings.ai.claudeCode.modelHelp')}
              </p>
            </div>
          ) : (
            <ModelEntryField
              mode={modelEntry}
              model={model}
              onModelChange={next => {
                resetTestState();
                setModel(next);
              }}
              catalog={cloudModels}
              catalogLoading={cloudModelsLoading}
              catalogError={cloudModelsError}
              onRetry={() => setModelsKey(k => k + 1)}
              label={t('settings.ai.modelLabel')}
              placeholder={
                selectedCloud
                  ? formatI18n(t('settings.ai.modelIdPlaceholderForProvider'), {
                      slug: selectedCloud.slug,
                    })
                  : t('settings.ai.modelIdPlaceholder')
              }
              analyticsId="ai-model-entry-mode-toggle"
              optionLabel={m => `${humanizeModelId(m.id)} — ${m.id}`}
            />
          )}

          <TemperatureOverrideField temperature={temperature} onChange={setTemperature} />

          {/* Vision capability (optional). Marks a custom/BYOK model as
                accepting image input so the chat composer offers image
                attachments for it. Only shown once a concrete model is chosen. */}
          {registrySlug && model.trim().length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="inline-flex items-center gap-2 text-xs text-content-secondary">
                <Checkbox
                  checked={visionLocked ? true : vision}
                  onCheckedChange={setVision}
                  disabled={visionLocked}
                  className="h-3.5 w-3.5 disabled:opacity-60"
                />
                {t('settings.ai.modelVision')}
              </Label>
              <p className="text-[11px] text-content-faint">{t('settings.ai.modelVisionDesc')}</p>
            </div>
          )}

          <ModelTestResultPanel
            testBusy={testBusy}
            testReply={testReply}
            testError={testError}
            testStartedAt={testStartedAt}
            currentProviderString={currentProviderString}
          />
        </div>
      )}
    </ModalShell>
  );
};

export default CustomRoutingDialog;
