import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ChatNewWindowHero from './ChatNewWindowHero';

vi.mock('../../hooks/useUser', () => ({ useUser: () => ({ user: { firstName: 'Ada' } }) }));

const mockUseUsageState = vi.hoisted(() =>
  vi.fn(() => ({ shouldShowBudgetCompletedMessage: false }))
);
vi.mock('../../hooks/useUsageState', () => ({ useUsageState: mockUseUsageState }));

vi.mock('../../services/api/openrouterFreeModels', () => ({
  applyOpenRouterFreeModels: vi.fn(),
}));

const blockingStateMock = vi.hoisted(() => ({ current: 'ok' as string }));
vi.mock('../../store/connectivitySelectors', () => ({
  selectBlockingState: () => blockingStateMock.current,
}));
vi.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector(undefined),
}));

const restartCoreProcessMock = vi.fn<() => Promise<void>>(() => Promise.resolve());
vi.mock('../../services/coreProcessControl', () => ({
  restartCoreProcess: () => restartCoreProcessMock(),
}));

describe('ChatNewWindowHero', () => {
  it('renders the greeting card without the core-recovery button by default', () => {
    blockingStateMock.current = 'ok';
    render(<ChatNewWindowHero />);
    expect(screen.getByTestId('home-card')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /restart/i })).toBeNull();
  });

  it('shows a restart-core button when the core is unreachable, and invokes it', async () => {
    blockingStateMock.current = 'core-unreachable';
    render(<ChatNewWindowHero />);
    const restart = screen.getByRole('button', { name: /restart/i });
    fireEvent.click(restart);
    await waitFor(() => expect(restartCoreProcessMock).toHaveBeenCalled());
  });
});
