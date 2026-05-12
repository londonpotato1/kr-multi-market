import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPolygon } from '../../lib/sources/polygon.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.POLYGON_API_KEY;
});

describe('fetchPolygon (옵셔널 source)', () => {
  it('returns {ok:false, error:"disabled"} when POLYGON_API_KEY not set', async () => {
    const result = await fetchPolygon(['QQQ']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toBe('disabled');
    expect(result.latencyMs).toBe(0);
  });

  it('parses QQQ /v2/aggs response when API key set', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        status: 'OK',
        ticker: 'QQQ',
        results: [{ c: 572.45, o: 563.21, h: 575.0, l: 562.0, v: 12345, t: 1700000000000 }],
      }), { status: 200 }) as unknown as Response,
    );
    const result = await fetchPolygon(['QQQ']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data[0]).toMatchObject({
      source: 'polygon',
      symbol: 'QQQ',
      price: 572.45,
      unit: 'USD',
    });
    // change24hPct = (c - o) / o * 100 = (572.45 - 563.21) / 563.21 * 100 ≈ 1.64%
    expect(result.data[0].change24hPct).toBeCloseTo(1.64, 1);
    // volume24hUsd = v * c = 12345 * 572.45 ≈ 7,066,895
    expect(result.data[0].volume24hUsd).toBeCloseTo(7066895, -1);
  });

  it('returns undefined change24hPct when open price missing', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        status: 'OK',
        ticker: 'QQQ',
        results: [{ c: 572.45, v: 12345, t: 1700000000000 }],  // o 없음
      }), { status: 200 }) as unknown as Response,
    );
    const result = await fetchPolygon(['QQQ']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data[0].change24hPct).toBeUndefined();
  });

  it('returns ok:false on HTTP 429 with API key set', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 429 }) as unknown as Response,
    );
    const result = await fetchPolygon(['QQQ']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).not.toBe('disabled');  // 진짜 fail (sourceHealth 오염)
  });
});
