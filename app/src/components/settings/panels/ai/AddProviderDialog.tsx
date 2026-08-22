/*
 * "Add a provider" — a modal listing every provider that is NOT yet connected,
 * grouped by kind.
 *
 * WHY A MODAL AND NOT A SELECT OR AN INLINE LIST. There are ~15 providers and
 * a user connects one or two. Listing all fifteen inline spends the section on
 * the ones nobody chose and buries the ones actually configured, so the panel
 * lists only what is connected and this dialog owns the catalogue. A modal is
 * the right container for it over a dropdown because picking a provider is the
 * first step of a task, not the setting of a value: the choice immediately
 * hands off to that provider's connect dialog, and nothing here is left
 * "selected" afterwards. It also has room to say what each provider is, which
 * a select item does not.
 *
 * Rows are real `<button>`s inside a `<ul>`, so the whole row is the target and
 * keyboard order follows reading order without any roving-focus machinery.
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
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
        'hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40'
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
  /** Called with the chosen slug. The caller closes this dialog and opens the
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
        <div className="flex flex-col gap-4">
          {populated.map(group => (
            <section key={group.title} className="flex flex-col gap-1">
              <h3 className="px-2.5 text-[10px] font-semibold uppercase tracking-wide text-content-faint">
                {group.title}
              </h3>
              <ul className="flex flex-col">
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
