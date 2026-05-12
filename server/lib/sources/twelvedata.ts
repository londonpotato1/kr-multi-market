import type { PricePoint, Result } from '@shared/types/prices.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const TD_BASE = 'https://api.twelvedata.com';

export const TWELVEDATA_SYMBOLS = ['QQQ'] as const;

type TDQuoteResponse = {
  symbol?: string;
  close?: string;
  percent_change?: string;
  volume?: string;
  timestamp?: number;
  status?: string;
  code?: number;
  message?: string;
};

function parseNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Fetch Twelve Data /quote. Optional source — TWELVEDATA_API_KEY 없으면 disabled.
 * Endpoint: /quote?symbol={sym}&apikey=...
 * Free tier: 800 req/day (TTL 120s, 24h/120s=720 < 800).
 * disabled shape: {ok:false, error:'disabled', latencyMs:0} — health.ts 가 sourceHealth 오염 면제.
 */
export async function fetchTwelveData(
  symbols: readonly string[] = TWELVEDATA_SYMBOLS,
): Promise<Result<PricePoint[]>> {
  const token = process.env.TWELVEDATA_API_KEY;
  if (!token) {
    return { ok: false, error: 'disabled', latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const results = await Promise.all(symbols.map(async (sym): Promise<PricePoint | null> => {
      const url = `${TD_BASE}/quote?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(token)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`TwelveData HTTP ${res.status}`);
        const raw = (await res.json()) as TDQuoteResponse;
        if (raw.status === 'error' || raw.code) {
          throw new Error(`TwelveData error: ${raw.message ?? 'unknown'}`);
        }
        const price = parseNum(raw.close);
        if (price === undefined) return null;
        return {
          source: 'twelvedata',
          symbol: sym,
          price,
          unit: 'USD',
          change24hPct: parseNum(raw.percent_change),
          volume24hUsd: parseNum(raw.volume),
          status: 'ok',
          asOf: raw.timestamp ? raw.timestamp * 1000 : Date.now(),
          receivedAt: Date.now(),
          schemaVersion: SCHEMA_VERSION,
        };
      } finally {
        clearTimeout(timeout);
      }
    }));

    const data = results.filter((p): p is PricePoint => p !== null);
    if (data.length === 0) {
      return { ok: false, error: 'TwelveData returned 0 valid items', latencyMs: Date.now() - start };
    }
    return { ok: true, data, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'TwelveData timeout', latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}
