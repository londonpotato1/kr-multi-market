import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchBybitLinear } from '../../lib/sources/bybit.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchBybitLinear', () => {
  it('parses QQQUSDT response into PricePoint[]', async () => {
    const mockResp = {
      retCode: 0,
      result: {
        list: [{
          symbol: 'QQQUSDT',
          lastPrice: '572.45',
          price24hPcnt: '0.0163',  // 1.63%
          turnover24h: '12345678.9',
          fundingRate: '0.0001',
          openInterest: '50000',
        }],
      },
    };
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResp), { status: 200 }) as unknown as Response,
    );

    const result = await fetchBybitLinear(['QQQUSDT']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      source: 'bybit',
      symbol: 'QQQUSDT',
      price: 572.45,
      unit: 'USDT',
      status: 'ok',
    });
    expect(result.data[0].change24hPct).toBeCloseTo(1.63, 2);
  });

  it('returns ok:false on HTTP error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 500 }) as unknown as Response,
    );
    const result = await fetchBybitLinear(['QQQUSDT']);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when retCode != 0', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ retCode: 10001, retMsg: 'error' }), { status: 200 }) as unknown as Response,
    );
    const result = await fetchBybitLinear(['QQQUSDT']);
    expect(result.ok).toBe(false);
  });
});
