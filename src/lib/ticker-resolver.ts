import type { SearchResponse } from '@shared/types/prices.js';

/** `/api/search?q=...` HTTP wrapper. server 가 3-tier resolution 담당. */
export async function searchTicker(q: string): Promise<SearchResponse> {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok && res.status !== 400) {
      return { tier: null, results: [], reason: 'not_found' };
    }
    return (await res.json()) as SearchResponse;
  } catch {
    return { tier: null, results: [], reason: 'not_found' };
  }
}
