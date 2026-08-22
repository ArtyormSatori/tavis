import { describe, expect, it, vi } from 'vitest';

import type { ThreadMessage } from '../../types/thread';
import {
  buildRuntimeMessages,
  STREAMING_TAIL_ID,
  streamingTailMessage,
  toThreadMessageLike,
} from '../assistantUiMessages';

function msg(over: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    id: 'm1',
    content: 'hello',
    type: 'text',
    extraMetadata: {},
    sender: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('toThreadMessageLike', () => {
  it('maps sender to role', () => {
    expect(toThreadMessageLike(msg({ id: 'u' })).role).toBe('user');
    expect(toThreadMessageLike(msg({ id: 'a', sender: 'agent' })).role).toBe('assistant');
  });

  it('unwraps a tool-call envelope so raw JSON never reaches the runtime', () => {
    const envelope = JSON.stringify({
      content: 'Pulling that up now.',
      tool_calls: [{ id: 'c1', name: 'memory_search', arguments: '{}' }],
    });
    const converted = toThreadMessageLike(msg({ id: 'e', sender: 'agent', content: envelope }));
    expect(converted.content).toEqual([{ type: 'text', text: 'Pulling that up now.' }]);
  });

  it('leaves ordinary prose untouched', () => {
    const m = msg({ id: 'p', sender: 'agent', content: 'just prose { not json' });
    expect(toThreadMessageLike(m).content).toEqual([
      { type: 'text', text: 'just prose { not json' },
    ]);
  });

  it('yields an empty content array for an empty message', () => {
    expect(toThreadMessageLike(msg({ id: 'blank', content: '' })).content).toEqual([]);
  });

  it('carries extraMetadata through as custom metadata', () => {
    const m = msg({ id: 'meta', extraMetadata: { requestId: 'r1' } });
    expect(toThreadMessageLike(m).metadata?.custom).toMatchObject({
      extraMetadata: { requestId: 'r1' },
    });
  });

  it('returns the identical object for the same source message', () => {
    const m = msg({ id: 'cached' });
    expect(toThreadMessageLike(m)).toBe(toThreadMessageLike(m));
  });
});

describe('streamingTailMessage', () => {
  it('is null with no stream and with an empty stream', () => {
    expect(streamingTailMessage(null)).toBeNull();
    expect(streamingTailMessage({ requestId: 'r', content: '', thinking: '' })).toBeNull();
  });

  it('is a running assistant message when tokens have landed', () => {
    const tail = streamingTailMessage({ requestId: 'r', content: 'partial', thinking: '' });
    expect(tail).toMatchObject({
      id: STREAMING_TAIL_ID,
      role: 'assistant',
      status: { type: 'running' },
      content: [{ type: 'text', text: 'partial' }],
    });
  });
});

describe('buildRuntimeMessages', () => {
  it('omits hidden messages', () => {
    const visible = msg({ id: 'v' });
    const hidden = msg({ id: 'h', extraMetadata: { hidden: true } });
    expect(buildRuntimeMessages([visible, hidden], null).map(m => m.id)).toEqual(['v']);
  });

  it('appends the live tail after the settled transcript', () => {
    const ids = buildRuntimeMessages([msg({ id: 'a' })], {
      requestId: 'r',
      content: 'tok',
      thinking: '',
    }).map(m => m.id);
    expect(ids).toEqual(['a', STREAMING_TAIL_ID]);
  });

  it('re-converts only the tail as tokens land, never the settled transcript', () => {
    // The projection-level statement of the property `ChatThreadView.renderPerf`
    // pins for the render tree: streaming must not sweep the transcript.
    const settled = Array.from({ length: 40 }, (_, i) =>
      msg({ id: `m-${i}`, sender: i % 2 ? 'agent' : 'user', content: `prose ${i}` })
    );
    const parse = vi.spyOn(JSON, 'parse');

    buildRuntimeMessages(settled, null); // warm the identity cache
    parse.mockClear();

    let text = '';
    for (let i = 0; i < 5; i += 1) {
      text += ` tok${i}`;
      buildRuntimeMessages(settled, { requestId: 'r', content: text, thinking: '' });
    }

    // Zero: settled messages are cached by identity and the tail is plain text.
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });
});
