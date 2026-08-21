import { fireEvent, render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
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
  const a1 = document.activeElement?.outerHTML?.slice(0, 120);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
  const a2 = document.activeElement?.outerHTML?.slice(0, 120);
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
  expect({ a1, a2, txt: trigger.textContent }).toEqual('SHOW');
});
