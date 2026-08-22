import {
  AttachmentPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  ChatModelAdapter,
  CompositeAttachmentAdapter,
  ComposerPrimitive,
  MessagePrimitive,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
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
const localChatModel: ChatModelAdapter = {
  run: async () => ({
    content: [
      {
        type: 'text',
        text: 'This is a local placeholder response. OpenHuman data and model connectors are not wired in yet.',
      },
    ],
  }),
};

const localAttachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

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

function ComposerAttachment() {
  return (
    <AttachmentPrimitive.Root className="flex max-w-52 items-center gap-2 rounded-lg border border-line bg-surface-subtle px-2 py-1.5 text-xs text-content">
      <AttachmentPrimitive.Name />
      <AttachmentPrimitive.Remove asChild>
        <button
          type="button"
          className="ml-auto text-content-muted transition-colors hover:text-content"
          aria-label="Remove attachment">
          ×
        </button>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

/** The Base example's composer structure, expressed with the app's tokens. */
function BaseComposer() {
  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div className="flex w-full cursor-text flex-col gap-2 rounded-3xl border border-line bg-surface p-2 transition-colors focus-within:border-line-strong data-[dragging=true]:border-dashed data-[dragging=true]:bg-surface-hover">
          <ComposerPrimitive.Attachments components={{ Attachment: ComposerAttachment }} />
          <ComposerPrimitive.Input
            rows={1}
            placeholder="Send a message..."
            className="max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-sm leading-6 text-content outline-none placeholder:text-content-faint"
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-1">
              <ComposerPrimitive.AddAttachment asChild>
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
                  aria-label="Add attachment">
                  <span className="text-lg leading-none">+</span>
                </button>
              </ComposerPrimitive.AddAttachment>
              <select
                aria-label="Dummy model selector"
                defaultValue="openhuman-demo"
                className="h-7 max-w-36 rounded-full bg-transparent px-2 text-xs font-medium text-content outline-none hover:bg-surface-hover">
                <option value="openhuman-demo">OpenHuman Demo</option>
                <option value="fast-demo">Fast Demo</option>
                <option value="reasoning-demo">Reasoning Demo</option>
              </select>
            </div>
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
  const runtime = useLocalRuntime(localChatModel, {
    adapters: { attachments: localAttachmentAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root
        data-testid="assistant-ui-chat"
        className="flex h-full min-h-0 flex-1 flex-col bg-surface"
        style={{
          ['--thread-max-width' as string]: '44rem',
          ['--composer-radius' as string]: '1.5rem',
          ['--composer-padding' as string]: '8px',
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
