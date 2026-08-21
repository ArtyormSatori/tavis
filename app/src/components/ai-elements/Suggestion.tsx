/**
 * Adapted from `suggestion.tsx` in vercel/ai-elements (Apache-2.0).
 * Upstream: https://github.com/vercel/ai-elements — registry component `suggestion`.
 *
 * Port notes (this is an adaptation, not a copy):
 * - `@/registry/default/ui/button` → OpenHuman's `Button` from `../ui`; upstream's
 *   `variant="outline"` maps onto OpenHuman's `secondary`.
 * - `@/lib/utils` `cn` → `../../lib/cn`.
 * - ScrollArea/ScrollBar are deliberately absent from this app (they break
 *   `lib/autoHideScrollbars` and cost real scroll performance on long
 *   transcripts), so the rail is a plain div with native `overflow-x-auto`.
 *   The upstream `ScrollBar orientation="horizontal" className="hidden"` was
 *   already invisible, so nothing visual is lost; `scrollbar-none` is not used
 *   because it is not configured here — the row is short enough that the native
 *   bar is acceptable.
 * - `cursor-pointer` dropped: `<button>` already carries it in this app's reset.
 * - No hardcoded copy: the label is the caller-supplied `suggestion` string.
 * - `data-slot` attributes added so tests assert structure, not class strings.
 */
import type { ComponentProps, ComponentPropsWithRef } from 'react';
import { useCallback } from 'react';

import { cn } from '../../lib/cn';
import { Button } from '../ui';

export type SuggestionsProps = ComponentPropsWithRef<'div'>;

export const Suggestions = ({ className, children, ...props }: SuggestionsProps) => (
  <div
    data-slot="suggestions"
    className="w-full overflow-x-auto whitespace-nowrap"
    {...props}>
    <div className={cn('flex w-max flex-nowrap items-center gap-2', className)}>{children}</div>
  </div>
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = 'secondary',
  size = 'sm',
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);

  return (
    <Button
      data-slot="suggestion"
      className={cn('rounded-full px-4', className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}>
      {children || suggestion}
    </Button>
  );
};
