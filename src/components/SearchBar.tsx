import { useState, useCallback } from 'react';
import type { SearchResponse, SearchResult, WatchlistEntry } from '@shared/types/prices.js';
import { searchTicker } from '../lib/ticker-resolver';
import { SearchDropdown } from './SearchDropdown';

type Props = {
  onAdd: (entry: WatchlistEntry) => void;
};

/** label → lowercase alphanumeric + hyphen. 충돌 해소는 useWatchlist.add 가 책임 (auto-suffix). */
function buildKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'item';
}

export function SearchBar({ onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    const res = await searchTicker(q);
    setResponse(res);
    setLoading(false);
  }, [query]);

  const handlePick = useCallback((result: SearchResult) => {
    const key = buildKey(result.label);
    try {
      onAdd({
        key,
        source: result.source,
        symbol: result.symbol,
        label: result.label,
        tier: result.tier,
      });
      setQuery('');
      setResponse(null);
    } catch (err) {
      alert((err as Error).message);
    }
  }, [onAdd]);

  return (
    <div className="search-bar-wrap">
      <form onSubmit={handleSubmit} className="search-bar-form">
        <input
          type="text"
          className="search-bar-input"
          placeholder="🔍 종목 검색 (예: Apple, 삼성전자, 005930)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="종목 검색"
          maxLength={32}
        />
        <button type="submit" disabled={query.trim().length < 2 || loading}>
          {loading ? '검색 중...' : '추가'}
        </button>
      </form>
      <SearchDropdown response={response} onPick={handlePick} onClose={() => setResponse(null)} />
    </div>
  );
}
