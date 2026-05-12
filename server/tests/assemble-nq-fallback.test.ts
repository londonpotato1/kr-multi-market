import { describe, it, expect, beforeEach } from 'vitest';
import { assemblePricesResponse, type SourceInputs } from '../lib/assemble.js';
import { _resetSourceHealth } from '../lib/health.js';
import type { PricePoint, Result } from '@shared/types/prices.js';

const now = Date.now();
const disabledResult: Result<PricePoint[]> = { ok: false, error: 'disabled', latencyMs: 0 };
const emptyResult: Result<PricePoint[]> = { ok: false, error: 'all sources failed', latencyMs: 0 };

const mkPP = (source: PricePoint['source'], symbol: string, price: number, unit: PricePoint['unit'] = 'USDT'): PricePoint => ({
  source, symbol, price, unit, status: 'ok', asOf: now, receivedAt: now, schemaVersion: 1,
});

const baseFx = (extra: Partial<SourceInputs> = {}): SourceInputs => ({
  hl: { ok: true, data: [
    mkPP('hyperliquid', 'xyz_KRW', 1471.7, 'USD'),
  ], latencyMs: 1 },
  naver: { ok: false, error: 'n/a', latencyMs: 0 },
  yahoo: { ok: true, data: [
    mkPP('yahoo', 'KRW=X', 1471.7, 'KRW'),
  ], latencyMs: 1 },
  upbit: { ok: true, data: [
    mkPP('upbit', 'KRW-USDT', 1470, 'KRW'),
  ], latencyMs: 1 },
  binance: emptyResult,
  bybit: disabledResult,
  bitget: disabledResult,
  polygon: disabledResult,
  twelvedata: disabledResult,
  ...extra,
});

describe('assemble — NQ fallback (no alias mutation)', () => {
  beforeEach(() => _resetSourceHealth());

  it('keeps bybit in payload.bybit slot (not binance alias)', () => {
    const resp = assemblePricesResponse(baseFx({
      bybit: { ok: true, data: [mkPP('bybit', 'QQQUSDT', 572.45)], latencyMs: 1 },
    }));
    expect(resp.tickers.nq).toBeDefined();
    expect(resp.tickers.nq.bybit).toBeDefined();
    expect(resp.tickers.nq.bybit?.source).toBe('bybit');
    expect(resp.tickers.nq.binance).toBeUndefined();  // alias 없음 검증
  });

  it('keeps bitget in payload.bitget slot', () => {
    const resp = assemblePricesResponse(baseFx({
      bitget: { ok: true, data: [mkPP('bitget', 'QQQUSDT', 572.45)], latencyMs: 1 },
    }));
    expect(resp.tickers.nq.bitget?.source).toBe('bitget');
  });

  it('keeps all 4 venue slots when all sources succeed', () => {
    const resp = assemblePricesResponse(baseFx({
      binance: { ok: true, data: [mkPP('binance', 'QQQUSDT', 572.45)], latencyMs: 1 },
      bybit: { ok: true, data: [mkPP('bybit', 'QQQUSDT', 572.50)], latencyMs: 1 },
      bitget: { ok: true, data: [mkPP('bitget', 'QQQUSDT', 572.40)], latencyMs: 1 },
      polygon: { ok: true, data: [mkPP('polygon', 'QQQ', 572.30, 'USD')], latencyMs: 1 },
    }));
    expect(resp.tickers.nq.binance).toBeDefined();
    expect(resp.tickers.nq.bybit).toBeDefined();
    expect(resp.tickers.nq.bitget).toBeDefined();
    expect(resp.tickers.nq.polygon).toBeDefined();
  });

  it('omits nq ticker entirely when all sources fail (loading state)', () => {
    const resp = assemblePricesResponse(baseFx());
    expect(resp.tickers.nq).toBeUndefined();
  });

  it('disabled optional source does not pollute sourceHealth', () => {
    const resp = assemblePricesResponse(baseFx({
      bybit: { ok: true, data: [mkPP('bybit', 'QQQUSDT', 572.45)], latencyMs: 1 },
    }));
    expect(resp.sourceHealth.polygon.consecutiveFailures).toBe(0);
    expect(resp.sourceHealth.twelvedata.consecutiveFailures).toBe(0);
    expect(resp.sourceHealth.polygon.lastSuccess).toBe(0);
  });
});
