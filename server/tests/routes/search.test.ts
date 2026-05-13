import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../lib/sources/finnhub.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sources/finnhub.js')>();
  return { ...actual, searchFinnhub: vi.fn() };
});
vi.mock('../../lib/sources/naver-search.js', () => ({ searchNaver: vi.fn() }));

import { app } from '../../index.js';
import { searchFinnhub } from '../../lib/sources/finnhub.js';
import { searchNaver } from '../../lib/sources/naver-search.js';

const mockFinnhub = searchFinnhub as ReturnType<typeof vi.fn>;
const mockNaver = searchNaver as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFinnhub.mockReset();
  mockNaver.mockReset();
});

describe('GET /api/search', () => {
  it('400 on empty q', async () => {
    const res = await request(app).get('/api/search?q=');
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('empty_query');
  });

  it('400 on q < 2 chars', async () => {
    const res = await request(app).get('/api/search?q=a');
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('too_short');
  });

  it('400 on q > 32 chars', async () => {
    const res = await request(app).get(`/api/search?q=${'a'.repeat(33)}`);
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('too_long');
  });

  it('400 on invalid chars (semicolon)', async () => {
    const res = await request(app).get('/api/search?q=' + encodeURIComponent('a;b'));
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('invalid_chars');
  });

  it('Tier 1: routes Hangul to Naver', async () => {
    mockNaver.mockResolvedValue([
      { source: 'naver', symbol: '005930', label: '삼성전자', description: 'KOSPI', tier: 1 },
    ]);
    const res = await request(app).get('/api/search?q=' + encodeURIComponent('삼성'));
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe(1);
    expect(res.body.results).toHaveLength(1);
    expect(mockFinnhub).not.toHaveBeenCalled();
  });

  it('Tier 1: routes English to Finnhub', async () => {
    mockFinnhub.mockResolvedValue([
      { source: 'yahoo', symbol: 'AAPL', label: 'Apple Inc.', description: 'Common Stock', tier: 1 },
    ]);
    const res = await request(app).get('/api/search?q=Apple');
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe(1);
    expect(res.body.results[0].symbol).toBe('AAPL');
    expect(mockNaver).not.toHaveBeenCalled();
  });

  it('Hangul + Naver 0 → naver_unavailable (Finnhub fallback X)', async () => {
    mockNaver.mockResolvedValue([]);
    const res = await request(app).get('/api/search?q=' + encodeURIComponent('없는한글'));
    expect(res.status).toBe(200);
    expect(res.body.tier).toBeNull();
    expect(res.body.reason).toBe('naver_unavailable');
  });

  it('English + Tier 1/2/3 모두 miss → not_found', async () => {
    mockFinnhub.mockResolvedValue([]);
    // Tier 2 mock 안 함 — 실제 fetchX 호출, test env 에서 invalid symbol 응답 (빈 결과)
    // Tier 3 = getLatestMids() = test env 비어있음
    const res = await request(app).get('/api/search?q=NOEXIST');
    expect(res.status).toBe(200);
    expect(res.body.tier).toBeNull();
    expect(res.body.reason).toBe('not_found');
  }, 15_000);
});
