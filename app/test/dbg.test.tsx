import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';

const budgetState = vi.hoisted(() => ({ level: 'none' as string, pct: 0 }));
vi.mock('/Users/enamakel/work/tinyhumansai/workflow-openhuman/openhuman/app/src/hooks/useEmbeddingBudgetState', () => ({
  useEmbeddingBudgetState: () => ({ ...budgetState }),
}));
vi.mock('/Users/enamakel/work/tinyhumansai/workflow-openhuman/openhuman/app/src/hooks/useUsageState', () => ({
  useUsageState: () => ({ teamUsage: null, isLoading: false, isAtLimit: false, isNearLimit: false, isFreeTier: false, usagePct: 0 }),
}));
vi.mock('/Users/enamakel/work/tinyhumansai/workflow-openhuman/openhuman/app/src/lib/nativeNotifications/tauriBridge', () => ({ showNativeNotification: vi.fn() }));

import userErrorsReducer from '../src/store/userErrorsSlice';
import NoticeCenter from '../src/components/notices/NoticeCenter';

describe('dbg', () => {
  it('shows on exhausted', () => {
    budgetState.level = 'exhausted';
    const store = configureStore({ reducer: { userErrors: userErrorsReducer } });
    render(<Provider store={store}><MemoryRouter><NoticeCenter /></MemoryRouter></Provider>);
    expect(screen.queryByTestId('notice-center')).not.toBeNull();
  });
});
