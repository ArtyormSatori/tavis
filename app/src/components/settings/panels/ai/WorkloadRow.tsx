/*
 * Workload row — one row per chat/background workload in the "Advanced"
 * routing table.
 *
 * The resolved provider+model is a `Badge` rather than a bare mono string: it
 * is a status about the row, and the badge's `primary` variant is what marks a
 * row the user has explicitly pinned versus one still inheriting the default.
 * The row carries `data-slot="workload-row"` so a test can reach it without
 * matching on a class string that layout work is free to change.
 */
import { useT } from '../../../../lib/i18n/I18nContext';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import {
  type CloudProvider,
  formatI18n,
  type ProviderRef,
  type Workload,
  WORKLOAD_MODEL_HINT_KEYS,
} from './aiPanelTypes';

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
    <div
      data-slot="workload-row"
      data-pinned={isCustom}
      className="flex items-center justify-between gap-3 py-3 transition-colors">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-sm font-medium text-content">{t(workload.labelKey)}</div>
        <div className="text-xs leading-5 text-content-muted">{t(workload.descriptionKey)}</div>
        <div className="text-[11px] leading-5 text-content-muted">
          {t(WORKLOAD_MODEL_HINT_KEYS[workload.id])}
        </div>
        {resolved ? (
          <Badge
            variant={isCustom ? 'primary' : 'neutral'}
            className="max-w-full truncate font-mono">
            {resolved}
          </Badge>
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
