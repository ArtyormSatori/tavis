import {
  AssistantRuntimeProvider,
  AttachmentPrimitive,
  AuiIf,
  type ChatModelAdapter,
  ComposerPrimitive,
  CompositeAttachmentAdapter,
  MessagePrimitive,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  ThreadPrimitive,
  useLocalRuntime,
} from '@assistant-ui/react';

/**
 * A local-only runtime so the assistant-ui primitives can be exercised without
 * an OpenHuman connector, stored conversation, or real model request.
 */
const localChatModel: ChatModelAdapter = {
  run: async () => ({
    content: [
      {
        type: 'text',
        text: 'This is a local placeholder response. OpenHuman connectors are not wired in yet.',
      },
    ],
  }),
};

const localAttachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

/** A raw assistant-ui surface with no application styling or connector code. */
export function AssistantUiChat() {
  const runtime = useLocalRuntime(localChatModel, {
    adapters: { attachments: localAttachmentAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root data-testid="assistant-ui-chat">
        <ThreadPrimitive.Viewport turnAnchor="top">
          <ThreadPrimitive.Empty>How can I help you today?</ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages>
            {() => (
              <MessagePrimitive.Root>
                <MessagePrimitive.Parts />
              </MessagePrimitive.Root>
            )}
          </ThreadPrimitive.Messages>
          <ThreadPrimitive.ViewportFooter>
            <ComposerPrimitive.Root>
              <ComposerPrimitive.AttachmentDropzone>
                <ComposerPrimitive.Attachments>
                  {() => (
                    <AttachmentPrimitive.Root>
                      <AttachmentPrimitive.Name />
                      <AttachmentPrimitive.Remove>Remove</AttachmentPrimitive.Remove>
                    </AttachmentPrimitive.Root>
                  )}
                </ComposerPrimitive.Attachments>
                <ComposerPrimitive.Input placeholder="Send a message..." />
                <ComposerPrimitive.AddAttachment>Add attachment</ComposerPrimitive.AddAttachment>
                <AuiIf condition={state => !state.thread.isRunning}>
                  <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
                </AuiIf>
                <AuiIf condition={state => state.thread.isRunning}>
                  <ComposerPrimitive.Cancel>Cancel</ComposerPrimitive.Cancel>
                </AuiIf>
              </ComposerPrimitive.AttachmentDropzone>
            </ComposerPrimitive.Root>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export default AssistantUiChat;
