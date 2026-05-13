import { useEffect } from 'react';
import type { SearchResult, SearchResponse } from '@shared/types/prices.js';

type Props = {
  response: SearchResponse | null;
  onPick: (result: SearchResult) => void;
  onClose: () => void;
};

const REASON_MESSAGES: Record<NonNullable<SearchResponse['reason']>, string> = {
  empty_query: '검색어를 입력하세요',
  too_short: '검색어는 2자 이상이어야 합니다',
  too_long: '검색어는 32자 이하여야 합니다',
  invalid_chars: '허용되지 않는 문자가 포함됨',
  naver_unavailable: '한국 주식 검색 일시 장애 (Naver 서버 응답 없음). 잠시 후 재시도하세요.',
  not_found: '검색 결과 없음 (Tier 1/2/3 모두 miss)',
};

export function SearchDropdown({ response, onPick, onClose }: Props) {
  useEffect(() => {
    if (!response) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [response, onClose]);

  if (!response) return null;
  return (
    <div className="search-dropdown" role="listbox">
      {response.results.length === 0 && (
        <div className="search-dropdown-empty">
          {response.reason ? REASON_MESSAGES[response.reason] : '검색 결과 없음'}
        </div>
      )}
      {response.results.map((r) => (
        <button
          key={`${r.source}:${r.symbol}`}
          type="button"
          className="search-dropdown-item"
          role="option"
          onClick={() => { onPick(r); onClose(); }}
        >
          <span className="search-item-label">{r.label}</span>
          <span className="search-item-meta">
            {r.symbol} · {r.description ?? r.source} · Tier {r.tier}
          </span>
        </button>
      ))}
    </div>
  );
}
