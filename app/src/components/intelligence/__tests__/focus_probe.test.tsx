import { render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogCancel,
} from '../../ui/AlertDialog';

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button id="trigger" onClick={() => setOpen(true)}>open</button>
      <AlertDialogRoot open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>hi</AlertDialogTitle>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialogRoot>
    </div>
  );
}

describe('focus probe', () => {
  it('restores focus', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender, getByText } = render(<Harness />);
    console.log('after mount', document.activeElement?.tagName, document.activeElement?.textContent);
    getByText('Cancel').click();
    await vi.waitFor(() => {
      console.log('polling', document.activeElement?.tagName, document.activeElement === trigger);
      expect(document.activeElement).toBe(trigger);
    }, { timeout: 2000 });
  });
});
