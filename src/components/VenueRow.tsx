import type { PricePoint, SourceName } from '@shared/types/prices.js';
import { fmtUsd, fmtKrw, fmtPct, fmtCompactUsd, fmtFunding } from '../lib/format';

const SOURCE_LABELS: Record<SourceName, string> = {
  hyperliquid: 'HL xyz',
  yahoo: 'Yahoo',
  binance: 'Binance',
  naver: 'KRX',
  upbit: 'Upbit',
};

type Props = { source: SourceName; pp?: PricePoint; note?: string };

function formatPriceByUnit(price: number, unit: PricePoint['unit']) {
  if (unit === 'KRW') return fmtKrw(price, 0);
  if (unit === 'pt') {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return fmtUsd(price, 2);
}

export function VenueRow({ source, pp, note }: Props) {
  if (!pp) return null;

  const change = pp.change24hPct ?? 0;
  const changeClass =
    change > 0 ? 'change-up' : change < 0 ? 'change-down' : 'change-flat';
  const statusClass = `status-${pp.status}`;
  const statusGlyph = pp.status === 'ok' ? '▣' : '▢';

  const isStale = pp.status === 'stale';
  const staleTitle = isStale
    ? `STALE${pp.staleReason ? ` — ${pp.staleReason}` : ''}`
    : pp.status;

  return (
    <div className={`venue-row${isStale ? ' venue-stale' : ''}`}>
      <span className="venue-pill">{SOURCE_LABELS[source]}</span>
      <span className="venue-price num">
        {formatPriceByUnit(pp.price, pp.unit)}
        {pp.unit !== 'USD' && (
          <span className="venue-unit"> {pp.unit}</span>
        )}
      </span>
      <span className={`venue-change ${changeClass}`}>{fmtPct(change)}</span>
      {pp.fundingRate8h !== undefined && pp.fundingRate8h !== 0 && (
        <span className="venue-funding" title="Funding rate (8h)">
          F:{fmtFunding(pp.fundingRate8h)}
        </span>
      )}
      {pp.volume24hUsd !== undefined && pp.volume24hUsd > 0 && (
        <span className="venue-vol" title="24h Volume USD">
          V:{fmtCompactUsd(pp.volume24hUsd)}
        </span>
      )}
      <span className={`venue-status ${statusClass}`} title={staleTitle}>
        {statusGlyph}
      </span>
      {note && (
        <span className="venue-note" title={note}>
          ⓘ
        </span>
      )}
    </div>
  );
}
