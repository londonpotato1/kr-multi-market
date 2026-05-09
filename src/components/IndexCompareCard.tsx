import type { TickerPayload, FxRates } from '@shared/types/prices.js';
import { VenueRow } from './VenueRow';
import { SpreadRow } from './SpreadRow';
import { fmtKrw, fmtUsd } from '../lib/format';

const SP500_REFERENCE_RATIO = 10;

type Props = {
  ticker: string;
  label: string;
  payload?: TickerPayload;
  fx?: FxRates;
};

export function IndexCompareCard({ ticker, label, payload, fx }: Props) {
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

  const usdtKrw = fx?.usdtKrw ?? 0;
  const showKrwHeadline = usdtKrw > 0 && (payload.hl || payload.binance);
  const sp500Multiplier = ticker === 'sp500' ? SP500_REFERENCE_RATIO : 1;

  const hlKrw = payload.hl && usdtKrw > 0 ? payload.hl.price * usdtKrw : null;
  const binanceKrw = payload.binance && usdtKrw > 0 ? payload.binance.price * usdtKrw * sp500Multiplier : null;
  const headlineKrw = hlKrw ?? binanceKrw;

  return (
    <article className="card index-card">
      <header className="card-head">
        <h3>{label}</h3>
        <span className="ticker-id">{ticker}</span>
      </header>

      {showKrwHeadline && headlineKrw !== null && (
        <>
          <div className="price num">{fmtKrw(headlineKrw, 0)}</div>
          {payload.hl && (
            <div className="price-usd-sub num" title="HL native">
              ≈ {fmtUsd(payload.hl.price, 2)} {payload.hl.unit}
            </div>
          )}
        </>
      )}

      <div className="venues">
        <VenueRow source="hyperliquid" pp={payload.hl} />
        <VenueRow source="yahoo" pp={payload.yahoo} />
        <VenueRow source="binance" pp={payload.binance} />
      </div>

      {ticker === 'sp500' && hlKrw !== null && binanceKrw !== null && (
        <div className="krw-conversions num" title="Both venues normalized to KRW via Upbit USDT-KRW + server reference ratio 10x for SPY">
          HL: {fmtKrw(hlKrw, 0)} | Binance×10: {fmtKrw(binanceKrw, 0)}
        </div>
      )}
      {ticker !== 'sp500' && hlKrw !== null && binanceKrw !== null && (
        <div className="krw-conversions num">
          HL: {fmtKrw(hlKrw, 0)} | Binance: {fmtKrw(binanceKrw, 0)}
        </div>
      )}

      <SpreadRow
        spread={payload.spread}
        warningNote={ticker === 'sp500' ? 'HL=index pt, Binance=SPY ETF (~10x ratio, server-normalized)' : undefined}
      />
    </article>
  );
}
