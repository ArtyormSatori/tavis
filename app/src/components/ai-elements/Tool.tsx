/**
 * Adapted from `tool.tsx` in vercel/ai-elements (Apache-2.0).
 * Upstream: https://github.com/vercel/ai-elements — registry component `tool`.
 *
 * Changes made for OpenHuman:
 *  - `@/registry/default/ui/*` imports rewritten to this app's own primitives
 *    (`Badge`, `CollapsibleRoot/Trigger/Content`) from `components/ui`.
 *  - shadcn semantic colours mapped onto OpenHuman design tokens
 *    (`bg-muted` -> `bg-surface-muted`, `text-foreground` -> `text-content`,
 *    `bg-destructive` -> `bg-coral-500`, and so on) so custom themes follow.
 *  - lucide-react icons replaced with inline `aria-hidden` SVGs (no lucide
 *    dependency in this app).
 *  - `ai` SDK types replaced with the narrow local shapes in `./types`.
 *  - upstream's `<CodeBlock>` (syntax-highlighted, not ported) replaced with a
 *    plain `<pre>` — highlighting is a separate component that this stage does
 *    not land.
 *  - `tailwindcss-animate` utilities replaced with the repo's own
 *    `animate-fade-in` keyframe; `size-4` expanded to `h-4 w-4` (Tailwind v3).
 *  - every user-facing string routed through `useT()`.
 */
import { type ComponentProps, isValidElement, type ReactNode } from 'react';

import { useT } from '../../lib/i18n/I18nContext';
import { cn } from '../../lib/cn';
import { Badge, CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from '../ui';
import type { ToolPart, ToolPartState } from './types';

export type { ToolPart } from './types';

const iconProps = {
  'aria-hidden': true,
  className: 'h-4 w-4 shrink-0',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
} as const;

const WrenchIcon = () => (
  <svg {...iconProps} className="h-4 w-4 shrink-0 text-content-muted">
    <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3Z" />
    <path d="M14.7 6.3 18 3l3 3-3.3 3.3" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    {...iconProps}
    className="h-4 w-4 shrink-0 text-content-muted transition-transform group-data-[state=open]:rotate-180">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const ClockIcon = ({ pulse = false }: { pulse?: boolean }) => (
  <svg {...iconProps} className={cn('h-4 w-4 shrink-0', pulse && 'animate-pulse')}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const CircleIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

const XCircleIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </svg>
);

export type ToolProps = ComponentProps<typeof CollapsibleRoot>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <CollapsibleRoot
    data-slot="tool"
    className={cn('group not-prose mb-4 w-full rounded-md border border-line', className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: `tool-${string}`; state: ToolPartState; toolName?: never }
  | { type: 'dynamic-tool'; state: ToolPartState; toolName: string }
);

/**
 * Status icons carry no colour of their own: the surrounding `Badge` variant
 * supplies the semantic tint, so the pair can never disagree the way upstream's
 * hardcoded `text-green-600` / `text-red-600` could.
 */
const statusIcons: Record<ToolPartState, ReactNode> = {
  'approval-requested': <ClockIcon />,
  'approval-responded': <CheckCircleIcon />,
  'input-available': <ClockIcon pulse />,
  'input-streaming': <CircleIcon />,
  'output-available': <CheckCircleIcon />,
  'output-denied': <XCircleIcon />,
  'output-error': <XCircleIcon />,
};

const statusVariants = {
  'approval-requested': 'warning',
  'approval-responded': 'primary',
  'input-available': 'warning',
  'input-streaming': 'neutral',
  'output-available': 'success',
  'output-denied': 'warning',
  'output-error': 'danger',
} as const satisfies Record<ToolPartState, string>;

/** i18n key + English fallback per lifecycle state. */
const statusLabelKeys: Record<ToolPartState, readonly [string, string]> = {
  'approval-requested': ['aiElements.tool.status.approvalRequested', 'Awaiting approval'],
  'approval-responded': ['aiElements.tool.status.approvalResponded', 'Responded'],
  'input-available': ['conversations.agentTaskInsights.running', 'Running'],
  'input-streaming': ['aiElements.tool.status.pending', 'Pending'],
  'output-available': ['conversations.agentTaskInsights.done', 'Done'],
  'output-denied': ['aiElements.tool.status.denied', 'Denied'],
  'output-error': ['common.error', 'Error'],
};

/** The status pill for one tool state. Exported to match upstream's surface. */
export const ToolStatusBadge = ({ status }: { status: ToolPartState }) => {
  const { t } = useT();
  const [key, fallback] = statusLabelKeys[status];
  return (
    <Badge
      variant={statusVariants[status]}
      data-slot="tool-status"
      data-state-name={status}
      className="gap-1.5 rounded-full px-2 py-1 text-xs">
      {statusIcons[status]}
      {t(key, fallback)}
    </Badge>
  );
};

export const getStatusBadge = (status: ToolPartState) => <ToolStatusBadge status={status} />;

export const ToolHeader = ({ className, title, type, state, toolName, ...props }: ToolHeaderProps) => {
  const derivedName = type === 'dynamic-tool' ? toolName : type.split('-').slice(1).join('-');

  return (
    <CollapsibleTrigger
      data-slot="tool-header"
      className={cn('flex w-full items-center justify-between gap-4 p-3', className)}
      {...props}>
      <div className="flex items-center gap-2">
        <WrenchIcon />
        <span className="text-sm font-medium text-content">{title ?? derivedName}</span>
        <ToolStatusBadge status={state} />
      </div>
      <ChevronDownIcon />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    data-slot="tool-content"
    className={cn(
      'space-y-4 p-4 text-content outline-none data-[state=open]:animate-fade-in',
      className
    )}
    {...props}
  />
);

/** Stand-in for upstream's syntax-highlighted `<CodeBlock>`. */
const JsonBlock = ({ code }: { code: string }) => (
  <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-content">{code}</pre>
);

export type ToolInputProps = ComponentProps<'div'> & {
  input: ToolPart['input'];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const { t } = useT();
  return (
    <div
      data-slot="tool-input"
      className={cn('space-y-2 overflow-hidden', className)}
      {...props}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-content-muted">
        {t('aiElements.tool.parameters', 'Parameters')}
      </h4>
      <div className="rounded-md bg-surface-muted/50">
        <JsonBlock code={JSON.stringify(input, null, 2)} />
      </div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<'div'> & {
  output: ToolPart['output'];
  errorText: ToolPart['errorText'];
};

export const ToolOutput = ({ className, output, errorText, ...props }: ToolOutputProps) => {
  const { t } = useT();

  if (!(output || errorText)) {
    return null;
  }

  let rendered = <div>{output as ReactNode}</div>;

  if (typeof output === 'object' && output !== null && !isValidElement(output)) {
    rendered = <JsonBlock code={JSON.stringify(output, null, 2)} />;
  } else if (typeof output === 'string') {
    rendered = <JsonBlock code={output} />;
  }

  return (
    <div data-slot="tool-output" className={cn('space-y-2', className)} {...props}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-content-muted">
        {errorText ? t('common.error', 'Error') : t('aiElements.tool.result', 'Result')}
      </h4>
      <div
        className={cn(
          'overflow-x-auto rounded-md text-xs [&_table]:w-full',
          errorText ? 'bg-coral-500/10 text-coral-500' : 'bg-surface-muted/50 text-content'
        )}>
        {errorText && <div className="p-3">{errorText}</div>}
        {rendered}
      </div>
    </div>
  );
};

export default Tool;
