import type { WatchlistEntry, PricesResponse, FxRates } from '@shared/types/prices.js';
import { WatchlistCard } from './WatchlistCard';

type Props = {
  entries: WatchlistEntry[];
  prices?: PricesResponse;
  fx?: FxRates;
  onRemove: (key: string) => void;
};

export function WatchlistSection({ entries, prices, fx, onRemove }: Props) {
  return (
    <section className="watchlist-section">
      <h2 className="watchlist-section-title">📌 관심 종목</h2>
      {entries.length === 0 && (
        <div className="watchlist-section-empty">검색해서 종목을 추가하세요</div>
      )}
      {entries.length > 0 && (
        <div className="watchlist-grid">
          {entries.map((entry) => (
            <WatchlistCard
              key={entry.key}
              entry={entry}
              payload={prices?.tickers[entry.key]}
              fx={fx}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
