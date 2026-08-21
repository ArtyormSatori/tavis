import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SubconsciousInstanceStatus } from '../../utils/tauriCommands/subconscious';
import SubconsciousInstanceCard from './SubconsciousInstanceCard';

vi.mock('../../lib/i18n/I18nContext', () => ({ useT: () => ({ t: (k: string) => k }) }));

function status(over: Partial<SubconsciousInstanceStatus> = {}): SubconsciousInstanceStatus {
  return {
    total_ticks: 3,
    last_tick_at: null,
    consecutive_failures: 0,
    provider_available: true,
    provider_unavailable_reason: null,
    ...over,
  } as SubconsciousInstanceStatus;
}

describe('SubconsciousInstanceCard', () => {
  it('renders title, subtitle and the run button, and fires onRun', () => {
    const onRun = vi.fn();
    render(
      <SubconsciousInstanceCard
        title="Dream world"
        subtitle="nightly reflection"
        status={status()}
        runLabel="Run now"
        triggering={false}
        onRun={onRun}
      />
    );

    expect(screen.getByText('Dream world')).toBeInTheDocument();
    expect(screen.getByText('nightly reflection')).toBeInTheDocument();

    const runButton = screen.getByRole('button', { name: 'Run now' });
    expect(runButton).toHaveAttribute('data-slot', 'button');
    fireEvent.click(runButton);
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('shows the disabled hint instead of stats when disabled', () => {
    render(
      <SubconsciousInstanceCard
        title="Dream world"
        subtitle="nightly reflection"
        status={undefined}
        disabled
        disabledHint="Turn this on in settings"
        runLabel="Run now"
        triggering={false}
        onRun={vi.fn()}
      />
    );

    expect(screen.getByText('Turn this on in settings')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run now' })).toBeNull();
  });

  it('renders a provider-settings button when the provider is unavailable', () => {
    const onProviderSettings = vi.fn();
    render(
      <SubconsciousInstanceCard
        title="Dream world"
        subtitle="nightly reflection"
        status={status({ provider_available: false, provider_unavailable_reason: 'No API key' })}
        runLabel="Run now"
        triggering={false}
        onRun={vi.fn()}
        onProviderSettings={onProviderSettings}
      />
    );

    expect(screen.getByText('No API key')).toBeInTheDocument();
    const settingsButton = screen.getByRole('button', { name: 'subconscious.providerSettings' });
    expect(settingsButton).toHaveAttribute('data-slot', 'button');
    fireEvent.click(settingsButton);
    expect(onProviderSettings).toHaveBeenCalledOnce();
  });
});
