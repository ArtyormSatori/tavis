import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ContentSurface from './ContentSurface';

describe('ContentSurface', () => {
  afterEach(cleanup);

  it('renders children', () => {
    render(
      <ContentSurface>
        <p>routed page</p>
      </ContentSurface>
    );
    expect(screen.getByText('routed page')).toBeTruthy();
  });

  it('frames the surface as an inset rounded card by default', () => {
    render(<ContentSurface>body</ContentSurface>);
    const surface = screen.getByTestId('app-content-surface');
    expect(surface.className).toContain('rounded-2xl');
    expect(surface.className).toContain('shadow-content-edge');
    // Asymmetric insets: hairline against the sidebar/top, 8px on free edges.
    expect(surface.className).toContain('mt-px');
    expect(surface.className).toContain('ml-px');
    expect(surface.className).toContain('mr-2');
    expect(surface.className).toContain('mb-2');
    expect(surface.dataset.unframed).toBeUndefined();
  });

  it('drops the radius, insets and seam when unframed', () => {
    render(<ContentSurface unframed>body</ContentSurface>);
    const surface = screen.getByTestId('app-content-surface');
    // A native CEF webview composites above HTML as a plain rectangle, so any
    // radius here would leave four square corners poking through the card.
    expect(surface.className).not.toContain('rounded-2xl');
    expect(surface.className).not.toContain('shadow-content-edge');
    expect(surface.className).not.toContain('mr-2');
    expect(surface.dataset.unframed).toBe('true');
  });

  it('keeps the bounded flex column in both modes so the page owns the scroll', () => {
    const { rerender } = render(<ContentSurface>body</ContentSurface>);
    expect(screen.getByTestId('app-content-surface').className).toContain('min-h-0');
    rerender(<ContentSurface unframed>body</ContentSurface>);
    const surface = screen.getByTestId('app-content-surface');
    expect(surface.className).toContain('min-h-0');
    expect(surface.className).toContain('flex-1');
    expect(surface.className).toContain('bg-surface');
  });
});
