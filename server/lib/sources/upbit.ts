import type { PricePoint, Result } from '@shared/types/prices.js';
import { log } from '../logger.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const UPBIT_URL = 'https://api.upbit.com/v1/ticker?markets=KRW-USDT';

type UpbitTicker = {
  market: string;
  trade_price?: number;
  prev_closing_price?: number;
  signed_change_rate?: number;
  acc_trade_price_24h?: number;
  trade_timestamp?: number;
};

export async function fetchUpbit(): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let raw: UpbitTicker[];
    try {
      const res = await fetch(UPBIT_URL, { signal: controller.signal });
      if (!res.ok) {
        return { ok: false, error: `Upbit HTTP ${res.status}`, latencyMs: Date.now() - start };
      }
      raw = await res.json() as UpbitTicker[];
    } finally {
      clearTimeout(timeout);
    }

    if (!Array.isArray(raw) || raw.length === 0) {
      return { ok: false, error: 'Upbit response empty', latencyMs: Date.now() - start };
    }

    const item = raw[0];
    if (!item || typeof item.trade_price !== 'number' || !Number.isFinite(item.trade_price)) {
      log.warn('[upbit] missing or invalid trade_price');
      return { ok: false, error: 'Upbit trade_price missing', latencyMs: Date.now() - start };
    }

    const change24h = typeof item.signed_change_rate === 'number'
      ? item.signed_change_rate * 100
      : undefined;

    const result: PricePoint[] = [{
      source: 'upbit',
      symbol: 'KRW-USDT',
      price: item.trade_price,    // KRW per USDT
      unit: 'KRW',                 // Korean USDT premium-affected rate
      change24hPct: change24h,
      volume24hUsd: undefined,     // Upbit gives KRW notional; conversion left to consumers
      status: 'ok',                // Upbit market is 24/7
      asOf: item.trade_timestamp ?? Date.now(),
      receivedAt: Date.now(),
      schemaVersion: SCHEMA_VERSION,
    }];

    return { ok: true, data: result, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: `Timeout after ${TIMEOUT_MS}ms`, latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}
