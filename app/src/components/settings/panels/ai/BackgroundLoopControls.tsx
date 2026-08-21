/*
 * Background loop controls + usage diagnostics.
 *
 * Two independently useful views composed under one component: the
 * heartbeat/planner controls (left) and the recent-usage ledger + budget math
 * (right). `view` lets a host panel (UsagePanel) mount just one half.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { listConnections as listComposioConnections } from '../../../../lib/composio/composioApi';
import type { ComposioConnection } from '../../../../lib/composio/types';
import { useT } from '../../../../lib/i18n/I18nContext';
import { creditsApi, type CreditTransaction, type TeamUsage } from '../../../../services/api/creditsApi';
import {
  type HeartbeatPlannerSummary,
  type HeartbeatSettings,
  type HeartbeatSettingsPatch,
  openhumanHeartbeatSettingsGet,
  openhumanHeartbeatSettingsSet,
  openhumanHeartbeatTickNow,
} from '../../../../utils/tauriCommands/heartbeat';
import type { RoutingMap } from './aiPanelTypes';
import {
  activeConnection,
  COMPOSIO_PERIODIC_TICK_MINUTES,
  describeProvider,
  isCalendarConnection,
  LEARNING_REBUILD_MINUTES,
  MEMORY_POLL_SECONDS,
  MEMORY_WORKERS,
  spendAmount,
  summarizeSpendByAction,
  summarizeSpendByHour,
  summarizeSpendSample,
  WEEK_MINUTES,
  type BackgroundLoopProviderView,
} from './backgroundLoopPrimitives';
import { HeartbeatLoopSection } from './HeartbeatLoopSection';
import { UsageLedgerSection } from './UsageLedgerSection';

type BackgroundLoopControlsView = 'all' | 'heartbeat' | 'ledger';

export const BackgroundLoopControls = ({
  routing,
  cloudProviders,
  view = 'all',
  hideHeader = false,
}: {
  routing: RoutingMap;
  cloudProviders: BackgroundLoopProviderView[];
  view?: BackgroundLoopControlsView;
  hideHeader?: boolean;
}) => {
  const { t } = useT();
  const [settings, setSettings] = useState<HeartbeatSettings | null>(null);
  const [usage, setUsage] = useState<TeamUsage | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [runningTick, setRunningTick] = useState(false);
  const [plannerSummary, setPlannerSummary] = useState<HeartbeatPlannerSummary | null>(null);
  const [error, setError] = useState<string>('');
  const settingsRef = useRef<HeartbeatSettings | null>(null);
  const patchRequestIdRef = useRef(0);

  const commitSettings = useCallback((nextSettings: HeartbeatSettings | null) => {
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [heartbeatResult, usageResult, transactionsResult, connectionsResult] =
      await Promise.allSettled([
        openhumanHeartbeatSettingsGet(),
        creditsApi.getTeamUsage(),
        creditsApi.getTransactions(200, 0),
        listComposioConnections(),
      ]);

    if (heartbeatResult.status === 'fulfilled') {
      commitSettings(heartbeatResult.value.result.settings);
    } else {
      setError(
        heartbeatResult.reason instanceof Error ? heartbeatResult.reason.message : 'Load failed'
      );
    }

    if (usageResult.status === 'fulfilled') {
      setUsage(usageResult.value);
    }

    if (transactionsResult.status === 'fulfilled') {
      setTransactions(transactionsResult.value.transactions ?? []);
    }

    if (connectionsResult.status === 'fulfilled') {
      setConnections(connectionsResult.value.connections ?? []);
    }
    setLoading(false);
  }, [commitSettings]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const applyHeartbeatPatch = useCallback(
    async (patch: HeartbeatSettingsPatch) => {
      const requestId = patchRequestIdRef.current + 1;
      patchRequestIdRef.current = requestId;
      const savingKey = Object.keys(patch).join(',');
      const previous = settingsRef.current;
      setError('');
      setSaving(savingKey);
      if (!previous) {
        // No baseline to patch against — abandon this request.
        if (patchRequestIdRef.current === requestId) {
          setSaving(null);
        }
        return;
      }
      commitSettings({ ...previous, ...patch });
      try {
        const response = await openhumanHeartbeatSettingsSet(patch);
        // Stale response — a newer patch superseded us; drop this result.
        if (patchRequestIdRef.current !== requestId) return;
        commitSettings(response.result.settings);
      } catch (err) {
        if (patchRequestIdRef.current !== requestId) return;
        commitSettings(previous);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (patchRequestIdRef.current === requestId) {
          setSaving(null);
        }
      }
    },
    [commitSettings]
  );

  const runPlannerNow = useCallback(async () => {
    setRunningTick(true);
    setError('');
    try {
      const response = await openhumanHeartbeatTickNow();
      setPlannerSummary(response.result.summary);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningTick(false);
    }
  }, [refresh]);

  const spendSample = summarizeSpendSample(transactions);
  const spendRows = spendSample.rows;
  const actionSummary = summarizeSpendByAction(transactions);
  const hourSummary = summarizeSpendByHour(transactions);
  const latestSpend = spendRows[0] ?? null;
  const heartbeatIntervalMinutes = settings ? Math.max(settings.interval_minutes, 5) : 5;
  const heartbeatTicksPerWeek = settings?.enabled
    ? Math.ceil(WEEK_MINUTES / heartbeatIntervalMinutes)
    : 0;
  const activeConnections = connections.filter(activeConnection);
  const activeCalendarConnections = activeConnections.filter(isCalendarConnection);
  const maxCalendarConnectionsPerTick = settings
    ? Math.max(settings.max_calendar_connections_per_tick ?? 2, 1)
    : 2;
  const calendarConnectionsPolled = settings?.notify_meetings
    ? Math.min(activeCalendarConnections.length, maxCalendarConnectionsPerTick)
    : 0;
  const calendarConnectionsSkipped = settings?.notify_meetings
    ? Math.max(activeCalendarConnections.length - calendarConnectionsPolled, 0)
    : 0;
  const calendarPlannerCallsPerTick = settings?.notify_meetings ? 1 + calendarConnectionsPolled : 0;
  const calendarPlannerCallsPerWeek = heartbeatTicksPerWeek * calendarPlannerCallsPerTick;
  const subconsciousModelCallsPerWeek =
    settings?.enabled && settings.inference_enabled ? heartbeatTicksPerWeek : 0;
  const composioPeriodicTicksPerWeek = Math.ceil(WEEK_MINUTES / COMPOSIO_PERIODIC_TICK_MINUTES);
  const learningTicksPerWeek = Math.ceil(WEEK_MINUTES / LEARNING_REBUILD_MINUTES);
  const memoryPollsPerWeek = Math.ceil((WEEK_MINUTES * 60 * MEMORY_WORKERS) / MEMORY_POLL_SECONDS);
  const composioConnectionScansPerWeek = composioPeriodicTicksPerWeek * activeConnections.length;
  const backgroundApiReadsPerWeek = calendarPlannerCallsPerWeek + composioConnectionScansPerWeek;
  const backgroundWakeupsPerWeek =
    heartbeatTicksPerWeek +
    composioPeriodicTicksPerWeek +
    learningTicksPerWeek +
    memoryPollsPerWeek;
  const scheduledCallsPerRemainingDollar =
    usage && usage.remainingUsd > 0 ? backgroundApiReadsPerWeek / usage.remainingUsd : null;
  const estimatedRowsLeft =
    usage && spendSample.avgRowUsd > 0
      ? Math.floor(usage.remainingUsd / spendSample.avgRowUsd)
      : null;
  const estimatedRowsPerBudget =
    usage && spendSample.avgRowUsd > 0
      ? Math.floor(usage.cycleBudgetUsd / spendSample.avgRowUsd)
      : null;
  const projectedHoursLeft =
    usage && spendSample.spendPerHour > 0 ? usage.remainingUsd / spendSample.spendPerHour : null;
  const projectionAnchorMs = latestSpend ? new Date(latestSpend.createdAt).getTime() : Number.NaN;
  const projectedExhaustAt =
    projectedHoursLeft !== null && Number.isFinite(projectionAnchorMs)
      ? new Date(projectionAnchorMs + projectedHoursLeft * 3_600_000).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'n/a';

  const loops = [
    {
      name: 'Heartbeat planner',
      enabled: Boolean(settings?.enabled),
      cadence: `${settings?.interval_minutes ?? 5} min`,
      route: describeProvider(routing.heartbeat, cloudProviders),
      work: 'Runs proactive collectors: cron reminders, calendar meetings, relevant notifications.',
      risk: settings?.notify_meetings
        ? `${calendarPlannerCallsPerTick} Composio read call(s)/tick; ${calendarConnectionsSkipped} calendar link(s) over cap skipped.`
        : 'Calendar collector off; planner reads only local enabled categories.',
    },
    {
      name: 'Subconscious tick',
      enabled: Boolean(settings?.enabled && settings?.inference_enabled),
      cadence: `${settings?.interval_minutes ?? 5} min`,
      route: describeProvider(routing.subconscious, cloudProviders),
      work: 'Evaluates subconscious tasks/reflections through kind=subconscious_tick.',
      risk:
        subconsciousModelCallsPerWeek > 0
          ? `${subconsciousModelCallsPerWeek} model call(s)/week at current interval.`
          : 'Inference off; no scheduled subconscious model calls.',
    },
    {
      name: 'Memory tree workers',
      enabled: true,
      cadence: 'queue',
      route: describeProvider(routing.memory, cloudProviders),
      work: 'Extracts chunks, seals branches, runs daily digests, routes topics.',
      risk: `${MEMORY_WORKERS} workers poll every ${MEMORY_POLL_SECONDS}s; LLM calls only when queue has extract/seal/digest/topic jobs.`,
    },
    {
      name: 'Reflection rebuild',
      enabled: true,
      cadence: '30 min',
      route: describeProvider(routing.learning, cloudProviders),
      work: 'Refreshes reflection state after memory activity.',
      risk: `${learningTicksPerWeek} wakeups/week; LLM work only when rebuild needs reflection.`,
    },
    {
      name: 'Composio sync',
      enabled: true,
      cadence: '20 min',
      route: 'Integration APIs',
      work: 'Polls connected tools when provider sync is due.',
      risk: `${composioPeriodicTicksPerWeek} wakeups/week; scans ${activeConnections.length} active connection(s).`,
    },
  ];

  const showHeartbeat = view === 'all' || view === 'heartbeat';
  const showLedger = view === 'all' || view === 'ledger';
  const gridCols =
    view === 'all' ? 'md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]' : 'grid-cols-1';

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="border-b border-line pb-2">
          <h2 className="text-base font-semibold text-content">
            {t('settings.ai.backgroundLoops')}
          </h2>
          <p className="mt-0.5 text-xs text-content-muted">{t('settings.ai.backgroundLoopsDesc')}</p>
        </div>
      )}

      <section className={`grid gap-3 ${gridCols}`}>
        {showHeartbeat && (
          <HeartbeatLoopSection
            t={t}
            settings={settings}
            loading={loading}
            saving={saving}
            runningTick={runningTick}
            plannerSummary={plannerSummary}
            error={error}
            loops={loops}
            maxCalendarConnectionsPerTick={maxCalendarConnectionsPerTick}
            onRefresh={() => void refresh()}
            onApplyPatch={patch => void applyHeartbeatPatch(patch)}
            onRunPlannerNow={() => void runPlannerNow()}
          />
        )}

        {showLedger && (
          <UsageLedgerSection
            t={t}
            loading={loading}
            onRefresh={() => void refresh()}
            usage={usage}
            spendRows={spendRows}
            spendAvgRowUsd={spendSample.avgRowUsd}
            spendSampleHours={spendSample.sampleHours}
            spendPerHour={spendSample.spendPerHour}
            rowsPerHour={spendSample.rowsPerHour}
            actionSummary={actionSummary}
            hourSummary={hourSummary}
            latestSpend={latestSpend}
            formatSpendAmount={spendAmount}
            backgroundApiReadsPerWeek={backgroundApiReadsPerWeek}
            backgroundWakeupsPerWeek={backgroundWakeupsPerWeek}
            calendarPlannerCallsPerWeek={calendarPlannerCallsPerWeek}
            composioConnectionScansPerWeek={composioConnectionScansPerWeek}
            memoryPollsPerWeek={memoryPollsPerWeek}
            estimatedRowsLeft={estimatedRowsLeft}
            estimatedRowsPerBudget={estimatedRowsPerBudget}
            projectedExhaustAt={projectedExhaustAt}
            projectedHoursLeft={projectedHoursLeft}
            scheduledCallsPerRemainingDollar={scheduledCallsPerRemainingDollar}
            heartbeatTicksPerWeek={heartbeatTicksPerWeek}
            heartbeatIntervalMinutes={heartbeatIntervalMinutes}
            calendarConnectionsPolled={calendarConnectionsPolled}
            activeCalendarConnectionsCount={activeCalendarConnections.length}
            maxCalendarConnectionsPerTick={maxCalendarConnectionsPerTick}
            calendarConnectionsSkipped={calendarConnectionsSkipped}
            notifyMeetingsEnabled={Boolean(settings?.notify_meetings)}
            subconsciousModelCallsPerWeek={subconsciousModelCallsPerWeek}
            subconsciousEnabled={Boolean(settings?.enabled && settings.inference_enabled)}
            activeConnectionsCount={activeConnections.length}
          />
        )}
      </section>
    </div>
  );
};

export default BackgroundLoopControls;
