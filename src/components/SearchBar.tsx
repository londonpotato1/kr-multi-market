import { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchResponse, SearchResult, WatchlistEntry } from '@shared/types/prices.js';
import { searchTicker } from '../lib/ticker-resolver';
import { SearchDropdown } from './SearchDropdown';

type Props = {
  onAdd: (entry: WatchlistEntry) => void;
};

const Q_REGEX = /^[a-zA-Z0-9가-힣\s.-]+$/;

/** v0.5.1: symbol 기반 (한글 label "item" fallback 회피). 충돌 해소는 useWatchlist.add 가 책임 (auto-suffix). */
function buildKey(symbol: string): string {
  // _ 도 [^a-z0-9]+ 가 흡수 — 별도 step 불필요 (double hyphen 회피)
  return symbol.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'item';
}

export function SearchBar({ onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // unmount cleanup — in-flight 요청 abort
  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2 || q.length > 32) {
      setResponse({ tier: null, results: [], reason: q.length < 2 ? 'too_short' : 'too_long' });
      return;
    }
    if (!Q_REGEX.test(q)) {
      setResponse({ tier: null, results: [], reason: 'invalid_chars' });
      return;
    }
    // 이전 in-flight 요청 abort (stale race 방지)
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    const res = await searchTicker(q, controller.signal);
    if (controller.signal.aborted) {
      setLoading(false);  // defensive — abort 후 unmount 가 아닌 케이스 방어
      return;
    }
    setResponse(res);
    setLoading(false);
  }, [query]);

  const handleClose = useCallback(() => setResponse(null), []);

  const handlePick = useCallback((result: SearchResult) => {
    const key = buildKey(result.symbol);
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
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage((err as Error).message);
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
      {errorMessage && (
        <div className="search-bar-error" role="alert">
          {errorMessage}
        </div>
      )}
      <SearchDropdown response={response} onPick={handlePick} onClose={handleClose} />
    </div>
  );
}
