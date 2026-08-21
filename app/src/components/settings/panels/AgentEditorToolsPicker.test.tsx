/**
 * AgentEditorToolsPicker — chip row + "Add tools" modal for the agent editor's
 * tool allowlist. Covers the "Allow all" control, now a `Toggle` primitive.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { agentRegistryApi } from '../../../services/api/agentRegistryApi';
import { AgentEditorToolsField } from './AgentEditorToolsPicker';

vi.mock('../../../services/api/agentRegistryApi', () => ({
  agentRegistryApi: {
    availableTools: vi.fn(),
  },
}));

const mockAvailableTools = vi.mocked(agentRegistryApi.availableTools);

describe('AgentEditorToolsField', () => {
  it('shows the none-selected hint when the allowlist is empty', () => {
    render(<AgentEditorToolsField toolAllowlist={[]} onChange={vi.fn()} />);
    expect(screen.getByText('settings.agents.editor.toolsNoneSelected')).toBeInTheDocument();
  });

  it('renders selected tools as chips', () => {
    render(<AgentEditorToolsField toolAllowlist={['memory_search', 'web_fetch']} onChange={vi.fn()} />);
    expect(screen.getByText('memory_search')).toBeInTheDocument();
    expect(screen.getByText('web_fetch')).toBeInTheDocument();
  });

  it('opens the picker modal and toggles "Allow all" on and off', async () => {
    mockAvailableTools.mockResolvedValue([
      { name: 'memory_search', description: 'Search memory' },
      { name: 'web_fetch', description: 'Fetch a URL' },
    ]);
    const onChange = vi.fn();
    render(<AgentEditorToolsField toolAllowlist={[]} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('settings.agents.editor.selectTools'));

    await waitFor(() => {
      expect(screen.getByTestId('agent-tools-allow-all-toggle')).toBeInTheDocument();
    });

    const allowAllToggle = screen.getByTestId('agent-tools-allow-all-toggle');
    expect(allowAllToggle).toHaveAttribute('aria-pressed', 'false');
    expect(allowAllToggle).toHaveAttribute('data-state', 'off');

    await act(async () => {
      fireEvent.click(allowAllToggle);
    });

    expect(onChange).toHaveBeenCalledWith(['*']);
  });

  it('reflects an already-all-selected allowlist as pressed', async () => {
    mockAvailableTools.mockResolvedValue([{ name: 'memory_search', description: 'Search memory' }]);
    render(<AgentEditorToolsField toolAllowlist={['*']} onChange={vi.fn()} />);

    expect(screen.getByText('settings.agents.editor.toolsAllSelected')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('settings.agents.editor.selectTools'));

    await waitFor(() => {
      const toggle = screen.getByTestId('agent-tools-allow-all-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveAttribute('data-state', 'on');
    });
  });
});
