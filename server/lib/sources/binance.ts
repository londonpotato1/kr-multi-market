import type { PricePoint, Result } from '@shared/types/prices.js';
import { log } from '../logger.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const FAPI_BASE = 'https://fapi.binance.com';

// Default Phase 3 targets — TradFi equity perps
export const BINANCE_SYMBOLS = ['EWYUSDT', 'SPYUSDT', 'QQQUSDT'] as const;

type BinanceTicker24hr = {
  symbol: string;
  lastPrice?: string;
  priceChangePercent?: string;
  quoteVolume?: string;
  closeTime?: number;
};

type BinancePremiumIndex = {
  symbol: string;
  lastFundingRate?: string;
  markPrice?: string;
  time?: number;
};

async function fetchTickers24hr(symbols: readonly string[]): Promise<BinanceTicker24hr[]> {
  // Batch via JSON array param
  const symbolsParam = encodeURIComponent(JSON.stringify([...symbols]));
  const url = `${FAPI_BASE}/fapi/v1/ticker/24hr?symbols=${symbolsParam}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Binance ticker HTTP ${res.status}`);
    }
    return await res.json() as BinanceTicker24hr[];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPremiumIndex(symbol: string): Promise<BinancePremiumIndex | null> {
  const url = `${FAPI_BASE}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      log.warn(`[binance] premiumIndex ${symbol} HTTP ${res.status}`);
      return null;
    }
    return await res.json() as BinancePremiumIndex;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      log.warn(`[binance] premiumIndex ${symbol} timeout`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Fetch Binance USDS-M Futures equity perps (default: EWYUSDT, SPYUSDT, QQQUSDT).
 * Combines /ticker/24hr (price + change + volume) with /premiumIndex (funding rate).
 */
export async function fetchBinanceFutures(symbols: readonly string[] = BINANCE_SYMBOLS): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  try {
    const tickers = await fetchTickers24hr(symbols);

    // Fetch funding rates in parallel
    const fundingPromises = symbols.map(s => fetchPremiumIndex(s));
    const fundings = await Promise.all(fundingPromises);
    const fundingBySymbol = new Map<string, BinancePremiumIndex>();
    for (let i = 0; i < symbols.length; i++) {
      const f = fundings[i];
      if (f) fundingBySymbol.set(symbols[i], f);
    }

    const requestedSymbols = new Set(symbols);
    const result: PricePoint[] = [];
    for (const t of tickers) {
      if (!requestedSymbols.has(t.symbol)) continue;
      const price = parseNum(t.lastPrice);
      if (!t.symbol || price === undefined) continue;
      const funding = fundingBySymbol.get(t.symbol);
      result.push({
        source: 'binance',
        symbol: t.symbol,
        price,
        unit: 'USDT',
        change24hPct: parseNum(t.priceChangePercent),
        volume24hUsd: parseNum(t.quoteVolume),
        fundingRate8h: funding ? parseNum(funding.lastFundingRate) : undefined,
        openInterestUsd: undefined,
        status: 'ok',
        asOf: t.closeTime ?? Date.now(),
        receivedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (result.length === 0) {
      return { ok: false, error: `Binance returned 0 valid tickers`, latencyMs: Date.now() - start };
    }

    return { ok: true, data: result, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: `Binance timeout`, latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}
