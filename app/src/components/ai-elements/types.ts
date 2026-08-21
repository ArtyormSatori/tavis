/**
 * Minimal local stand-ins for the `ai` package's UI-part types.
 *
 * Upstream AI Elements (vercel/ai-elements, Apache-2.0) imports `ToolUIPart`,
 * `DynamicToolUIPart` and friends from the `ai` SDK. That package is not a
 * dependency of this app, so only the handful of fields the adapted components
 * actually read are re-declared here. Deliberately narrow: this is a wire shape
 * the caller supplies, not a copy of the SDK's type graph.
 */

/** Lifecycle of a single tool invocation, as the AI SDK models it. */
export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-denied'
  | 'output-error';

interface ToolPartBase {
  state: ToolPartState;
  /** Arguments the model produced for the call. Rendered as JSON. */
  input?: unknown;
  /** Whatever the tool returned — a string, JSON-able object, or an element. */
  output?: unknown;
  /** Populated instead of `output` when the call failed. */
  errorText?: string;
}

/** A statically registered tool: `type` is `tool-<name>`. */
export interface StaticToolPart extends ToolPartBase {
  type: `tool-${string}`;
  toolName?: never;
}

/** A tool resolved at runtime, whose name travels as its own field. */
export interface DynamicToolPart extends ToolPartBase {
  type: 'dynamic-tool';
  toolName: string;
}

export type ToolPart = StaticToolPart | DynamicToolPart;
