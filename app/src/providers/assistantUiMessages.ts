import type { ThreadMessageLike } from '@assistant-ui/react';

import { unwrapToolCallEnvelope } from '../lib/chat/toolCallEnvelope';
import type { StreamingAssistantState } from '../store/chatRuntimeSlice';
import type { ThreadMessage } from '../types/thread';

/**
 * Redux -> assistant-ui message mapping.
 *
 * assistant-ui is adopted as a *runtime* (semantics + API), never as a store:
 * `chatRuntimeSlice` and `threadSlice` remain the single source of truth for
 * messages, streaming, tool state, queueing and persistence. Everything here is
 * a pure, read-only projection of that state onto the shape the runtime wants.
 * Nothing in this module writes.
 *
 * The one property that matters for performance is stated as a test, not a
 * comment: converting the transcript while a token streams must not re-convert
 * the settled messages above the live tail. `ChatThreadView.renderPerf.test.tsx`
 * pins the equivalent property for the render tree; `assistantUiMessages.test.ts`
 * pins it for this projection.
 */

/** Cache keyed on the source object, so a settled message converts exactly once. */
const conversionCache = new WeakMap<ThreadMessage, ThreadMessageLike>();

/** Synthetic id for the live streaming tail. Stable so React reconciles it. */
export const STREAMING_TAIL_ID = '__openhuman_streaming_tail__';

/**
 * Convert one persisted message.
 *
 * Agent content is passed through `unwrapToolCallEnvelope` for the same reason
 * the transcript renderer does it: a `{content, tool_calls}` provider envelope
 * must never reach a rendered surface as raw JSON. Tool *activity* is not
 * projected as assistant-ui tool-call parts — it lives in the far richer
 * `toolTimelineByThread` projection that `ToolTimelineBlock` renders, and
 * duplicating it here would paint every tool twice.
 */
export function toThreadMessageLike(msg: ThreadMessage): ThreadMessageLike {
  const cached = conversionCache.get(msg);
  if (cached !== undefined) return cached;

  const text =
    msg.sender === 'agent' ? unwrapToolCallEnvelope(msg.content ?? '').text : (msg.content ?? '');

  const converted: ThreadMessageLike = {
    id: msg.id,
    role: msg.sender === 'agent' ? 'assistant' : 'user',
    content: text.length > 0 ? [{ type: 'text', text }] : [],
    createdAt: new Date(msg.createdAt),
    metadata: { custom: { extraMetadata: msg.extraMetadata ?? {}, sourceType: msg.type } },
  };

  conversionCache.set(msg, converted);
  return converted;
}

/**
 * The live tail as a running assistant message.
 *
 * The tail is deliberately NOT part of `thread.messagesByThreadId` — Redux keeps
 * the settled transcript and the in-flight preview in separate slices, which is
 * exactly what keeps settled message identities stable while tokens land. Here
 * that separation is re-joined for the runtime's benefit: one fresh object per
 * token, and only that one object is ever re-converted.
 */
export function streamingTailMessage(
  streaming: StreamingAssistantState | null
): ThreadMessageLike | null {
  if (!streaming) return null;
  const text = streaming.content ?? '';
  if (text.length === 0) return null;
  return {
    id: STREAMING_TAIL_ID,
    role: 'assistant',
    content: [{ type: 'text', text }],
    status: { type: 'running' },
    metadata: { custom: { requestId: streaming.requestId, streaming: true } },
  };
}

/**
 * The full thread as assistant-ui sees it: settled transcript, then the live
 * tail when one is in flight.
 *
 * Hidden messages are filtered the same way the transcript filters them, so the
 * runtime's view of the thread and the rendered view cannot disagree about what
 * the conversation contains.
 */
export function buildRuntimeMessages(
  messages: readonly ThreadMessage[],
  streaming: StreamingAssistantState | null
): ThreadMessageLike[] {
  const out: ThreadMessageLike[] = [];
  for (const msg of messages) {
    if (msg.extraMetadata?.hidden) continue;
    out.push(toThreadMessageLike(msg));
  }
  const tail = streamingTailMessage(streaming);
  if (tail) out.push(tail);
  return out;
}
