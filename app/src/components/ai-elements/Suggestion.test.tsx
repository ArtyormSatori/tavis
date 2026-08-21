import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Suggestion, Suggestions } from './Suggestion';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|canvas|white|black)\b/;

describe('Suggestions', () => {
  it('renders its children inside a natively scrolling rail', () => {
    render(
      <Suggestions data-testid="rail">
        <Suggestion data-testid="one" suggestion="Summarise this" />
        <Suggestion data-testid="two" suggestion="Draft a reply" />
      </Suggestions>
    );

    const rail = screen.getByTestId('rail');
    expect(rail).toHaveAttribute('data-slot', 'suggestions');
    expect(rail.className).toContain('overflow-x-auto');
    expect(screen.getByTestId('one')).toHaveTextContent('Summarise this');
    expect(screen.getByTestId('two')).toHaveTextContent('Draft a reply');
  });

  it('passes ...rest and preserved attributes through to the DOM node', () => {
    render(
      <Suggestions aria-label="Suggested prompts" data-testid="rail" id="rail-1">
        <Suggestion suggestion="Hi" />
      </Suggestions>
    );

    const rail = screen.getByTestId('rail');
    expect(rail).toHaveAttribute('id', 'rail-1');
    expect(rail).toHaveAttribute('aria-label', 'Suggested prompts');
  });
});

describe('Suggestion', () => {
  it('labels itself from the suggestion string', () => {
    render(<Suggestion data-testid="chip" suggestion="Summarise this" />);

    const chip = screen.getByTestId('chip');
    expect(chip).toHaveAttribute('data-slot', 'suggestion');
    expect(chip).toHaveAttribute('type', 'button');
    expect(chip).toHaveTextContent('Summarise this');
  });

  it('prefers explicit children over the suggestion string', () => {
    render(
      <Suggestion data-testid="chip" suggestion="Summarise this">
        Custom label
      </Suggestion>
    );

    expect(screen.getByTestId('chip')).toHaveTextContent('Custom label');
  });

  it('hands the suggestion string back to onClick', () => {
    const onClick = vi.fn();
    render(<Suggestion data-testid="chip" onClick={onClick} suggestion="Draft a reply" />);

    fireEvent.click(screen.getByTestId('chip'));

    expect(onClick).toHaveBeenCalledWith('Draft a reply');
  });

  it('is safe to click with no onClick handler', () => {
    render(<Suggestion data-testid="chip" suggestion="Draft a reply" />);

    expect(() => fireEvent.click(screen.getByTestId('chip'))).not.toThrow();
  });

  it('lets a caller className win over the defaults', () => {
    render(<Suggestion className="rounded-md" data-testid="chip" suggestion="Hi" />);

    const cls = screen.getByTestId('chip').className;
    expect(cls).toContain('rounded-md');
    expect(cls).not.toContain('rounded-full');
  });

  it('uses only OpenHuman semantic tokens, never raw palette classes', () => {
    render(
      <Suggestions data-testid="rail">
        <Suggestion data-testid="chip" suggestion="Hi" />
      </Suggestions>
    );

    expect(screen.getByTestId('rail').className).not.toMatch(RAW_PALETTE);
    expect(screen.getByTestId('chip').className).not.toMatch(RAW_PALETTE);
  });
});
