import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ButtonGroupRoot, { ButtonGroupItem } from './ButtonGroup';

/**
 * Raw palette utilities are the failure this suite exists to catch: they look
 * correct in the default theme and silently ignore a custom one.
 */
const RAW_PALETTE = /\b(bg|text|border|ring)-(neutral|stone|slate|canvas|white|black)\b/;

describe('ButtonGroup', () => {
  it('renders a group of buttons with the slot contract', () => {
    render(
      <ButtonGroupRoot data-testid="group">
        <ButtonGroupItem>Day</ButtonGroupItem>
        <ButtonGroupItem>Week</ButtonGroupItem>
      </ButtonGroupRoot>
    );

    const group = screen.getByTestId('group');
    expect(group).toHaveAttribute('data-slot', 'button-group');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('data-orientation', 'horizontal');
    expect(group).toHaveAttribute('data-size', 'md');

    const day = screen.getByRole('button', { name: 'Day' });
    expect(day).toHaveAttribute('data-slot', 'button-group-item');
    expect(day).toHaveAttribute('data-variant', 'secondary');
    expect(day).toHaveAttribute('data-size', 'md');
  });

  it('passes the root size and tone down to items, and lets an item override', () => {
    render(
      <ButtonGroupRoot size="sm" tone="danger">
        <ButtonGroupItem>Delete</ButtonGroupItem>
        <ButtonGroupItem size="lg" tone="default">
          Keep
        </ButtonGroupItem>
      </ButtonGroupRoot>
    );

    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del).toHaveAttribute('data-size', 'sm');
    expect(del).toHaveAttribute('data-tone', 'danger');

    const keep = screen.getByRole('button', { name: 'Keep' });
    expect(keep).toHaveAttribute('data-size', 'lg');
    expect(keep).toHaveAttribute('data-tone', 'default');
  });

  it('joins the children horizontally and stacks them when vertical', () => {
    const { rerender } = render(
      <ButtonGroupRoot data-testid="group">
        <ButtonGroupItem>One</ButtonGroupItem>
      </ButtonGroupRoot>
    );
    expect(screen.getByTestId('group').className).toMatch(/\[&>\*:not\(:first-child\)\]:-ml-px/);

    rerender(
      <ButtonGroupRoot data-testid="group" orientation="vertical">
        <ButtonGroupItem>One</ButtonGroupItem>
      </ButtonGroupRoot>
    );
    const group = screen.getByTestId('group');
    expect(group).toHaveAttribute('data-orientation', 'vertical');
    expect(group.className).toMatch(/flex-col/);
    expect(group.className).toMatch(/\[&>\*:not\(:first-child\)\]:-mt-px/);
  });

  it('forwards ref, className and arbitrary rest props onto the DOM node', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ButtonGroupRoot
        ref={ref}
        data-testid="group"
        aria-label="View range"
        id="range-group"
        className="mt-4">
        <ButtonGroupItem data-testid="first">One</ButtonGroupItem>
      </ButtonGroupRoot>
    );

    const group = screen.getByTestId('group');
    expect(ref.current).toBe(group);
    expect(group).toHaveAttribute('aria-label', 'View range');
    expect(group).toHaveAttribute('id', 'range-group');
    expect(group.className).toMatch(/mt-4/);
    expect(screen.getByTestId('first')).toBeInTheDocument();
  });

  it('preserves analytics ids and keeps items keyboard reachable', async () => {
    const user = userEvent.setup();
    const onFirst = vi.fn();
    const onSecond = vi.fn();

    render(
      <ButtonGroupRoot>
        <ButtonGroupItem analyticsId="range-day" onClick={onFirst}>
          Day
        </ButtonGroupItem>
        <ButtonGroupItem onClick={onSecond}>Week</ButtonGroupItem>
      </ButtonGroupRoot>
    );

    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute(
      'data-analytics-id',
      'range-day'
    );

    // Independent actions, so each button is its own tab stop (unlike
    // ToggleGroup's single roving one).
    await user.tab();
    expect(screen.getByRole('button', { name: 'Day' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onFirst).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Week' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  it('uses only themeable tokens — no raw palette utilities', () => {
    render(
      <ButtonGroupRoot data-testid="group" tone="danger">
        <ButtonGroupItem data-testid="item">One</ButtonGroupItem>
      </ButtonGroupRoot>
    );

    expect(screen.getByTestId('group').className).not.toMatch(RAW_PALETTE);
    expect(screen.getByTestId('item').className).not.toMatch(RAW_PALETTE);
  });
});
