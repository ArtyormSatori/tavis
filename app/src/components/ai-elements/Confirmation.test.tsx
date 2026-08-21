import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
  type ConfirmationState,
  type ToolApproval,
} from './Confirmation';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|canvas|white|black)\b/;

const approvalPending: ToolApproval = { id: 'call-1' };
const approved: ToolApproval = { id: 'call-1', approved: true };
const rejected: ToolApproval = { id: 'call-1', approved: false, reason: 'Too risky' };

function renderConfirmation(
  state: ConfirmationState,
  approval: ToolApproval,
  onAccept = vi.fn(),
  onReject = vi.fn()
) {
  const utils = render(
    <Confirmation approval={approval} data-testid="confirmation" state={state}>
      <ConfirmationTitle data-testid="title">Delete the file?</ConfirmationTitle>
      <ConfirmationRequest>
        <span data-testid="request">Waiting on you</span>
      </ConfirmationRequest>
      <ConfirmationAccepted>
        <span data-testid="accepted">Approved</span>
      </ConfirmationAccepted>
      <ConfirmationRejected>
        <span data-testid="rejected">Denied</span>
      </ConfirmationRejected>
      <ConfirmationActions data-testid="actions">
        <ConfirmationAction data-testid="accept" onClick={onAccept}>
          Approve
        </ConfirmationAction>
        <ConfirmationAction data-testid="reject" onClick={onReject} variant="secondary">
          Deny
        </ConfirmationAction>
      </ConfirmationActions>
    </Confirmation>
  );
  return { onAccept, onReject, ...utils };
}

describe('Confirmation', () => {
  it('renders nothing without an approval record', () => {
    render(
      <Confirmation approval={undefined} data-testid="confirmation" state="approval-requested">
        <ConfirmationTitle>Hidden</ConfirmationTitle>
      </Confirmation>
    );

    expect(screen.queryByTestId('confirmation')).toBeNull();
  });

  it.each(['input-streaming', 'input-available'] as const)(
    'renders nothing while the tool input is still %s',
    state => {
      renderConfirmation(state, approvalPending);

      expect(screen.queryByTestId('confirmation')).toBeNull();
    }
  );

  it('shows the request branch and the actions while approval is requested', () => {
    renderConfirmation('approval-requested', approvalPending);

    expect(screen.getByTestId('confirmation')).toHaveAttribute('data-slot', 'confirmation');
    expect(screen.getByTestId('title')).toHaveTextContent('Delete the file?');
    expect(screen.getByTestId('request')).toBeInTheDocument();
    expect(screen.getByTestId('actions')).toHaveAttribute('data-slot', 'confirmation-actions');
    expect(screen.queryByTestId('accepted')).toBeNull();
    expect(screen.queryByTestId('rejected')).toBeNull();
  });

  it('fires the action handlers', () => {
    const { onAccept, onReject } = renderConfirmation('approval-requested', approvalPending);

    fireEvent.click(screen.getByTestId('accept'));
    fireEvent.click(screen.getByTestId('reject'));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it.each(['approval-responded', 'output-denied', 'output-available'] as const)(
    'shows only the accepted branch in %s once approved',
    state => {
      renderConfirmation(state, approved);

      expect(screen.getByTestId('accepted')).toBeInTheDocument();
      expect(screen.queryByTestId('rejected')).toBeNull();
      expect(screen.queryByTestId('request')).toBeNull();
      expect(screen.queryByTestId('actions')).toBeNull();
    }
  );

  it.each(['approval-responded', 'output-denied', 'output-available'] as const)(
    'shows only the rejected branch in %s once denied',
    state => {
      renderConfirmation(state, rejected);

      expect(screen.getByTestId('rejected')).toBeInTheDocument();
      expect(screen.queryByTestId('accepted')).toBeNull();
    }
  );

  it('shows neither response branch while approval is still pending in a responded state', () => {
    renderConfirmation('approval-responded', approvalPending);

    expect(screen.queryByTestId('accepted')).toBeNull();
    expect(screen.queryByTestId('rejected')).toBeNull();
  });

  it('throws when a sub-component is used outside Confirmation', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ConfirmationRequest>x</ConfirmationRequest>)).toThrow(
      /must be used within Confirmation/
    );
    spy.mockRestore();
  });

  it('passes ...rest and preserved attributes through to the DOM node', () => {
    render(
      <Confirmation
        approval={approvalPending}
        aria-label="Tool approval"
        data-testid="confirmation"
        id="confirm-1"
        state="approval-requested">
        <ConfirmationTitle>Body</ConfirmationTitle>
      </Confirmation>
    );

    const node = screen.getByTestId('confirmation');
    expect(node).toHaveAttribute('id', 'confirm-1');
    expect(node).toHaveAttribute('aria-label', 'Tool approval');
  });

  it('lets a caller className win over the defaults', () => {
    render(
      <Confirmation
        approval={approvalPending}
        className="gap-6"
        data-testid="confirmation"
        state="approval-requested">
        <ConfirmationTitle>Body</ConfirmationTitle>
      </Confirmation>
    );

    const cls = screen.getByTestId('confirmation').className;
    expect(cls).toContain('gap-6');
    expect(cls).not.toContain('gap-2');
  });

  it('uses only OpenHuman semantic tokens, never raw palette classes', () => {
    renderConfirmation('approval-requested', approvalPending);

    for (const id of ['confirmation', 'title', 'actions', 'accept', 'reject']) {
      expect(screen.getByTestId(id).className).not.toMatch(RAW_PALETTE);
    }
  });
});
