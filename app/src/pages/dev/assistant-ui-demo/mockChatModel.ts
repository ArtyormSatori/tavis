/**
 * A mock `ChatModelAdapter` for the vendored assistant-ui `base` demo.
 *
 * Upstream the demo runs against the docs site's live inference route. This
 * repo's copy is explicitly mock-only: nothing here reaches the OpenHuman core,
 * the backend, or any provider. The adapter replays a canned script so every
 * surface the demo renders — reasoning, tool calls, markdown, timing, the
 * running/cancel states — has something to show without a data source.
 */
import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ThreadAssistantMessagePart,
} from '@assistant-ui/react';
import debugFactory from 'debug';

const debug = debugFactory('openhuman:assistant-ui-demo');

/** Delay between streamed chunks. Slow enough to see, fast enough not to annoy. */
const CHUNK_MS = 18;
/** Pause before the first chunk, so the "working" indicator actually appears. */
const FIRST_CHUNK_MS = 350;

const REASONING = [
  'The user is exercising the demo, so there is no real question to answer.',
  'I will show what the transcript can render: a reasoning block, a tool call with a',
  'result, and a markdown answer with a list and a code block.',
].join(' ');

const ANSWER = `Here is what this demo is showing you.

This is the upstream [assistant-ui \`base\` example](https://www.assistant-ui.com/demos/base), vendored into the app and wired to a **mock** adapter. Nothing you type leaves the browser.

- the composer supports \`@\` mentions and \`/\` commands
- attachments, branch switching and message editing all work against the in-memory store
- the thread list on the left is an \`InMemoryThreadListAdapter\`

\`\`\`ts
// this reply is a canned script, not a model
const runtime = useLocalRuntime(mockChatModelAdapter);
\`\`\`

Send another message to replay it.`;

const WEATHER_ARGS = { location: 'San Francisco, CA', unit: 'celsius' } as const;
const WEATHER_RESULT = {
  location: 'San Francisco, CA',
  temperature: 17,
  unit: 'celsius',
  conditions: 'Foggy, clearing by afternoon',
} as const;

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

/**
 * Whether this turn should include a tool call. Keyed off the message text so
 * the demo is steerable — ask about the weather and you get the tool timeline.
 */
const wantsTool = (options: ChatModelRunOptions): boolean => {
  const last = options.messages[options.messages.length - 1];
  const text = last?.content
    .map(part => (part.type === 'text' ? part.text : ''))
    .join(' ')
    .toLowerCase();
  return text?.includes('weather') ?? false;
};

export const mockChatModelAdapter: ChatModelAdapter = {
  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    const { abortSignal } = options;
    const withTool = wantsTool(options);
    debug('[assistant-ui-demo] run start messages=%d tool=%s', options.messages.length, withTool);

    await sleep(FIRST_CHUNK_MS, abortSignal);

    // 1. Reasoning, streamed.
    let reasoning = '';
    for (const piece of chunk(REASONING)) {
      reasoning += piece;
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await sleep(CHUNK_MS, abortSignal);
    }
    const reasoningPart: ThreadAssistantMessagePart = { type: 'reasoning', text: reasoning };

    // 2. Optionally a tool call: args first (running), then the result.
    const parts: ThreadAssistantMessagePart[] = [reasoningPart];
    if (withTool) {
      parts.push({
        type: 'tool-call',
        toolCallId: `demo-${options.unstable_assistantMessageId ?? 'call'}`,
        toolName: 'get_weather',
        args: WEATHER_ARGS,
        argsText: JSON.stringify(WEATHER_ARGS, null, 2),
      });
      yield { content: parts };
      await sleep(700, abortSignal);
      parts[parts.length - 1] = {
        ...(parts[parts.length - 1] as ThreadAssistantMessagePart & { type: 'tool-call' }),
        result: WEATHER_RESULT,
      };
      yield { content: parts };
      await sleep(CHUNK_MS, abortSignal);
    }

    // 3. The answer, streamed.
    let answer = '';
    for (const piece of chunk(ANSWER)) {
      answer += piece;
      yield { content: [...parts, { type: 'text', text: answer }] };
      await sleep(CHUNK_MS, abortSignal);
    }

    debug('[assistant-ui-demo] run complete chars=%d', answer.length);
    yield {
      content: [...parts, { type: 'text', text: answer }],
      status: { type: 'complete', reason: 'stop' },
    };
  },
};

export default mockChatModelAdapter;
