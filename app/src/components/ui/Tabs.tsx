import { Tabs as TabsPrimitive } from 'radix-ui';
import { type ComponentPropsWithoutRef } from 'react';

import { cn } from '../../lib/cn';

export const TabsRoot = TabsPrimitive.Root;

/** Roving-focus tab list: arrow keys move, Home/End jump, only one tab stop. */
export const TabsList = ({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    data-slot="tabs-list"
    className={cn('flex items-center gap-1', className)}
    {...rest}
  />
);

export const TabsTrigger = ({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    data-slot="tabs-trigger"
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
      'text-content-muted hover:bg-surface-hover hover:text-content-secondary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25',
      'data-[state=active]:bg-surface-strong data-[state=active]:text-content',
      className,
    )}
    {...rest}
  />
);

export const TabsContent = ({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    data-slot="tabs-content"
    className={cn('focus:outline-none', className)}
    {...rest}
  />
);

export default TabsRoot;
