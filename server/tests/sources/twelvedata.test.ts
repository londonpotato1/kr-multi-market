import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTwelveData } from '../../lib/sources/twelvedata.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TWELVEDATA_API_KEY;
});

describe('fetchTwelveData (옵셔널 source)', () => {
  it('returns {ok:false, error:"disabled"} when TWELVEDATA_API_KEY not set', async () => {
    const result = await fetchTwelveData(['QQQ']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toBe('disabled');
    expect(result.latencyMs).toBe(0);
  });

  it('parses /quote response when API key set', async () => {
    process.env.TWELVEDATA_API_KEY = 'test-key';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        symbol: 'QQQ',
        close: '572.45',
        percent_change: '1.63',
        volume: '12345',
        timestamp: 1700000000,
      }), { status: 200 }) as unknown as Response,
    );
    const result = await fetchTwelveData(['QQQ']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data[0]).toMatchObject({
      source: 'twelvedata',
      symbol: 'QQQ',
      price: 572.45,
      unit: 'USD',
    });
    expect(result.data[0].change24hPct).toBeCloseTo(1.63, 2);
    // volume24hUsd = shares × close = 12345 × 572.45 ≈ 7,066,895 (polygon 일관성)
    expect(result.data[0].volume24hUsd).toBeCloseTo(7066895, -1);
  });

  it('returns ok:false when API returns error code', async () => {
    process.env.TWELVEDATA_API_KEY = 'test-key';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 401, status: 'error', message: 'invalid key' }), { status: 200 }) as unknown as Response,
    );
    const result = await fetchTwelveData(['QQQ']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).not.toBe('disabled');
  });

  it('returns ok:false on AbortError as "TwelveData timeout"', async () => {
    process.env.TWELVEDATA_API_KEY = 'test-key';
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
    const result = await fetchTwelveData(['QQQ']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toBe('TwelveData timeout');
  });
});
