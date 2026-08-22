import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/assistant-ui/ui/dialog';
import { TargetIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useT } from '../../../../lib/i18n/I18nContext';
import { Button } from '../../../../components/ui';

export type GoalSelectorProps = {
  goal: string | null;
  onGoalChange: (goal: string | null) => void;
  /** Controlled so a slash command can open the same dialog the pill opens. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The thread's goal: a pill showing the current one, and a dialog to set, edit
 * or remove it.
 *
 * Open state is controlled by the caller rather than owned here because there
 * are two ways in — clicking the pill and typing `/goal` — and a component that
 * owned its own state could only serve the first.
 */
export function GoalSelector({ goal, onGoalChange, open, onOpenChange }: GoalSelectorProps) {
  const { t } = useT();
  const [draft, setDraft] = useState(goal ?? '');

  // Reopening after a cancel should show the saved goal, not the abandoned
  // edit, so the draft resyncs on each open rather than only on mount.
  useEffect(() => {
    if (open) setDraft(goal ?? '');
  }, [open, goal]);

  const save = () => {
    const trimmed = draft.trim();
    onGoalChange(trimmed.length > 0 ? trimmed : null);
    onOpenChange(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={t('conversations.composer.goal.title')}
        className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 min-w-0 shrink items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors">
        <TargetIcon className="size-3.5 shrink-0" />
        <span className="max-w-40 truncate">
          {goal ?? t('conversations.composer.goal.set')}
        </span>
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('conversations.composer.goal.title')}</DialogTitle>
            <DialogDescription>
              {t('conversations.composer.goal.description')}
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={3}
            autoFocus
            placeholder={t('conversations.composer.goal.placeholder')}
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-content-faint focus:outline-hidden focus:ring-2 focus:ring-primary-500/20"
          />

          <DialogFooter>
            {goal !== null && (
              <Button
                variant="ghost"
                onClick={() => {
                  onGoalChange(null);
                  onOpenChange(false);
                }}>
                {t('common.remove')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GoalSelector;
