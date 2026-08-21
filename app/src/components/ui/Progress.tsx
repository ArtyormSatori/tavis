import { Progress as ProgressPrimitive } from 'radix-ui';

import { cn } from '../../lib/cn';

export interface ProgressProps {
  /**
   * 0–100, or `null` for indeterminate.
   *
   * Radix maps `null` to `data-state="indeterminate"` and drops `aria-valuenow`,
   * which is the accessible half. The visual half is ours: the indicator
   * switches to a shimmer instead of sitting at a permanently empty 0%, which
   * is what a naive `value ?? 0` translate would render.
   */
  value: number | null;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

const Progress = ({
  value,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: ProgressProps) => {
  const indeterminate = value === null;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-testid={testId}
      value={value}
      aria-label={ariaLabel}
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-surface-strong',
        className,
      )}>
      {indeterminate ? (
        <ProgressPrimitive.Indicator className="h-full w-1/3 rounded-full bg-primary-500 motion-safe:animate-shimmer" />
      ) : (
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary-500 transition-transform duration-300 motion-reduce:transition-none"
          style={{ transform: `translateX(-${100 - value}%)` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
};

export default Progress;
