/*
 * "Add a provider" — a rich select over every provider that is NOT yet
 * connected.
 *
 * WHY A SELECT AND NOT A LIST. There are ~15 providers and a user connects one
 * or two. Rendering all fifteen as rows spends the whole section on the ones
 * nobody chose, and buries the two that are actually configured. Inverting it
 * puts the answer to "what am I using" at the top level and demotes "what
 * could I use" to the moment the user asks for it.
 *
 * WHY Radix `Select` AND NOT `NativeSelect`. `Select`'s own doc note draws the
 * line: `NativeSelect` for long or unbounded lists of plain text, `Select` for
 * a short list (<= ~20) that needs custom item rendering. Fifteen items each
 * carrying a swatch, a name and a second line is that case exactly; an
 * `<option>` holds text and nothing else.
 *
 * IT PICKS AN ACTION, NOT A VALUE. `value` is pinned to `''` so the trigger
 * always shows its placeholder: choosing an item opens that provider's connect
 * dialog and the control returns to rest. A select that kept the last pick
 * would be claiming a selection this component does not own — the connection
 * state lives in `draft.cloudProviders`, and only the dialog can change it.
 */
import { useT } from '../../../../lib/i18n/I18nContext';
import { cn } from '../../../../lib/cn';
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '../../../ui/Select';

export interface ProviderOption {
  slug: string;
  label: string;
  tone: string;
  /** Second line: the endpoint host for a cloud provider, a short line about
   *  where it runs for the others. Never a translated provider blurb — that
   *  would be ~15 strings per locale to say what the host already says. */
  detail: string;
}

export interface ProviderOptionGroup {
  /** Already-translated heading. */
  title: string;
  options: ProviderOption[];
}

export const ProviderPicker = ({
  groups,
  onPick,
}: {
  groups: ProviderOptionGroup[];
  onPick: (slug: string) => void;
}) => {
  const { t } = useT();
  const empty = groups.every(g => g.options.length === 0);

  if (empty) {
    return (
      <p className="text-xs text-content-muted" data-testid="provider-picker-empty">
        {t('settings.ai.providers.allConnected')}
      </p>
    );
  }

  return (
    <SelectRoot value="" onValueChange={onPick}>
      <SelectTrigger
        inputSize="sm"
        className="max-w-sm"
        aria-label={t('settings.ai.providers.addProvider')}
        data-testid="provider-picker">
        <SelectValue placeholder={t('settings.ai.providers.addProviderPlaceholder')} />
      </SelectTrigger>
      {/* Wider than the trigger: the trigger is a compact control, the menu has
          two lines per item to show. */}
      <SelectContent className="w-[min(24rem,calc(100vw-2rem))]">
        {groups
          .filter(group => group.options.length > 0)
          .map(group => (
            <SelectGroup key={group.title}>
              <SelectLabel>{group.title}</SelectLabel>
              {group.options.map(option => (
                <SelectItem key={option.slug} value={option.slug}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ring-1',
                        option.tone
                      )}>
                      {option.label.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-content">{option.label}</span>
                      <span className="truncate font-mono text-[10px] leading-3 text-content-muted">
                        {option.detail}
                      </span>
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </SelectRoot>
  );
};

export default ProviderPicker;
