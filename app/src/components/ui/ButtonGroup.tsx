import { type VariantProps } from 'class-variance-authority';
import {
  createContext,
  forwardRef,
  type HTMLAttributes,
  useContext,
  useMemo,
} from 'react';

import { cn } from '../../lib/cn';
import Button, { type ButtonProps, type buttonVariants } from './Button';

/**
 * A segmented row (or column) of `Button`s that reads as one control: the
 * borders are joined, only the outer corners are rounded, and neighbouring
 * borders overlap by a pixel instead of doubling up.
 *
 * There is no Radix primitive here and deliberately so — this is layout, not
 * behaviour. If you need a *selection* control (one shared roving tab stop,
 * pressed state, single/multiple), reach for `ToggleGroup` instead; this is for
 * a row of independent actions (Save / Save as / …, or a split button).
 *
 * The joining is done with child selectors on the root rather than by asking
 * each item to know its own position, so a mapped list, a conditional item or
 * a wrapped `Tooltip` trigger all keep working. Items still need to be direct
 * children for `:first-child` / `:last-child` to mean what it looks like.
 *
 * `size` / `variant` / `tone` on the root are defaults for `ButtonGroupItem`,
 * passed through context — they are `Button`'s own axes verbatim, so a group
 * lines up with a standalone `Button` of the same size. An item may still
 * override any of them.
 */
type ButtonGroupContextValue = Pick<VariantProps<typeof buttonVariants>, 'variant' | 'tone' | 'size'>;

const ButtonGroupContext = createContext<ButtonGroupContextValue>({
  variant: 'secondary',
  tone: 'default',
  size: 'md',
});

export type ButtonGroupOrientation = 'horizontal' | 'vertical';

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement>, ButtonGroupContextValue {
  orientation?: ButtonGroupOrientation;
}

/**
 * `-ml-px` collapses the shared border; `focus-within:z-10` on the children
 * lifts the focused button so its ring is not clipped by the neighbour that
 * overlaps it.
 */
const JOIN: Record<ButtonGroupOrientation, string> = {
  horizontal:
    'flex-row [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none ' +
    '[&>*:not(:first-child)]:-ml-px',
  vertical:
    'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none ' +
    '[&>*:not(:first-child)]:-mt-px',
};

export const ButtonGroupRoot = forwardRef<HTMLDivElement, ButtonGroupProps>((props, ref) => {
  const {
    variant = 'secondary',
    tone = 'default',
    size = 'md',
    orientation = 'horizontal',
    className,
    children,
    role,
    ...rest
  } = props;

  const context = useMemo(() => ({ variant, tone, size }), [variant, tone, size]);

  return (
    <ButtonGroupContext.Provider value={context}>
      <div
        ref={ref}
        role={role ?? 'group'}
        data-slot="button-group"
        data-variant={variant ?? undefined}
        data-tone={tone ?? undefined}
        data-size={size ?? undefined}
        data-orientation={orientation}
        className={cn(
          'inline-flex items-stretch [&>*]:relative [&>*]:focus-within:z-10',
          JOIN[orientation],
          className
        )}
        {...rest}>
        {children}
      </div>
    </ButtonGroupContext.Provider>
  );
});
ButtonGroupRoot.displayName = 'ButtonGroupRoot';

export type ButtonGroupItemProps = ButtonProps;

/** A `Button` that inherits the group's variant/tone/size unless it overrides them. */
export const ButtonGroupItem = forwardRef<HTMLButtonElement, ButtonGroupItemProps>(
  ({ variant, tone, size, className, ...rest }, ref) => {
    const group = useContext(ButtonGroupContext);
    return (
      <Button
        ref={ref}
        variant={variant ?? group.variant ?? undefined}
        tone={tone ?? group.tone ?? undefined}
        size={size ?? group.size ?? undefined}
        data-slot="button-group-item"
        className={cn('focus-visible:z-10', className)}
        {...rest}
      />
    );
  }
);
ButtonGroupItem.displayName = 'ButtonGroupItem';

export default ButtonGroupRoot;
