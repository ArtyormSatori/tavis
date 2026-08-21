import { useT } from '../../lib/i18n/I18nContext';
import { Button } from '../ui';

interface ModelQualityPillProps {
  className?: string;
}

/**
 * Compact read-only pill that shows the current model name and quality tier
 * in the chat composer toolbar. The chevron is decorative (v1: no dropdown).
 */
export default function ModelQualityPill({ className }: ModelQualityPillProps) {
  const { t } = useT();

  return (
    <Button
      variant="tertiary"
      size="xs"
      analyticsId="chat-model-quality-pill"
      aria-label={t('composer.modelSelector')}
      title={t('composer.modelSelector')}
      disabled
      className={`rounded-full text-content-faint disabled:cursor-default disabled:opacity-100 select-none hover:bg-transparent ${className ?? ''}`}>
      <span>OpenHuman</span>
      <span className="text-content-faint">·</span>
      <span>{t('composer.qualityHigh')}</span>
      {/* `shrink-0` keeps the chevron from being squeezed, and the button's
          `px-2` gives it trailing padding so the glyph is never clipped against
          the rounded pill edge (#3292). */}
      <svg
        className="w-3 h-3 ml-0.5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </Button>
  );
}
