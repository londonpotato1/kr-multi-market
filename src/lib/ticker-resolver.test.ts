import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchTicker } from './ticker-resolver';

afterEach(() => vi.restoreAllMocks());

describe('searchTicker', () => {
  it('returns response from /api/search', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        tier: 1,
        results: [{ source: 'yahoo', symbol: 'AAPL', label: 'Apple Inc.', description: 'Common Stock', tier: 1 }],
      }), { status: 200 }) as unknown as Response,
    );
    const res = await searchTicker('Apple');
    expect(res.tier).toBe(1);
    expect(res.results).toHaveLength(1);
  });

  it('returns empty results on 400', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tier: null, results: [], reason: 'too_short' }), { status: 400 }) as unknown as Response,
    );
    const res = await searchTicker('a');
    expect(res.results).toEqual([]);
    expect(res.reason).toBe('too_short');
  });

  it('returns empty results on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const res = await searchTicker('Apple');
    expect(res.results).toEqual([]);
  });
});
