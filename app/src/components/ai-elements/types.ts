/**
 * Shared local types for the adapted AI Elements layer.
 *
 * Upstream (vercel/ai-elements, Apache-2.0) imports types from `lucide-react`
 * (`LucideIcon`) and from the `ai` SDK (`ChatStatus`, `FileUIPart`,
 * `SourceDocumentUIPart`). Neither package is a dependency of this app, so the
 * handful of fields actually used are re-declared here rather than pulled in.
 */
import type { ComponentType, SVGProps } from 'react';

/**
 * Stand-in for upstream's `LucideIcon`: any component that takes SVG props.
 * The icons in `./icons.tsx` and `components/ui/icons.tsx` both satisfy it.
 */
export type AiElementIcon = ComponentType<SVGProps<SVGSVGElement>>;
