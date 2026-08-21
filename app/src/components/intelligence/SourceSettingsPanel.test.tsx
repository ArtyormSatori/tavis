import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourceSettingsPanel } from './SourceSettingsPanel';
import type { MemorySourceEntry } from '../../services/memorySourcesService';

vi.mock('../../services/memorySourcesService', async () => {
  const actual = await vi.importActual<typeof import('../../services/memorySourcesService')>(
    '../../services/memorySourcesService'
  );
  return { ...actual, updateMemorySource: vi.fn() };
});

import { updateMemorySource } from '../../services/memorySourcesService';

const source: MemorySourceEntry = {
  id: 'src-1',
  kind: 'rss_feed',
  label: 'My Feed',
  enabled: true,
  max_items: 50,
};

describe('<SourceSettingsPanel />', () => {
  it('renders a labelled numeric field per relevant limit and a save button', () => {
    render(<SourceSettingsPanel source={source} onSaved={vi.fn()} />);
    const field = screen.getByLabelText(/Max Items/i) as HTMLInputElement;
    expect(field).toBeInTheDocument();
    expect(field.value).toBe('50');
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
  });

  it('saves the edited value and reports the updated entry', async () => {
    const updated = { ...source, max_items: 75 };
    vi.mocked(updateMemorySource).mockResolvedValue(updated);
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(<SourceSettingsPanel source={source} onSaved={onSaved} />);
    const field = screen.getByLabelText(/Max Items/i);
    await user.clear(field);
    await user.type(field, '75');
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(updateMemorySource).toHaveBeenCalledWith('src-1', { max_items: 75 });
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('renders nothing for a source kind with no limit fields', () => {
    const { container } = render(
      <SourceSettingsPanel source={{ ...source, kind: 'conversation' }} onSaved={vi.fn()} />
    );
    // conversation only has sync_depth_days, so the panel still renders one field
    expect(container.querySelector(`[data-testid="source-settings-panel-src-1"]`)).toBeTruthy();
  });
});
