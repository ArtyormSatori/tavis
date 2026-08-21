/**
 * RecoveryPhraseImportMode — word-count selector (now a `ToggleGroup`,
 * single-select) plus the word-slot grid.
 */
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RecoveryPhraseImportMode from './RecoveryPhraseImportMode';

function renderMode(selectedWordCount = 12) {
  const inputRefs = createRef<(HTMLInputElement | null)[]>();
  (inputRefs as { current: (HTMLInputElement | null)[] }).current = [];
  const onWordCountChange = vi.fn();
  render(
    <RecoveryPhraseImportMode
      importWords={Array.from({ length: selectedWordCount }, () => '')}
      selectedWordCount={selectedWordCount}
      importValid={null}
      inputRefs={inputRefs as never}
      onWordCountChange={onWordCountChange}
      onWordChange={vi.fn()}
      onWordKeyDown={vi.fn()}
      onSwitchToGenerate={vi.fn()}
    />
  );
  return { onWordCountChange };
}

describe('RecoveryPhraseImportMode', () => {
  it('marks the active word-count option as pressed', () => {
    renderMode(12);
    const twelve = screen.getByRole('button', { name: '12' });
    const twentyFour = screen.getByRole('button', { name: '24' });
    expect(twelve).toHaveAttribute('aria-pressed', 'true');
    expect(twelve).toHaveAttribute('data-state', 'on');
    expect(twentyFour).toHaveAttribute('aria-pressed', 'false');
    expect(twentyFour).toHaveAttribute('data-state', 'off');
  });

  it('calls onWordCountChange when a different count is selected', () => {
    const { onWordCountChange } = renderMode(12);
    fireEvent.click(screen.getByRole('button', { name: '24' }));
    expect(onWordCountChange).toHaveBeenCalledWith(24);
  });

  it('renders one labelled input per word slot', () => {
    renderMode(12);
    expect(screen.getAllByLabelText(/Recovery phrase word/i)).toHaveLength(12);
  });
});
