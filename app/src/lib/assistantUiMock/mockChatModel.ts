/**
 * A mock `ChatModelAdapter` for the vendored assistant-ui `base` demo.
 *
 * Upstream the demo runs against the docs site's live inference route. This
 * repo's copy is explicitly mock-only: nothing here reaches the OpenHuman core,
 * the backend, or any provider. It replays `MOCK_SCRIPT` so every surface the
 * transcript can render has something to show without a data source — thinking
 * tokens, tool calls with streaming arguments, subagent delegations with nested
 * steps, and streamed markdown prose.
 *
 * The adapter yields **cumulative** content on every tick, which is what the
 * runtime expects: each yield replaces the assistant message's parts, so a part
 * that is still growing is re-emitted with more text rather than appended to.
 */
import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ThreadAssistantMessagePart,
} from '@assistant-ui/react';
import debugFactory from 'debug';

import { MOCK_SCRIPT, type MockSubagentResult } from './mockScript';

const debug = debugFactory('openhuman:assistant-ui-demo');

/** Delay between streamed text chunks. Slow enough to see, fast enough not to annoy. */
const CHUNK_MS = 16;
/** Pause before the first chunk, so the "working" indicator actually appears. */
const FIRST_CHUNK_MS = 350;
/** Pause while a tool call's arguments stream in before it starts running. */
const ARGS_MS = 260;

type ToolCallPart = ThreadAssistantMessagePart & { type: 'tool-call' };

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

/** Split into word-ish chunks so the stream looks like a model, not a typewriter. */
const chunk = (text: string): string[] => text.match(/\s*\S+/g) ?? [];

export const mockChatModelAdapter: ChatModelAdapter = {
  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    const { abortSignal } = options;
    const runId = options.unstable_assistantMessageId ?? 'run';
    debug('[assistant-ui-demo] run start messages=%d', options.messages.length);

    /** Everything emitted so far. Re-yielded in full on every tick. */
    const parts: ThreadAssistantMessagePart[] = [];
    const emit = (): ChatModelRunResult => ({ content: [...parts] });

    await sleep(FIRST_CHUNK_MS, abortSignal);

    for (const [index, step] of MOCK_SCRIPT.entries()) {
      switch (step.kind) {
        case 'reasoning':
        case 'text': {
          // Stream the block in, replacing the tail part each tick.
          const at = parts.length;
          let text = '';
          for (const piece of chunk(step.text)) {
            text += piece;
            parts[at] = { type: step.kind, text };
            yield emit();
            await sleep(CHUNK_MS, abortSignal);
          }
          break;
        }

        case 'tool': {
          const at = parts.length;
          const toolCallId = `${runId}-tool-${index}`;
          const argsText = JSON.stringify(step.args, null, 2);

          // Arguments first, with no result — this is the "running" state the
          // tool group renders a spinner for.
          parts[at] = {
            type: 'tool-call',
            toolCallId,
            toolName: step.toolName,
            args: step.args,
            argsText,
          };
          yield emit();
          await sleep(ARGS_MS, abortSignal);
          await sleep(step.runMs, abortSignal);

          parts[at] = { ...(parts[at] as ToolCallPart), result: step.result };
          yield emit();
          break;
        }

        case 'subagent': {
          const at = parts.length;
          const toolCallId = `${runId}-task-${index}`;
          const argsText = JSON.stringify(step.args, null, 2);
          const base = {
            type: 'tool-call' as const,
            toolCallId,
            toolName: 'task',
            args: step.args,
            argsText,
          };

          // A delegation reports progress while it runs, so its result grows a
          // nested step at a time rather than appearing whole at the end.
          const running: MockSubagentResult = {
            subagent: step.subagent,
            status: 'running',
            steps: [],
          };
          parts[at] = { ...base, result: { ...running } };
          yield emit();

          for (const nested of step.steps) {
            await sleep(step.stepMs, abortSignal);
            running.steps = [...running.steps, nested];
            parts[at] = { ...base, result: { ...running } };
            yield emit();
          }

          await sleep(step.stepMs, abortSignal);
          parts[at] = {
            ...base,
            result: {
              ...running,
              status: 'complete',
              report: step.report,
            } satisfies MockSubagentResult,
          };
          yield emit();
          break;
        }
      }
    }

    debug('[assistant-ui-demo] run complete parts=%d', parts.length);
    yield { content: [...parts], status: { type: 'complete', reason: 'stop' } };
  },
};

export default mockChatModelAdapter;
