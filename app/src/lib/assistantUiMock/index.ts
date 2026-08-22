/**
 * A scripted, offline assistant-ui turn.
 *
 * Two surfaces render assistant-ui against a stand-in model while the real
 * OpenHuman seams are reconnected one at a time: the main chat pane
 * (`features/conversations/components/AssistantUiChat`) and the vendored
 * upstream demo (`pages/dev/assistant-ui-demo`). Both need the same thing —
 * a turn that exercises every part the transcript can draw — so the script,
 * the adapter that streams it, and the subagent renderer live here rather
 * than inside either consumer.
 *
 * Nothing in here reaches the core, the backend, or any provider.
 */
export { mockChatModelAdapter } from './mockChatModel';
export { buildSeedMessages, MOCK_SCRIPT, SEED_PROMPT } from './mockScript';
export type { MockStep, MockSubagentResult, MockSubagentStep } from './mockScript';
export { MockToolFallback, SubagentCall } from './SubagentCall';
