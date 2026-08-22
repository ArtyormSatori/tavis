import { createRoot } from 'react-dom/client';
import './index.css';
import { AssistantUiChat } from './features/conversations/components/AssistantUiChat';
createRoot(document.getElementById('root')!).render(
  <div className="h-dvh w-full overflow-hidden bg-surface">
    <AssistantUiChat />
  </div>
);
