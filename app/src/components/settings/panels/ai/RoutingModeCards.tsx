/*
 * Top-level routing-mode picker: a segmented radio row (Managed / Use Your Own
 * / Advanced) plus the "managed" confirmation banner.
 *
 * IT IS A REAL RADIO GROUP. These three modes are mutually exclusive and one
 * is always in force, but the old markup was three independent `<button>`s
 * whose selected-ness lived only in a class string: a screen reader was told
 * nothing about the choice, arrow keys did nothing, and there was no way to
 * hear which mode was active. `RadioGroupRoot`/`RadioGroupItem` supply
 * `role="radiogroup"`, roving focus and `aria-checked`. Each cell is a
 * `<label>` wrapping its item, so the whole cell stays clickable and the
 * accessible name is the title plus its description.
 *
 * IT IS SEGMENTED, NOT THREE CARDS. Three 152px-tall cards in a grid took a
 * third of the page to express one choice, and the grid pinned them to equal
 * thirds at exactly one breakpoint. One bordered strip divided into three
 * flex cells says the same thing in a quarter of the height, fills whatever
 * width the pane actually has, and folds to stacked rows on its own — the
 * column is the flex default, not a breakpoint.
 */
import { cn } from '../../../../lib/cn';
import { useT } from '../../../../lib/i18n/I18nContext';
import Alert from '../../../ui/Alert';
import Label from '../../../ui/Label';
import { RadioGroupItem, RadioGroupRoot } from '../../../ui/RadioGroup';
import type { RoutingMode } from './aiPanelTypes';

/** One cell of the segmented control. Selected-ness comes from the resolved
 *  mode rather than a `:has()` selector, so it works on the macOS 12 floor. */
const ModeOption = ({
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
  <Label
    data-slot="routing-mode-option"
    data-selected={selected}
    className={cn(
      'flex min-w-0 flex-1 cursor-pointer items-start gap-3 p-3 transition-colors duration-150',
      selected
        ? tone === 'sage'
          ? 'bg-sage-50 dark:bg-sage-500/10'
          : 'bg-primary-50 dark:bg-primary-500/10'
        : 'bg-surface hover:bg-surface-hover'
    )}>
    <RadioGroupItem value={value} size="md" className="mt-0.5" />
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm font-medium text-content">{title}</span>
      <span className="text-[11px] leading-4 text-content-muted">{description}</span>
    </span>
  </Label>
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
        className={cn(
          'flex w-full flex-col items-stretch overflow-hidden rounded-xl border border-line',
          'divide-y divide-line md:flex-row md:divide-x md:divide-y-0'
        )}>
        <ModeOption
          value="managed"
          selected={effectiveRoutingMode === 'managed'}
          tone="sage"
          title={t('settings.ai.routing.managed')}
          description={t('settings.ai.routing.managedDesc')}
        />
        <ModeOption
          value="own"
          selected={effectiveRoutingMode === 'own'}
          tone="primary"
          title={t('settings.ai.routing.useYourOwn')}
          description={t('settings.ai.routing.useYourOwnDesc')}
        />
        <ModeOption
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
