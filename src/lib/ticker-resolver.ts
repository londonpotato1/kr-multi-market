import type { SearchResponse } from '@shared/types/prices.js';

/** `/api/search?q=...` HTTP wrapper. server 가 3-tier resolution 담당. */
export async function searchTicker(q: string, signal?: AbortSignal): Promise<SearchResponse> {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
    if (!res.ok && res.status !== 400) {
      return { tier: null, results: [], reason: 'not_found' };
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.results)) {
      return { tier: null, results: [], reason: 'not_found' };
    }
    return data as SearchResponse;
  } catch {
    return { tier: null, results: [], reason: 'not_found' };
  }
}
