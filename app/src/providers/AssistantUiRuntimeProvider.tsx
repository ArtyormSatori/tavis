import { AssistantRuntimeProvider, useExternalStoreRuntime } from '@assistant-ui/react';
import type { ReactNode } from 'react';

import { useAppSelector } from '../store/hooks';
import { useOpenHumanExternalStore } from './useOpenHumanExternalStore';

/**
 * Mounts assistant-ui's runtime over the existing Redux state.
 *
 * This is additive by design. Nothing below it is required to consume the
 * runtime — the transcript, composer and tool timeline still render from Redux
 * exactly as before — so mounting it cannot regress a surface that ignores it.
 * What it provides is the runtime *context*: any component under it may use
 * assistant-ui's hooks and primitives, and the two views of the conversation
 * are guaranteed to agree because both read the same store.
 *
 * The runtime is scoped to the selected thread. Switching threads swaps the
 * message list, which is the behaviour `useExternalStoreRuntime` expects.
 */
export function AssistantUiRuntimeProvider({ children }: { children: ReactNode }) {
  const threadId = useAppSelector(state => state.thread.selectedThreadId);
  const adapter = useOpenHumanExternalStore(threadId);
  const runtime = useExternalStoreRuntime(adapter);
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

export default AssistantUiRuntimeProvider;
