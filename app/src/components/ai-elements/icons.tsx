/**
 * Inline icons for the adapted AI Elements layer.
 *
 * Upstream uses `lucide-react` (`BrainIcon`, `ChevronDownIcon`, `DotIcon`,
 * `BookIcon`). `lucide-react` is not a dependency here and may not be added,
 * and `components/ui/icons.tsx` only ships Spinner/Check/Close/Warning — so
 * these four are hand-drawn as small `aria-hidden` SVGs on the same 24×24 grid
 * and `currentColor` stroke as the existing ui icons.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  'aria-hidden': true as const,
  focusable: 'false' as const,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

export function BrainIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A3 3 0 0 0 6.5 17 2.5 2.5 0 0 0 9.5 21a2.5 2.5 0 0 0 2.5-2.5V5.5A2.5 2.5 0 0 0 9.5 3Z" />
      <path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5A3 3 0 0 1 17.5 17 2.5 2.5 0 0 1 14.5 21 2.5 2.5 0 0 1 12 18.5V5.5A2.5 2.5 0 0 1 14.5 3Z" />
    </svg>
  );
}

export function ChevronDownIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function DotIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BookIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}
