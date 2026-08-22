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
  type Unstable_SlashCommand,
  useLocalRuntime,
} from '@assistant-ui/react';
import debugFactory from 'debug';
import { useCallback, useMemo, useState } from 'react';

import { useT } from '../../../lib/i18n/I18nContext';
import { type ContextUsage, ContextWindowPill } from './composer/ContextWindowPill';
import { GoalSelector } from './composer/GoalSelector';

const debug = debugFactory('openhuman:assistant-ui');

const localAttachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

/**
 * Placeholder accounting, alongside the placeholder transcript.
 *
 * Shaped as the real thing would be — separate cached and fresh input, because
 * a cache read is billed at a fraction of a fresh one and the cost cannot be
 * derived from a single token count — so wiring this to live usage is a change
 * of source, not of shape.
 */
const MOCK_USAGE: ContextUsage = {
  used: 24_180,
  limit: 200_000,
  input: 19_400,
  cachedInput: 12_650,
  output: 4_780,
  costUsd: 0.0412,
};

/**
 * The assistant-ui `Thread`, running against an isolated offline runtime.
 *
 * This surface is still a stand-in: `Conversations` renders it instead of the
 * legacy pane (`renderAssistantUiOnly`) while the OpenHuman-specific seams are
 * reconnected one at a time. Nothing here reaches the core or the backend.
 *
 * What it shows, though, is the real shape of the surface: the mock turn
 * (thinking tokens, tool calls, dispatched subagents, streamed prose), slash
 * commands in the composer, the context-window meter and the thread goal. Each
 * of those is wired to placeholder state that a later change swaps for a live
 * source without touching the components.
 */
export function AssistantUiChat() {
  const { t } = useT();
  const [goal, setGoal] = useState<string | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const initialMessages = useMemo(() => buildSeedMessages(), []);
  const runtime = useLocalRuntime(mockChatModelAdapter, {
    adapters: { attachments: localAttachmentAdapter },
    initialMessages,
  });

  const slashCommands: readonly Unstable_SlashCommand[] = useMemo(
    () => [
      {
        id: 'clear',
        description: t('conversations.composer.command.clear'),
        // A real reset, not a cosmetic one: `reset()` with no argument drops
        // the seeded transcript too, so `/clear` leaves an actually empty
        // thread rather than restoring the sample conversation.
        execute: () => {
          debug('[assistant-ui] /clear');
          runtime.thread.reset();
        },
      },
      {
        id: 'goal',
        description: t('conversations.composer.command.goal'),
        execute: () => setGoalDialogOpen(true),
      },
    ],
    [runtime, t]
  );

  const ComposerExtras = useCallback(
    () => (
      <>
        <ContextWindowPill usage={MOCK_USAGE} />
        <GoalSelector
          goal={goal}
          onGoalChange={setGoal}
          open={goalDialogOpen}
          onOpenChange={setGoalDialogOpen}
        />
      </>
    ),
    [goal, goalDialogOpen]
  );

  const components: ThreadComponents = useMemo(
    () => ({ ToolFallback: MockToolFallback, ToolGroup: MockToolGroup, ComposerExtras }),
    [ComposerExtras]
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread components={components} slashCommands={slashCommands} />
    </AssistantRuntimeProvider>
  );
}

export default AssistantUiChat;
