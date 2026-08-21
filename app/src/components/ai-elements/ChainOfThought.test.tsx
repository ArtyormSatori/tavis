import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from './ChainOfThought';

const RAW_PALETTE =
  /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|zinc|gray|canvas|white|black)\b/;

const collectClasses = (root: HTMLElement) =>
  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    .map(el => el.getAttribute('class') ?? '')
    .join(' ');

const renderTree = () =>
  render(
    <ChainOfThought data-testid="cot">
      <ChainOfThoughtHeader data-testid="cot-header" />
      <ChainOfThoughtContent data-testid="cot-content">
        <ChainOfThoughtStep data-testid="cot-step" label="Searching" description="the web" />
        <ChainOfThoughtSearchResults data-testid="cot-results">
          <ChainOfThoughtSearchResult data-testid="cot-result">
            example.com
          </ChainOfThoughtSearchResult>
        </ChainOfThoughtSearchResults>
        <ChainOfThoughtImage caption="A chart" data-testid="cot-image">
          <span>img</span>
        </ChainOfThoughtImage>
      </ChainOfThoughtContent>
    </ChainOfThought>
  );

describe('ChainOfThought', () => {
  it('renders the header closed by default', () => {
    renderTree();

    const header = screen.getByTestId('cot-header');
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(header).toHaveTextContent('Chain of Thought');
    expect(screen.queryByTestId('cot-step')).toBeNull();
  });

  it('reveals the content when the header is clicked, and hides it again', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByTestId('cot-header'));

    expect(screen.getByTestId('cot-header')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('cot-step')).toHaveTextContent('Searching');
    expect(screen.getByTestId('cot-step')).toHaveTextContent('the web');
    expect(screen.getByTestId('cot-result')).toHaveTextContent('example.com');
    expect(screen.getByTestId('cot-image')).toHaveTextContent('A chart');

    await user.click(screen.getByTestId('cot-header'));
    expect(screen.queryByTestId('cot-step')).toBeNull();
  });

  it('honours the controlled open prop and reports changes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ChainOfThought open={true} onOpenChange={onOpenChange}>
        <ChainOfThoughtHeader data-testid="cot-header" />
        <ChainOfThoughtContent>
          <span data-testid="body">body</span>
        </ChainOfThoughtContent>
      </ChainOfThought>
    );

    expect(screen.getByTestId('body')).toBeInTheDocument();

    await user.click(screen.getByTestId('cot-header'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Still open: the caller owns the state.
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });

  it('passes rest props through and emits the data-slot contract', () => {
    renderTree();

    expect(screen.getByTestId('cot')).toHaveAttribute('data-slot', 'chain-of-thought');
    expect(screen.getByTestId('cot-header')).toHaveAttribute(
      'data-slot',
      'chain-of-thought-header'
    );
    expect(screen.getByTestId('cot-content')).toHaveAttribute(
      'data-slot',
      'chain-of-thought-content'
    );
  });

  it('tags a step with its status as data-variant', () => {
    render(
      <ChainOfThought defaultOpen>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep data-testid="step" label="Pending" status="pending" />
        </ChainOfThoughtContent>
      </ChainOfThought>
    );

    expect(screen.getByTestId('step')).toHaveAttribute('data-variant', 'pending');
  });

  it('uses design tokens, never raw palette classes', () => {
    const { container } = render(
      <ChainOfThought defaultOpen data-testid="cot">
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent>
          <ChainOfThoughtStep label="Step" description="desc" status="active" />
          <ChainOfThoughtSearchResults>
            <ChainOfThoughtSearchResult>r</ChainOfThoughtSearchResult>
          </ChainOfThoughtSearchResults>
          <ChainOfThoughtImage caption="cap">x</ChainOfThoughtImage>
        </ChainOfThoughtContent>
      </ChainOfThought>
    );

    expect(collectClasses(container)).not.toMatch(RAW_PALETTE);
  });
});
