import { createRoot } from 'react-dom/client';
import './index.css';
import { COMPOSER_DROPZONE, COMPOSER_INPUT } from './components/chat/composer/composerStyles';

createRoot(document.getElementById('root')!).render(
  <div className="p-10">
    <div className={COMPOSER_DROPZONE} id="dropzone">
      <textarea id="probe" className={COMPOSER_INPUT} placeholder="probe composer" />
    </div>
  </div>
);
