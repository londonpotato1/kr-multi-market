import type { PricePoint, Result } from '@shared/types/prices.js';
import { log } from '../logger.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

type YahooChartMeta = {
  symbol: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketTime?: number;
  currency?: string;
  exchangeName?: string;
  instrumentType?: 'CURRENCY' | 'INDEX' | 'FUTURE' | 'EQUITY' | 'ETF' | string;
  hasPrePostMarketData?: boolean;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{ meta?: YahooChartMeta }>;
    error?: { code: string; description: string } | null;
  };
};

function unitFromInstrument(t?: string): PricePoint['unit'] {
  if (t === 'CURRENCY') return 'KRW';
  if (t === 'INDEX' || t === 'FUTURE') return 'pt';
  return 'USD';
}

export async function fetchYahoo(symbols: readonly string[]): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  try {
    const result: PricePoint[] = [];

    // Per-symbol fetch (T3.1 will swap to /v7/finance/quote batch endpoint)
    await Promise.all(
      symbols.map(async (sym) => {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1m`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(url, { headers: YAHOO_HEADERS, signal: controller.signal });
          if (!res.ok) {
            log.warn(`[yahoo] ${sym} HTTP ${res.status}`);
            return;
          }

          const raw = (await res.json()) as YahooChartResponse;
          if (raw.chart?.error) {
            log.warn(`[yahoo] ${sym} error:`, raw.chart.error.description);
            return;
          }

          const meta = raw.chart?.result?.[0]?.meta;
          if (!meta || typeof meta.regularMarketPrice !== 'number') {
            log.warn(`[yahoo] ${sym} missing regularMarketPrice`);
            return;
          }

          const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
          const change = prev > 0 ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
          const asOf = (meta.regularMarketTime ?? Date.now() / 1000) * 1000;
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
          });
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            log.warn(`[yahoo] ${sym} timeout after ${TIMEOUT_MS}ms`);
          } else {
            log.warn(`[yahoo] ${sym} fetch error:`, err instanceof Error ? err.message : err);
          }
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    if (result.length === 0) {
      return { ok: false, error: `Yahoo returned 0 valid results for ${symbols.length} symbols`, latencyMs: Date.now() - start };
    }

    return { ok: true, data: result, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}
