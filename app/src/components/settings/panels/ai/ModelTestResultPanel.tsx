/*
 * "Test model" result banner for the custom-routing dialog — shown while the
 * test is running, and after it succeeds or fails.
 */
import { useT } from '../../../../lib/i18n/I18nContext';
import { formatI18n } from './aiPanelTypes';

export const ModelTestResultPanel = ({
  testBusy,
  testReply,
  testError,
  testStartedAt,
  currentProviderString,
}: {
  testBusy: boolean;
  testReply: string | null;
  testError: string | null;
  testStartedAt: string | null;
  currentProviderString: string | null;
}) => {
  const { t } = useT();
  if (!testBusy && !testReply && !testError && !testStartedAt) return null;

  return (
    <div
      role={testError ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-xs ${
        testError
          ? 'border-coral-200 dark:border-coral-500/30 bg-coral-50 dark:bg-coral-500/10 text-coral-700 dark:text-coral-300'
          : testBusy
            ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200'
            : 'border-sage-200 dark:border-sage-500/30 bg-sage-50 dark:bg-sage-500/10 text-sage-800 dark:text-sage-200'
      }`}>
      <div className="font-semibold">
        {testError
          ? t('settings.ai.testFailed')
          : testBusy
            ? t('settings.ai.testingModel')
            : t('settings.ai.modelResponse')}
      </div>
      <div className="mt-1 space-y-1">
        <div className="font-mono text-[11px] text-current/80">
          {formatI18n(t('settings.ai.providerWithValue'), {
            value: currentProviderString ?? t('settings.ai.noneDash'),
          })}
        </div>
        <div className="font-mono text-[11px] text-current/80">
          {t('settings.ai.promptHelloWorld')}
        </div>
        {testStartedAt && (
          <div className="font-mono text-[11px] text-current/80">
            {formatI18n(t('settings.ai.startedAt'), { value: testStartedAt })}
          </div>
        )}
      </div>
      {testBusy ? (
        <div className="mt-2 rounded-md border border-current/15 bg-surface/70 px-3 py-2 text-[12px]">
          {t('settings.ai.waitingForModelResponse')}
        </div>
      ) : testError ? (
        <div className="mt-2 rounded-md border border-current/15 bg-surface/70 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap break-words">
          {testError}
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-current/80">
            {t('settings.ai.response')}
          </div>
          <div className="rounded-md border border-current/15 bg-surface/70 px-3 py-3 text-[13px] leading-relaxed text-content whitespace-pre-wrap break-words">
            {testReply}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelTestResultPanel;
