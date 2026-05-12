import type { SourceName, SourceHealth, Result } from '@shared/types/prices.js';

const state: Record<SourceName, SourceHealth> = {
  hyperliquid: { lastSuccess: 0, consecutiveFailures: 0 },
  naver:       { lastSuccess: 0, consecutiveFailures: 0 },
  yahoo:       { lastSuccess: 0, consecutiveFailures: 0 },
  binance:     { lastSuccess: 0, consecutiveFailures: 0 },
  upbit:       { lastSuccess: 0, consecutiveFailures: 0 },
  bybit:       { lastSuccess: 0, consecutiveFailures: 0 },
  bitget:      { lastSuccess: 0, consecutiveFailures: 0 },
  polygon:     { lastSuccess: 0, consecutiveFailures: 0 },
  twelvedata:  { lastSuccess: 0, consecutiveFailures: 0 },
};

/** Record one source attempt result. Updates lastSuccess + consecutiveFailures.
 *  v0.4.2: `error === 'disabled'` (optional source env 키 없음) 은 sourceHealth 안 오염. */
export function recordSourceAttempt<T>(source: SourceName, result: Result<T>, now: number = Date.now()): void {
  if (result.ok) {
    state[source] = { lastSuccess: now, consecutiveFailures: 0 };
  } else if (result.error === 'disabled') {
    // v0.4.2: optional source (Polygon, TwelveData) 가 env 키 없으면
    // `{ok:false, error:'disabled'}` 반환 → sourceHealth 안 오염, fail count 미증가.
    // Producer 는 Task 6/7 (Wave 5) 에서 추가 — 현재 dead path 이지만 의도된 sequencing.
    return;
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
