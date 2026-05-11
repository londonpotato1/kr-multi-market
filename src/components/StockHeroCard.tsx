import { useEffect, useRef, useState } from 'react';
import type { TickerPayload, FxRates } from '@shared/types/prices.js';
import { fmtKrw, fmtUsd, fmtPct } from '../lib/format';
import { PremiumGauge } from './PremiumGauge';
import { SignalBadge } from './SignalBadge';

type Props = {
  ticker: string;
  label: string;
  payload?: TickerPayload;
  fx?: FxRates;
};

function premiumTier(pct: number | null | undefined): 'cool' | 'warm' | 'hot' | 'na' {
  if (pct === null || pct === undefined) return 'na';
  const a = Math.abs(pct);
  if (a < 1) return 'cool';
  if (a < 3) return 'warm';
  return 'hot';
}

export function StockHeroCard({ ticker, label, payload, fx }: Props) {
  const hl = payload?.hl;
  const [flashClass, setFlashClass] = useState<'' | 'flash-up' | 'flash-down'>('');
  const lastPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hl) return;
    const prev = lastPriceRef.current;
    if (prev !== null && prev !== hl.price) {
      setFlashClass(hl.price > prev ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlashClass(''), 800);
      lastPriceRef.current = hl.price;
      return () => clearTimeout(t);
    }
    lastPriceRef.current = hl.price;
  }, [hl?.price]); // hl.price 변경 시에만 flash (object ref 변경 무시)

  if (!payload) {
    return (
      <article className="card stock-hero card-loading" data-testid="stock-hero-loading">
        <header className="card-head">
          <h3 className="ts-card-title">{label}</h3>
          <span className="ts-subtitle">{ticker}</span>
        </header>
        <div className="stock-hero-primary">—</div>
      </article>
    );
  }

  const usdtKrw = fx?.usdtKrw ?? 0;
  const fxAvailable = usdtKrw > 0;
  const krwFromHl = hl && fxAvailable ? hl.price * usdtKrw : null;
  const showHlAsPrimary = !!hl;

  const premium = payload.premium;
  // HL unavailable → premium gauge 강제 NA (premium 수치는 HL 가격을 기반으로 계산되므로 의미 없음)
  const premiumPct = hl ? (premium?.pctUsd ?? null) : null;
  const tier = premiumTier(premiumPct);
  const change = hl?.change24hPct;
  const changeClass = change == null
    ? ''
    : change > 0 ? 'change-up' : change < 0 ? 'change-down' : 'change-flat';

  const krx = payload.naver;
  const krxClosed = krx?.status === 'stale';

  return (
    <article className="card stock-hero">
      <header className="card-head">
        <h3 className="ts-card-title">{label}</h3>
        <div className="ts-subtitle">{ticker} · KRX × Hyperliquid</div>
        {hl && <span className="live-dot" title="HL live">●live</span>}
      </header>

      {/* PRIMARY: HL → KRW */}
      <div className={`stock-hero-primary ts-hero-price ${flashClass}`}>
        {!showHlAsPrimary ? (
          <>
            <span className="stock-hero-dash">—</span>
            <div className="stock-hero-primary-label ts-subtitle">HL UNAVAILABLE</div>
          </>
        ) : !fxAvailable ? (
          <>
            {fmtUsd(hl!.price)}
            <div className="stock-hero-primary-label ts-subtitle">KRW UNAVAIL — USD shown</div>
          </>
        ) : (
          <>
            {fmtKrw(krwFromHl!, 0)}
            <div className="stock-hero-primary-label ts-subtitle">HL → KRW · 24/7 발견가</div>
          </>
        )}
      </div>

      {/* SECONDARY: Premium */}
      <div className="stock-hero-secondary">
        <div className={`stock-hero-premium ts-hero-premium premium-${tier}`}>
          {premiumPct === null ? '—' : (premiumPct >= 0 ? '▲ ' : '▼ ') + fmtPct(premiumPct)}
        </div>
        <div className="stock-hero-premium-label ts-subtitle">
          PREMIUM {tier === 'hot' && '· HOT'}{tier === 'warm' && '· WARM'}{tier === 'cool' && '· COOL'}{tier === 'na' && '· N/A'}
        </div>
        <PremiumGauge pctUsd={premiumPct} tier={tier} />
      </div>

      {/* TERTIARY: KRX + 24h */}
      <dl className="stock-hero-tertiary ts-meta">
        <div>
          <dt>KRX</dt>
          <dd>
            {krx ? (
              <>
                {fmtKrw(krx.price, 0)}
                {krxClosed && <span className="closed-tag"> (closed)</span>}
              </>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt>24h</dt>
          <dd className={changeClass}>{change == null ? '—' : fmtPct(change)}</dd>
        </div>
      </dl>

      {/* FOOTER: Signal */}
      {premiumPct !== null && !krxClosed && (
        <footer className="stock-hero-footer">
          <SignalBadge ticker={ticker} currentPct={premiumPct} />
        </footer>
      )}
      {krxClosed && (
        <footer className="stock-hero-footer">
          <span className="signal-stale">KRX CLOSED</span>
        </footer>
      )}
    </article>
  );
}
