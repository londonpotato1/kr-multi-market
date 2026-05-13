import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchNaver } from '../../lib/sources/naver-search.js';

afterEach(() => vi.restoreAllMocks());

describe('searchNaver', () => {
  it('parses /ac autocomplete response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        items: [
          { code: '005930', name: '삼성전자', typeCode: 'KOSPI', typeName: '코스피' },
          { code: '028260', name: '삼성물산', typeCode: 'KOSPI', typeName: '코스피' },
        ],
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
      new Response(JSON.stringify({ items: [] }), { status: 200 }) as unknown as Response,
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
      code: `00593${i}`, name: `삼성${i}`, typeCode: 'KOSPI', typeName: '코스피',
    }));
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items }), { status: 200 }) as unknown as Response,
    );
    const results = await searchNaver('삼성');
    expect(results).toHaveLength(5);
  });

  it('uses UTF-8 encoding on ac.stock.naver.com (v0.5.0 endpoint switch)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }) as unknown as Response,
    );
    await searchNaver('삼성');
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    // 새 endpoint 는 ac.stock.naver.com, UTF-8 percent-encoded. EUC-KR 가설 (잘못된 진단) 회귀 방어.
    expect(calledUrl).toContain('ac.stock.naver.com/ac');
    expect(calledUrl).toContain('target=stock');
    expect(calledUrl).toContain('%EC%82%BC%EC%84%B1');  // UTF-8 '삼성'
  });
});
