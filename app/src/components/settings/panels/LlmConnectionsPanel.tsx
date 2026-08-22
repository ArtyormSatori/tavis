import { useState } from 'react';

import { useT } from '../../../lib/i18n/I18nContext';
import ChipTabs from '../../layout/ChipTabs';
import AIPanel, { type AIPanelTab } from './AIPanel';

/**
 * The Connections → LLM surface: provider credentials and workload routing.
 *
 * This was a three-chip page — API keys plus two developer diagnostics, Local
 * Model Debug and Agent Chat Debug, which had been folded in here when they
 * were retired as standalone Developer Options pages. Both are gone now, so
 * there is one surface and nothing to switch between: `ChipTabs` over a single
 * item is a control that cannot do anything, and the hash it was backed by
 * addressed panels that no longer exist. `AIPanel` renders directly.
 *
 * It renders unembedded, so it keeps the same PanelPage chrome and `p-4`
 * padding as the sibling Connections tabs (Voice, Embeddings, …); the two-pane
 * shell hides the redundant back button.
 */
const LlmConnectionsPanel = () => {
  const { t } = useT();
  const [tab, setTab] = useState<AIPanelTab>('providers');

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight text-content">
          {t('pages.settings.ai.llm')}
        </h1>
        <p className="text-sm text-content-muted">{t('connections.header.llm')}</p>
      </div>
      <ChipTabs
        className="flex flex-wrap gap-1.5"
        ariaLabel={t('pages.settings.ai.llm')}
        testIdPrefix="ai-tab"
        items={[
          { id: 'providers', label: t('settings.ai.llmProviders') },
          { id: 'routing', label: t('settings.ai.routing') },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <AIPanel tab={tab} onTabChange={setTab} hideTabChrome />
      </div>
    </div>
  );
};

export default LlmConnectionsPanel;
