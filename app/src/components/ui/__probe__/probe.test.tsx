import { writeFileSync } from 'node:fs';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { ModalShell } from '../ModalShell';

vi.mock('../../../lib/i18n/I18nContext', () => ({ useT: () => ({ t: (k: string) => k }) }));

const log: string[] = [];

describe('probe', () => {
  test('outside pointer + focus restore', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    log.push(`before render active=${document.activeElement?.tagName}`);

    const onClose = vi.fn();
    const { unmount } = render(
      <ModalShell title="t" titleId="t" onClose={onClose}>
        <p>Dialog content</p>
      </ModalShell>,
    );

    await new Promise((r) => setTimeout(r, 10));
    const ov = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
    log.push(`overlay pointerEvents=${ov.style.pointerEvents} bodyPE=${document.body.style.pointerEvents}`);

    fireEvent.pointerDown(ov);
    log.push(`after overlay pointerdown calls=${onClose.mock.calls.length}`);

    fireEvent.pointerDown(document.body);
    log.push(`after body pointerdown calls=${onClose.mock.calls.length}`);

    const content = screen.getByRole('dialog');
    fireEvent.pointerDown(content, { button: 0, ctrlKey: false });
    log.push(`after content pointerdown calls=${onClose.mock.calls.length}`);

    log.push(`active before unmount=${document.activeElement?.tagName}/${document.activeElement?.getAttribute('aria-label')}`);
    unmount();
    await new Promise((r) => setTimeout(r, 50));
    log.push(`active after unmount=${document.activeElement?.tagName}`);
    log.push(`trigger focused=${document.activeElement === trigger}`);

    writeFileSync('/tmp/probe-out.txt', log.join('\n'));
    expect(true).toBe(true);
  });
});
