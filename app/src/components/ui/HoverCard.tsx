import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef } from 'react';

import { cn } from '../../lib/cn';

/**
 * Radix `HoverCard` — a preview surface that opens on pointer hover *and* on
 * keyboard focus, which is the whole reason to prefer it over a hand-rolled
 * `onMouseEnter` popover: the hover-only version is unreachable from the
 * keyboard, and Radix wires focus, escape-to-dismiss and viewport collision
 * for free.
 *
 * Visually it mirrors `Popover.tsx` (same border/surface/shadow/radius) — a
 * hover card and a click popover reading differently would be noise, not
 * signal. The distinction lives in the interaction, not the chrome.
 *
 * ANIMATION: only the keyframes in `tailwind.config.js`; `tailwindcss-animate`
 * is not installed, so `animate-in`/`fade-in-0` do not exist here. Content
 * mounts on open, so `animate-fade-in` is the transition that runs.
 *
 * NOT a tooltip. A hover card is a rich, non-essential preview; a label for an
 * icon button belongs in `Tooltip`.
 */
export const HoverCardRoot = HoverCardPrimitive.Root;
export const HoverCardTrigger = HoverCardPrimitive.Trigger;

export interface HoverCardContentProps
  extends ComponentPropsWithRef<typeof HoverCardPrimitive.Content> {
  /** Portal target; defaults to `document.body`. */
  container?: HTMLElement | null;
}

export const HoverCardContent = ({
  className,
  align = 'center',
  sideOffset = 6,
  container,
  ...rest
}: HoverCardContentProps) => (
  <HoverCardPrimitive.Portal container={container ?? undefined}>
    <HoverCardPrimitive.Content
      data-slot="hover-card-content"
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-64 rounded-xl border border-line bg-surface p-3 text-sm text-content shadow-large',
        'animate-fade-in focus:outline-none',
        className
      )}
      {...rest}
    />
  </HoverCardPrimitive.Portal>
);

export const HoverCardArrow = ({
  className,
  ...rest
}: ComponentPropsWithRef<typeof HoverCardPrimitive.Arrow>) => (
  <HoverCardPrimitive.Arrow
    data-slot="hover-card-arrow"
    className={cn('fill-surface', className)}
    {...rest}
  />
);

export default HoverCardRoot;
