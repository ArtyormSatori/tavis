/**
 * Adapted from `artifact.tsx` in vercel/ai-elements (Apache-2.0).
 * Upstream: https://github.com/vercel/ai-elements — registry component `artifact`.
 *
 * Port notes (this is an adaptation, not a copy):
 * - `@/registry/default/ui/{button,tooltip}` → OpenHuman's own primitives from `../ui`.
 *   Upstream's Radix Tooltip quartet (`TooltipProvider`/`Tooltip`/`TooltipTrigger`/
 *   `TooltipContent`) collapses to OpenHuman's single portal `Tooltip label={…}`.
 * - `@/lib/utils` `cn` → `../../lib/cn`.
 * - lucide-react is not a dependency here: `XIcon` → `CloseIcon` from `../ui/icons`,
 *   and the `icon?: LucideIcon` prop becomes a structural
 *   `ComponentType<{ className?: string }>` so any local icon fits.
 * - Button variants remapped: upstream `variant="ghost"` → OpenHuman `tertiary`,
 *   and the hand-rolled `size-8 p-0` square becomes `iconOnly`.
 * - shadcn semantic colours remapped onto OpenHuman tokens (bg-background →
 *   bg-surface-canvas, bg-muted → bg-surface-muted, text-muted-foreground →
 *   text-content-muted, text-foreground → text-content, border → border-line).
 * - Tailwind v4 `size-*` utilities rewritten to explicit `h-* w-*` (this app is v3).
 * - The one hardcoded string ("Close") goes through `useT()`.
 * - `data-slot` attributes added so tests assert structure, not class strings.
 */
import type { ComponentProps, ComponentPropsWithRef, ComponentType } from 'react';

import { cn } from '../../lib/cn';
import { useT } from '../../lib/i18n/I18nContext';
import { Button, CloseIcon, Tooltip } from '../ui';

export type ArtifactProps = ComponentPropsWithRef<'div'>;

export const Artifact = ({ className, ...props }: ArtifactProps) => (
  <div
    data-slot="artifact"
    className={cn(
      'flex flex-col overflow-hidden rounded-lg border border-line bg-surface-canvas shadow-sm',
      className
    )}
    {...props}
  />
);

export type ArtifactHeaderProps = ComponentPropsWithRef<'div'>;

export const ArtifactHeader = ({ className, ...props }: ArtifactHeaderProps) => (
  <div
    data-slot="artifact-header"
    className={cn(
      'flex items-center justify-between border-b border-line bg-surface-muted/50 px-4 py-3',
      className
    )}
    {...props}
  />
);

export type ArtifactCloseProps = ComponentProps<typeof Button>;

export const ArtifactClose = ({
  className,
  children,
  size = 'sm',
  variant = 'tertiary',
  ...props
}: ArtifactCloseProps) => {
  const { t } = useT();
  const label = t('common.close');

  return (
    <Button
      data-slot="artifact-close"
      aria-label={label}
      className={cn('text-content-muted hover:text-content', className)}
      iconOnly
      size={size}
      type="button"
      variant={variant}
      {...props}>
      {children ?? <CloseIcon className="h-4 w-4" />}
    </Button>
  );
};

export type ArtifactTitleProps = ComponentPropsWithRef<'p'>;

export const ArtifactTitle = ({ className, ...props }: ArtifactTitleProps) => (
  <p
    data-slot="artifact-title"
    className={cn('text-sm font-medium text-content', className)}
    {...props}
  />
);

export type ArtifactDescriptionProps = ComponentPropsWithRef<'p'>;

export const ArtifactDescription = ({ className, ...props }: ArtifactDescriptionProps) => (
  <p
    data-slot="artifact-description"
    className={cn('text-sm text-content-muted', className)}
    {...props}
  />
);

export type ArtifactActionsProps = ComponentPropsWithRef<'div'>;

export const ArtifactActions = ({ className, ...props }: ArtifactActionsProps) => (
  <div
    data-slot="artifact-actions"
    className={cn('flex items-center gap-1', className)}
    {...props}
  />
);

export type ArtifactActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
  /** Any icon component taking a `className` — upstream typed this `LucideIcon`. */
  icon?: ComponentType<{ className?: string }>;
};

export const ArtifactAction = ({
  tooltip,
  label,
  icon: Icon,
  children,
  className,
  size = 'sm',
  variant = 'tertiary',
  ...props
}: ArtifactActionProps) => {
  const button = (
    <Button
      data-slot="artifact-action"
      aria-label={label || tooltip}
      className={cn('text-content-muted hover:text-content', className)}
      iconOnly
      size={size}
      type="button"
      variant={variant}
      {...props}>
      {Icon ? <Icon className="h-4 w-4" /> : children}
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip label={tooltip} side="top">
        {button}
      </Tooltip>
    );
  }

  return button;
};

export type ArtifactContentProps = ComponentPropsWithRef<'div'>;

export const ArtifactContent = ({ className, ...props }: ArtifactContentProps) => (
  <div data-slot="artifact-content" className={cn('flex-1 overflow-auto p-4', className)} {...props} />
);
