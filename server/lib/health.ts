import type { SourceName, SourceHealth, Result } from '@shared/types/prices.js';

const state: Record<SourceName, SourceHealth> = {
  hyperliquid: { lastSuccess: 0, consecutiveFailures: 0 },
  naver:       { lastSuccess: 0, consecutiveFailures: 0 },
  yahoo:       { lastSuccess: 0, consecutiveFailures: 0 },
  binance:     { lastSuccess: 0, consecutiveFailures: 0 },
  upbit:       { lastSuccess: 0, consecutiveFailures: 0 },
};

/** Record one source attempt result. Updates lastSuccess + consecutiveFailures. */
export function recordSourceAttempt<T>(source: SourceName, result: Result<T>, now: number = Date.now()): void {
  if (result.ok) {
    state[source] = { lastSuccess: now, consecutiveFailures: 0 };
  } else {
    state[source] = {
      lastSuccess: state[source].lastSuccess,
      consecutiveFailures: state[source].consecutiveFailures + 1,
    };
  }
}

/** Snapshot current health for all sources. */
export function getSourceHealth(): Record<SourceName, SourceHealth> {
  // Return copy
  return Object.fromEntries(
    Object.entries(state).map(([k, v]) => [k, { ...v }])
  ) as Record<SourceName, SourceHealth>;
}

/** Test helper to reset state. */
export function _resetSourceHealth(): void {
  for (const key of Object.keys(state) as SourceName[]) {
    state[key] = { lastSuccess: 0, consecutiveFailures: 0 };
  }
}
