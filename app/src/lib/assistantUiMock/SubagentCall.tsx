/**
 * Renders a `task` tool call — a delegation to a subagent — as its own block
 * rather than through the generic `ToolFallback`.
 *
 * A delegation is not shaped like an ordinary call: it has an agent identity, a
 * running list of nested steps it took, and a written report at the end. Folding
 * that into the fallback's args/result JSON pair loses the thing worth seeing,
 * which is the nested trace arriving step by step while the parent turn waits.
 *
 * Styling stays on the shadcn semantic tokens the rest of the vendored set
 * uses, so this follows the app theme in both modes.
 */
import { cn } from '@/components/assistant-ui/lib/utils';
import { ToolFallback } from '@/components/assistant-ui/tool-fallback';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/assistant-ui/ui/collapsible';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CheckIcon, ChevronDownIcon, Loader2Icon, WorkflowIcon } from 'lucide-react';

import type { MockSubagentResult } from './mockScript';

/** Narrow the untyped tool result to the shape this demo's script produces. */
function asSubagentResult(result: unknown): MockSubagentResult | undefined {
  if (typeof result !== 'object' || result === null) return undefined;
  const candidate = result as Partial<MockSubagentResult>;
  if (typeof candidate.subagent !== 'string' || !Array.isArray(candidate.steps)) return undefined;
  return candidate as MockSubagentResult;
}

export const SubagentCall: ToolCallMessagePartComponent = ({ args, result }) => {
  const parsed = asSubagentResult(result);
  const running = parsed?.status !== 'complete';
  const description = (args as { description?: string } | undefined)?.description;
  const name =
    parsed?.subagent ??
    (args as { subagent_type?: string } | undefined)?.subagent_type ??
    'subagent';

  return (
    <Collapsible
      data-slot="aui_subagent-call"
      defaultOpen
      className="aui-subagent-call border-border/60 dark:border-muted-foreground/15 my-2 rounded-xl border">
      <CollapsibleTrigger className="group/subagent text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors">
        <WorkflowIcon className="size-4 shrink-0" />
        <span className="text-start leading-none">
          Delegated to <b className="text-foreground">{name}</b>
        </span>
        {running ? (
          <Loader2Icon className="size-3.5 shrink-0 animate-spin [animation-duration:0.6s]" />
        ) : (
          <CheckIcon className="text-muted-foreground size-3.5 shrink-0" />
        )}
        <ChevronDownIcon className="ml-auto size-4 shrink-0 -rotate-90 transition-transform group-data-[state=open]/subagent:rotate-0" />
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3">
        {description && <p className="text-muted-foreground mb-2 text-xs">{description}</p>}

        <ol className="flex flex-col gap-1.5">
          {parsed?.steps.map((step, i) => (
            <li
              key={`${step.tool}-${i}`}
              className="text-muted-foreground flex items-baseline gap-2 text-xs">
              <span className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[11px]">
                {step.tool}
              </span>
              <span className="min-w-0 break-words">{step.detail}</span>
            </li>
          ))}
        </ol>

        {parsed?.report && (
          <p
            className={cn(
              'text-foreground border-border/60 dark:border-muted-foreground/15 mt-3 border-t pt-3 text-sm leading-relaxed'
            )}>
            {parsed.report}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SubagentCall;

/**
 * Drop-in for `Thread`'s `components.ToolFallback` seam: routes a `task` call
 * to {@link SubagentCall} and leaves every other tool to the stock fallback.
 *
 * Using the seam rather than editing `thread.tsx` keeps the vendored component
 * set unmodified, so it can still be re-pulled from the registry.
 */
export const MockToolFallback: ToolCallMessagePartComponent = props =>
  props.toolName === 'task' ? <SubagentCall {...props} /> : <ToolFallback {...props} />;
