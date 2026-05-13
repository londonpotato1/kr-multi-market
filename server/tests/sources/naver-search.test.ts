import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchNaver } from '../../lib/sources/naver-search.js';

afterEach(() => vi.restoreAllMocks());

describe('searchNaver', () => {
  it('parses /searchListJson response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          d: [
            { cd: '005930', nm: '삼성전자', tpcd: 'KOSPI' },
            { cd: '028260', nm: '삼성물산', tpcd: 'KOSPI' },
          ],
        },
      }), { status: 200 }) as unknown as Response,
    );
    const results = await searchNaver('삼성');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      source: 'naver', symbol: '005930', label: '삼성전자', description: 'KOSPI', tier: 1,
    });
  });

  it('returns [] on empty result', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: { d: [] } }), { status: 200 }) as unknown as Response,
    );
    const results = await searchNaver('없는종목');
    expect(results).toEqual([]);
  });

  it('returns [] on HTTP error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 500 }) as unknown as Response,
    );
    const results = await searchNaver('삼성');
    expect(results).toEqual([]);
  });

  it('limits to top 5 results', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      cd: `00593${i}`, nm: `삼성${i}`, tpcd: 'KOSPI',
    }));
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: { d: items } }), { status: 200 }) as unknown as Response,
    );
    const results = await searchNaver('삼성');
    expect(results).toHaveLength(5);
  });
});
