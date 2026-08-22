/*
 * Top-level routing-mode picker: three selectable cards (Managed / Use Your
 * Own / Advanced) plus the "managed" confirmation banner.
 *
 * TWO THINGS CHANGED HERE, both deliberate.
 *
 * 1. It is a real radio group. These three modes are mutually exclusive — one
 *    is always in force — and the old markup was three independent `<button>`s
 *    whose selected-ness lived only in a class string. A screen reader was told
 *    nothing about the choice, arrow keys did nothing, and there was no way to
 *    hear which mode was active. `RadioGroupRoot`/`RadioGroupItem` supply
 *    `role="radiogroup"`, roving focus, and `aria-checked` for free. Each card
 *    is a `<label>` wrapping its item, so the whole card stays clickable and
 *    the accessible name is the title plus its description.
 *
 * 2. The layout is flex, not `md:grid-cols-3`. A three-column grid forces
 *    equal thirds at exactly one breakpoint and stacks below it; `flex-1
 *    basis-0` fills whatever width the pane actually has and the `flex-col`
 *    fallback handles the narrow case without a breakpoint at all. The
 *    `min-h-[152px]` that padded the grid cells to a uniform height is gone
 *    with it — `items-stretch` already equalises flex siblings, and a hard
 *    pixel floor only clipped or over-padded once the copy was translated.
 */
import { cn } from '../../../../lib/cn';
import { useT } from '../../../../lib/i18n/I18nContext';
import Alert from '../../../ui/Alert';
import { RadioGroupItem, RadioGroupRoot } from '../../../ui/RadioGroup';
import type { RoutingMode } from './aiPanelTypes';

/** One selectable mode card. Selected-ness is driven by the resolved mode. */
const ModeCard = ({
  value,
  selected,
  tone,
  title,
  description,
}: {
  value: RoutingMode;
  selected: boolean;
  /** `sage` marks the recommended managed default; the rest read as primary. */
  tone: 'sage' | 'primary';
  title: string;
  description: string;
}) => (
  <label
    data-slot="routing-mode-card"
    data-selected={selected}
    className={cn(
      'flex min-w-0 flex-1 basis-0 cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-left',
      'transition-colors duration-150',
      selected
        ? tone === 'sage'
          ? 'border-sage-300 bg-sage-50 dark:border-sage-500/40 dark:bg-sage-500/10'
          : 'border-primary-300 bg-primary-50 dark:border-primary-500/40 dark:bg-primary-500/10'
        : 'border-line-strong bg-surface hover:bg-surface-hover'
    )}>
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm font-semibold text-content">{title}</span>
      <RadioGroupItem value={value} size="md" className="mt-0.5" />
    </div>
    <span className="text-xs leading-5 text-content-secondary">{description}</span>
  </label>
);

export const RoutingModeCards = ({
  effectiveRoutingMode,
  onSelectManaged,
  onSelectOwn,
  onSelectCustom,
}: {
  effectiveRoutingMode: RoutingMode;
  onSelectManaged: () => void;
  onSelectOwn: () => void;
  onSelectCustom: () => void;
}) => {
  const { t } = useT();
  return (
    <div className="flex w-full flex-col gap-3">
      <RadioGroupRoot
        aria-label={t('settings.ai.routing')}
        value={effectiveRoutingMode}
        onValueChange={next => {
          if (next === 'managed') onSelectManaged();
          else if (next === 'own') onSelectOwn();
          else if (next === 'custom') onSelectCustom();
        }}
        className="flex w-full flex-col items-stretch gap-3 lg:flex-row">
        <ModeCard
          value="managed"
          selected={effectiveRoutingMode === 'managed'}
          tone="sage"
          title={t('settings.ai.routing.managed')}
          description={t('settings.ai.routing.managedDesc')}
        />
        <ModeCard
          value="own"
          selected={effectiveRoutingMode === 'own'}
          tone="primary"
          title={t('settings.ai.routing.useYourOwn')}
          description={t('settings.ai.routing.useYourOwnDesc')}
        />
        <ModeCard
          value="custom"
          selected={effectiveRoutingMode === 'custom'}
          tone="primary"
          title={t('settings.ai.routing.advanced')}
          description={t('settings.ai.routing.advancedDesc')}
        />
      </RadioGroupRoot>

      {effectiveRoutingMode === 'managed' ? (
        <Alert variant="success">{t('settings.ai.routing.managedMsg')}</Alert>
      ) : null}
    </div>
  );
};

export default RoutingModeCards;
