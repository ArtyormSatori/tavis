import { writeFileSync } from 'node:fs';

import { render } from '@testing-library/react';
import { Dialog } from 'radix-ui';
import { describe, expect, test } from 'vitest';

const log: string[] = [];

describe('raw radix focus restore', () => {
  test('restores focus when the whole tree is unmounted', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>t</Dialog.Title>
            <button>inner</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    await new Promise((r) => setTimeout(r, 10));
    log.push(`active while open = ${document.activeElement?.textContent}`);

    unmount();
    await new Promise((r) => setTimeout(r, 50));
    log.push(`restored to trigger = ${document.activeElement === trigger}`);
    log.push(`active after unmount = ${document.activeElement?.tagName}`);

    writeFileSync('/tmp/probe-out.txt', log.join('\n'));
    expect(true).toBe(true);
  });
});
