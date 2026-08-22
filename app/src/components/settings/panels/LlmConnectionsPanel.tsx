import { useT } from '../../../lib/i18n/I18nContext';
import PageSectionHeader from '../../layout/PageSectionHeader';
import AIPanel from './AIPanel';

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

  return (
    <div className="flex h-full flex-col gap-4">
      <PageSectionHeader
        title={t('pages.settings.ai.llm')}
        description={t('connections.header.llm')}
      />
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
        <AIPanel />
      </div>
    </div>
  );
};

export default LlmConnectionsPanel;
