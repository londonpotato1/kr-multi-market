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

export function IndexCompactCard({ ticker, label, payload, fx }: Props) {
  const hasAnyVenue = !!(payload?.hl || payload?.binance || payload?.yahoo);
  if (!payload || !hasAnyVenue) {
    return (
      <article className="card index-compact card-loading" data-testid="index-compact-loading">
        <header className="card-head">
          <h3 className="ts-card-title">{label}</h3>
          <span className="ts-subtitle">{ticker}</span>
        </header>
        <div className="index-compact-headline">—</div>
      </article>
    );
  }

  const usdtKrw = fx?.usdtKrw ?? 0;
  const fxAvailable = usdtKrw > 0;
  const sp500Multiplier = ticker === 'sp500' ? SP500_REFERENCE_RATIO : 1;

  const hlKrw = payload.hl && fxAvailable ? payload.hl.price * usdtKrw : null;
  const binanceKrw = payload.binance && fxAvailable
    ? payload.binance.price * usdtKrw * sp500Multiplier
    : null;
  const headlineKrw = hlKrw ?? binanceKrw;

  const showKrwHeadline = fxAvailable && headlineKrw !== null;
  const showUsdHeadline = !fxAvailable && !!payload.hl;

  return (
    <article className="card index-compact">
      <header className="card-head">
        <h3 className="ts-card-title">{label}</h3>
        <span className="ts-subtitle">{ticker}</span>
      </header>

      {showKrwHeadline && (
        <>
          <div className="index-compact-headline ts-index-headline">
            {fmtKrw(headlineKrw!, 0)}
          </div>
          <div className="index-compact-usdt ts-subtitle">
            ≈ {fmtUsd(headlineKrw! / usdtKrw)} USDT
          </div>
        </>
      )}
      {showUsdHeadline && (
        <div className="index-compact-headline ts-index-headline">
          {fmtUsd(payload.hl!.price)}
        </div>
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
