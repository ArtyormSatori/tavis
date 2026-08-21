import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from './Artifact';

const RAW_PALETTE = /\b(?:bg|text|border|ring)-(?:neutral|stone|slate|canvas|white|black)\b/;

const StarIcon = ({ className }: { className?: string }) => (
  <svg aria-hidden="true" className={className} data-testid="star" viewBox="0 0 24 24" />
);

describe('Artifact', () => {
  it('renders the full card structure', () => {
    render(
      <Artifact data-testid="artifact">
        <ArtifactHeader data-testid="header">
          <ArtifactTitle data-testid="title">Quarterly report</ArtifactTitle>
          <ArtifactDescription data-testid="description">Generated just now</ArtifactDescription>
          <ArtifactActions data-testid="actions">
            <ArtifactClose data-testid="close" />
          </ArtifactActions>
        </ArtifactHeader>
        <ArtifactContent data-testid="content">Body</ArtifactContent>
      </Artifact>
    );

    expect(screen.getByTestId('artifact')).toHaveAttribute('data-slot', 'artifact');
    expect(screen.getByTestId('header')).toHaveAttribute('data-slot', 'artifact-header');
    expect(screen.getByTestId('title')).toHaveAttribute('data-slot', 'artifact-title');
    expect(screen.getByTestId('title')).toHaveTextContent('Quarterly report');
    expect(screen.getByTestId('description')).toHaveAttribute('data-slot', 'artifact-description');
    expect(screen.getByTestId('actions')).toHaveAttribute('data-slot', 'artifact-actions');
    expect(screen.getByTestId('content')).toHaveAttribute('data-slot', 'artifact-content');
    expect(screen.getByTestId('content')).toHaveTextContent('Body');
  });

  it('passes ...rest and preserved attributes through to the DOM node', () => {
    render(
      <Artifact data-testid="artifact" id="artifact-1" aria-label="Artifact card" title="hello">
        Body
      </Artifact>
    );

    const node = screen.getByTestId('artifact');
    expect(node).toHaveAttribute('id', 'artifact-1');
    expect(node).toHaveAttribute('aria-label', 'Artifact card');
    expect(node).toHaveAttribute('title', 'hello');
  });

  it('labels the close button from the translated Close string', () => {
    render(<ArtifactClose data-testid="close" />);

    const close = screen.getByTestId('close');
    expect(close).toHaveAttribute('data-slot', 'artifact-close');
    expect(close).toHaveAccessibleName('Close');
    expect(close).toHaveAttribute('type', 'button');
  });

  it('renders the supplied icon and derives the action label from the tooltip', () => {
    render(<ArtifactAction data-testid="action" icon={StarIcon} tooltip="Favourite" />);

    expect(screen.getByTestId('star')).toBeInTheDocument();
    expect(screen.getByTestId('action')).toHaveAccessibleName('Favourite');
  });

  it('prefers an explicit label over the tooltip', () => {
    render(
      <ArtifactAction data-testid="action" icon={StarIcon} label="Star it" tooltip="Favourite" />
    );

    expect(screen.getByTestId('action')).toHaveAccessibleName('Star it');
  });

  it('renders children when no icon is given and no tooltip wrapper is requested', () => {
    render(<ArtifactAction data-testid="action">Ok</ArtifactAction>);

    expect(screen.getByTestId('action')).toHaveTextContent('Ok');
  });

  it('lets a caller className win over the defaults', () => {
    render(
      <Artifact className="bg-surface" data-testid="artifact">
        Body
      </Artifact>
    );

    const cls = screen.getByTestId('artifact').className;
    expect(cls).toContain('bg-surface');
    expect(cls).not.toContain('bg-surface-canvas');
  });

  it('uses only OpenHuman semantic tokens, never raw palette classes', () => {
    render(
      <Artifact data-testid="artifact">
        <ArtifactHeader data-testid="header">
          <ArtifactTitle data-testid="title">T</ArtifactTitle>
          <ArtifactDescription data-testid="description">D</ArtifactDescription>
          <ArtifactActions data-testid="actions">
            <ArtifactClose data-testid="close" />
          </ArtifactActions>
        </ArtifactHeader>
        <ArtifactContent data-testid="content">Body</ArtifactContent>
      </Artifact>
    );

    for (const id of [
      'artifact',
      'header',
      'title',
      'description',
      'actions',
      'close',
      'content',
    ]) {
      expect(screen.getByTestId(id).className).not.toMatch(RAW_PALETTE);
    }
  });
});
