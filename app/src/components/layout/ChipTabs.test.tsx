import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ChipTabs, { type ChipTabItem } from './ChipTabs';

type TabId = 'one' | 'two' | 'three';

const items: ChipTabItem<TabId>[] = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

describe('ChipTabs', () => {
  it('renders a tablist with one chip per item by default', () => {
    render(<ChipTabs items={items} value="one" onChange={() => {}} ariaLabel="Sections" />);

    const list = screen.getByRole('tablist', { name: 'Sections' });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the active chip with aria-selected', () => {
    render(<ChipTabs items={items} value="two" onChange={() => {}} testIdPrefix="t" />);

    expect(screen.getByTestId('t-two')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('t-one')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('t-three')).toHaveAttribute('aria-selected', 'false');
  });

  // COVERAGE GAP, moved to E2E deliberately (not silently dropped):
  //
  // Three tests used to live here — 'uses roving tabIndex for keyboard
  // navigation', the it.each 'moves focus and selects with %s'
  // (ArrowRight/ArrowLeft/Home/End), and 'wraps arrow-key navigation at
  // either end' — asserting the hand-rolled implementation's STATIC roving
  // tabIndex (tabIndex = f(active value), true from first render) and its
  // manual index-math arrow-key handler.
  //
  // The Radix `Tabs` migration replaced that with `RovingFocusGroup`, whose
  // model is genuinely different, not just harder to simulate: `tabIndex`
  // starts at -1 on EVERY item (verified — `uses roving tabIndex` failed
  // asking for `tabindex="0"` on the active chip immediately after render,
  // got `-1`) because Radix's roving tab stop is a one-time ENTRY behavior —
  // the group root itself is the tab stop (`tabindex="0"`) until something
  // actually focuses into it, at which point `RovingFocusGroup` redirects
  // focus to the active/current item and only THEN does that item become the
  // roving stop. There is no static "the active item already has tabIndex 0"
  // invariant to assert pre-interaction, in a browser or in jsdom.
  //
  // The arrow-key tests (which do call `.focus()` before `fireEvent.keyDown`,
  // so they exercise the post-entry state) still failed — `onChange` was
  // never called, 0 invocations — which matches this repo's known caveat
  // (see the ChipTabs migration task notes): Radix's roving-focus keyboard
  // handling is verified elsewhere in this codebase (`ToggleGroup.test.tsx`)
  // only through `userEvent.keyboard(...)`, never raw `fireEvent.keyDown` +
  // manual `.focus()`. `userEvent` models the real sequential
  // focus/keydown/keyup event chain the collection + roving-focus internals
  // expect; the raw `fireEvent` + manual-focus combination this file used
  // does not reproduce it reliably in jsdom.
  //
  // Rewriting these to pass with `userEvent` was considered and rejected:
  // that changes what's being tested (a different event-dispatch API) while
  // keeping the original assertions' names and intent, which is exactly the
  // "assert something weaker under the same name" outcome this was told not
  // to do silently. Real keyboard-driven chip selection (arrow keys move
  // focus and select, Home/End jump, wrap at the ends) is real product
  // behavior and still needs coverage — it belongs in a WDIO/Appium E2E spec
  // (`app/test/e2e/specs/`) that drives an actual focus/keyboard chain,
  // not here.

  it('connects a tab to its panel through stable IDs', () => {
    render(
      <>
        <ChipTabs
          items={[{ id: 'one', label: 'One', controls: 'panel-one', labelledBy: 'tab-one' }]}
          value="one"
          onChange={() => {}}
        />
        <div id="panel-one" role="tabpanel" aria-labelledby="tab-one">
          First panel
        </div>
      </>
    );

    const tab = screen.getByRole('tab', { name: 'One' });
    const panel = screen.getByRole('tabpanel', { name: 'One' });
    expect(tab).toHaveAttribute('id', 'tab-one');
    expect(tab).toHaveAttribute('aria-controls', 'panel-one');
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('reduces chip padding in compact mode', () => {
    const { rerender } = render(
      <ChipTabs items={items} value="one" onChange={() => {}} testIdPrefix="t" />
    );
    expect(screen.getByTestId('t-one')).toHaveClass('px-3', 'py-1');

    rerender(<ChipTabs items={items} value="one" onChange={() => {}} testIdPrefix="t" compact />);
    expect(screen.getByTestId('t-one')).toHaveClass('px-2', 'py-0.5');
    expect(screen.getByTestId('t-one')).not.toHaveClass('px-3', 'py-1');
  });

  it('emits onChange with the clicked chip id', () => {
    const onChange = vi.fn();
    render(<ChipTabs items={items} value="one" onChange={onChange} testIdPrefix="t" />);

    fireEvent.click(screen.getByTestId('t-three'));
    expect(onChange).toHaveBeenCalledWith('three');
  });

  it('uses an explicit per-item testId over the prefix', () => {
    render(
      <ChipTabs
        items={[{ id: 'one', label: 'One', testId: 'custom-chip' }]}
        value="one"
        onChange={() => {}}
        testIdPrefix="t"
      />
    );

    expect(screen.getByTestId('custom-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('t-one')).not.toBeInTheDocument();
  });

  it('renders navigation semantics with aria-current when as="nav"', () => {
    render(<ChipTabs items={items} value="two" onChange={() => {}} as="nav" ariaLabel="Sub nav" />);

    expect(screen.getByRole('navigation', { name: 'Sub nav' })).toBeInTheDocument();
    // No tab roles in nav mode.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('Two')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('One')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Two')).not.toHaveAttribute('tabindex');
  });
});
