/**
 * Pure formatting helpers shared by `MemorySyncSchedule` and `MemorySourceRow`.
 */
import type { MemorySourceEntry } from '../../services/memorySourcesService';

export function relativeTimestamp(
  epochMs: number | null,
  t: (k: string) => string
): string | null {
  if (epochMs === null) return null;
  const delta = Date.now() - epochMs;
  if (delta < 1000) return t('time.justNow');
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}${t('time.secondsAgoSuffix')}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${t('time.minutesAgoSuffix')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t('time.hoursAgoSuffix')}`;
  const days = Math.floor(hours / 24);
  return `${days}${t('time.daysAgoSuffix')}`;
}

export function sourceTreeScope(source: MemorySourceEntry): string | null {
  switch (source.kind) {
    case 'folder':
      return source.path ?? null;
    case 'github_repo':
      return source.url ?? null;
    case 'web_page':
      return source.url ?? null;
    case 'twitter_query':
      return source.query ?? null;
    default:
      return null;
  }
}

export function sourceDetail(source: MemorySourceEntry): string | null {
  switch (source.kind) {
    case 'folder':
      return source.path ?? null;
    case 'github_repo':
      return source.url ?? null;
    case 'rss_feed':
      return source.url ?? null;
    case 'web_page':
      return source.url ?? null;
    case 'twitter_query':
      return source.query ?? null;
    default:
      return null;
  }
}
