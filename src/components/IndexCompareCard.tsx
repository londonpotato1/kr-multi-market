import type { FxRates, TickerPayload } from '@shared/types/prices.js';
import { VenueRow } from './VenueRow';
import { SpreadRow } from './SpreadRow';

type Props = {
  label: string;
  ticker: string;
  payload?: TickerPayload;
  fx?: FxRates;
};

export function IndexCompareCard({ label, ticker, payload, fx }: Props) {
  void fx;
  const hasAnyVenue = !!(payload?.hl || payload?.binance || payload?.yahoo);

  if (!payload || !hasAnyVenue) {
    return (
      <article className="card card-loading">
        <header className="card-head">
          <h3>{label}</h3>
          <span className="ticker-id">{ticker}</span>
        </header>
        <div className="price-skel">—</div>
      </article>
    );
  }

  const spreadWarning =
    ticker === 'sp500'
      ? 'HL=index pt, Binance=SPY ETF (~10x ratio)'
      : undefined;

  return (
    <article className="card index-card">
      <header className="card-head">
        <h3>{label}</h3>
        <span className="ticker-id">{ticker}</span>
      </header>
      <div className="venues">
        <VenueRow source="hyperliquid" pp={payload.hl} />
        <VenueRow source="yahoo" pp={payload.yahoo} />
        <VenueRow source="binance" pp={payload.binance} />
      </div>
      <SpreadRow spread={payload.spread} warningNote={spreadWarning} />
    </article>
  );
}
