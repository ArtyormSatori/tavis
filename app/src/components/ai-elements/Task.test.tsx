import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from './Task';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|canvas|white|black)\b/;

const renderTask = (props?: { defaultOpen?: boolean }) =>
  render(
    <Task data-testid="task" defaultOpen={props?.defaultOpen}>
      <TaskTrigger data-testid="task-trigger" title="Searching the codebase" />
      <TaskContent data-testid="task-content">
        <TaskItem data-testid="task-item">
          Read <TaskItemFile data-testid="task-item-file">Tool.tsx</TaskItemFile>
        </TaskItem>
      </TaskContent>
    </Task>
  );

describe('Task', () => {
  it('renders the trigger title and is open by default', () => {
    renderTask();

    expect(screen.getByText('Searching the codebase')).toBeInTheDocument();
    expect(screen.getByTestId('task-trigger')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('task-content')).toHaveAttribute('data-state', 'open');
  });

  it('renders items and file chips inside the content', () => {
    renderTask();

    expect(screen.getByTestId('task-item')).toHaveTextContent('Read');
    expect(screen.getByTestId('task-item-file')).toHaveTextContent('Tool.tsx');
  });

  it('collapses and re-expands from the trigger', async () => {
    const user = userEvent.setup();
    renderTask();
    const trigger = screen.getByTestId('task-trigger');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('task-content')).toHaveAttribute('data-state', 'closed');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('task-content')).toHaveAttribute('data-state', 'open');
  });

  it('renders a custom trigger child instead of the default row', () => {
    render(
      <Task>
        <TaskTrigger title="ignored">
          <button type="button" data-testid="custom-trigger">
            Custom
          </button>
        </TaskTrigger>
      </Task>
    );

    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).toBeNull();
  });

  it('starts closed when defaultOpen is false', () => {
    renderTask({ defaultOpen: false });
    expect(screen.getByTestId('task-trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  it('passes rest props and data-testid through to the DOM', () => {
    renderTask();

    expect(screen.getByTestId('task')).toBeInTheDocument();
    expect(screen.getByTestId('task-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('task-content')).toBeInTheDocument();
    expect(screen.getByTestId('task-item')).toBeInTheDocument();
    expect(screen.getByTestId('task-item-file')).toBeInTheDocument();
  });

  it('lets a caller className win over the defaults', () => {
    render(
      <TaskItem data-testid="item" className="text-sm text-content">
        Body
      </TaskItem>
    );
    const item = screen.getByTestId('item');
    expect(item.className).toContain('text-content');
    expect(item.className).not.toContain('text-content-muted');
  });

  it('emits the data-slot contract', () => {
    renderTask();

    expect(screen.getByTestId('task')).toHaveAttribute('data-slot', 'task');
    expect(screen.getByTestId('task-trigger')).toHaveAttribute('data-slot', 'task-trigger');
    expect(screen.getByTestId('task-content')).toHaveAttribute('data-slot', 'task-content');
    expect(screen.getByTestId('task-item')).toHaveAttribute('data-slot', 'task-item');
    expect(screen.getByTestId('task-item-file')).toHaveAttribute('data-slot', 'task-item-file');
  });

  it('emits no raw palette utility on any slot', () => {
    renderTask();

    for (const el of Array.from(document.querySelectorAll('[data-slot]'))) {
      expect(el.className.toString(), el.getAttribute('data-slot') ?? '').not.toMatch(RAW_PALETTE);
    }
  });
});
