import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from './Select';

it('debug', () => {
  render(
    <SelectRoot defaultValue="calm">
      <SelectTrigger data-testid="t" aria-label="Tone"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="calm">Calm</SelectItem>
        <SelectItem value="direct">Direct</SelectItem>
      </SelectContent>
    </SelectRoot>
  );
  const trigger = screen.getByTestId('t');
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  // eslint-disable-next-line no-console
  console.log('ACTIVE', document.activeElement?.outerHTML?.slice(0, 200));
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
  console.log('ACTIVE2', document.activeElement?.outerHTML?.slice(0, 200));
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
  console.log('TRIGGER', trigger.textContent);
});
