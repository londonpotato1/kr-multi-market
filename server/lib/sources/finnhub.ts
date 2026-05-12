import type { PricePoint, Result } from '@shared/types/prices.js';
import { log } from '../logger.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;

type FinnhubQuote = {
  c?: number;   // current price
  pc?: number;  // previous close
  t?: number;   // timestamp (unix sec)
};

/** Map Yahoo symbol → Finnhub symbol. Index / future / FX 는 미지원, ETF/equity only. */
function toFinnhubSymbol(yahooSym: string): string | null {
  if (yahooSym.startsWith('^')) return null;   // index
  if (yahooSym.endsWith('=F')) return null;    // future
  if (yahooSym.endsWith('=X')) return null;    // FX
  return yahooSym;
}

export async function fetchFinnhub(
  symbols: readonly string[],
  token: string,
): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  const result: PricePoint[] = [];

  await Promise.all(symbols.map(async (sym) => {
    const finnSym = toFinnhubSymbol(sym);
    if (!finnSym) return;

    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnSym)}&token=${encodeURIComponent(token)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return;
      const raw = (await res.json()) as FinnhubQuote;
      if (typeof raw.c !== 'number' || raw.c <= 0) return;
      const safePc = raw.pc && raw.pc > 0 ? raw.pc : undefined;
      const pct = safePc !== undefined ? ((raw.c - safePc) / safePc) * 100 : undefined;
      result.push({
        source: 'yahoo',  // source slot 유지: Finnhub 은 yahoo 의 Tier-4 fallback
        symbol: sym,
        price: raw.c,
        unit: 'USD',
        change24hPct: pct,
        status: 'ok',
        asOf: raw.t ? raw.t * 1000 : Date.now(),
        receivedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
        previousClose: safePc,
        previousCloseSource: safePc !== undefined ? 'yahoo' : undefined,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        log.warn(`[finnhub] ${sym} timeout`);
      } else {
        log.warn(`[finnhub] ${sym} error:`, err instanceof Error ? err.message : err);
      }
    } finally {
      clearTimeout(timeout);
    }
  }));

  if (result.length === 0) {
    return { ok: false, error: 'Finnhub returned 0 valid items', latencyMs: Date.now() - start };
  }
  return { ok: true, data: result, latencyMs: Date.now() - start };
}
