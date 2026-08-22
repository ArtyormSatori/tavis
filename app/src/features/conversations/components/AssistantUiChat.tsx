import { Thread } from '@/components/assistant-ui/thread';
import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useLocalRuntime,
} from '@assistant-ui/react';

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

/** The assistant-ui generated Thread, running against an isolated dummy runtime. */
export function AssistantUiChat() {
  const runtime = useLocalRuntime(localChatModel, {
    adapters: { attachments: localAttachmentAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

export default AssistantUiChat;
