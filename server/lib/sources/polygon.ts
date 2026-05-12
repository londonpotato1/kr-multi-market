import type { PricePoint, Result } from '@shared/types/prices.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const POLYGON_BASE = 'https://api.polygon.io';

export const POLYGON_SYMBOLS = ['QQQ'] as const;

type PolygonAggsResponse = {
  status?: string;
  ticker?: string;
  results?: Array<{
    c?: number;
    o?: number;
    h?: number;
    l?: number;
    v?: number;
    t?: number;
  }>;
};

/**
 * Fetch Polygon.io prev-day aggregate. Optional source — POLYGON_API_KEY 없으면 disabled.
 * Endpoint: /v2/aggs/ticker/{sym}/prev?adjusted=true&apiKey=...
 * Free tier: 5 req/min (TTL 12s, 60/12=5).
 * disabled shape: {ok:false, error:'disabled', latencyMs:0} — health.ts 가 sourceHealth 오염 면제.
 */
export async function fetchPolygon(
  symbols: readonly string[] = POLYGON_SYMBOLS,
): Promise<Result<PricePoint[]>> {
  const token = process.env.POLYGON_API_KEY;
  if (!token) {
    return { ok: false, error: 'disabled', latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const results = await Promise.all(symbols.map(async (sym): Promise<PricePoint | null> => {
      const url = `${POLYGON_BASE}/v2/aggs/ticker/${encodeURIComponent(sym)}/prev?adjusted=true&apiKey=${encodeURIComponent(token)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);
        const raw = (await res.json()) as PolygonAggsResponse;
        const item = raw.results?.[0];
        if (!item || typeof item.c !== 'number') return null;
        // /prev endpoint = 전일 종가. open 없으면 변동률 산출 불가 → undefined (bybit/bitget 일관성).
        const change24hPct = (item.o !== undefined && item.o > 0)
          ? ((item.c - item.o) / item.o) * 100
          : undefined;
        return {
          source: 'polygon',
          symbol: sym,
          price: item.c,
          unit: 'USD',
          change24hPct,
          volume24hUsd: typeof item.v === 'number' ? item.v * item.c : undefined,
          status: 'ok',
          // ⚠️ /prev = 전일 바 timestamp (24h+ lag). 신선도는 receivedAt 사용.
          asOf: item.t ?? Date.now(),
          receivedAt: Date.now(),
          schemaVersion: SCHEMA_VERSION,
        };
      } finally {
        clearTimeout(timeout);
      }
    }));

    const data = results.filter((p): p is PricePoint => p !== null);
    if (data.length === 0) {
      return { ok: false, error: 'Polygon returned 0 valid items', latencyMs: Date.now() - start };
    }
    return { ok: true, data, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Polygon timeout', latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}
