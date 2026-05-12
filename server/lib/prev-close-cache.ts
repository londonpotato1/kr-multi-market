// prev-close-cache.ts — 24h TTL last-good cache for KRX previousClose.
// Used as fallback when both Naver and Yahoo fail to provide the field.

type CacheEntry = {
  value: number;
  source: 'naver' | 'yahoo';
  storedAt: number;
};

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry>();

export function storePrevClose(ticker: string, value: number, source: 'naver' | 'yahoo'): void {
  if (value <= 0) return;
  cache.set(ticker, { value, source, storedAt: Date.now() });
}

export function getPrevClose(ticker: string): { value: number; source: 'cache' } | undefined {
  const entry = cache.get(ticker);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > TTL_MS) {
    cache.delete(ticker);
    return undefined;
  }
  return { value: entry.value, source: 'cache' };
}

// Resolve previousClose using fallback chain: live Naver/Yahoo → cache.
// Caller passes already-resolved values; we just pick the best + persist.
export function resolvePrevClose(
  ticker: string,
  fromNaver: number | undefined,
  fromYahoo: number | undefined
): { value: number; source: 'naver' | 'yahoo' | 'cache' } | undefined {
  if (fromNaver !== undefined && fromNaver > 0) {
    storePrevClose(ticker, fromNaver, 'naver');
    return { value: fromNaver, source: 'naver' };
  }
  if (fromYahoo !== undefined && fromYahoo > 0) {
    storePrevClose(ticker, fromYahoo, 'yahoo');
    return { value: fromYahoo, source: 'yahoo' };
  }
  return getPrevClose(ticker);
}

// Test-only: reset cache state between tests.
export function _resetPrevCloseCacheForTests(): void {
  cache.clear();
}
