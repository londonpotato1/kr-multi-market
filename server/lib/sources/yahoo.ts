import type { PricePoint, Result } from '@shared/types/prices.js';
import { log } from '../logger.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

type YahooQuoteItem = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  regularMarketVolume?: number;
  previousClose?: number;
  currency?: string;
  quoteType?: string;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteItem[];
    error?: { description: string } | null;
  };
};

type YahooChartMeta = {
  symbol?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketTime?: number;
  currency?: string;
  instrumentType?: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{ meta?: YahooChartMeta }>;
    error?: { code?: string; description?: string } | null;
  };
};

function unitFromQuoteType(t?: string): PricePoint['unit'] {
  if (t === 'CURRENCY') return 'KRW';
  if (t === 'INDEX' || t === 'FUTURE') return 'pt';
  return 'USD';
}

function unitFromInstrument(t?: string): PricePoint['unit'] {
  if (t === 'CURRENCY') return 'KRW';
  if (t === 'INDEX' || t === 'FUTURE') return 'pt';
  return 'USD';
}

async function tryBatchQuote(host: 'query1' | 'query2', symbols: readonly string[]): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  const url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS, signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `Yahoo ${host} v7 HTTP ${res.status}`, latencyMs: Date.now() - start };
    }
    const raw = await res.json() as YahooQuoteResponse;
    if (raw.quoteResponse?.error) {
      return { ok: false, error: `Yahoo error: ${raw.quoteResponse.error.description}`, latencyMs: Date.now() - start };
    }
    const items = raw.quoteResponse?.result ?? [];
    const result: PricePoint[] = [];
    for (const item of items) {
      if (!item.symbol || typeof item.regularMarketPrice !== 'number') continue;
      const asOf = (item.regularMarketTime ?? Date.now() / 1000) * 1000;
      result.push({
        source: 'yahoo',
        symbol: item.symbol,
        price: item.regularMarketPrice,
        unit: unitFromQuoteType(item.quoteType),
        change24hPct: typeof item.regularMarketChangePercent === 'number' ? item.regularMarketChangePercent : undefined,
        volume24hUsd: undefined,  // volume is share count, not USD
        status: 'ok',
        asOf,
        receivedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
      });
    }
    if (result.length === 0) {
      return { ok: false, error: `Yahoo ${host} v7 returned 0 valid items`, latencyMs: Date.now() - start };
    }
    return { ok: true, data: result, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: `Yahoo ${host} v7 timeout`, latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

async function tryChartPerSymbol(symbols: readonly string[]): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  const result: PricePoint[] = [];
  await Promise.all(symbols.map(async (sym) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1m`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: YAHOO_HEADERS, signal: controller.signal });
      if (!res.ok) {
        log.warn(`[yahoo] chart ${sym} HTTP ${res.status}`);
        return;
      }
      const raw = await res.json() as YahooChartResponse;
      if (raw.chart?.error) {
        log.warn(`[yahoo] chart ${sym} error:`, raw.chart.error.description ?? 'unknown');
        return;
      }
      const meta = raw.chart?.result?.[0]?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number') return;
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
      const change = prev > 0 ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
      const asOf = (meta.regularMarketTime ?? Date.now() / 1000) * 1000;
      // v0.4.0: previousClose 노출 (Naver fallback 용)
      const rawPrev = meta.previousClose ?? meta.chartPreviousClose;
      const safePrevClose = typeof rawPrev === 'number' && rawPrev > 0 ? rawPrev : undefined;
      result.push({
        source: 'yahoo',
        symbol: meta.symbol ?? sym,
        price: meta.regularMarketPrice,
        unit: unitFromInstrument(meta.instrumentType),
        change24hPct: change,
        status: 'ok',
        asOf,
        receivedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
        previousClose: safePrevClose,
        previousCloseSource: safePrevClose !== undefined ? 'yahoo' : undefined,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        log.warn(`[yahoo] chart ${sym} timeout`);
      } else {
        log.warn(`[yahoo] chart ${sym} error:`, err instanceof Error ? err.message : err);
      }
    } finally {
      clearTimeout(timeout);
    }
  }));
  if (result.length === 0) {
    return { ok: false, error: `Yahoo chart fallback returned 0 valid items`, latencyMs: Date.now() - start };
  }
  return { ok: true, data: result, latencyMs: Date.now() - start };
}

/**
 * Fetch Yahoo Finance prices for multiple symbols.
 * 4-tier fallback (v0.4.2):
 *   1. v7/finance/quote on query2 (batch)
 *   2. v7/finance/quote on query1 (different shard)
 *   3. v8/finance/chart per-symbol
 *   4. Finnhub /quote (FINNHUB_TOKEN 활성 시에만, ETF/equity only)
 *
 * Returns ok:false if all 4 tiers fail (or all tiers + Finnhub disabled).
 */
export async function fetchYahoo(symbols: readonly string[]): Promise<Result<PricePoint[]>> {
  // Tier 1: query2 batch
  const r1 = await tryBatchQuote('query2', symbols);
  if (r1.ok) return r1;
  log.warn(`[yahoo] tier 1 (query2 v7 batch) failed: ${r1.error}`);
  
  // Tier 2: query1 batch
  const r2 = await tryBatchQuote('query1', symbols);
  if (r2.ok) return r2;
  log.warn(`[yahoo] tier 2 (query1 v7 batch) failed: ${r2.error}`);
  
  // Tier 3: per-symbol chart
  const r3 = await tryChartPerSymbol(symbols);
  if (r3.ok) return r3;
  log.warn(`[yahoo] tier 3 (chart per-symbol) failed: ${r3.error}`);

  // v0.4.2: Tier 4 — Finnhub fallback (FINNHUB_TOKEN 활성 시에만)
  const finnhubToken = process.env.FINNHUB_TOKEN;
  if (finnhubToken) {
    const { fetchFinnhub } = await import('./finnhub.js');
    const r4 = await fetchFinnhub(symbols, finnhubToken);
    if (r4.ok) {
      log.info(`[yahoo] tier 4 (finnhub fallback) succeeded for ${r4.data.length} symbols`);
      return r4;
    }
    log.warn(`[yahoo] tier 4 (finnhub fallback) failed: ${r4.error}`);
  }

  return { ok: false, error: `All Yahoo tiers failed for ${symbols.length} symbols`, latencyMs: 0 };
}
