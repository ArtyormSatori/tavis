import { Checkbox as CheckboxPrimitive } from 'radix-ui';

import { cn } from '../../lib/cn';
import { CheckIcon } from './icons';

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  /**
   * Tri-state. The previous native-input version had to reach for a ref and set
   * `.indeterminate` in an effect, because the attribute does not exist in
   * markup; Radix models it as a real value.
   */
  indeterminate?: boolean;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

/**
 * Radix `Checkbox`. Unlike a bare `<input type="checkbox">` styled with the
 * forms plugin, this renders its own indicator, so the check mark follows the
 * theme's content colour instead of the UA accent colour.
 */
const Checkbox = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  indeterminate = false,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: CheckboxProps) => (
  <CheckboxPrimitive.Root
    id={id}
    data-slot="checkbox"
    data-testid={testId}
    checked={indeterminate ? 'indeterminate' : checked}
    onCheckedChange={(next) => onCheckedChange(next === true)}
    disabled={disabled}
    aria-label={ariaLabel}
    className={cn(
      'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-line-strong bg-surface',
      'transition-colors duration-150 motion-reduce:transition-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500',
      'data-[state=indeterminate]:border-primary-500 data-[state=indeterminate]:bg-primary-500',
      className,
    )}>
    <CheckboxPrimitive.Indicator className="text-content-inverted">
      {indeterminate ? (
        <span aria-hidden="true" className="block h-0.5 w-2 rounded-full bg-current" />
      ) : (
        <CheckIcon className="h-3 w-3" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

export default Checkbox;
