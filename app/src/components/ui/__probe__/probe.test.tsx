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
    console.log('ACTIVE:', document.activeElement?.tagName, document.activeElement?.getAttribute('aria-label'));
    console.log('FOCUS_INSIDE:', dialog.contains(document.activeElement));
    console.log('PARENT_SLOT:', dialog.parentElement?.getAttribute('data-slot'), dialog.parentElement?.tagName);
    console.log('OVERLAY_PRESENT:', !!document.querySelector('[data-slot="dialog-overlay"]'));
    expect(true).toBe(true);
  });
});
