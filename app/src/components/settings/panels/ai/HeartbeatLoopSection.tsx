/*
 * Heartbeat controls + loop map — the left column of BackgroundLoopControls.
 * Pure presentational component: all state lives in the parent hook.
 */
import {
  type HeartbeatPlannerSummary,
  type HeartbeatSettings,
  type HeartbeatSettingsPatch,
} from '../../../../utils/tauriCommands/heartbeat';
import Button from '../../../ui/Button';
import { SettingsSelect, SettingsStatusLine } from '../../controls';
import { formatI18n } from './aiPanelTypes';
import { LoopToggle } from './backgroundLoopPrimitives';

export type HeartbeatLoop = {
  name: string;
  enabled: boolean;
  cadence: string;
  route: string;
  work: string;
  risk: string;
};

export const HeartbeatLoopSection = ({
  t,
  settings,
  loading,
  saving,
  runningTick,
  plannerSummary,
  error,
  loops,
  maxCalendarConnectionsPerTick,
  onRefresh,
  onApplyPatch,
  onRunPlannerNow,
}: {
  t: (key: string, fallback?: string) => string;
  settings: HeartbeatSettings | null;
  loading: boolean;
  saving: string | null;
  runningTick: boolean;
  plannerSummary: HeartbeatPlannerSummary | null;
  error: string;
  loops: HeartbeatLoop[];
  maxCalendarConnectionsPerTick: number;
  onRefresh: () => void;
  onApplyPatch: (patch: HeartbeatSettingsPatch) => void;
  onRunPlannerNow: () => void;
}) => (
  <div className="space-y-3">
    <div className="rounded-lg border border-line bg-surface-muted p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-content">
            {t('settings.ai.heartbeatControls')}
          </div>
          <div className="text-xs text-content-muted">{t('settings.ai.heartbeatControlsDesc')}</div>
        </div>
        <Button type="button" variant="secondary" size="xs" onClick={onRefresh} disabled={loading}>
          {t('common.refresh')}
        </Button>
      </div>

      {error && <SettingsStatusLine saving={false} error={error} savedNote={null} savingLabel="" />}

      {settings ? (
        <div className="space-y-2">
          <LoopToggle
            label={t('settings.ai.heartbeatLoop')}
            description={t('settings.ai.heartbeatLoopDesc')}
            checked={settings.enabled}
            busy={saving === 'enabled'}
            onToggle={() => onApplyPatch({ enabled: !settings.enabled })}
          />
          <LoopToggle
            label={t('settings.ai.subconsciousInference')}
            description={t('settings.ai.subconsciousInferenceDesc')}
            checked={settings.inference_enabled}
            busy={saving === 'inference_enabled'}
            onToggle={() => onApplyPatch({ inference_enabled: !settings.inference_enabled })}
          />
          <LoopToggle
            label={t('settings.ai.calendarMeetingChecks')}
            description={t('settings.ai.calendarMeetingChecksDesc')}
            checked={settings.notify_meetings}
            busy={saving === 'notify_meetings'}
            onToggle={() => onApplyPatch({ notify_meetings: !settings.notify_meetings })}
          />
          <div className="grid gap-2 rounded-lg border border-line bg-surface px-3 py-2 sm:grid-cols-3">
            <label className="min-w-0 space-y-1 text-xs font-medium text-content-secondary">
              <span className="whitespace-nowrap">{t('settings.ai.calendarCap')}</span>
              <SettingsSelect
                aria-label={t('settings.ai.calendarCap')}
                value={maxCalendarConnectionsPerTick}
                disabled={saving === 'max_calendar_connections_per_tick'}
                onChange={e =>
                  onApplyPatch({ max_calendar_connections_per_tick: Number(e.target.value) })
                }
                className="w-full"
                inputSize="sm">
                {[1, 2, 3, 5, 10].map(count => (
                  <option key={count} value={count}>
                    {formatI18n(t('settings.ai.connectionsPerTick'), { count })}
                  </option>
                ))}
              </SettingsSelect>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-content-secondary">
              <span className="whitespace-nowrap">{t('settings.ai.meetingLookahead')}</span>
              <SettingsSelect
                aria-label={t('settings.ai.meetingLookahead')}
                value={settings.meeting_lookahead_minutes}
                disabled={saving === 'meeting_lookahead_minutes'}
                onChange={e => onApplyPatch({ meeting_lookahead_minutes: Number(e.target.value) })}
                className="w-full"
                inputSize="sm">
                {[15, 30, 60, 120, 240].map(minutes => (
                  <option key={minutes} value={minutes}>
                    {formatI18n(t('settings.ai.minutesShort'), { count: minutes })}
                  </option>
                ))}
              </SettingsSelect>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-content-secondary">
              <span className="whitespace-nowrap">{t('settings.ai.reminderLookahead')}</span>
              <SettingsSelect
                aria-label={t('settings.ai.reminderLookahead')}
                value={settings.reminder_lookahead_minutes}
                disabled={saving === 'reminder_lookahead_minutes'}
                onChange={e => onApplyPatch({ reminder_lookahead_minutes: Number(e.target.value) })}
                className="w-full"
                inputSize="sm">
                {[5, 15, 30, 60, 120].map(minutes => (
                  <option key={minutes} value={minutes}>
                    {formatI18n(t('settings.ai.minutesShort'), { count: minutes })}
                  </option>
                ))}
              </SettingsSelect>
            </label>
          </div>
          <LoopToggle
            label={t('settings.ai.cronReminderChecks')}
            description={t('settings.ai.cronReminderChecksDesc')}
            checked={settings.notify_reminders}
            busy={saving === 'notify_reminders'}
            onToggle={() => onApplyPatch({ notify_reminders: !settings.notify_reminders })}
          />
          <LoopToggle
            label={t('settings.ai.relevantNotificationChecks')}
            description={t('settings.ai.relevantNotificationChecksDesc')}
            checked={settings.notify_relevant_events}
            busy={saving === 'notify_relevant_events'}
            onToggle={() =>
              onApplyPatch({ notify_relevant_events: !settings.notify_relevant_events })
            }
          />
          <LoopToggle
            label={t('settings.ai.externalDelivery')}
            description={t('settings.ai.externalDeliveryDesc')}
            checked={settings.external_delivery_enabled}
            busy={saving === 'external_delivery_enabled'}
            onToggle={() =>
              onApplyPatch({ external_delivery_enabled: !settings.external_delivery_enabled })
            }
          />

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
            <label
              className="text-xs font-medium text-content-secondary"
              htmlFor="heartbeat-interval">
              {t('settings.ai.interval')}
            </label>
            <SettingsSelect
              id="heartbeat-interval"
              aria-label={t('settings.ai.interval')}
              value={settings.interval_minutes}
              disabled={saving === 'interval_minutes'}
              onChange={e => onApplyPatch({ interval_minutes: Number(e.target.value) })}
              inputSize="sm">
              {[5, 10, 15, 30, 60].map(minutes => (
                <option key={minutes} value={minutes}>
                  {formatI18n(t('settings.ai.minutesShort'), { count: minutes })}
                </option>
              ))}
            </SettingsSelect>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={onRunPlannerNow}
              disabled={runningTick}
              className="ml-auto">
              {runningTick ? t('settings.ai.running') : t('settings.ai.plannerTickNow')}
            </Button>
          </div>

          {plannerSummary && (
            <div className="rounded-md border border-primary-100 bg-primary-50 dark:bg-primary-500/10 px-3 py-2 text-xs text-primary-900">
              {t('settings.ai.plannerSummary')
                .replace('{sourceEvents}', String(plannerSummary.source_events))
                .replace('{sent}', String(plannerSummary.deliveries_sent))
                .replace('{deduped}', String(plannerSummary.deliveries_skipped_dedup))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-content-muted">
          {loading
            ? t('settings.ai.loadingHeartbeatControls')
            : t('settings.ai.heartbeatControlsUnavailable')}
        </div>
      )}
    </div>

    <div className="overflow-hidden rounded-lg border border-line bg-surface-muted">
      <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
        {t('settings.ai.loopMap')}
      </div>
      <div className="divide-y divide-line">
        {loops.map(loop => (
          <div key={loop.name} className="grid gap-2 px-3 py-3 md:grid-cols-[150px_1fr]">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-content">{loop.name}</div>
              <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-content-muted">
                <span>{loop.enabled ? t('settings.ai.on') : t('settings.ai.off')}</span>
                <span>{loop.cadence}</span>
              </div>
            </div>
            <div className="min-w-0 text-xs text-content-secondary">
              <div>{loop.work}</div>
              <div className="mt-1 font-mono text-[11px] text-content-muted">
                {t('settings.ai.routeLabel').replace('{route}', loop.route)}
              </div>
              <div className="mt-1 text-content-muted">{loop.risk}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default HeartbeatLoopSection;
