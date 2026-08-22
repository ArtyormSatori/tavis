import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import './index.css';
import { store } from './store';
import { I18nProvider } from './lib/i18n/I18nContext';
import { AssistantUiChat } from './features/conversations/components/AssistantUiChat';
createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <I18nProvider>
      <div className="h-dvh w-full overflow-hidden bg-surface">
        <AssistantUiChat />
      </div>
    </I18nProvider>
  </Provider>
);
