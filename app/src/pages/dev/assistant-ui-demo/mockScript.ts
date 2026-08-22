/**
 * The canned transcript the demo replays.
 *
 * Kept apart from the adapter so the *content* (what a turn contains) and the
 * *timing* (how it arrives) can be read separately. Everything here is fiction:
 * no file is read, no search is run, no subagent exists.
 */

/**
 * JSON-safe argument payload. Tool-call parts require their `args` to be plain
 * JSON (`ReadonlyJSONObject` upstream); `Record<string, unknown>` is wider than
 * that and does not satisfy it.
 */
type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;
export type JsonObject = { readonly [key: string]: JsonValue };

export type MockSubagentStep = {
  /** Tool the subagent reached for. */
  tool: string;
  /** One-line, human-readable detail. */
  detail: string;
};

export type MockSubagentResult = {
  subagent: string;
  status: 'running' | 'complete';
  steps: MockSubagentStep[];
  report?: string;
};

/** A tool call in the script, with the result it eventually returns. */
export type MockToolStep = {
  kind: 'tool';
  toolName: string;
  args: JsonObject;
  /** Milliseconds the call "runs" before its result lands. */
  runMs: number;
  result: unknown;
};

/** A subagent delegation, whose nested steps stream in one at a time. */
export type MockSubagentCall = {
  kind: 'subagent';
  subagent: string;
  args: JsonObject;
  steps: MockSubagentStep[];
  /** Milliseconds between nested steps. */
  stepMs: number;
  report: string;
};

/** Streamed thinking tokens. */
export type MockReasoning = { kind: 'reasoning'; text: string };

/** Streamed assistant prose (markdown). */
export type MockText = { kind: 'text'; text: string };

export type MockStep = MockReasoning | MockToolStep | MockSubagentCall | MockText;

const INTRO = `Looking at this now — I'll search the codebase first, then hand the deeper reads to a couple of subagents.`;

const ANSWER = `Here is what this demo is showing you.

This is the upstream [assistant-ui \`base\` example](https://www.assistant-ui.com/demos/base), vendored into the app and driven by a **mock** adapter. Nothing you type leaves the browser — every step above was scripted.

What the transcript exercised, in order:

1. **thinking tokens** — two reasoning blocks, streamed a word at a time and grouped into the chain-of-thought
2. **tool calls** — \`web_search\` and \`read_file\`, each showing streaming arguments before their result lands
3. **subagent calls** — two \`task\` delegations, each with its own nested tool steps and a final report
4. **streamed prose** — this answer, including a list and a code block

\`\`\`ts
// the whole turn is a script, not a model
const runtime = useLocalRuntime(mockChatModelAdapter);
\`\`\`

Send another message to replay it.`;

export const MOCK_SCRIPT: readonly MockStep[] = [
  {
    kind: 'reasoning',
    text: `The user is exercising the demo, so there is no real question to answer. What I can do is make the turn cover every part the transcript knows how to render, in the order a real turn would produce them.`,
  },
  { kind: 'text', text: INTRO },
  {
    kind: 'tool',
    toolName: 'web_search',
    args: { query: 'assistant-ui base example thread primitives', max_results: 5 },
    runMs: 900,
    result: {
      results: [
        { title: 'assistant-ui — base demo', url: 'https://www.assistant-ui.com/demos/base' },
        { title: 'Thread primitives', url: 'https://www.assistant-ui.com/docs/ui/Thread' },
      ],
      took_ms: 812,
    },
  },
  {
    kind: 'reasoning',
    text: `The docs confirm the part types the renderer groups: reasoning, tool calls, and text. Two nested delegations will show what a subagent looks like next to an ordinary call.`,
  },
  {
    kind: 'tool',
    toolName: 'read_file',
    args: { path: 'app/src/pages/dev/assistant-ui-demo/BaseDemo.tsx', offset: 592, limit: 40 },
    runMs: 600,
    result: {
      path: 'app/src/pages/dev/assistant-ui-demo/BaseDemo.tsx',
      lines: 40,
      excerpt: '<MessagePrimitive.GroupedParts groupBy={groupPartByType({ … })}>',
    },
  },
  {
    kind: 'subagent',
    subagent: 'code-explorer',
    args: {
      subagent_type: 'code-explorer',
      description: 'Map the vendored component set',
      prompt: 'List every component under components/assistant-ui and what each one renders.',
    },
    stepMs: 620,
    steps: [
      { tool: 'glob', detail: 'app/src/components/assistant-ui/**/*.tsx — 19 files' },
      { tool: 'read_file', detail: 'thread.tsx — viewport, composer, action bar' },
      { tool: 'read_file', detail: 'tool-group.tsx — collapsible group of tool calls' },
      { tool: 'grep', detail: 'ToolCallMessagePartComponent — 3 matches' },
    ],
    report:
      'Nineteen components. `thread.tsx` owns the viewport and composer; `tool-group.tsx` collapses consecutive tool calls; `reasoning.tsx` renders the thinking block. All of them read shadcn semantic tokens, so they follow the app theme.',
  },
  {
    kind: 'subagent',
    subagent: 'test-runner',
    args: {
      subagent_type: 'test-runner',
      description: 'Check the demo route typechecks',
      prompt: 'Run the typecheck and report anything that fails in the demo directory.',
    },
    stepMs: 520,
    steps: [
      { tool: 'shell', detail: 'pnpm typecheck' },
      { tool: 'shell', detail: 'eslint src/pages/dev/assistant-ui-demo' },
    ],
    report: 'Typecheck clean, no lint errors in the demo directory.',
  },
  {
    kind: 'reasoning',
    text: `Both delegations came back clean. Time to summarise what the turn actually demonstrated.`,
  },
  { kind: 'text', text: ANSWER },
];
