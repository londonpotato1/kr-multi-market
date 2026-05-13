import type { SearchResult } from '@shared/types/prices.js';
import { log } from '../logger.js';

const NAVER_AC_BASE = 'https://ac.stock.naver.com';
const SEARCH_TIMEOUT_MS = 5000;

type NaverAcItem = {
  code?: string;       // ticker code (6자리)
  name?: string;       // 종목명
  typeCode?: string;   // KOSPI, KOSDAQ, etc.
  typeName?: string;   // 코스피, 코스닥
};

type NaverAcResponse = {
  items?: NaverAcItem[];
};

/**
 * Naver 종목 검색 (한글). undocumented autocomplete endpoint.
 * NOTE: 이전엔 `m.stock.naver.com/api/json/search/searchListJson.nhn` 사용했으나,
 * 그것은 검색이 아니라 시가총액 인기종목 리스트 (keyword 무시). v0.5.0 에서
 * 실제 검색 endpoint `ac.stock.naver.com/ac` (UTF-8) 로 교체.
 * 응답 shape 변경 시 fail 은 [] 반환.
 */
export async function searchNaver(q: string): Promise<SearchResult[]> {
  if (!q) return [];
  const url = `${NAVER_AC_BASE}/ac?q=${encodeURIComponent(q)}&target=stock`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      log.warn(`[naver-search] HTTP ${res.status}`);
      return [];
    }
    const raw = (await res.json()) as NaverAcResponse;
    const items = raw.items ?? [];
    const results: SearchResult[] = [];
    for (const item of items) {
      if (!item.code || !item.name) continue;
      results.push({
        source: 'naver',
        symbol: item.code,
        label: item.name,
        description: item.typeCode || 'KRX',  // typeCode 빈 문자열도 KRX fallback (비공식 endpoint 방어)
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
