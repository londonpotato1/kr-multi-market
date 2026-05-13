import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../lib/sources/finnhub.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sources/finnhub.js')>();
  return { ...actual, searchFinnhub: vi.fn() };
});
vi.mock('../../lib/sources/naver-search.js', () => ({ searchNaver: vi.fn() }));
vi.mock('../../lib/sources/binance.js', () => ({ fetchBinanceFutures: vi.fn() }));
vi.mock('../../lib/sources/bybit.js', () => ({ fetchBybitLinear: vi.fn() }));
vi.mock('../../lib/sources/bitget.js', () => ({ fetchBitgetFutures: vi.fn() }));

import { app } from '../../index.js';
import { searchFinnhub } from '../../lib/sources/finnhub.js';
import { searchNaver } from '../../lib/sources/naver-search.js';
import { fetchBinanceFutures } from '../../lib/sources/binance.js';
import { fetchBybitLinear } from '../../lib/sources/bybit.js';
import { fetchBitgetFutures } from '../../lib/sources/bitget.js';

const mockFinnhub = searchFinnhub as ReturnType<typeof vi.fn>;
const mockNaver = searchNaver as ReturnType<typeof vi.fn>;
const mockBinance = fetchBinanceFutures as ReturnType<typeof vi.fn>;
const mockBybit = fetchBybitLinear as ReturnType<typeof vi.fn>;
const mockBitget = fetchBitgetFutures as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFinnhub.mockReset();
  mockNaver.mockReset();
  // Tier 2 default: all miss (테스트가 hit 시키려면 override)
  mockBinance.mockResolvedValue({ ok: false, error: 'not found', latencyMs: 0 });
  mockBybit.mockResolvedValue({ ok: false, error: 'not found', latencyMs: 0 });
  mockBitget.mockResolvedValue({ ok: false, error: 'not found', latencyMs: 0 });
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
    // Tier 2 beforeEach default = all miss. Tier 3 = test env getLatestMids 빈 Map.
    const res = await request(app).get('/api/search?q=NOEXIST');
    expect(res.status).toBe(200);
    expect(res.body.tier).toBeNull();
    expect(res.body.reason).toBe('not_found');
  });

  it('Tier 2 hit: Binance first-match-wins (binance > bybit > bitget)', async () => {
    mockFinnhub.mockResolvedValue([]);
    mockBinance.mockResolvedValue({ ok: true, data: [{ source: 'binance', symbol: 'TSLAUSDT', price: 250, unit: 'USDT', status: 'ok', asOf: 0, receivedAt: 0, schemaVersion: 1 }], latencyMs: 10 });
    mockBybit.mockResolvedValue({ ok: true, data: [{ source: 'bybit', symbol: 'TSLAUSDT', price: 250.1, unit: 'USDT', status: 'ok', asOf: 0, receivedAt: 0, schemaVersion: 1 }], latencyMs: 10 });
    const res = await request(app).get('/api/search?q=TSLA');
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe(2);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].source).toBe('binance');
    expect(res.body.results[0].symbol).toBe('TSLAUSDT');
  });
});
