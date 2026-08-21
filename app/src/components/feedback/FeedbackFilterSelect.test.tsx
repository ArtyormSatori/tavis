import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FeedbackFilterSelect from './FeedbackFilterSelect';

const OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
];

describe('<FeedbackFilterSelect />', () => {
  it('shows the current selection on the trigger', () => {
    render(
      <FeedbackFilterSelect
        value="feature"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="Type"
      />
    );
    // Radix Select's trigger is a real <button> but sets an explicit
    // role="combobox" (it manages its own popup rather than deferring to the
    // OS), so the accessible role is combobox, not button.
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Feature');
  });

  it('opens the menu and selects an option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FeedbackFilterSelect value="all" options={OPTIONS} onChange={onChange} ariaLabel="Type" />
    );

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Bug' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Bug' }));
    expect(onChange).toHaveBeenCalledWith('bug');
    // Menu closes after selection.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape without changing the value', () => {
    const onChange = vi.fn();
    render(
      <FeedbackFilterSelect value="all" options={OPTIONS} onChange={onChange} ariaLabel="Type" />
    );
    const trigger = screen.getByRole('combobox', { name: 'Type' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens on ArrowDown and marks the current selection with aria-selected', () => {
    render(
      <FeedbackFilterSelect
        value="feature"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="Type"
      />
    );
    const trigger = screen.getByRole('combobox', { name: 'Type' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const selected = screen.getByRole('option', { name: 'Feature' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Bug' })).toHaveAttribute('aria-selected', 'false');
  });

  it('commits the highlighted option with Enter', () => {
    const onChange = vi.fn();
    render(
      <FeedbackFilterSelect value="all" options={OPTIONS} onChange={onChange} ariaLabel="Type" />
    );
    const trigger = screen.getByRole('combobox', { name: 'Type' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });

    // Enter on the option is the commit path Radix wires to SELECTION_KEYS
    // (mirrors the coverage already asserted in ui/Select.test.tsx for the
    // shared primitive; kept here to pin that this call site wires onChange).
    fireEvent.keyDown(screen.getByRole('option', { name: 'Bug' }), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('bug');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
