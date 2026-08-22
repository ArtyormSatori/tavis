/*
 * Section header + body for the LLM configuration page.
 *
 * The page previously hand-rolled this shape twice as
 * `<div className="border-b border-line pb-2">` wrapping an `<h2>` and a `<p>`.
 * A `<div>` with a bottom border is not a separator to a screen reader — it is
 * nothing at all — so the rule is drawn with the `Separator` primitive, which
 * Radix exposes correctly (decorative here: the heading already names the
 * section, so announcing a separator on top of it is noise).
 *
 * Layout is a plain flex column with no width cap. Every section fills the
 * pane it is given and lets its own children decide how to wrap, which is what
 * lets the routing cards and the workload tables go side by side on a wide
 * window instead of stacking inside a centred column.
 */
import { type ReactNode } from 'react';

import { cn } from '../../../../lib/cn';
import Separator from '../../../ui/Separator';

export interface PanelSectionProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned control(s) on the heading row. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const PanelSection = ({
  title,
  description,
  action,
  children,
  className,
}: PanelSectionProps) => (
  <section data-slot="panel-section" className={cn('flex w-full flex-col gap-4', className)}>
    <header className="flex w-full flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-content">{title}</h2>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {description != null ? <p className="text-xs text-content-muted">{description}</p> : null}
      <Separator className="mt-1" />
    </header>
    {children}
  </section>
);

export default PanelSection;
