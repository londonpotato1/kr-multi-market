import type { PricePoint, Result } from '@shared/types/prices.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const BYBIT_BASE = 'https://api.bybit.com';

export const BYBIT_SYMBOLS = ['QQQUSDT'] as const;

type BybitTicker = {
  symbol: string;
  lastPrice?: string;
  price24hPcnt?: string;
  turnover24h?: string;
  fundingRate?: string;
  openInterest?: string;
};

type BybitTickersResponse = {
  retCode: number;
  retMsg?: string;
  result?: { list?: BybitTicker[] };
};

function parseNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Fetch Bybit Linear (USDT-margined perp) tickers. Default: QQQUSDT (NQ source).
 * Endpoint: /v5/market/tickers?category=linear&symbol=<sym>
 * Response: price24hPcnt is a ratio (e.g. "0.0163" = 1.63%) — multiplied by 100.
 */
export async function fetchBybitLinear(
  symbols: readonly string[] = BYBIT_SYMBOLS,
): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const results = await Promise.all(symbols.map(async (sym) => {
      const url = `${BYBIT_BASE}/v5/market/tickers?category=linear&symbol=${encodeURIComponent(sym)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
      const raw = (await res.json()) as BybitTickersResponse;
      if (raw.retCode !== 0) {
        throw new Error(`Bybit retCode ${raw.retCode}: ${raw.retMsg ?? 'unknown'}`);
      }
      return raw.result?.list?.[0];
    }));

    const data: PricePoint[] = [];
    for (const t of results) {
      if (!t) continue;
      const price = parseNum(t.lastPrice);
      if (!t.symbol || price === undefined) continue;
      const pctRatio = parseNum(t.price24hPcnt);
      data.push({
        source: 'bybit',
        symbol: t.symbol,
        price,
        unit: 'USDT',
        change24hPct: pctRatio !== undefined ? pctRatio * 100 : undefined,
        volume24hUsd: parseNum(t.turnover24h),
        fundingRate8h: parseNum(t.fundingRate),
        openInterestUsd: parseNum(t.openInterest),
        status: 'ok',
        asOf: Date.now(),
        receivedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (data.length === 0) {
      return { ok: false, error: 'Bybit returned 0 valid tickers', latencyMs: Date.now() - start };
    }
    return { ok: true, data, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Bybit timeout', latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}
