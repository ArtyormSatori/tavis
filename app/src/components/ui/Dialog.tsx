import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

export const DialogRoot = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export interface DialogOverlayProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {}

export const DialogOverlay = ({ className, ...rest }: DialogOverlayProps) => (
  <DialogPrimitive.Overlay
    data-slot="dialog-overlay"
    // `surface-overlay` is the themed scrim token. A literal `bg-black/50`
    // would not follow a user's theme, and raw palette colours are banned in
    // this directory by `lint:ui-tokens`.
    className={cn('fixed inset-0 z-50 bg-surface-overlay/50 backdrop-blur-sm', className)}
    {...rest}
  />
);

export interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Portal target. Defaults to `document.body`.
   *
   * The mascot, notch and overlay windows are transparent NSPanels rendering
   * their own React root; a scrim portalled into their `document.body` paints
   * an opaque sheet over a window that is supposed to be see-through. Those
   * roots pass their own container instead.
   */
  container?: HTMLElement | null;
  overlayClassName?: string;
  children: ReactNode;
}

export const DialogContent = ({
  className,
  overlayClassName,
  container,
  children,
  ...rest
}: DialogContentProps) => (
  <DialogPrimitive.Portal container={container ?? undefined}>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      data-slot="dialog-content"
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
        'overflow-hidden rounded-2xl bg-surface shadow-large animate-fade-up focus:outline-none',
        className,
      )}
      {...rest}>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export default DialogRoot;
