/*
 * One workload's row in the "Advanced" routing table.
 *
 * This is a `<tr>`, not a stack of `<div>`s. The advanced view is a matrix —
 * eight workloads against the provider and model each resolves to — and the
 * old markup rendered every cell as another line inside a flex column, so
 * nothing lined up between rows and the values could only be read by scanning
 * each block in turn. A real table gives the columns, the header association,
 * and a row a screen reader can announce as a row.
 *
 * The row keeps `data-slot="workload-row"` so tests can reach it without
 * matching a class string that layout work is free to change. `TableRow`
 * writes its own `data-slot` before spreading props, so ours wins.
 */
import { useT } from '../../../../lib/i18n/I18nContext';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import { TableCell, TableRow } from '../../../ui/Table';
import {
  type CloudProvider,
  type ProviderRef,
  type Workload,
  WORKLOAD_MODEL_HINT_KEYS,
} from './aiPanelTypes';

export type WorkloadRowProps = {
  workload: Workload;
  ref_: ProviderRef;
  cloudProviders: CloudProvider[];
};

/**
 * Split a `ProviderRef` into the two columns the table shows.
 *
 * The old row joined these into one `"OpenAI · gpt-5.6"` string. A table needs
 * them apart, and keeping the split here means the joining rule lives in one
 * place rather than being re-derived per cell.
 */
function resolveTarget(
  ref_: ProviderRef,
  cloudProviders: CloudProvider[],
  t: (key: string) => string
): { provider: string | null; model: string | null } {
  if (ref_.kind === 'cloud') {
    const cloud = cloudProviders.find(c => c.slug === ref_.providerSlug);
    return { provider: cloud?.label ?? ref_.providerSlug, model: ref_.model };
  }
  if (ref_.kind === 'local') {
    return { provider: t('settings.ai.localOllama'), model: ref_.model };
  }
  if (ref_.kind === 'claude-code') {
    return { provider: t('settings.ai.claudeCode.modalTitle'), model: ref_.model };
  }
  if (ref_.kind === 'openhuman') {
    return { provider: t('settings.ai.openhumanDefault'), model: null };
  }
  return { provider: null, model: null };
}

export const WorkloadRow = ({
  workload,
  ref_,
  cloudProviders,
  onCustomClick,
}: WorkloadRowProps & { onCustomClick: () => void }) => {
  const { t } = useT();
  // "Pinned" means the user chose this route explicitly, rather than inheriting
  // whatever Managed decides. It drives the badge tone and the button copy.
  const isPinned = ref_.kind === 'cloud' || ref_.kind === 'local';
  const { provider, model } = resolveTarget(ref_, cloudProviders, t);

  return (
    <TableRow data-slot="workload-row" data-pinned={isPinned} className="align-top">
      <TableCell className="py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-content">{t(workload.labelKey)}</span>
          <span className="text-xs leading-5 text-content-muted">
            {t(workload.descriptionKey)}
          </span>
          <span className="text-[11px] leading-5 text-content-faint">
            {t(WORKLOAD_MODEL_HINT_KEYS[workload.id])}
          </span>
        </div>
      </TableCell>

      <TableCell className="py-3">
        {provider ? (
          <Badge variant={isPinned ? 'primary' : 'neutral'} className="max-w-full truncate">
            {provider}
          </Badge>
        ) : (
          <span className="text-[11px] text-content-faint">
            {t('settings.ai.workload.noModel')}
          </span>
        )}
      </TableCell>

      <TableCell className="py-3">
        {model ? (
          <span className="block max-w-[22ch] truncate font-mono text-xs text-content-secondary">
            {model}
          </span>
        ) : (
          <span className="text-xs text-content-faint">{'—'}</span>
        )}
      </TableCell>

      <TableCell className="py-3 text-right">
        <Button type="button" variant="secondary" size="xs" onClick={onCustomClick}>
          {isPinned ? t('settings.ai.workload.changeModel') : t('settings.ai.workload.chooseModel')}
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default WorkloadRow;
