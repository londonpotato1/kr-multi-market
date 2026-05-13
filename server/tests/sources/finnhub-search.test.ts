import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchFinnhub } from '../../lib/sources/finnhub.js';

afterEach(() => vi.restoreAllMocks());

describe('searchFinnhub', () => {
  it('parses /search response and filters Common Stock + ETF', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        count: 3,
        result: [
          { symbol: 'AAPL', description: 'APPLE INC', type: 'Common Stock' },
          { symbol: 'AAPL.MX', description: 'APPLE INC (MX)', type: 'Common Stock' },
          { symbol: 'AAPL.OPT', description: 'AAPL Option', type: 'Option' },
        ],
      }), { status: 200 }) as unknown as Response,
    );
    const results = await searchFinnhub('Apple', 'test-token');
    expect(results).toHaveLength(2);  // Option filtered out
    expect(results[0]).toMatchObject({
      source: 'yahoo', symbol: 'AAPL', label: 'APPLE INC', tier: 1,
    });
  });

  it('returns [] when token empty', async () => {
    const results = await searchFinnhub('Apple', '');
    expect(results).toEqual([]);
  });

  it('returns [] on HTTP 429', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 429 }) as unknown as Response,
    );
    const results = await searchFinnhub('Apple', 'test-token');
    expect(results).toEqual([]);
  });

  it('limits to top 5 results', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      symbol: `T${i}`, description: `Ticker ${i}`, type: 'Common Stock',
    }));
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ count: 20, result: items }), { status: 200 }) as unknown as Response,
    );
    const results = await searchFinnhub('T', 'test-token');
    expect(results).toHaveLength(5);
  });
});
