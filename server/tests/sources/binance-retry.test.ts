import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchBinanceFutures } from '../../lib/sources/binance.js';

afterEach(() => vi.restoreAllMocks());

describe('Binance retry (v0.4.2)', () => {
  it('retries once on first failure and succeeds on second attempt', async () => {
    let call = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = url.toString();
      if (u.includes('/ticker/24hr')) {
        call++;
        if (call === 1) return new Response('', { status: 500 }) as unknown as Response;
        return new Response(JSON.stringify([
          { symbol: 'QQQUSDT', lastPrice: '572.45', priceChangePercent: '1.63', quoteVolume: '1000', closeTime: 1700000000000 },
        ]), { status: 200 }) as unknown as Response;
      }
      return new Response(JSON.stringify({ symbol: 'QQQUSDT', lastFundingRate: '0.0001' }), { status: 200 }) as unknown as Response;
    });

    const result = await fetchBinanceFutures(['QQQUSDT']);
    expect(result.ok).toBe(true);
    expect(call).toBe(2);
  }, 15_000);

  it('uses Retry-After header for backoff (capped at 5s)', async () => {
    let call = 0;
    const start = Date.now();
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = url.toString();
      if (u.includes('/ticker/24hr')) {
        call++;
        if (call === 1) {
          return new Response('', { status: 429, headers: { 'Retry-After': '2' } }) as unknown as Response;
        }
        return new Response(JSON.stringify([
          { symbol: 'QQQUSDT', lastPrice: '572.45', priceChangePercent: '1.63', quoteVolume: '1000', closeTime: 1700000000000 },
        ]), { status: 200 }) as unknown as Response;
      }
      return new Response(JSON.stringify({ symbol: 'QQQUSDT' }), { status: 200 }) as unknown as Response;
    });

    const result = await fetchBinanceFutures(['QQQUSDT']);
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(true);
    expect(call).toBe(2);
    expect(elapsed).toBeGreaterThanOrEqual(2000);
    expect(elapsed).toBeLessThan(5000);
  }, 15_000);

  it('caps Retry-After at 5000ms', async () => {
    let call = 0;
    const start = Date.now();
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = url.toString();
      if (u.includes('/ticker/24hr')) {
        call++;
        if (call === 1) {
          return new Response('', { status: 429, headers: { 'Retry-After': '60' } }) as unknown as Response;
        }
        return new Response(JSON.stringify([
          { symbol: 'QQQUSDT', lastPrice: '572.45', priceChangePercent: '1.63', quoteVolume: '1000', closeTime: 1700000000000 },
        ]), { status: 200 }) as unknown as Response;
      }
      return new Response(JSON.stringify({ symbol: 'QQQUSDT' }), { status: 200 }) as unknown as Response;
    });
    const result = await fetchBinanceFutures(['QQQUSDT']);
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(true);
    expect(call).toBe(2);
    expect(elapsed).toBeLessThan(7000);  // cap 5s + slack
  }, 15_000);

  it('falls back to default 1s backoff when Retry-After is HTTP-date (NaN guard)', async () => {
    let call = 0;
    const start = Date.now();
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = url.toString();
      if (u.includes('/ticker/24hr')) {
        call++;
        if (call === 1) {
          // HTTP-date 형식 — parseInt → NaN. fallback 으로 1s 기본값 사용 검증.
          return new Response('', { status: 429, headers: { 'Retry-After': 'Wed, 21 Oct 2015 07:28:00 GMT' } }) as unknown as Response;
        }
        return new Response(JSON.stringify([
          { symbol: 'QQQUSDT', lastPrice: '572.45', priceChangePercent: '1.63', quoteVolume: '1000', closeTime: 1700000000000 },
        ]), { status: 200 }) as unknown as Response;
      }
      return new Response(JSON.stringify({ symbol: 'QQQUSDT' }), { status: 200 }) as unknown as Response;
    });
    const result = await fetchBinanceFutures(['QQQUSDT']);
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(true);
    expect(call).toBe(2);
    expect(elapsed).toBeGreaterThanOrEqual(1000);  // 기본 1s backoff
    expect(elapsed).toBeLessThan(3000);            // NaN setTimeout(0) 회귀 방지
  }, 15_000);
});
