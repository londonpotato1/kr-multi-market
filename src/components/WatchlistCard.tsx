import type { WatchlistEntry, TickerPayload, FxRates } from '@shared/types/prices.js';
import { IndexCompactCard } from './IndexCompactCard';

type Props = {
  entry: WatchlistEntry;
  payload?: TickerPayload;
  fx?: FxRates;
  onRemove: (key: string) => void;
};

export function WatchlistCard({ entry, payload, fx, onRemove }: Props) {
  return (
    <div className="watchlist-card-wrap">
      <button
        type="button"
        className="watchlist-card-remove"
        aria-label={`${entry.label} 삭제`}
        title="삭제"
        onClick={() => onRemove(entry.key)}
      >
        ✕
      </button>
      <IndexCompactCard
        ticker={entry.key}
        label={entry.label}
        payload={payload}
        fx={fx}
        hideVenues
      />
    </div>
  );
}
