import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HoverCardContent, HoverCardRoot, HoverCardTrigger } from './HoverCard';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|canvas|white|black)\b/;

const renderHoverCard = (contentProps?: Record<string, unknown>) =>
  render(
    <HoverCardRoot openDelay={0} closeDelay={0}>
      <HoverCardTrigger data-testid="trigger" href="#profile">
        @ada
      </HoverCardTrigger>
      <HoverCardContent data-testid="content" {...contentProps}>
        Ada Lovelace
      </HoverCardContent>
    </HoverCardRoot>
  );

describe('HoverCard', () => {
  it('stays closed until the trigger is engaged', () => {
    renderHoverCard();

    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('opens on keyboard focus and closes on blur', async () => {
    renderHoverCard();
    const trigger = screen.getByTestId('trigger');

    fireEvent.focus(trigger);
    await waitFor(() => expect(screen.getByTestId('content')).toHaveTextContent('Ada Lovelace'));

    fireEvent.blur(trigger);
    await waitFor(() => expect(screen.queryByTestId('content')).toBeNull());
  });

  it('opens on pointer hover', async () => {
    renderHoverCard();

    fireEvent.pointerEnter(screen.getByTestId('trigger'), { pointerType: 'mouse' });
    await waitFor(() => expect(screen.getByTestId('content')).toBeInTheDocument());
  });

  it('marks the open trigger with data-state', async () => {
    renderHoverCard();
    const trigger = screen.getByTestId('trigger');

    fireEvent.focus(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('data-state', 'open'));
  });

  it('forwards rest props and a data-slot onto the content node', async () => {
    renderHoverCard({ id: 'profile-card', 'aria-label': 'Profile' });

    fireEvent.focus(screen.getByTestId('trigger'));
    const content = await screen.findByTestId('content');

    expect(content).toHaveAttribute('data-slot', 'hover-card-content');
    expect(content).toHaveAttribute('id', 'profile-card');
    expect(content).toHaveAttribute('aria-label', 'Profile');
  });

  it('lets a caller className win over the defaults', async () => {
    renderHoverCard({ className: 'rounded-none' });

    fireEvent.focus(screen.getByTestId('trigger'));
    const content = await screen.findByTestId('content');

    expect(content.className).toContain('rounded-none');
    expect(content.className).not.toContain('rounded-xl');
  });

  it('resolves content styling to design tokens, never a raw palette class', async () => {
    renderHoverCard();

    fireEvent.focus(screen.getByTestId('trigger'));
    const content = await screen.findByTestId('content');

    expect(content.className).not.toMatch(RAW_PALETTE);
  });
});
