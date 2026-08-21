/**
 * JoinPolicyToggle — 3-segment radio control for per-meeting join policy.
 *
 * Values: "auto" | "ask" | "skip"
 *
 * Phase 2: local state only. Phase 3 will add persistence.
 */
import { cn } from '../../lib/cn';
import { useT } from '../../lib/i18n/I18nContext';
import Button from '../ui/Button';

export type JoinPolicy = 'auto' | 'ask' | 'skip';

interface JoinPolicyToggleProps {
  value: JoinPolicy;
  onChange: (v: JoinPolicy) => void;
  disabled?: boolean;
  /** Compact variant: smaller text, tighter padding (default false). */
  compact?: boolean;
}

const SEGMENTS: JoinPolicy[] = ['auto', 'ask', 'skip'];

const KEY_MAP: Record<JoinPolicy, string> = {
  auto: 'skills.meetingBots.upcoming.auto',
  ask: 'skills.meetingBots.upcoming.ask',
  skip: 'skills.meetingBots.upcoming.skip',
};

export function JoinPolicyToggle({
  value,
  onChange,
  disabled = false,
  compact = false,
}: JoinPolicyToggleProps) {
  const { t } = useT();

  return (
    <div
      role="radiogroup"
      aria-label={t('skills.meetingBots.upcoming.joinPolicy')}
      className={cn(
        'inline-flex rounded-md border border-white/10 overflow-hidden',
        disabled && 'opacity-50 pointer-events-none'
      )}>
      {SEGMENTS.map(seg => {
        const isActive = seg === value;
        return (
          <Button
            key={seg}
            variant={isActive ? 'primary' : 'tertiary'}
            size="xs"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(seg)}
            className={cn(
              'h-auto rounded-none focus-visible:ring-offset-0',
              compact ? 'px-2 py-0.5' : 'px-2.5 py-1',
              !isActive && 'font-normal hover:text-content'
            )}>
            {t(KEY_MAP[seg])}
          </Button>
        );
      })}
    </div>
  );
}
