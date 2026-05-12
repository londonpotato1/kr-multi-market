import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchYahoo } from '../../lib/sources/yahoo.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FINNHUB_TOKEN;
});

describe('Yahoo Finnhub fallback (v0.4.2)', () => {
  it('falls back to Finnhub when all yahoo tiers fail and FINNHUB_TOKEN is set', async () => {
    process.env.FINNHUB_TOKEN = 'test-token';

    vi.spyOn(global, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const u = url.toString();
      if (u.includes('finnhub.io')) {
        return new Response(JSON.stringify({ c: 572.45, pc: 563.21, t: 1700000000 }), { status: 200 }) as unknown as Response;
      }
      return new Response('', { status: 429 }) as unknown as Response;
    });

    const result = await fetchYahoo(['QQQ']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data[0]).toMatchObject({ source: 'yahoo', symbol: 'QQQ', price: 572.45 });
  });

  it('returns ok:false when yahoo fails and FINNHUB_TOKEN is not set', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 429 }) as unknown as Response,
    );
    const result = await fetchYahoo(['QQQ']);
    expect(result.ok).toBe(false);
  });

  it('Finnhub filters out index (^NDX), future (NQ=F), FX (KRW=X) symbols', async () => {
    process.env.FINNHUB_TOKEN = 'test-token';

    const finnhubCalls: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const u = url.toString();
      if (u.includes('finnhub.io')) {
        // 호출된 symbol 만 기록 후 응답
        const match = u.match(/symbol=([^&]+)/);
        if (match) finnhubCalls.push(decodeURIComponent(match[1]));
        return new Response(JSON.stringify({ c: 572.45, pc: 563.21, t: 1700000000 }), { status: 200 }) as unknown as Response;
      }
      return new Response('', { status: 429 }) as unknown as Response;
    });

    await fetchYahoo(['^NDX', 'NQ=F', 'KRW=X', 'QQQ']);
    // QQQ 만 Finnhub 으로 전달 — 나머지 3개 filter 됨
    expect(finnhubCalls).toEqual(['QQQ']);
  });
});
