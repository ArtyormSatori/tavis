import { Thread, type ThreadComponents } from '@/components/assistant-ui/thread';
import {
  buildSeedMessages,
  mockChatModelAdapter,
  MockToolFallback,
  MockToolGroup,
} from '@/lib/assistantUiMock';
import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useLocalRuntime,
} from '@assistant-ui/react';
import debugFactory from 'debug';
import { useMemo } from 'react';

const debug = debugFactory('openhuman:assistant-ui');

const localAttachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

/**
 * Routes a `task` tool call to the subagent renderer, and opens a tool group
 * that still has work in flight. Both go through `Thread`'s `components` seam
 * so the vendored component set stays unmodified and can still be re-pulled
 * from the registry.
 */
const components: ThreadComponents = { ToolFallback: MockToolFallback, ToolGroup: MockToolGroup };

/**
 * The assistant-ui `Thread`, running against an isolated offline runtime.
 *
 * This surface is still a stand-in: `Conversations` renders it instead of the
 * legacy pane (`renderAssistantUiOnly`) while the OpenHuman-specific seams are
 * reconnected one at a time. Nothing here reaches the core or the backend.
 *
 * What changed is what the stand-in *shows*. It used to answer every turn with
 * a single non-streamed sentence ("This is a local placeholder response…"),
 * which exercised almost nothing: no streaming, no reasoning, no tool calls, so
 * the parts of `Thread` that matter most for the migration were never on
 * screen. It now replays the shared mock turn — thinking tokens, tool calls
 * with streaming arguments, subagent delegations with nested steps, and
 * markdown prose — and seeds that turn on mount so the surface is populated
 * before you type.
 */
export function AssistantUiChat() {
  const initialMessages = useMemo(() => buildSeedMessages(), []);
  debug('[assistant-ui] mounting mock chat surface seeded=%d', initialMessages.length);

  const runtime = useLocalRuntime(mockChatModelAdapter, {
    adapters: { attachments: localAttachmentAdapter },
    initialMessages,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread components={components} />
    </AssistantRuntimeProvider>
  );
}

export default AssistantUiChat;
