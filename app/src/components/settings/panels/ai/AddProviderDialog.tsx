/*
 * "Add a provider" — a modal holding one scrollable, grouped select box of
 * every provider that is NOT yet connected.
 *
 * WHY A MODAL AND NOT AN INLINE LIST. There are ~15 providers and a user
 * connects one or two. Listing all fifteen inline spends the section on the
 * ones nobody chose and buries the ones actually configured, so the panel
 * lists only what is connected and this dialog owns the catalogue.
 *
 * WHY ONE SCROLLING BOX AND NOT FOUR STACKED SECTIONS. Sections that each grow
 * to fit push the dialog past the viewport and hand the scroll to the page
 * behind it, so the group you were reading can leave the screen while its
 * heading stays. A single bounded listbox scrolls its own content, and the
 * group headings stick to the top edge while their own group is in view, so
 * "which category am I in" survives the scroll.
 *
 * THE OPTIONS ARE `<button>`s IN A `<ul>`, NOT `role="listbox"`. This picks an
 * action and closes: the chosen provider hands off to its connect flow and
 * nothing stays selected. A real listbox would promise a selected value that
 * this component never holds, and would need roving focus to deliver what tab
 * order already gives us here.
 */
import { LuChevronRight } from 'react-icons/lu';

import { cn } from '../../../../lib/cn';
import { useT } from '../../../../lib/i18n/I18nContext';
import { ModalShell } from '../../../ui/ModalShell';

export interface ProviderOption {
  slug: string;
  label: string;
  tone: string;
  /** Second line: the endpoint host for a cloud provider, a short line about
   *  where it runs for the others. Deliberately not a translated per-provider
   *  blurb, which would be ~15 strings per locale to say what the host says. */
  detail: string;
}

export interface ProviderOptionGroup {
  /** Stable id, used for the React key so two groups may share a title. */
  id: string;
  /** Already-translated heading. */
  title: string;
  options: ProviderOption[];
}

const ProviderOptionRow = ({
  option,
  onPick,
}: {
  option: ProviderOption;
  onPick: (slug: string) => void;
}) => (
  <li>
    <button
      type="button"
      onClick={() => onPick(option.slug)}
      data-testid={`add-provider-option-${option.slug}`}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
        'hover:bg-surface-hover focus:outline-none focus-visible:bg-surface-hover',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/40'
      )}>
      <span
        aria-hidden
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-semibold ring-1',
          option.tone
        )}>
        {option.label.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-content">{option.label}</span>
        <span className="truncate font-mono text-[11px] leading-4 text-content-muted">
          {option.detail}
        </span>
      </span>
      <LuChevronRight aria-hidden className="h-4 w-4 flex-shrink-0 text-content-faint" />
    </button>
  </li>
);

export const AddProviderDialog = ({
  groups,
  onPick,
  onClose,
}: {
  groups: ProviderOptionGroup[];
  /** Called with the chosen slug. The caller closes this dialog and starts the
   *  provider's own connect flow. */
  onPick: (slug: string) => void;
  onClose: () => void;
}) => {
  const { t } = useT();
  const populated = groups.filter(group => group.options.length > 0);

  return (
    <ModalShell
      title={t('settings.ai.providers.addProvider')}
      titleId="add-provider-dialog-title"
      subtitle={t('settings.ai.providers.addProviderSubtitle')}
      onClose={onClose}
      maxWidthClassName="max-w-lg">
      {populated.length === 0 ? (
        <p className="py-6 text-center text-sm text-content-muted" data-testid="add-provider-empty">
          {t('settings.ai.providers.allConnected')}
        </p>
      ) : (
        /* The box owns the scroll. `overscroll-contain` stops a flick at the
           end of the list from continuing into the page behind the modal. */
        <div
          data-testid="add-provider-list"
          className="max-h-[22rem] w-full overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface-subtle">
          {populated.map(group => (
            <section key={group.id}>
              <h3 className="sticky top-0 z-10 border-b border-line-subtle bg-surface-subtle/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-faint backdrop-blur">
                {group.title}
              </h3>
              <ul className="flex flex-col divide-y divide-line-subtle bg-surface">
                {group.options.map(option => (
                  <ProviderOptionRow key={option.slug} option={option} onPick={onPick} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ModalShell>
  );
};

export default AddProviderDialog;
