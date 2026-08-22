/**
 * Mounts a fully mocked assistant-ui runtime for the vendored `base` demo.
 *
 * Deliberately isolated from the app's real runtime
 * (`providers/AssistantUiRuntimeProvider`, which projects OpenHuman's Redux
 * state through an external store). This one owns its own in-memory state: a
 * thread list that lives for the lifetime of the page, a canned chat model, and
 * attachment/feedback adapters that never leave the browser. Mounting it cannot
 * touch a thread, a message, or the core.
 */
import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  InMemoryThreadListAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from '@assistant-ui/react';
import debugFactory from 'debug';
import { type ReactNode, useMemo, useState } from 'react';

import { mockChatModelAdapter } from './mockChatModel';

const debug = debugFactory('openhuman:assistant-ui-demo');

/**
 * The per-thread runtime. `useRemoteThreadListRuntime` calls this once per live
 * thread, so each thread in the list gets its own message history.
 */
function useDemoThreadRuntime() {
  const adapters = useMemo(
    () => ({
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
      feedback: {
        submit: ({ type }: { type: 'positive' | 'negative' }) => {
          debug('[assistant-ui-demo] feedback=%s (mock, discarded)', type);
        },
      },
    }),
    []
  );

  return useLocalRuntime(mockChatModelAdapter, { adapters });
}

export function MockRuntimeProvider({ children }: { children: ReactNode }) {
  // One adapter instance for the page's lifetime — the options doc requires a
  // stable reference, since replacing it reloads the list and drops threads.
  const [adapter] = useState(() => new InMemoryThreadListAdapter());
  const runtime = useRemoteThreadListRuntime({ runtimeHook: useDemoThreadRuntime, adapter });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

export default MockRuntimeProvider;
