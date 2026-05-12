import { describe, it, expect, beforeEach } from 'vitest';
import { assemblePricesResponse, type SourceInputs } from '../lib/assemble.js';
import { _resetSourceHealth } from '../lib/health.js';
import type { PricePoint } from '@shared/types/prices.js';

const now = Date.now();
const mkPP = (source: PricePoint['source'], symbol: string, price: number, unit: PricePoint['unit']): PricePoint => ({
  source, symbol, price, unit, status: 'ok', asOf: now, receivedAt: now, schemaVersion: 1,
});

const QQQ_RANGE: [number, number] = [400, 800];  // QQQ ETF reasonable 2024-2026 range

describe('NQ unit consistency — all sources ~$500-700 USD/USDT', () => {
  beforeEach(() => _resetSourceHealth());

  it('rejects unit drift (e.g. NDX index 21000pt) by source filter', () => {
    const inputs: SourceInputs = {
      hl: { ok: false, error: 'n/a', latencyMs: 0 },
      naver: { ok: false, error: 'n/a', latencyMs: 0 },
      yahoo: { ok: true, data: [mkPP('yahoo', '^NDX', 21000, 'pt')], latencyMs: 1 },
      upbit: { ok: true, data: [mkPP('upbit', 'KRW-USDT', 1470, 'KRW')], latencyMs: 1 },
      binance: { ok: true, data: [mkPP('binance', 'QQQUSDT', 572.45, 'USDT')], latencyMs: 1 },
      bybit: { ok: false, error: 'disabled', latencyMs: 0 },
      bitget: { ok: false, error: 'disabled', latencyMs: 0 },
      polygon: { ok: false, error: 'disabled', latencyMs: 0 },
      twelvedata: { ok: false, error: 'disabled', latencyMs: 0 },
    };
    const resp = assemblePricesResponse(inputs);
    expect(resp.tickers.nq).toBeDefined();
    // ^NDX 는 YAHOO_SYMBOL_TO_TICKER 에 없음 → drop
    expect(resp.tickers.nq.yahoo).toBeUndefined();
    expect(resp.tickers.nq.binance?.price).toBeGreaterThanOrEqual(QQQ_RANGE[0]);
    expect(resp.tickers.nq.binance?.price).toBeLessThanOrEqual(QQQ_RANGE[1]);
  });

  it('accepts QQQ ETF from Yahoo (USD)', () => {
    const inputs: SourceInputs = {
      hl: { ok: false, error: 'n/a', latencyMs: 0 },
      naver: { ok: false, error: 'n/a', latencyMs: 0 },
      yahoo: { ok: true, data: [mkPP('yahoo', 'QQQ', 572.45, 'USD')], latencyMs: 1 },
      upbit: { ok: true, data: [mkPP('upbit', 'KRW-USDT', 1470, 'KRW')], latencyMs: 1 },
      binance: { ok: false, error: 'n/a', latencyMs: 0 },
      bybit: { ok: false, error: 'disabled', latencyMs: 0 },
      bitget: { ok: false, error: 'disabled', latencyMs: 0 },
      polygon: { ok: false, error: 'disabled', latencyMs: 0 },
      twelvedata: { ok: false, error: 'disabled', latencyMs: 0 },
    };
    const resp = assemblePricesResponse(inputs);
    expect(resp.tickers.nq.yahoo?.price).toBe(572.45);
    expect(resp.tickers.nq.yahoo?.unit).toBe('USD');
  });

  it('all 4 venue sources fall within QQQ range', () => {
    const inputs: SourceInputs = {
      hl: { ok: false, error: 'n/a', latencyMs: 0 },
      naver: { ok: false, error: 'n/a', latencyMs: 0 },
      yahoo: { ok: true, data: [mkPP('yahoo', 'QQQ', 572.45, 'USD')], latencyMs: 1 },
      upbit: { ok: true, data: [mkPP('upbit', 'KRW-USDT', 1470, 'KRW')], latencyMs: 1 },
      binance: { ok: true, data: [mkPP('binance', 'QQQUSDT', 572.50, 'USDT')], latencyMs: 1 },
      bybit: { ok: true, data: [mkPP('bybit', 'QQQUSDT', 572.55, 'USDT')], latencyMs: 1 },
      bitget: { ok: true, data: [mkPP('bitget', 'QQQUSDT', 572.40, 'USDT')], latencyMs: 1 },
      polygon: { ok: false, error: 'disabled', latencyMs: 0 },
      twelvedata: { ok: false, error: 'disabled', latencyMs: 0 },
    };
    const resp = assemblePricesResponse(inputs);
    const venues = [
      resp.tickers.nq.yahoo,
      resp.tickers.nq.binance,
      resp.tickers.nq.bybit,
      resp.tickers.nq.bitget,
    ];
    for (const v of venues) {
      expect(v).toBeDefined();
      expect(v!.price).toBeGreaterThanOrEqual(QQQ_RANGE[0]);
      expect(v!.price).toBeLessThanOrEqual(QQQ_RANGE[1]);
    }
  });
});
