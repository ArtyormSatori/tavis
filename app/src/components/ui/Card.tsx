import { type ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export const CardHeader = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('px-4 pb-0 pt-4', className)}>{children}</div>
);

export const CardTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h3 className={cn('text-xs font-semibold tracking-wide text-content-muted', className)}>{children}</h3>
);

export const CardDescription = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('mt-1 text-xs leading-relaxed text-content-muted', className)}>{children}</p>
);

export const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('p-4', className)}>{children}</div>
);

/**
 * A bordered surface with an optional heading and divided body — the shape
 * ~470 hand-rolled `rounded-* border bg-*` wrappers across the app are
 * reproducing. Generalized out of `settings/controls/SettingsSection`, which
 * now re-exports this.
 */
const Card = ({ title, description, children, className, 'data-testid': testId }: CardProps) => (
  <div
    data-slot="card"
    data-testid={testId}
    className={cn('overflow-hidden rounded-xl border border-line bg-surface', className)}>
    {title && (
      <div className="px-4 pb-0 pt-4">
        {/* Real heading (h3, one level below SettingsHeader's h2) for a11y and
            so getByRole('heading') keeps resolving section titles. */}
        <h3 className="text-xs font-semibold tracking-wide text-content-muted">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-content-muted">{description}</p>
        )}
      </div>
    )}
    {/* `divide-line-subtle` flips with the theme on its own, so the historical
        hardcoded dark-mode companion is gone: a raw palette scale would not
        follow a user's custom theme. */}
    <div className="divide-y divide-line-subtle">{children}</div>
  </div>
);

export default Card;
