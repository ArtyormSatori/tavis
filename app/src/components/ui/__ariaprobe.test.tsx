import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogRoot, DialogContent, DialogTitle } from './Dialog';

describe('aria-modal probe', () => {
  it('reports what Radix actually stamps', () => {
    render(
      <DialogRoot open>
        <DialogContent>
          <DialogTitle>probe</DialogTitle>
        </DialogContent>
      </DialogRoot>,
    );
    const el = screen.getByRole('dialog');
    // eslint-disable-next-line no-console
    console.log('PROBE aria-modal =', JSON.stringify(el.getAttribute('aria-modal')));
    expect({ariaModal: el.getAttribute('aria-modal'), role: el.getAttribute('role')}).toBe('FORCE_FAIL_TO_PRINT');
  });
});
