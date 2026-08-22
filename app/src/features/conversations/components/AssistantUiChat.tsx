import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
} from '@assistant-ui/react';

/**
 * The deliberately local first pass of the chat surface.
 *
 * This is a direct assistant-ui composition: no Redux projection, OpenHuman
 * message adapter, persistence, or model request is attached yet. Keeping the
 * inert model here gives the library's Thread and Composer primitives a real
 * runtime while making the boundary for the next integration step explicit.
 */
const localChatModel = { run: async () => ({ content: [] }) };

function ArrowUpIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19V5m0 0-6 6m6-6 6 6"
      />
    </svg>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-4 py-2 sm:px-6">
      <div className="max-w-[80%] rounded-2xl bg-primary-500 px-3.5 py-2.5 text-sm leading-6 text-content-inverted">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.If hasContent>
      <MessagePrimitive.Root className="px-4 py-2 sm:px-6">
        <div className="max-w-[80%] rounded-2xl bg-surface-muted px-3.5 py-2.5 text-sm leading-6 text-content">
          <MessagePrimitive.Parts />
        </div>
      </MessagePrimitive.Root>
    </MessagePrimitive.If>
  );
}

/** The Base example's composer structure, expressed with the app's tokens. */
function BaseComposer() {
  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div className="flex w-full cursor-text flex-col gap-2 rounded-3xl border border-line bg-surface p-2 transition-colors focus-within:border-line-strong data-[dragging=true]:border-dashed data-[dragging=true]:bg-surface-hover">
          <ComposerPrimitive.Input
            rows={1}
            placeholder="Send a message..."
            className="max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-sm leading-6 text-content outline-none placeholder:text-content-faint"
          />
          <div className="relative flex items-center justify-between">
            <div />
            <div className="flex items-center gap-1.5">
              <AuiIf condition={state => !state.thread.isRunning}>
                <ComposerPrimitive.Send asChild>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-full bg-primary-500 text-content-inverted transition-colors hover:bg-primary-600 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Send message">
                    <ArrowUpIcon />
                  </button>
                </ComposerPrimitive.Send>
              </AuiIf>
              <AuiIf condition={state => state.thread.isRunning}>
                <ComposerPrimitive.Cancel asChild>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-full bg-primary-500 text-content-inverted transition-colors hover:bg-primary-600"
                    aria-label="Stop generating">
                    <span className="size-3 rounded-sm bg-current" />
                  </button>
                </ComposerPrimitive.Cancel>
              </AuiIf>
            </div>
          </div>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
}

/**
 * A standalone assistant-ui chat surface.
 *
 * It is intentionally isolated from the application's existing conversation
 * connector. The UI is ready to be wired to OpenHuman in a following step,
 * while this component establishes the raw library structure and behaviour.
 */
export function AssistantUiChat() {
  const runtime = useLocalRuntime(localChatModel);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root
        data-testid="assistant-ui-chat"
        className="flex h-full min-h-0 flex-1 flex-col bg-surface"
        style={{
          '--thread-max-width': '44rem',
          '--composer-radius': '1.5rem',
          '--composer-padding': '8px',
        }}>
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          className="relative flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-scroll px-4 pt-4">
          <ThreadPrimitive.Empty>
            <div className="mx-auto mb-6 flex w-full max-w-[var(--thread-max-width)] flex-col items-center px-4 text-center">
              <h1 className="text-2xl font-medium tracking-tight text-content">
                How can I help you today?
              </h1>
            </div>
          </ThreadPrimitive.Empty>
          <div className="mb-14 flex flex-col gap-y-6 empty:hidden">
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          </div>
          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto flex w-full flex-col overflow-visible bg-surface pb-4 pt-3 md:pb-6">
            <div className="mx-auto w-full max-w-[var(--thread-max-width)]">
              <BaseComposer />
            </div>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export default AssistantUiChat;
