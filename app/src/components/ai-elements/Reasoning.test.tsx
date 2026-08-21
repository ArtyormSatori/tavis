import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Reasoning, ReasoningContent, ReasoningTrigger } from './Reasoning';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|zinc|gray|canvas|white|black)\b/;

const collectClasses = (root: HTMLElement) =>
  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    .map(el => el.getAttribute('class') ?? '')
    .join(' ');

const renderReasoning = (props?: { isStreaming?: boolean; defaultOpen?: boolean }) =>
  render(
    <Reasoning data-testid="reasoning" isStreaming={props?.isStreaming} defaultOpen={props?.defaultOpen}>
      <ReasoningTrigger data-testid="reasoning-trigger" />
      <ReasoningContent data-testid="reasoning-content">Because of X, then Y.</ReasoningContent>
    </Reasoning>
  );

describe('Reasoning', () => {
  it('renders closed by default and shows the settled thinking message', () => {
    renderReasoning();

    const trigger = screen.getByTestId('reasoning-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Thought for a few seconds');
    expect(screen.queryByTestId('reasoning-content')).toBeNull();
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
    expect(screen.queryByTestId('reasoning-content')).toBeNull();
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
      expect(screen.getByTestId('content')).toBeInTheDocument();

      rerender(
        <Reasoning isStreaming={false}>
          <ReasoningTrigger data-testid="trigger" />
          <ReasoningContent data-testid="content">reasoning</ReasoningContent>
        </Reasoning>
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByTestId('content')).toBeNull();
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
    expect(screen.getByTestId('reasoning-trigger')).toHaveAttribute('data-slot', 'reasoning-trigger');
    expect(screen.getByTestId('reasoning-content')).toHaveAttribute('data-slot', 'reasoning-content');
  });

  it('uses design tokens, never raw palette classes', () => {
    const { container } = renderReasoning({ defaultOpen: true });

    expect(collectClasses(container)).not.toMatch(RAW_PALETTE);
  });
});
