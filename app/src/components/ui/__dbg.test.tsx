import { fireEvent, render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from './Select';

it('debug', () => {
  const onValueChange = vi.fn();
  render(
    <SelectRoot defaultValue="calm" onValueChange={onValueChange}>
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
  const opts = screen.getAllByRole('option').map(o => o.outerHTML.slice(0, 140));
  const direct = screen.getByRole('option', { name: 'Direct' });
  fireEvent.keyDown(direct, { key: 'Enter' });
  expect({ opts, calls: onValueChange.mock.calls, txt: trigger.textContent }).toEqual('SHOW');
});
