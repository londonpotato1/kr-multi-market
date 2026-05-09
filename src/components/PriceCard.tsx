import { useEffect, useRef, useState } from 'react';
import type { TickerPayload } from '@shared/types/prices.js';
import { fmtUsd, fmtPct, fmtCompactUsd, fmtFunding, fmtKrw } from '../lib/format';
import { PremiumRow } from './PremiumRow';

type Props = {
  label: string;
  ticker: string;
  payload?: TickerPayload;
};

export function PriceCard({ label, ticker, payload }: Props) {
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
  }, [hl?.price, hl]);

  if (!hl) {
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

  const change = hl.change24hPct ?? 0;
  const changeClass = change > 0 ? 'change-up' : change < 0 ? 'change-down' : 'change-flat';

  return (
    <article className="card">
      <header className="card-head">
        <h3>{label}</h3>
        <span className="ticker-id">{hl.symbol}</span>
      </header>
      <div className={`price ${flashClass}`}>
        {fmtUsd(hl.price)}
      </div>
      <div className={`change ${changeClass}`}>{fmtPct(change)}</div>
      <dl className="meta-grid">
        <div><dt>24h Vol</dt><dd>{fmtCompactUsd(hl.volume24hUsd ?? 0)}</dd></div>
        <div><dt>Funding 8h</dt><dd>{hl.fundingRate8h !== undefined ? fmtFunding(hl.fundingRate8h) : '—'}</dd></div>
        <div><dt>OI</dt><dd>{fmtCompactUsd(hl.openInterestUsd ?? 0)}</dd></div>
        <div><dt>Status</dt><dd className="status-ok">{hl.status}</dd></div>
      </dl>
      {payload?.naver && (
        <div className={`krx-row${payload.naver.status === 'stale' ? ' venue-stale' : ''}`}>
          <span className="krx-label">KRX</span>
          <span className="krx-value">{fmtKrw(payload.naver.price, 0)}</span>
          <span className={`krx-status status-${payload.naver.status}`}>
            {payload.naver.status === 'ok' ? '● live' : '○ ' + (payload.naver.staleReason ?? payload.naver.status)}
          </span>
        </div>
      )}
      {payload?.premium && <PremiumRow ticker={ticker} premium={payload.premium} />}
    </article>
  );
}
