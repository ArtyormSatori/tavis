/**
 * ChainOfThought — adapted from `chain-of-thought.tsx` in
 * https://github.com/vercel/ai-elements (Apache License 2.0).
 *
 * Changes made in this port:
 * - `@/registry/default/ui/{badge,collapsible}` -> OpenHuman's own primitives
 *   from `../ui`; `@/lib/utils` cn -> `../../lib/cn`.
 * - `@radix-ui/react-use-controllable-state` -> the local
 *   `./useControllableState` (this repo takes Radix through the unified
 *   `radix-ui` package only, which does not re-export that hook).
 * - lucide icons (Brain/ChevronDown/Dot) -> inline SVGs in `./icons`;
 *   `LucideIcon` -> the local `AiElementIcon` type.
 * - shadcn semantic colours -> OpenHuman design tokens, and
 *   `tailwindcss-animate` utilities -> the keyframes in tailwind.config.js
 *   (`animate-fade-up`, and the `animate-fade-in` already baked into
 *   `CollapsibleContent`). Tailwind v3 here, so `size-4` -> `h-4 w-4`.
 * - user-facing strings go through `useT()`.
 * - `data-slot` attributes added, per this repo's component contract.
 */
import { memo, createContext, useContext, useMemo, type ComponentProps, type ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { useT } from '../../lib/i18n/I18nContext';
import { Badge, CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from '../ui';

import { BrainIcon, ChevronDownIcon, DotIcon } from './icons';
import type { AiElementIcon } from './types';
import { useControllableState } from './useControllableState';

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error('ChainOfThought components must be used within ChainOfThought');
  }
  return context;
};

export type ChainOfThoughtProps = ComponentProps<'div'> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
  ({ className, open, defaultOpen = false, onOpenChange, children, ...props }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });

    const chainOfThoughtContext = useMemo(() => ({ isOpen, setIsOpen }), [isOpen, setIsOpen]);

    return (
      <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
        <div data-slot="chain-of-thought" className={cn('not-prose w-full space-y-4', className)} {...props}>
          {children}
        </div>
      </ChainOfThoughtContext.Provider>
    );
  }
);

export type ChainOfThoughtHeaderProps = ComponentProps<typeof CollapsibleTrigger>;

export const ChainOfThoughtHeader = memo(({ className, children, ...props }: ChainOfThoughtHeaderProps) => {
  const { t } = useT();
  const { isOpen, setIsOpen } = useChainOfThought();

  return (
    <CollapsibleRoot onOpenChange={setIsOpen} open={isOpen}>
      <CollapsibleTrigger
        data-slot="chain-of-thought-header"
        className={cn(
          'flex w-full items-center justify-start gap-2 px-0 py-0 text-sm font-normal',
          'text-content-muted transition-colors hover:bg-transparent hover:text-content',
          className
        )}
        {...props}>
        <BrainIcon className="h-4 w-4" />
        <span className="flex-1 text-left">
          {children ?? t('chat.chainOfThought.title', 'Chain of Thought')}
        </span>
        <ChevronDownIcon className={cn('h-4 w-4 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')} />
      </CollapsibleTrigger>
    </CollapsibleRoot>
  );
});

export type ChainOfThoughtStepStatus = 'complete' | 'active' | 'pending';

export type ChainOfThoughtStepProps = ComponentProps<'div'> & {
  icon?: AiElementIcon;
  label: ReactNode;
  description?: ReactNode;
  status?: ChainOfThoughtStepStatus;
};

const stepStatusStyles: Record<ChainOfThoughtStepStatus, string> = {
  active: 'text-content',
  complete: 'text-content-muted',
  pending: 'text-content-muted/50',
};

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon: Icon = DotIcon,
    label,
    description,
    status = 'complete',
    children,
    ...props
  }: ChainOfThoughtStepProps) => (
    <div
      data-slot="chain-of-thought-step"
      data-variant={status}
      className={cn('flex gap-2 text-sm', stepStatusStyles[status], 'animate-fade-up', className)}
      {...props}>
      <div className="relative mt-0.5">
        <Icon className="h-4 w-4" />
        <div className="absolute bottom-0 left-1/2 top-7 -mx-px w-px bg-line" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div>{label}</div>
        {description && <div className="text-xs text-content-muted">{description}</div>}
        {children}
      </div>
    </div>
  )
);

export type ChainOfThoughtSearchResultsProps = ComponentProps<'div'>;

export const ChainOfThoughtSearchResults = memo(({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
  <div
    data-slot="chain-of-thought-search-results"
    className={cn('flex flex-wrap items-center gap-2', className)}
    {...props}
  />
));

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

/**
 * Upstream renders `<Badge variant="secondary">`. This repo's Badge has no
 * `secondary` variant (its neutral variant is the equivalent surface) and it
 * accepts a fixed prop set rather than spreading `...rest` onto the DOM, so the
 * emitted `data-slot` here is the primitive's own `badge`.
 */
export const ChainOfThoughtSearchResult = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
    <Badge className={cn('gap-1 px-2 py-0.5 text-xs font-normal', className)} variant="neutral" {...props}>
      {children}
    </Badge>
  )
);

export type ChainOfThoughtContentProps = ComponentProps<typeof CollapsibleContent>;

export const ChainOfThoughtContent = memo(({ className, children, ...props }: ChainOfThoughtContentProps) => {
  const { isOpen } = useChainOfThought();

  return (
    <CollapsibleRoot open={isOpen}>
      <CollapsibleContent
        data-slot="chain-of-thought-content"
        className={cn('mt-2 space-y-3 px-0 pb-0 text-content outline-none', className)}
        {...props}>
        {children}
      </CollapsibleContent>
    </CollapsibleRoot>
  );
});

export type ChainOfThoughtImageProps = ComponentProps<'div'> & {
  caption?: string;
};

export const ChainOfThoughtImage = memo(({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
  <div data-slot="chain-of-thought-image" className={cn('mt-2 space-y-2', className)} {...props}>
    <div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-surface-muted p-3">
      {children}
    </div>
    {caption && <p className="text-xs text-content-muted">{caption}</p>}
  </div>
));

ChainOfThought.displayName = 'ChainOfThought';
ChainOfThoughtHeader.displayName = 'ChainOfThoughtHeader';
ChainOfThoughtStep.displayName = 'ChainOfThoughtStep';
ChainOfThoughtSearchResults.displayName = 'ChainOfThoughtSearchResults';
ChainOfThoughtSearchResult.displayName = 'ChainOfThoughtSearchResult';
ChainOfThoughtContent.displayName = 'ChainOfThoughtContent';
ChainOfThoughtImage.displayName = 'ChainOfThoughtImage';
