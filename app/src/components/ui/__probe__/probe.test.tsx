import { writeFileSync } from 'node:fs';

import { fireEvent, render } from '@testing-library/react';
import { Dialog } from 'radix-ui';
import { describe, expect, test, vi } from 'vitest';

const log: string[] = [];

describe('raw radix dialog', () => {
  test('outside pointer dismissal in jsdom', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay data-testid="ov" />
          <Dialog.Content>
            <Dialog.Title>t</Dialog.Title>
            <p>body</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    await new Promise((r) => setTimeout(r, 10));

    const ov = document.querySelector('[data-testid="ov"]') as HTMLElement;
    fireEvent.pointerDown(ov);
    log.push(`raw: after overlay pointerdown = ${onOpenChange.mock.calls.length}`);

    fireEvent.pointerDown(ov);
    fireEvent.click(ov);
    log.push(`raw: after overlay pointerdown+click = ${onOpenChange.mock.calls.length}`);

    fireEvent.keyDown(document, { key: 'Escape' });
    log.push(`raw: after escape = ${onOpenChange.mock.calls.length}`);
    log.push(`PointerEvent is polyfilled: ${globalThis.PointerEvent?.name}`);

    writeFileSync('/tmp/probe-out.txt', log.join('\n'));
    expect(true).toBe(true);
  });
});
