import { describe, it, expect, beforeEach } from 'vitest';
import { assemblePricesResponse, type SourceInputs } from '../lib/assemble.js';
import { _resetSourceHealth } from '../lib/health.js';
import type { PricePoint } from '@shared/types/prices.js';

const now = Date.now();
const mkPP = (source: PricePoint['source'], symbol: string, price: number, unit: PricePoint['unit'] = 'USDT'): PricePoint => ({
  source, symbol, price, unit, status: 'ok', asOf: now, receivedAt: now, schemaVersion: 1,
});

const minimal = (): SourceInputs => ({
  hl: { ok: false, error: 'n/a', latencyMs: 0 },
  naver: { ok: false, error: 'n/a', latencyMs: 0 },
  yahoo: { ok: true, data: [mkPP('yahoo', 'KRW=X', 1471.7, 'KRW')], latencyMs: 1 },
  upbit: { ok: true, data: [mkPP('upbit', 'KRW-USDT', 1470, 'KRW')], latencyMs: 1 },
  binance: { ok: false, error: 'n/a', latencyMs: 0 },
  bybit: { ok: false, error: 'disabled', latencyMs: 0 },
  bitget: { ok: false, error: 'disabled', latencyMs: 0 },
  polygon: { ok: false, error: 'disabled', latencyMs: 0 },
  twelvedata: { ok: false, error: 'disabled', latencyMs: 0 },
});

describe('assemble — dynamic watchlist mapping', () => {
  beforeEach(() => _resetSourceHealth());

  it('adds watchlist ticker to response tickers[key]', () => {
    const inputs = minimal();
    inputs.binance = { ok: true, data: [mkPP('binance', 'AAPLUSDT', 195.50)], latencyMs: 1 };
    const resp = assemblePricesResponse(inputs, [
      { key: 'aapl', source: 'binance', symbol: 'AAPLUSDT' },
    ]);
    expect(resp.tickers.aapl).toBeDefined();
    expect(resp.tickers.aapl.binance?.price).toBe(195.50);
  });

  it('skips entry when source data missing', () => {
    const resp = assemblePricesResponse(minimal(), [
      { key: 'aapl', source: 'binance', symbol: 'AAPLUSDT' },
    ]);
    expect(resp.tickers.aapl).toBeUndefined();
  });

  it('skips entry when key collides with static ticker', () => {
    const inputs = minimal();
    inputs.binance = { ok: true, data: [mkPP('binance', 'EWYUSDT', 60)], latencyMs: 1 };
    const resp = assemblePricesResponse(inputs, [
      { key: 'ewy', source: 'binance', symbol: 'EWYUSDT' },
    ]);
    expect(resp.tickers.ewy?.binance).toBeDefined();
  });

  it('no watchlist arg = v0.4.2 behavior unchanged', () => {
    const resp = assemblePricesResponse(minimal());
    expect(resp.tickers.aapl).toBeUndefined();
  });

  it('multiple watchlist entries via different sources', () => {
    const inputs = minimal();
    inputs.binance = { ok: true, data: [mkPP('binance', 'AAPLUSDT', 195)], latencyMs: 1 };
    inputs.naver = { ok: true, data: [mkPP('naver', '035720', 50000, 'KRW')], latencyMs: 1 };
    const resp = assemblePricesResponse(inputs, [
      { key: 'aapl', source: 'binance', symbol: 'AAPLUSDT' },
      { key: 'kakao', source: 'naver', symbol: '035720' },
    ]);
    expect(resp.tickers.aapl.binance?.price).toBe(195);
    expect(resp.tickers.kakao.naver?.price).toBe(50000);
  });
});
