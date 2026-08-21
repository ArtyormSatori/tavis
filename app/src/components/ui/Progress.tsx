import { Progress as ProgressPrimitive } from 'radix-ui';

import { cn } from '../../lib/cn';

export interface ProgressProps {
  /** 0–100. `null` renders an indeterminate bar. */
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
}: ProgressProps) => (
  <ProgressPrimitive.Root
    data-slot="progress"
    data-testid={testId}
    value={value}
    aria-label={ariaLabel}
    className={cn(
      'relative h-1.5 w-full overflow-hidden rounded-full bg-surface-strong',
      className
    )}>
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary-500 transition-transform duration-300 motion-reduce:transition-none"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
);

export default Progress;
