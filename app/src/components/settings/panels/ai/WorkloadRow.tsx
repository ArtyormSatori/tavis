/*
 * Workload row (stacked, narrow-friendly) — one row per chat/background
 * workload in the "Advanced" routing table.
 */
import { useT } from '../../../../lib/i18n/I18nContext';
import Button from '../../../ui/Button';
import { type CloudProvider, formatI18n, type ProviderRef, type Workload } from './aiPanelTypes';
import { WORKLOAD_MODEL_HINT_KEYS } from './aiPanelTypes';

export type WorkloadRowProps = {
  workload: Workload;
  ref_: ProviderRef;
  cloudProviders: CloudProvider[];
};

export const WorkloadRow = ({
  workload,
  ref_,
  cloudProviders,
  onCustomClick,
}: WorkloadRowProps & { onCustomClick: () => void }) => {
  const { t } = useT();
  const selectedCloud =
    ref_.kind === 'cloud' ? cloudProviders.find(c => c.slug === ref_.providerSlug) : undefined;
  const isCustom = ref_.kind === 'cloud' || ref_.kind === 'local';

  let resolved = '';
  if (ref_.kind === 'cloud') {
    resolved = selectedCloud
      ? `${selectedCloud.label} · ${ref_.model}`
      : `${ref_.providerSlug} · ${ref_.model}`;
  } else if (ref_.kind === 'local') {
    resolved = formatI18n(t('settings.ai.localModelResolved'), { model: ref_.model });
  } else if (ref_.kind === 'openhuman') {
    resolved = t('settings.ai.openhumanDefault');
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3 transition-colors">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium text-content">{t(workload.labelKey)}</div>
        <div className="text-xs leading-5 text-content-muted">{t(workload.descriptionKey)}</div>
        <div className="text-[11px] leading-5 text-content-muted">
          {t(WORKLOAD_MODEL_HINT_KEYS[workload.id])}
        </div>
        {resolved ? (
          <div
            className={`font-mono text-[11px] truncate ${
              isCustom ? 'text-primary-700 dark:text-primary-200' : 'text-content-muted'
            }`}>
            {resolved}
          </div>
        ) : (
          <div className="text-[11px] text-content-faint">{t('settings.ai.workload.noModel')}</div>
        )}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        onClick={onCustomClick}
        className={isCustom ? 'ring-1 ring-line-strong' : ''}>
        {isCustom ? t('settings.ai.workload.changeModel') : t('settings.ai.workload.chooseModel')}
      </Button>
    </div>
  );
};

export default WorkloadRow;
