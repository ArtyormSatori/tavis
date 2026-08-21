/*
 * Top-level routing-mode picker: three large selectable cards (Managed / Use
 * Your Own / Advanced) plus the "managed" confirmation banner.
 */
import { useT } from '../../../../lib/i18n/I18nContext';
import Button from '../../../ui/Button';
import type { RoutingMode } from './aiPanelTypes';

export const RoutingModeCards = ({
  effectiveRoutingMode,
  onSelectManaged,
  onSelectOwn,
  onSelectCustom,
}: {
  effectiveRoutingMode: RoutingMode;
  onSelectManaged: () => void;
  onSelectOwn: () => void;
  onSelectCustom: () => void;
}) => {
  const { t } = useT();
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onSelectManaged}
          className={`h-full min-h-[152px] flex-col items-start justify-start rounded-2xl p-4 text-left font-normal normal-case ${
            effectiveRoutingMode === 'managed'
              ? 'border-sage-300 bg-sage-50 dark:border-sage-500/40 dark:bg-sage-500/10'
              : 'bg-surface hover:bg-surface-hover'
          }`}>
          <div className="text-sm font-semibold text-content">{t('settings.ai.routing.managed')}</div>
          <p className="mt-2 text-xs leading-5 text-content-secondary">
            {t('settings.ai.routing.managedDesc')}
          </p>
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={onSelectOwn}
          className={`h-full min-h-[152px] flex-col items-start justify-start rounded-2xl p-4 text-left font-normal normal-case ${
            effectiveRoutingMode === 'own'
              ? 'border-primary-300 bg-primary-50 dark:border-primary-500/40 dark:bg-primary-500/10'
              : 'bg-surface hover:bg-surface-hover'
          }`}>
          <div className="text-sm font-semibold text-content">
            {t('settings.ai.routing.useYourOwn')}
          </div>
          <p className="mt-2 text-xs leading-5 text-content-secondary">
            {t('settings.ai.routing.useYourOwnDesc')}
          </p>
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={onSelectCustom}
          className={`h-full min-h-[152px] flex-col items-start justify-start rounded-2xl p-4 text-left font-normal normal-case ${
            effectiveRoutingMode === 'custom'
              ? 'border-primary-300 bg-primary-50 dark:border-primary-500/40 dark:bg-primary-500/10'
              : 'bg-surface hover:bg-surface-hover'
          }`}>
          <div className="text-sm font-semibold text-content">
            {t('settings.ai.routing.advanced')}
          </div>
          <p className="mt-2 text-xs leading-5 text-content-secondary">
            {t('settings.ai.routing.advancedDesc')}
          </p>
        </Button>
      </div>

      {effectiveRoutingMode === 'managed' ? (
        <div className="rounded-xl border border-sage-200 bg-sage-50/70 px-4 py-3 text-sm text-sage-900 dark:border-sage-500/30 dark:bg-sage-500/10 dark:text-sage-100">
          {t('settings.ai.routing.managedMsg')}
        </div>
      ) : null}
    </>
  );
};

export default RoutingModeCards;
