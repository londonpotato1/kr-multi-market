import type { PricePoint, Result } from '@shared/types/prices.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const BITGET_BASE = 'https://api.bitget.com';

export const BITGET_SYMBOLS = ['QQQUSDT'] as const;

type BitgetTicker = {
  symbol: string;
  lastPr?: string;
  change24h?: string;
  baseVolume?: string;        // base asset 단위 (사용 X)
  usdtVolume?: string;        // USDT 단위 (volume24hUsd 매핑)
  fundingRate?: string;
  holdingAmount?: string;     // base asset 단위 OI (USDT 환산 X, 미사용)
};

type BitgetResponse = {
  code: string;
  msg?: string;
  data?: BitgetTicker[];
};

function parseNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Fetch Bitget USDT-M futures tickers. Default: QQQUSDT (NQ redundancy).
 * Endpoint: /api/v2/mix/market/ticker?productType=usdt-futures&symbol=<sym>
 *   (Singular /ticker filters by symbol. Plural /tickers ignores the symbol
 *   param and returns all 550 USDT-M tickers — do not use.)
 * Response: change24h is a ratio (e.g. "0.0163" = 1.63%) — multiplied by 100.
 * volume24hUsd uses usdtVolume (USDT 단위), not baseVolume (base asset 단위).
 * openInterestUsd is undefined — Bitget API does not provide USDT-denominated OI directly.
 */
export async function fetchBitgetFutures(
  symbols: readonly string[] = BITGET_SYMBOLS,
): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const results = await Promise.all(symbols.map(async (sym) => {
      const url = `${BITGET_BASE}/api/v2/mix/market/ticker?productType=usdt-futures&symbol=${encodeURIComponent(sym)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Bitget HTTP ${res.status}`);
      const raw = (await res.json()) as BitgetResponse;
      if (raw.code !== '00000') {
        throw new Error(`Bitget code ${raw.code}: ${raw.msg ?? 'unknown'}`);
      }
      return raw.data?.[0];
    }));

    const data: PricePoint[] = [];
    for (const t of results) {
      if (!t) continue;
      const price = parseNum(t.lastPr);
      if (!t.symbol || price === undefined) continue;
      const pctRatio = parseNum(t.change24h);
      data.push({
        source: 'bitget',
        symbol: t.symbol,
        price,
        unit: 'USDT',
        change24hPct: pctRatio !== undefined ? pctRatio * 100 : undefined,
        volume24hUsd: parseNum(t.usdtVolume),  // USDT 단위 (not baseVolume)
        fundingRate8h: parseNum(t.fundingRate),
        openInterestUsd: undefined,            // Bitget API USDT 단위 OI 미제공
        status: 'ok',
        asOf: Date.now(),
        receivedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (data.length === 0) {
      return { ok: false, error: 'Bitget returned 0 valid tickers', latencyMs: Date.now() - start };
    }
    return { ok: true, data, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Bitget timeout', latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}
