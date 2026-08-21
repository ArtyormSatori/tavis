import { writeFileSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { ModalShell } from '../ModalShell';

vi.mock('../../../lib/i18n/I18nContext', () => ({ useT: () => ({ t: (k: string) => k }) }));

describe('probe', () => {
  test('shape', () => {
    render(
      <ModalShell title="t" titleId="t" onClose={() => {}}>
        <p>Dialog content</p>
      </ModalShell>,
    );
    const dialog = screen.getByRole('dialog');
    writeFileSync(
      '/tmp/probe-out.txt',
      [
        `ACTIVE=${document.activeElement?.tagName}/${document.activeElement?.getAttribute('aria-label')}`,
        `FOCUS_INSIDE=${dialog.contains(document.activeElement)}`,
        `PARENT_SLOT=${dialog.parentElement?.getAttribute('data-slot')}/${dialog.parentElement?.tagName}`,
        `OVERLAY_PRESENT=${!!document.querySelector('[data-slot="dialog-overlay"]')}`,
        `BODY_HTML=${document.body.innerHTML.slice(0, 400)}`,
      ].join('\n'),
    );
    expect(true).toBe(true);
  });
});
