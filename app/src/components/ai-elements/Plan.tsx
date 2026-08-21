/**
 * Adapted from `plan.tsx` in vercel/ai-elements (Apache-2.0).
 * Upstream: https://github.com/vercel/ai-elements — registry component `plan`.
 *
 * Changes made for OpenHuman:
 *  - upstream composes shadcn's `Card` + `CardHeader/Title/Description/Action/
 *    Content/Footer`. This app's `Card` is a single closed component with no
 *    such subcomponents and no `asChild`, so the plan surface is built on
 *    `CollapsibleRoot variant="card"` — which renders the identical chrome
 *    (`rounded-xl border border-line bg-surface`) — with the header/title/
 *    description/action/content/footer slots as local token-styled elements.
 *  - shadcn semantic colours mapped onto OpenHuman tokens.
 *  - lucide-react `ChevronsUpDownIcon` replaced with an inline `aria-hidden`
 *    SVG (no lucide dependency in this app).
 *  - upstream's `<Shimmer>` (a sibling registry component, not ported here) is
 *    reimplemented locally on the repo's own `animate-shimmer` keyframe.
 *  - `Button` maps to this app's `variant="tertiary" size="sm" iconOnly`.
 *  - every user-facing string routed through `useT()`.
 */
import { type ComponentProps, createContext, useContext, useMemo } from 'react';

import { cn } from '../../lib/cn';
import { useT } from '../../lib/i18n/I18nContext';
import { Button, CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from '../ui';

interface PlanContextValue {
  isStreaming: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('Plan components must be used within Plan');
  }
  return context;
};

/**
 * A local stand-in for upstream's `<Shimmer>`: a gradient sweep over the text
 * while the plan is still streaming in. Uses the repo's `animate-shimmer`
 * keyframe (background-position based) rather than `tailwindcss-animate`.
 */
const Shimmer = ({ children }: { children: string }) => (
  <span
    data-slot="plan-shimmer"
    className="animate-shimmer bg-gradient-to-r from-content-muted via-content to-content-muted bg-[length:200%_100%] bg-clip-text text-transparent">
    {children}
  </span>
);

export type PlanProps = ComponentProps<typeof CollapsibleRoot> & { isStreaming?: boolean };

export const Plan = ({ className, isStreaming = false, children, ...props }: PlanProps) => {
  const contextValue = useMemo(() => ({ isStreaming }), [isStreaming]);

  return (
    <PlanContext.Provider value={contextValue}>
      <CollapsibleRoot
        data-slot="plan"
        variant="card"
        className={cn('shadow-none', className)}
        {...props}>
        {children}
      </CollapsibleRoot>
    </PlanContext.Provider>
  );
};

export type PlanHeaderProps = ComponentProps<'div'>;

export const PlanHeader = ({ className, ...props }: PlanHeaderProps) => (
  <div
    data-slot="plan-header"
    className={cn('flex items-start justify-between gap-3 px-4 pt-4', className)}
    {...props}
  />
);

export type PlanTitleProps = Omit<ComponentProps<'h3'>, 'children'> & { children: string };

export const PlanTitle = ({ className, children, ...props }: PlanTitleProps) => {
  const { isStreaming } = usePlan();

  return (
    <h3
      data-slot="plan-title"
      className={cn('text-sm font-semibold leading-none text-content', className)}
      {...props}>
      {isStreaming ? <Shimmer>{children}</Shimmer> : children}
    </h3>
  );
};

export type PlanDescriptionProps = Omit<ComponentProps<'p'>, 'children'> & { children: string };

export const PlanDescription = ({ className, children, ...props }: PlanDescriptionProps) => {
  const { isStreaming } = usePlan();

  return (
    <p
      data-slot="plan-description"
      className={cn('text-balance text-xs leading-relaxed text-content-muted', className)}
      {...props}>
      {isStreaming ? <Shimmer>{children}</Shimmer> : children}
    </p>
  );
};

export type PlanActionProps = ComponentProps<'div'>;

export const PlanAction = ({ className, ...props }: PlanActionProps) => (
  <div
    data-slot="plan-action"
    className={cn('flex shrink-0 items-center gap-1', className)}
    {...props}
  />
);

export type PlanContentProps = ComponentProps<'div'>;

export const PlanContent = ({ className, ...props }: PlanContentProps) => (
  <CollapsibleContent asChild className="p-0">
    <div
      data-slot="plan-content"
      className={cn('px-4 py-3 text-sm text-content-secondary', className)}
      {...props}
    />
  </CollapsibleContent>
);

export type PlanFooterProps = ComponentProps<'div'>;

export const PlanFooter = ({ className, ...props }: PlanFooterProps) => (
  <div
    data-slot="plan-footer"
    className={cn('flex items-center gap-2 px-4 pb-4 pt-2', className)}
    {...props}
  />
);

export type PlanTriggerProps = ComponentProps<typeof Button>;

export const PlanTrigger = ({ className, ...props }: PlanTriggerProps) => {
  const { t } = useT();
  const label = t('aiElements.plan.toggle', 'Toggle plan');

  return (
    // The shared trigger primitive's own padding / weight / hover fill are
    // merged away inside it (its `cn`) before `asChild` hands the class string
    // to `Button`, which otherwise ends up with two competing paddings.
    <CollapsibleTrigger
      asChild
      className="w-auto justify-center p-0 font-normal hover:bg-transparent">
      <Button
        data-slot="plan-trigger"
        className={cn('h-8 w-8', className)}
        size="sm"
        iconOnly
        variant="tertiary"
        aria-label={label}
        {...props}>
        <svg
          aria-hidden
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24">
          <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
        </svg>
      </Button>
    </CollapsibleTrigger>
  );
};

export default Plan;
