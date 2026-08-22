import { AssistantRuntimeProvider, useAui, useAuiState, useExternalStoreRuntime, type ThreadMessageLike } from '@assistant-ui/react';
import { render } from '@testing-library/react';
import { describe, it } from 'vitest';

const messages: ThreadMessageLike[] = [
  { role: 'user', content: [{ type: 'text', text: 'hello' }] },
];

function Probe() {
  const aui = useAui();
  const state = useAuiState(({ thread }) => thread);
  console.log('AUI KEYS', Object.keys(aui));
  console.log('THREAD KEYS', state ? Object.keys(state) : state);
  console.log('MSG COUNT', (state as any)?.messages?.length);
  console.log('THREAD CLIENT KEYS', (aui as any).thread ? Object.keys((aui as any).thread) : 'none');
  return <div />;
}

function H() {
  const runtime = useExternalStoreRuntime({ messages, isRunning: false, convertMessage: (m: ThreadMessageLike) => m, onNew: async () => {} });
  return <AssistantRuntimeProvider runtime={runtime}><Probe /></AssistantRuntimeProvider>;
}

describe('probe', () => { it('probes', () => { render(<H />); }); });
