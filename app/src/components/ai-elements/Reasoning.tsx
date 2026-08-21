/**
 * Reasoning (the "reasoning-lite" port) — adapted from `reasoning.tsx` in
 * https://github.com/vercel/ai-elements (Apache License 2.0).
 *
 * OMISSION, deliberate: upstream's `ReasoningContent` renders its children with
 * `Streamdown` plus the `@streamdown/{cjk,code,math,mermaid}` plugins. That
 * markdown renderer is NOT a dependency of this app and is NOT being added, so
 * only the collapsible reasoning shell is ported here and `ReasoningContent`
 * renders its children as-is. Its `children` is therefore `ReactNode`, not the
 * `string` upstream requires — a caller that wants markdown renders it itself
 * and passes the result in. Upstream's `<Shimmer>` (also markdown-adjacent, and
 * not present here) is replaced by a plain `animate-pulse` span.
 *
 * Other changes made in this port:
 * - `@/registry/default/ui/collapsible` -> OpenHuman's Collapsible primitives
 *   from `../ui`; `@/lib/utils` cn -> `../../lib/cn`.
 * - `@radix-ui/react-use-controllable-state` -> the local
 *   `./useControllableState` (Radix comes through the unified `radix-ui`
 *   package here, which does not re-export that hook).
 * - lucide `BrainIcon` / `ChevronDownIcon` -> inline SVGs in `./icons`.
 * - shadcn semantic colours -> OpenHuman design tokens; `tailwindcss-animate`
 *   enter/exit utilities dropped in favour of the `animate-fade-in` already
 *   baked into `CollapsibleContent`. Tailwind v3, so `size-4` -> `h-4 w-4`.
 * - user-facing strings go through `useT()`.
 * - `data-slot` attributes added, per this repo's component contract.
 *
 * The auto-open-while-streaming / auto-close-after-streaming behaviour and the
 * duration accounting are upstream's, unchanged.
 */
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

import { cn } from '../../lib/cn';
import { useT } from '../../lib/i18n/I18nContext';
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from '../ui';

import { BrainIcon, ChevronDownIcon } from './icons';
import { useControllableState } from './useControllableState';

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error('Reasoning components must be used within Reasoning');
  }
  return context;
};

export type ReasoningProps = Omit<
  ComponentProps<typeof CollapsibleRoot>,
  'open' | 'defaultOpen' | 'onOpenChange'
> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const resolvedDefaultOpen = defaultOpen ?? isStreaming;

    /**
     * Sticky record of a manual open/close, mirroring `userOverrideOpen` in
     * `features/conversations/components/ToolTimelineBlock.tsx`.
     *
     * WHY THIS EXISTS (#4942): the auto-open effect below re-runs whenever
     * `isOpen` changes. Guarding it only on the `defaultOpen === false` PROP
     * meant a user who collapsed the panel mid-stream was forced straight back
     * open on the next commit — the panel could not be closed while streaming,
     * which is the #4942 report inverted. A prop cannot record a runtime
     * interaction; this state can.
     *
     * `null` = the user has not touched it, so the automatic rules apply.
     */
    const [userOverrideOpen, setUserOverrideOpen] = useState<boolean | null>(null);

    const [isOpen, setIsOpen] = useControllableState<boolean>({
      defaultProp: resolvedDefaultOpen,
      onChange: onOpenChange,
      prop: open,
    });
    const [duration, setDuration] = useControllableState<number | undefined>({
      defaultProp: undefined,
      prop: durationProp,
    });

    const hasEverStreamedRef = useRef(isStreaming);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const startTimeRef = useRef<number | null>(null);

    // Track when streaming starts and compute duration
    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true;
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now();
        }
      } else if (startTimeRef.current !== null) {
        setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S));
        startTimeRef.current = null;
      }
    }, [isStreaming, setDuration]);

    // Auto-open when streaming starts, unless the caller opted out via
    // `defaultOpen={false}` or the user has manually toggled (#4942).
    useEffect(() => {
      if (isStreaming && !isOpen && userOverrideOpen === null && defaultOpen !== false) {
        setIsOpen(true);
      }
    }, [isStreaming, isOpen, setIsOpen, userOverrideOpen, defaultOpen]);

    // Auto-close when streaming ends (once only, and only if it ever streamed)
    useEffect(() => {
      if (
        hasEverStreamedRef.current &&
        !isStreaming &&
        isOpen &&
        !hasAutoClosed &&
        userOverrideOpen === null
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, setIsOpen, hasAutoClosed, userOverrideOpen]);

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        // Record the manual choice so neither auto rule can undo it (#4942).
        setUserOverrideOpen(newOpen);
        setIsOpen(newOpen);
      },
      [setIsOpen]
    );

    const contextValue = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen }),
      [duration, isOpen, isStreaming, setIsOpen]
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <CollapsibleRoot
          data-slot="reasoning"
          className={cn('not-prose mb-4', className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}>
          {children}
        </CollapsibleRoot>
      </ReasoningContext.Provider>
    );
  }
);

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
};

export const ReasoningTrigger = memo(
  ({ className, children, getThinkingMessage, ...props }: ReasoningTriggerProps) => {
    const { t } = useT();
    const { isStreaming, isOpen, duration } = useReasoning();

    const defaultGetThinkingMessage = useCallback(
      (streaming: boolean, seconds?: number): ReactNode => {
        if (streaming || seconds === 0) {
          // Upstream uses its <Shimmer> component; this app has no equivalent.
          return <span className="animate-pulse">{t('chat.thinking')}</span>;
        }
        if (seconds === undefined) {
          return <p>{t('chat.reasoning.thoughtForAFewSeconds', 'Thought for a few seconds')}</p>;
        }
        return (
          <p>
            {t('chat.reasoning.thoughtForSeconds', 'Thought for {n} seconds').replace(
              '{n}',
              String(seconds)
            )}
          </p>
        );
      },
      [t]
    );

    const renderMessage = getThinkingMessage ?? defaultGetThinkingMessage;

    return (
      <CollapsibleTrigger
        data-slot="reasoning-trigger"
        className={cn(
          'flex w-full items-center justify-start gap-2 px-0 py-0 text-sm font-normal',
          'text-content-muted transition-colors hover:bg-transparent hover:text-content',
          className
        )}
        {...props}>
        {children ?? (
          <>
            <BrainIcon className="h-4 w-4" />
            {renderMessage(isStreaming, duration)}
            <ChevronDownIcon
              className={cn('h-4 w-4 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent>;

export const ReasoningContent = memo(({ className, children, ...props }: ReasoningContentProps) => (
  <CollapsibleContent
    data-slot="reasoning-content"
    className={cn(
      'mt-4 whitespace-pre-wrap px-0 pb-0 text-sm text-content-muted outline-none',
      className
    )}
    {...props}>
    {children}
  </CollapsibleContent>
));

Reasoning.displayName = 'Reasoning';
ReasoningTrigger.displayName = 'ReasoningTrigger';
ReasoningContent.displayName = 'ReasoningContent';
