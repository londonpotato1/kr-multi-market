import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchBitgetFutures } from '../../lib/sources/bitget.js';

afterEach(() => vi.restoreAllMocks());

describe('fetchBitgetFutures', () => {
  it('parses QQQUSDT response into PricePoint[]', async () => {
    const mockResp = {
      code: '00000',
      data: [{
        symbol: 'QQQUSDT',
        lastPr: '572.45',
        change24h: '0.0163',
        baseVolume: '12345',
        usdtVolume: '7064345.25',
        fundingRate: '0.0001',
        holdingAmount: '431.04',
        markPrice: '572.40',
      }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResp), { status: 200 }) as unknown as Response,
    );
    const result = await fetchBitgetFutures(['QQQUSDT']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data[0]).toMatchObject({
      source: 'bitget',
      symbol: 'QQQUSDT',
      price: 572.45,
      unit: 'USDT',
    });
    expect(result.data[0].change24hPct).toBeCloseTo(1.63, 2);
    // volume24hUsd = usdtVolume (USDT 단위)
    expect(result.data[0].volume24hUsd).toBeCloseTo(7064345.25, 1);
    // openInterestUsd = undefined (Bitget API USDT 직접 제공 X)
    expect(result.data[0].openInterestUsd).toBeUndefined();
  });

  it('returns ok:false on HTTP 500', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 500 }) as unknown as Response,
    );
    const result = await fetchBitgetFutures(['QQQUSDT']);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when code != 00000', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '40001', msg: 'error' }), { status: 200 }) as unknown as Response,
    );
    const result = await fetchBitgetFutures(['QQQUSDT']);
    expect(result.ok).toBe(false);
  });
});
