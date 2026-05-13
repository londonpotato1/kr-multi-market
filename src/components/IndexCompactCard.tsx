import type { TickerPayload, FxRates, PricePoint } from '@shared/types/prices.js';
import { VenueRow } from './VenueRow';
import { SpreadRow } from './SpreadRow';
import { fmtKrw, fmtUsd } from '../lib/format';

const SP500_REFERENCE_RATIO = 10;

type Props = {
  ticker: string;
  label: string;
  payload?: TickerPayload;
  fx?: FxRates;
  hideVenues?: boolean;  // v0.5.2: 단일 venue watchlist 카드용 (venues 섹션 중복 제거)
};

/** v0.4.2 — NQ headline fallback chain (모든 source = USD/USDT scale, spec §3.2 / §3.3).
 *  Priority: HL > Yahoo > Binance > Bybit > Bitget > Polygon > TwelveData.
 *  Stale source (NYSE 휴장 시 Yahoo 등) 는 skip — fresh perp source 우선. */
function pickHeadlineSource(
  payload: TickerPayload,
  fxAvailable: boolean,
  usdtKrw: number,
): { value: number; label: string } | null {
  if (!fxAvailable) return null;
  const candidates: Array<[PricePoint | undefined, string]> = [
    [payload.hl,         'HL'],
    [payload.yahoo,      'Yahoo'],
    [payload.binance,    'Binance'],
    [payload.bybit,      'Bybit'],
    [payload.bitget,     'Bitget'],
    [payload.polygon,    'Polygon'],
    [payload.twelvedata, 'TwelveData'],
  ];
  for (const [pp, label] of candidates) {
    if (pp && pp.status !== 'stale' && Number.isFinite(pp.price) && pp.price > 0) {
      return { value: pp.price * usdtKrw, label };
    }
  }
  return null;
}

export function IndexCompactCard({ ticker, label, payload, fx, hideVenues }: Props) {
  const hasAnyVenue = !!(
    payload?.hl || payload?.yahoo || payload?.binance ||
    payload?.bybit || payload?.bitget || payload?.polygon || payload?.twelvedata ||
    payload?.naver
  );
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

  // NQ 카드: pickHeadlineSource 사용 (v0.4.2). EWY/SP500: 기존 HL→Binance 분기 유지.
  const useFallbackChain = ticker === 'nq';

  const hlKrw = payload.hl && fxAvailable ? payload.hl.price * usdtKrw : null;
  const binanceKrw = payload.binance && fxAvailable
    ? payload.binance.price * usdtKrw * sp500Multiplier
    : null;

  // v0.5.3: stale 도 가격 표시 (KRX 휴장 시 한국 주식 watchlist 카드 fallback 없음).
  // 정적 dashboard 의 StockHeroCard 와 일관 (stale 시 가격 + footer 시그널).
  const naverKrw = payload.naver
    && Number.isFinite(payload.naver.price)
    && payload.naver.price > 0
    ? payload.naver.price
    : null;
  const naverMarketClosed = payload.naver?.status === 'stale'
    && payload.naver.staleReason === 'market_closed';

  const headline = naverKrw !== null
    ? { value: naverKrw, label: 'Naver' }
    : useFallbackChain
      ? pickHeadlineSource(payload, fxAvailable, usdtKrw)
      : (hlKrw !== null ? { value: hlKrw, label: 'HL' }
         : binanceKrw !== null ? { value: binanceKrw, label: 'Binance' }
         : null);

  const showKrwHeadline = (naverKrw !== null) || (fxAvailable && headline !== null);
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
            {fmtKrw(headline!.value, 0)}
          </div>
          {naverMarketClosed && (
            <div className="index-compact-stale-note ts-subtitle">
              KRX 휴장 (마지막 가격)
            </div>
          )}
          {naverKrw === null && (
            <div className="index-compact-usdt ts-subtitle">
              ≈ {fmtUsd(headline!.value / usdtKrw)} USDT
              {useFallbackChain && ` · 출처 ${headline!.label}`}
            </div>
          )}
        </>
      )}
      {showUsdHeadline && (
        <div className="index-compact-headline ts-index-headline">
          {fmtUsd(payload.hl!.price)}
        </div>
      )}

      {!hideVenues && (
        <div className="venues">
          <VenueRow source="hyperliquid" pp={payload.hl} />
          <VenueRow source="yahoo" pp={payload.yahoo} />
          <VenueRow source="binance" pp={payload.binance} />
          <VenueRow source="bybit" pp={payload.bybit} />
          <VenueRow source="bitget" pp={payload.bitget} />
          <VenueRow source="naver" pp={payload.naver} />
        </div>
      )}

      {ticker === 'sp500' && hlKrw !== null && binanceKrw !== null && (
        <div className="krw-conversions num" title="Both venues normalized to KRW via Upbit USDT-KRW + server reference ratio 10x for SPY">
          HL: {fmtKrw(hlKrw, 0)} | Binance×10: {fmtKrw(binanceKrw, 0)}
        </div>
      )}
      {ticker !== 'sp500' && ticker !== 'nq' && hlKrw !== null && binanceKrw !== null && (
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
