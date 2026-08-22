import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FeedbackFilterSelect from '../../src/components/feedback/FeedbackFilterSelect';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
];

describe('probe: radix select traversal via userEvent', () => {
  it('moves the highlight with ArrowDown and commits with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FeedbackFilterSelect value="all" options={OPTIONS} onChange={onChange} ariaLabel="Type" />);
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('bug');
  });

  it('End jumps to the last option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FeedbackFilterSelect value="all" options={OPTIONS} onChange={onChange} ariaLabel="Type" />);
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.keyboard('{End}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('idea');
  });
});
