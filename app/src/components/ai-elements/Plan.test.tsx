import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from './Plan';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|canvas|white|black)\b/;

const renderPlan = (props?: { isStreaming?: boolean; defaultOpen?: boolean }) =>
  render(
    <Plan data-testid="plan" isStreaming={props?.isStreaming} defaultOpen={props?.defaultOpen}>
      <PlanHeader data-testid="plan-header">
        <div>
          <PlanTitle data-testid="plan-title">Refactor the timeline</PlanTitle>
          <PlanDescription data-testid="plan-description">Three steps, no writes.</PlanDescription>
        </div>
        <PlanAction data-testid="plan-action">
          <PlanTrigger data-testid="plan-trigger" />
        </PlanAction>
      </PlanHeader>
      <PlanContent data-testid="plan-content">Step one</PlanContent>
      <PlanFooter data-testid="plan-footer">Footer</PlanFooter>
    </Plan>
  );

describe('Plan', () => {
  it('renders the title, description, content and footer', () => {
    renderPlan({ defaultOpen: true });

    expect(screen.getByText('Refactor the timeline')).toBeInTheDocument();
    expect(screen.getByText('Three steps, no writes.')).toBeInTheDocument();
    expect(screen.getByTestId('plan-content')).toHaveTextContent('Step one');
    expect(screen.getByTestId('plan-footer')).toHaveTextContent('Footer');
  });

  it('toggles the content from the trigger', async () => {
    const user = userEvent.setup();
    renderPlan();

    const trigger = screen.getByTestId('plan-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // `CollapsibleContent asChild` unmounts its child while closed, so absence
    // — not a `data-state` — is the closed contract here.
    expect(screen.queryByTestId('plan-content')).toBeNull();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('plan-content')).toHaveAttribute('data-state', 'open');
  });

  it('labels the trigger for assistive technology', () => {
    renderPlan();
    expect(screen.getByLabelText('Toggle plan')).toBe(screen.getByTestId('plan-trigger'));
  });

  it('wraps the title and description in a shimmer while streaming', () => {
    renderPlan({ isStreaming: true });

    expect(
      screen.getByTestId('plan-title').querySelector('[data-slot="plan-shimmer"]')
    ).not.toBeNull();
    expect(
      screen.getByTestId('plan-description').querySelector('[data-slot="plan-shimmer"]')
    ).not.toBeNull();
    expect(screen.getByText('Refactor the timeline')).toBeInTheDocument();
  });

  it('renders plain text when not streaming', () => {
    renderPlan();
    expect(screen.getByTestId('plan-title').querySelector('[data-slot="plan-shimmer"]')).toBeNull();
  });

  it('throws when a slot is used outside Plan', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<PlanTitle>Orphan</PlanTitle>)).toThrow(
      /Plan components must be used within Plan/
    );
    spy.mockRestore();
  });

  it('passes rest props and data-testid through to the DOM', () => {
    renderPlan({ defaultOpen: true });

    for (const id of [
      'plan',
      'plan-header',
      'plan-title',
      'plan-description',
      'plan-action',
      'plan-trigger',
      'plan-content',
      'plan-footer',
    ]) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
  });

  it('lets a caller className win over the defaults', () => {
    render(
      <Plan data-testid="plan" className="rounded-none">
        <PlanHeader />
      </Plan>
    );
    const root = screen.getByTestId('plan');
    expect(root.className).toContain('rounded-none');
    expect(root.className).not.toContain('rounded-xl');
  });

  it('emits the data-slot contract', () => {
    renderPlan({ defaultOpen: true });

    const expected: Array<[string, string]> = [
      ['plan', 'plan'],
      ['plan-header', 'plan-header'],
      ['plan-title', 'plan-title'],
      ['plan-description', 'plan-description'],
      ['plan-action', 'plan-action'],
      ['plan-trigger', 'plan-trigger'],
      ['plan-content', 'plan-content'],
      ['plan-footer', 'plan-footer'],
    ];
    for (const [testId, slot] of expected) {
      expect(screen.getByTestId(testId), slot).toHaveAttribute('data-slot', slot);
    }
  });

  it('emits no raw palette utility on any slot', () => {
    renderPlan({ defaultOpen: true, isStreaming: true });

    for (const el of Array.from(document.querySelectorAll('[data-slot]'))) {
      expect(el.className.toString(), el.getAttribute('data-slot') ?? '').not.toMatch(RAW_PALETTE);
    }
  });
});
