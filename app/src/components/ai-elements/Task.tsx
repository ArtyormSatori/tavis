/**
 * Adapted from `task.tsx` in vercel/ai-elements (Apache-2.0).
 * Upstream: https://github.com/vercel/ai-elements — registry component `task`.
 *
 * Changes made for OpenHuman:
 *  - `@/registry/default/ui/collapsible` rewritten to this app's
 *    `CollapsibleRoot/Trigger/Content` from `components/ui`.
 *  - shadcn semantic colours mapped onto OpenHuman tokens (`bg-secondary` ->
 *    `bg-surface-subtle`, `text-muted-foreground` -> `text-content-muted`,
 *    `border-muted` -> `border-line-subtle`, …).
 *  - lucide-react `SearchIcon` / `ChevronDownIcon` replaced with inline
 *    `aria-hidden` SVGs (no lucide dependency in this app).
 *  - `tailwindcss-animate` utilities replaced with the repo's `animate-fade-in`
 *    keyframe; `size-4` expanded to `h-4 w-4` (Tailwind v3).
 *  - the trigger's default label is `title`, supplied by the caller, so no
 *    string is hardcoded here.
 */
import { type ComponentProps } from 'react';

import { cn } from '../../lib/cn';
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from '../ui';

const iconProps = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
} as const;

const SearchIcon = () => (
  <svg {...iconProps} className="h-4 w-4 shrink-0">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    {...iconProps}
    className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export type TaskItemFileProps = ComponentProps<'div'>;

export const TaskItemFile = ({ children, className, ...props }: TaskItemFileProps) => (
  <div
    data-slot="task-item-file"
    className={cn(
      'inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle px-1.5 py-0.5 text-xs text-content',
      className
    )}
    {...props}>
    {children}
  </div>
);

export type TaskItemProps = ComponentProps<'div'>;

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
  <div data-slot="task-item" className={cn('text-sm text-content-muted', className)} {...props}>
    {children}
  </div>
);

export type TaskProps = ComponentProps<typeof CollapsibleRoot>;

export const Task = ({ defaultOpen = true, className, ...props }: TaskProps) => (
  <CollapsibleRoot
    data-slot="task"
    className={cn(className)}
    defaultOpen={defaultOpen}
    {...props}
  />
);

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
};

export const TaskTrigger = ({ children, className, title, ...props }: TaskTriggerProps) => (
  <CollapsibleTrigger data-slot="task-trigger" asChild className={cn('group', className)} {...props}>
    {children ?? (
      <div className="flex w-full cursor-pointer items-center gap-2 text-sm text-content-muted transition-colors hover:text-content">
        <SearchIcon />
        <p className="text-sm">{title}</p>
        <ChevronDownIcon />
      </div>
    )}
  </CollapsibleTrigger>
);

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({ children, className, ...props }: TaskContentProps) => (
  <CollapsibleContent
    data-slot="task-content"
    className={cn('p-0 text-content outline-none data-[state=open]:animate-fade-in', className)}
    {...props}>
    <div className="mt-4 space-y-2 border-l-2 border-line-subtle pl-4">{children}</div>
  </CollapsibleContent>
);

export default Task;
