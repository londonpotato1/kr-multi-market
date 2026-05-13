import { type Request, type Response } from 'express';
import { searchFinnhub } from '../lib/sources/finnhub.js';
import { searchNaver } from '../lib/sources/naver-search.js';
import { fetchBinanceFutures } from '../lib/sources/binance.js';
import { fetchBybitLinear } from '../lib/sources/bybit.js';
import { fetchBitgetFutures } from '../lib/sources/bitget.js';
import { getLatestMids } from '../lib/sources/hyperliquid-ws.js';
import { log } from '../lib/logger.js';
import type { SearchResponse, SearchResult } from '@shared/types/prices.js';

const Q_REGEX = /^[a-zA-Z0-9가-힣\s.-]+$/;
const HANGUL_REGEX = /[가-힣]/;

// Startup warn: FINNHUB_TOKEN 미설정 시 영문 Tier 1 always miss
if (!process.env.FINNHUB_TOKEN && process.env.NODE_ENV !== 'test') {
  log.warn('[search] FINNHUB_TOKEN not set — English Tier 1 (Finnhub /search) will always return []');
}

export async function searchHandler(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '').trim();
  // 검사 순서: empty → invalid_chars → too_short → too_long
  // (보안 신호 우선 — 특수문자 1자도 invalid_chars 로 정확 reject, security 우선 spec §6 의도)
  if (q.length === 0) {
    res.status(400).json({ tier: null, results: [], reason: 'empty_query' } as SearchResponse);
    return;
  }
  if (!Q_REGEX.test(q)) {
    res.status(400).json({ tier: null, results: [], reason: 'invalid_chars' } as SearchResponse);
    return;
  }
  if (q.length < 2) {
    res.status(400).json({ tier: null, results: [], reason: 'too_short' } as SearchResponse);
    return;
  }
  if (q.length > 32) {
    res.status(400).json({ tier: null, results: [], reason: 'too_long' } as SearchResponse);
    return;
  }

  const isHangul = HANGUL_REGEX.test(q);

  // Tier 1: KRX (한글) 또는 NASDAQ (영문)
  const tier1Results = isHangul
    ? await searchNaver(q)
    : await searchFinnhub(q, process.env.FINNHUB_TOKEN ?? '');

  if (tier1Results.length > 0) {
    res.json({ tier: 1, results: tier1Results } as SearchResponse);
    return;
  }

  // 한글 입력 + Naver 결과 0개 → Finnhub fallback X (한글 미지원). 영문 입력 권고.
  if (isHangul) {
    res.json({ tier: null, results: [], reason: 'naver_unavailable' } as SearchResponse);
    return;
  }

  // Tier 2: CEX probe (Binance + Bybit + Bitget 병렬, singleFlight 우회 — 정기 poll cache 와 분리)
  const TICKER = q.toUpperCase();
  const cexSymbol = `${TICKER}USDT`;
  const [binResult, bybitResult, bitgetResult] = await Promise.all([
    fetchBinanceFutures([cexSymbol]).catch((err) => { log.warn('[search] binance probe failed', err instanceof Error ? err.message : err); return null; }),
    fetchBybitLinear([cexSymbol]).catch((err) => { log.warn('[search] bybit probe failed', err instanceof Error ? err.message : err); return null; }),
    fetchBitgetFutures([cexSymbol]).catch((err) => { log.warn('[search] bitget probe failed', err instanceof Error ? err.message : err); return null; }),
  ]);

  const tier2Hits: SearchResult[] = [];
  if (binResult?.ok && binResult.data.length > 0) {
    tier2Hits.push({ source: 'binance', symbol: cexSymbol, label: cexSymbol, description: 'Binance Perp', tier: 2 });
  }
  if (bybitResult?.ok && bybitResult.data.length > 0) {
    tier2Hits.push({ source: 'bybit', symbol: cexSymbol, label: cexSymbol, description: 'Bybit Perp', tier: 2 });
  }
  if (bitgetResult?.ok && bitgetResult.data.length > 0) {
    tier2Hits.push({ source: 'bitget', symbol: cexSymbol, label: cexSymbol, description: 'Bitget Perp', tier: 2 });
  }
  if (tier2Hits.length > 0) {
    // First-match-wins: binance > bybit > bitget 우선순위 (배열 순서)
    res.json({ tier: 2, results: [tier2Hits[0]] } as SearchResponse);
    return;
  }

  // Tier 3: HL xyz allMids lookup
  const mids = getLatestMids();
  const hlKey = `xyz_${TICKER}`;
  if (mids.mids.has(hlKey)) {
    res.json({
      tier: 3,
      results: [{ source: 'hyperliquid', symbol: hlKey, label: TICKER, description: 'Hyperliquid xyz', tier: 3 }],
    } as SearchResponse);
    return;
  }

  res.json({ tier: null, results: [], reason: 'not_found' } as SearchResponse);
}
