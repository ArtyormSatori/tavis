import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from './Tool';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|canvas|white|black)\b/;

const renderTool = (props?: { defaultOpen?: boolean }) =>
  render(
    <Tool data-testid="tool" defaultOpen={props?.defaultOpen}>
      <ToolHeader data-testid="tool-header" type="tool-memory_search" state="output-available" />
      <ToolContent data-testid="tool-content">
        <ToolInput data-testid="tool-input" input={{ query: 'kettle' }} />
        <ToolOutput data-testid="tool-output" output={{ hits: 3 }} errorText={undefined} />
      </ToolContent>
    </Tool>
  );

describe('Tool', () => {
  it('renders the tool name derived from a static tool type', () => {
    renderTool();
    expect(screen.getByText('memory_search')).toBeInTheDocument();
  });

  it('renders an explicit title over the derived name', () => {
    render(
      <Tool>
        <ToolHeader type="tool-memory_search" state="output-available" title="Searched memory" />
      </Tool>
    );
    expect(screen.getByText('Searched memory')).toBeInTheDocument();
    expect(screen.queryByText('memory_search')).toBeNull();
  });

  it('renders the tool name of a dynamic tool from toolName', () => {
    render(
      <Tool>
        <ToolHeader type="dynamic-tool" state="input-available" toolName="fetch_weather" />
      </Tool>
    );
    expect(screen.getByText('fetch_weather')).toBeInTheDocument();
  });

  it('expands and collapses from the header', async () => {
    const user = userEvent.setup();
    renderTool();

    const header = screen.getByTestId('tool-header');
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('tool-content')).toHaveAttribute('data-state', 'closed');

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('tool-content')).toHaveAttribute('data-state', 'open');

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('tool-content')).toHaveAttribute('data-state', 'closed');
  });

  it('labels each lifecycle state on the status badge', () => {
    const cases = [
      ['input-streaming', 'Pending'],
      ['input-available', 'Running'],
      ['approval-requested', 'Awaiting approval'],
      ['approval-responded', 'Responded'],
      ['output-available', 'Done'],
      ['output-denied', 'Denied'],
      ['output-error', 'Error'],
    ] as const;

    for (const [state, label] of cases) {
      const { unmount } = render(
        <Tool>
          <ToolHeader type="tool-x" state={state} />
        </Tool>
      );
      expect(screen.getByText(label), state).toBeInTheDocument();
      unmount();
    }
  });

  it('serializes object input as JSON under a Parameters heading', () => {
    renderTool({ defaultOpen: true });
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByTestId('tool-input').textContent).toContain('"query": "kettle"');
  });

  it('renders an error output instead of a result', () => {
    render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolOutput data-testid="out" output={undefined} errorText="rate limited" />
        </ToolContent>
      </Tool>
    );
    expect(screen.getByText('rate limited')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Result')).toBeNull();
  });

  it('renders nothing when there is neither output nor error', () => {
    const { container } = render(<ToolOutput output={undefined} errorText={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('passes rest props and data-testid through to the DOM', () => {
    renderTool({ defaultOpen: true });

    expect(screen.getByTestId('tool')).toBeInTheDocument();
    expect(screen.getByTestId('tool-header')).toBeInTheDocument();
    expect(screen.getByTestId('tool-content')).toBeInTheDocument();
    expect(screen.getByTestId('tool-input')).toBeInTheDocument();
    expect(screen.getByTestId('tool-output')).toBeInTheDocument();
  });

  it('lets a caller className win over the defaults', () => {
    render(
      <Tool data-testid="tool" className="mb-0">
        <ToolHeader type="tool-x" state="output-available" />
      </Tool>
    );
    const root = screen.getByTestId('tool');
    expect(root.className).toContain('mb-0');
    expect(root.className).not.toContain('mb-4');
  });

  it('emits the data-slot contract', () => {
    renderTool({ defaultOpen: true });

    expect(screen.getByTestId('tool')).toHaveAttribute('data-slot', 'tool');
    expect(screen.getByTestId('tool-header')).toHaveAttribute('data-slot', 'tool-header');
    expect(screen.getByTestId('tool-content')).toHaveAttribute('data-slot', 'tool-content');
    expect(screen.getByTestId('tool-input')).toHaveAttribute('data-slot', 'tool-input');
    expect(screen.getByTestId('tool-output')).toHaveAttribute('data-slot', 'tool-output');
    expect(document.querySelector('[data-slot="tool-status"]')).toHaveAttribute(
      'data-status',
      'output-available'
    );
  });

  it('emits no raw palette utility on any slot', () => {
    renderTool({ defaultOpen: true });

    for (const el of Array.from(document.querySelectorAll('[data-slot]'))) {
      expect(el.className.toString(), el.getAttribute('data-slot') ?? '').not.toMatch(RAW_PALETTE);
    }
  });
});
