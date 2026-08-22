import { AssistantRuntimeProvider, useAui, useAuiState, useExternalStoreRuntime, type ThreadMessageLike } from '@assistant-ui/react';
import { render } from '@testing-library/react';
import { describe, it } from 'vitest';
import * as nodeFs from 'node:fs';
(globalThis as any).__probeFs = nodeFs;

const messages: ThreadMessageLike[] = [
  { role: 'user', content: [{ type: 'text', text: 'hello' }] },
];

function Probe() {
  const aui = useAui();
  const state = useAuiState(({ thread }) => thread);
  const fs = (globalThis as any).__probeFs;
  fs.writeFileSync('/tmp/probe-out.txt', JSON.stringify({
    auiKeys: Object.keys(aui),
    threadStateKeys: state ? Object.keys(state) : null,
    msgCount: (state as any)?.messages?.length,
    threadClientKeys: (aui as any).thread ? Object.keys((aui as any).thread) : 'none',
    firstMsg: (state as any)?.messages?.[0],
  }, null, 1));
  return <div />;
}

function H() {
  const runtime = useExternalStoreRuntime({ messages, isRunning: false, convertMessage: (m: ThreadMessageLike) => m, onNew: async () => {} });
  return <AssistantRuntimeProvider runtime={runtime}><Probe /></AssistantRuntimeProvider>;
}

describe('probe', () => { it('probes', () => { render(<H />); }); });
