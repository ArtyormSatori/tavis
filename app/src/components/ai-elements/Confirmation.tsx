/**
 * Adapted from `confirmation.tsx` in vercel/ai-elements (Apache-2.0).
 * Upstream: https://github.com/vercel/ai-elements — registry component `confirmation`.
 *
 * Port notes (this is an adaptation, not a copy):
 * - `@/registry/default/ui/{alert,button}` → OpenHuman's `Alert`/`AlertDescription`/
 *   `Button` from `../ui`.
 * - `@/lib/utils` `cn` → `../../lib/cn`.
 * - The `ai` package is not a dependency here. Upstream's `ToolUIPart["state"]`
 *   is re-declared locally as {@link ConfirmationState} — only the six state
 *   strings this component actually branches on — and its six-arm
 *   `ToolUIPartApproval` union collapses to {@link ToolApproval}, which is the
 *   same set of inhabited shapes (`approved` absent, `true`, or `false`).
 * - Upstream's bare `<Alert>` inherits shadcn's default colours; here the
 *   variant is explicit so the surface stays on OpenHuman tokens.
 * - `ConfirmationAction`'s hand-rolled `h-8 px-3 text-sm` becomes `size="sm"`.
 * - No hardcoded copy: every visible string is caller-supplied via children.
 * - `data-slot` attributes added so tests assert structure, not class strings.
 */
import type { ComponentProps, ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

import { cn } from '../../lib/cn';
import { Alert, AlertDescription, Button } from '../ui';

/**
 * The tool-call lifecycle states this component branches on. Mirrors the
 * subset of the AI SDK's `ToolUIPart["state"]` that upstream reads; the SDK
 * type itself is deliberately not imported (the `ai` package is not a
 * dependency of this app).
 */
export type ConfirmationState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-denied'
  | 'output-available'
  | 'output-error';

/** The approval record attached to a parked tool call. */
export type ToolApproval =
  | { id: string; approved?: undefined; reason?: undefined }
  | { id: string; approved: boolean; reason?: string }
  | undefined;

interface ConfirmationContextValue {
  approval: ToolApproval;
  state: ConfirmationState;
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

const useConfirmation = (): ConfirmationContextValue => {
  const context = useContext(ConfirmationContext);

  if (!context) {
    throw new Error('Confirmation components must be used within Confirmation');
  }

  return context;
};

/** The states in which a decision has already been recorded. */
const RESPONDED_STATES: readonly ConfirmationState[] = [
  'approval-responded',
  'output-denied',
  'output-available',
];

export type ConfirmationProps = ComponentProps<typeof Alert> & {
  approval?: ToolApproval;
  state: ConfirmationState;
};

export const Confirmation = ({
  className,
  approval,
  state,
  variant = 'warning',
  ...props
}: ConfirmationProps) => {
  const contextValue = useMemo(() => ({ approval, state }), [approval, state]);

  if (!approval || state === 'input-streaming' || state === 'input-available') {
    return null;
  }

  return (
    <ConfirmationContext.Provider value={contextValue}>
      <Alert
        data-slot="confirmation"
        variant={variant}
        className={cn('flex flex-col gap-2', className)}
        {...props}
      />
    </ConfirmationContext.Provider>
  );
};

export type ConfirmationTitleProps = ComponentProps<typeof AlertDescription>;

export const ConfirmationTitle = ({ className, ...props }: ConfirmationTitleProps) => (
  <AlertDescription
    data-slot="confirmation-title"
    className={cn('inline text-content', className)}
    {...props}
  />
);

export interface ConfirmationRequestProps {
  children?: ReactNode;
}

export const ConfirmationRequest = ({ children }: ConfirmationRequestProps) => {
  const { state } = useConfirmation();

  // Only show while approval is still being requested.
  if (state !== 'approval-requested') {
    return null;
  }

  return children;
};

export interface ConfirmationAcceptedProps {
  children?: ReactNode;
}

export const ConfirmationAccepted = ({ children }: ConfirmationAcceptedProps) => {
  const { approval, state } = useConfirmation();

  if (!approval?.approved || !RESPONDED_STATES.includes(state)) {
    return null;
  }

  return children;
};

export interface ConfirmationRejectedProps {
  children?: ReactNode;
}

export const ConfirmationRejected = ({ children }: ConfirmationRejectedProps) => {
  const { approval, state } = useConfirmation();

  if (approval?.approved !== false || !RESPONDED_STATES.includes(state)) {
    return null;
  }

  return children;
};

export type ConfirmationActionsProps = ComponentProps<'div'>;

export const ConfirmationActions = ({ className, ...props }: ConfirmationActionsProps) => {
  const { state } = useConfirmation();

  // Only show while approval is still being requested.
  if (state !== 'approval-requested') {
    return null;
  }

  return (
    <div
      data-slot="confirmation-actions"
      className={cn('flex items-center justify-end gap-2 self-end', className)}
      {...props}
    />
  );
};

export type ConfirmationActionProps = ComponentProps<typeof Button>;

export const ConfirmationAction = ({ size = 'sm', ...props }: ConfirmationActionProps) => (
  <Button data-slot="confirmation-action" size={size} type="button" {...props} />
);
