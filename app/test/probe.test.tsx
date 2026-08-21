import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { ModalShell } from '../../src/components/ui/ModalShell';

vi.mock('../../src/lib/i18n/I18nContext', () => ({ useT: () => ({ t: (k: string) => k }) }));

describe('probe', () => {
  test('where does focus land and what is the DOM shape', () => {
    render(
      <ModalShell title="t" titleId="t" onClose={() => {}}>
        <p>Dialog content</p>
      </ModalShell>,
    );
    const dialog = screen.getByRole('dialog');
    console.log('ACTIVE:', document.activeElement?.tagName, document.activeElement?.getAttribute('aria-label'));
    console.log('FOCUS INSIDE DIALOG:', dialog.contains(document.activeElement));
    console.log('PARENT slot:', dialog.parentElement?.getAttribute('data-slot'), dialog.parentElement?.tagName);
    console.log('OVERLAY present:', !!document.querySelector('[data-slot="dialog-overlay"]'));
    expect(true).toBe(true);
  });
});
