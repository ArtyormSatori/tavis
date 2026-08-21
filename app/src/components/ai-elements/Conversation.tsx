/**
 * Adapted from `conversation.tsx` in vercel/ai-elements (Apache-2.0).
 * Upstream: https://github.com/vercel/ai-elements — registry component
 * `conversation`.
 *
 * Port notes (this is an adaptation, not a copy):
 * - Upstream is built on the `use-stick-to-bottom` package: `Conversation` IS
 *   `<StickToBottom>` and `ConversationContent` IS `<StickToBottom.Content>`.
 *   That package is not a dependency here — this app already owns
 *   `hooks/useStickToBottom`, which pins the same behaviour (thread-swap snap,
 *   scroll-up disengage, ResizeObserver on streamed growth) and hands back a
 *   container ref. So `Conversation` is a plain scroll container that FORWARDS
 *   ITS REF, and the host wires that ref to the hook. The anchoring stays the
 *   host's, which matters: the hook's contract is keyed on the message array
 *   and the thread id, neither of which this component can see.
 * - `overflow-y-hidden` upstream becomes `overflow-y-auto` for the same reason:
 *   the package moves the scroll onto its own inner content element, and
 *   without it the scroll belongs to this container.
 * - `min-h-0` added. This is a `flex-1` child of a column flex parent, and
 *   without it the basis-0 child refuses to shrink below its content height,
 *   so a short window pushes the composer off-screen instead of scrolling
 *   (#3785).
 * - `role="log"` is upstream's and is kept: it is what makes a screen reader
 *   announce arriving turns.
 * - `ConversationScrollButton` is NOT ported. It reads `isAtBottom` from
 *   `useStickToBottomContext`, and this app's hook deliberately keeps its
 *   "am I stuck to the bottom" state in a ref (it is read inside a scroll
 *   handler and must not re-render the transcript on every scroll frame), so
 *   there is nothing to render the button off. Reinstating it means giving the
 *   hook a throttled piece of state first.
 * - `ConversationDownload` / `messagesToMarkdown` are NOT ported: they are
 *   typed on the `ai` SDK's `UIMessage` and there is no download affordance in
 *   this product.
 * - `ConversationEmptyState` is NOT ported: every host of the transcript passes
 *   its own `emptyContent` element, so a second empty state would be dead code.
 * - `data-slot` attributes added so tests assert structure, not class strings.
 */
import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type ConversationProps = HTMLAttributes<HTMLDivElement>;

/**
 * The transcript's scroll viewport. Attach the ref returned by
 * `useStickToBottom` to keep it pinned as turns arrive.
 */
export const Conversation = forwardRef<HTMLDivElement, ConversationProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="conversation"
      role="log"
      className={cn('relative min-h-0 flex-1 overflow-y-auto', className)}
      {...props}
    />
  )
);
Conversation.displayName = 'Conversation';

export type ConversationContentProps = HTMLAttributes<HTMLDivElement>;

/** The column of turns inside the viewport. */
export const ConversationContent = forwardRef<HTMLDivElement, ConversationContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="conversation-content"
      className={cn('flex w-full flex-col', className)}
      {...props}
    />
  )
);
ConversationContent.displayName = 'ConversationContent';
