import { describe, it, expect, beforeEach, vi } from 'vitest';

// hyperliquid-ws WS map mock — assemble.ts 의 동적 hyperliquid 분기가
// REST sources.hl 대신 WS allMids 를 직접 lookup 한다는 사실을 확인.
vi.mock('../lib/sources/hyperliquid-ws.js', () => ({
  getLatestMids: vi.fn(() => ({
    mids: new Map<string, number>(),
    lastUpdate: 0,
    connected: false,
  })),
}));

import { assemblePricesResponse, type SourceInputs } from '../lib/assemble.js';
import { _resetSourceHealth } from '../lib/health.js';
import { getLatestMids } from '../lib/sources/hyperliquid-ws.js';
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

  it('hydrates hyperliquid entry from WS allMids (not sources.hl REST)', () => {
    // sources.hl 은 REST 정적 7 ticker only — xyz_AAPL 없음.
    // WS map 에는 있는 상태로 mock → tickers[entry.key].hl 채워져야 함.
    const wsUpdate = now - 1000;
    vi.mocked(getLatestMids).mockReturnValueOnce({
      mids: new Map([['xyz_AAPL', 195.42]]),
      lastUpdate: wsUpdate,
      connected: true,
    });
    const resp = assemblePricesResponse(minimal(), [
      { key: 'aapl-hl', source: 'hyperliquid', symbol: 'xyz_AAPL' },
    ]);
    const t = resp.tickers['aapl-hl'];
    expect(t?.hl).toBeDefined();
    expect(t?.hl?.source).toBe('hyperliquid');
    expect(t?.hl?.symbol).toBe('xyz_AAPL');
    expect(t?.hl?.price).toBe(195.42);
    expect(t?.hl?.unit).toBe('USD');
    expect(t?.hl?.status).toBe('ok');
    expect(t?.hl?.asOf).toBe(wsUpdate);
  });

  it('skips hyperliquid entry when WS map has no symbol', () => {
    // WS map empty (default mock) — entry 건너뛰어야 함.
    const resp = assemblePricesResponse(minimal(), [
      { key: 'aapl-hl', source: 'hyperliquid', symbol: 'xyz_AAPL' },
    ]);
    expect(resp.tickers['aapl-hl']).toBeUndefined();
  });
});
