import {
  AssistantRuntimeProvider,
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
        className="flex min-h-0 flex-1 flex-col bg-surface">
        <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
          <ThreadPrimitive.Empty>
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-6 text-center">
              <h1 className="text-lg font-semibold text-content">How can I help?</h1>
              <p className="mt-1 text-sm text-content-muted">Start a new conversation below.</p>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>

        <div className="shrink-0 px-4 pb-4 pt-3 sm:px-6">
          <ComposerPrimitive.Root className="flex w-full flex-col rounded-3xl border border-transparent bg-surface-muted/55 transition-colors focus-within:border-line focus-within:bg-surface-muted/75">
            <ComposerPrimitive.Input
              rows={1}
              placeholder="Send a message..."
              className="max-h-40 min-h-11 w-full resize-none bg-transparent px-3.5 pb-2 pt-3 text-sm leading-5 text-content outline-none placeholder:text-content-faint"
            />
            <div className="flex items-center justify-end px-2 pb-2">
              <ComposerPrimitive.Send className="inline-flex h-8 items-center justify-center rounded-full bg-primary-500 px-3 text-xs font-medium text-content-inverted transition-colors hover:bg-primary-600 disabled:pointer-events-none disabled:opacity-40">
                Send
              </ComposerPrimitive.Send>
            </div>
          </ComposerPrimitive.Root>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export default AssistantUiChat;
