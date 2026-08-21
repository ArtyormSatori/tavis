import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Reasoning, ReasoningContent, ReasoningTrigger } from './Reasoning';

const RAW_PALETTE =
  /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|zinc|gray|canvas|white|black)\b/;

const collectClasses = (root: HTMLElement) =>
  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    .map(el => el.getAttribute('class') ?? '')
    .join(' ');

const renderReasoning = (props?: { isStreaming?: boolean; defaultOpen?: boolean }) =>
  render(
    <Reasoning
      data-testid="reasoning"
      isStreaming={props?.isStreaming}
      defaultOpen={props?.defaultOpen}>
      <ReasoningTrigger data-testid="reasoning-trigger" />
      <ReasoningContent data-testid="reasoning-content">Because of X, then Y.</ReasoningContent>
    </Reasoning>
  );

describe('Reasoning', () => {
  // Regression: #4942. The auto-open effect re-runs on every `isOpen` change, so
  // guarding it on the `defaultOpen` PROP alone let it immediately undo a manual
  // collapse — the panel could not be closed while streaming. A prop cannot
  // record a runtime interaction; the sticky `userOverrideOpen` state can.
  // Mirrors the fix in features/conversations/components/ToolTimelineBlock.tsx.
  it('lets the user collapse the panel mid-stream without it springing back open', () => {
    renderReasoning({ isStreaming: true });

    const trigger = screen.getByTestId('reasoning-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The user collapses it while tokens are still arriving.
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('reasoning-content')).toHaveAttribute('data-state', 'closed');
  });

  it('keeps a mid-stream manual OPEN from being auto-closed when streaming ends', () => {
    const { rerender } = render(
      <Reasoning data-testid="reasoning" isStreaming={true} defaultOpen={false}>
        <ReasoningTrigger data-testid="reasoning-trigger" />
        <ReasoningContent data-testid="reasoning-content">Because of X.</ReasoningContent>
      </Reasoning>
    );

    const trigger = screen.getByTestId('reasoning-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger); // user opens it deliberately
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Streaming finishes; the auto-close timer must not override the user.
    rerender(
      <Reasoning data-testid="reasoning" isStreaming={false} defaultOpen={false}>
        <ReasoningTrigger data-testid="reasoning-trigger" />
        <ReasoningContent data-testid="reasoning-content">Because of X.</ReasoningContent>
      </Reasoning>
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('reasoning-trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders closed by default and shows the settled thinking message', () => {
    renderReasoning();

    const trigger = screen.getByTestId('reasoning-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Thought for a few seconds');
    // Radix keeps the content mounted and marks it hidden rather than
    // unmounting it, so the closed state is asserted on `data-state`.
    expect(screen.getByTestId('reasoning-content')).toHaveAttribute('data-state', 'closed');
  });

  it('opens while streaming and shows the streaming message', () => {
    renderReasoning({ isStreaming: true });

    expect(screen.getByTestId('reasoning-trigger')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('reasoning-trigger')).toHaveTextContent('Thinking...');
    expect(screen.getByTestId('reasoning-content')).toHaveTextContent('Because of X, then Y.');
  });

  it('stays closed while streaming when defaultOpen is explicitly false', () => {
    renderReasoning({ isStreaming: true, defaultOpen: false });

    expect(screen.getByTestId('reasoning-trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles on click', () => {
    renderReasoning();

    fireEvent.click(screen.getByTestId('reasoning-trigger'));
    expect(screen.getByTestId('reasoning-content')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('reasoning-trigger'));
    // Radix keeps the content mounted and marks it hidden rather than
    // unmounting it, so the closed state is asserted on `data-state`.
    expect(screen.getByTestId('reasoning-content')).toHaveAttribute('data-state', 'closed');
  });

  it('auto-closes a second after streaming ends', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <Reasoning isStreaming={true}>
          <ReasoningTrigger data-testid="trigger" />
          <ReasoningContent data-testid="content">reasoning</ReasoningContent>
        </Reasoning>
      );
      expect(screen.getByTestId('content')).toHaveAttribute('data-state', 'open');

      rerender(
        <Reasoning isStreaming={false}>
          <ReasoningTrigger data-testid="trigger" />
          <ReasoningContent data-testid="content">reasoning</ReasoningContent>
        </Reasoning>
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByTestId('content')).toHaveAttribute('data-state', 'closed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders a custom thinking message when one is supplied', () => {
    render(
      <Reasoning duration={7}>
        <ReasoningTrigger
          data-testid="trigger"
          getThinkingMessage={(_streaming, duration) => <span>pondered {duration}s</span>}
        />
      </Reasoning>
    );

    expect(screen.getByTestId('trigger')).toHaveTextContent('pondered 7s');
  });

  it('passes rest props through and emits the data-slot contract', () => {
    renderReasoning({ defaultOpen: true });

    expect(screen.getByTestId('reasoning')).toHaveAttribute('data-slot', 'reasoning');
    expect(screen.getByTestId('reasoning-trigger')).toHaveAttribute(
      'data-slot',
      'reasoning-trigger'
    );
    expect(screen.getByTestId('reasoning-content')).toHaveAttribute(
      'data-slot',
      'reasoning-content'
    );
  });

  it('uses design tokens, never raw palette classes', () => {
    const { container } = renderReasoning({ defaultOpen: true });

    expect(collectClasses(container)).not.toMatch(RAW_PALETTE);
  });
});
