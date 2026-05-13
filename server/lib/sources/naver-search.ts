import type { SearchResult } from '@shared/types/prices.js';
import { log } from '../logger.js';

const NAVER_BASE = 'https://m.stock.naver.com';
const SEARCH_TIMEOUT_MS = 5000;

type NaverSearchItem = {
  cd?: string;    // ticker code (6자리)
  nm?: string;    // 종목명
  tpcd?: string;  // 시장 (KOSPI, KOSDAQ, etc.)
};

type NaverSearchResponse = {
  result?: { d?: NaverSearchItem[] };
};

/** Naver 종목 검색 (한글). undocumented endpoint — 응답 shape 변경 시 fail 시 [] 반환. */
export async function searchNaver(q: string): Promise<SearchResult[]> {
  if (!q) return [];
  const url = `${NAVER_BASE}/api/json/search/searchListJson.nhn?keyword=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      log.warn(`[naver-search] HTTP ${res.status}`);
      return [];
    }
    const raw = (await res.json()) as NaverSearchResponse;
    const items = raw.result?.d ?? [];
    const results: SearchResult[] = [];
    for (const item of items) {
      if (!item.cd || !item.nm) continue;
      results.push({
        source: 'naver',
        symbol: item.cd,
        label: item.nm,
        description: item.tpcd || 'KRX',  // tpcd 가 빈 문자열도 KRX fallback (비공식 endpoint 방어)
        tier: 1,
      });
      if (results.length >= 5) break;
    }
    return results;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      log.warn('[naver-search] timeout');
    } else {
      log.warn('[naver-search] error:', err instanceof Error ? err.message : err);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
