/**
 * The AI-elements layer — chat-surface components adapted from
 * vercel/ai-elements (Apache-2.0) onto this app's own primitives and tokens.
 *
 * Same rule as `components/ui`: if a component exists here, import it from
 * `components/ai-elements` rather than reaching into the file. These are
 * compound components — a root plus its slots — so each family is exported as
 * a group, and the shared tool-part wire shapes come from `./types`.
 */

// Tool calls
export {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  ToolStatusBadge,
  getStatusBadge,
  type ToolContentProps,
  type ToolHeaderProps,
  type ToolInputProps,
  type ToolOutputProps,
  type ToolProps,
} from './Tool';
export type { DynamicToolPart, StaticToolPart, ToolPart, ToolPartState } from './types';

// Tool approval
export {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
  type ConfirmationAcceptedProps,
  type ConfirmationActionProps,
  type ConfirmationActionsProps,
  type ConfirmationProps,
  type ConfirmationRejectedProps,
  type ConfirmationRequestProps,
  type ConfirmationState,
  type ConfirmationTitleProps,
  type ToolApproval,
} from './Confirmation';

// Model thinking
export {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  useReasoning,
  type ReasoningContentProps,
  type ReasoningProps,
  type ReasoningTriggerProps,
} from './Reasoning';
export {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
  type ChainOfThoughtContentProps,
  type ChainOfThoughtHeaderProps,
  type ChainOfThoughtImageProps,
  type ChainOfThoughtProps,
  type ChainOfThoughtSearchResultProps,
  type ChainOfThoughtSearchResultsProps,
  type ChainOfThoughtStepIcon,
  type ChainOfThoughtStepProps,
  type ChainOfThoughtStepStatus,
} from './ChainOfThought';

// Work in progress
export {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
  type PlanActionProps,
  type PlanContentProps,
  type PlanDescriptionProps,
  type PlanFooterProps,
  type PlanHeaderProps,
  type PlanProps,
  type PlanTitleProps,
  type PlanTriggerProps,
} from './Plan';
export {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
  type TaskContentProps,
  type TaskItemFileProps,
  type TaskItemProps,
  type TaskProps,
  type TaskTriggerProps,
} from './Task';

// Output surfaces
export {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
  type ArtifactActionProps,
  type ArtifactActionsProps,
  type ArtifactCloseProps,
  type ArtifactContentProps,
  type ArtifactDescriptionProps,
  type ArtifactHeaderProps,
  type ArtifactProps,
  type ArtifactTitleProps,
} from './Artifact';
export {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
  type SourceProps,
  type SourcesContentProps,
  type SourcesProps,
  type SourcesTriggerProps,
} from './Sources';

// Transcript shell
export {
  Conversation,
  ConversationContent,
  type ConversationContentProps,
  type ConversationProps,
} from './Conversation';
export {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  type MessageActionProps,
  type MessageActionsProps,
  type MessageContentProps,
  type MessageProps,
  type MessageRole,
} from './Message';

// Composer affordances
export { Suggestion, Suggestions, type SuggestionProps, type SuggestionsProps } from './Suggestion';

// Icons
export { BookIcon, BrainIcon, ChevronDownIcon, DotIcon } from './icons';
