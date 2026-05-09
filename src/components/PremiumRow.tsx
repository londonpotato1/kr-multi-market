import type { Premium, SourceStatus } from '@shared/types/prices.js';
import { fmtPct } from '../lib/format';
import { SignalBadge } from './SignalBadge';

type Props = { ticker: string; premium?: Premium; krxStatus?: SourceStatus };

export function PremiumRow({ ticker, premium, krxStatus }: Props) {
  if (!premium) return null;

  if (premium.guard === 'blocked') {
    return (
      <div className="premium-row premium-blocked">
        <span className="premium-label">Premium</span>
        <span className="premium-warn-chip" title="GDR ratio drift detected">
          ⚠ 스키마 변경 의심
        </span>
      </div>
    );
  }

  if (premium.pctUsd === null) {
    return (
      <div className="premium-row premium-pending">
        <span className="premium-label">Premium</span>
        <span className="muted">—</span>
      </div>
    );
  }

  const sign = premium.pctUsd >= 0 ? 'up' : 'down';
  const guardChip = premium.guard === 'warn'
    ? <span className="premium-warn-chip" title="GDR ratio in [0.85,1.15]">⚠ warn</span>
    : null;
  const krxClosed = krxStatus === 'stale';

  return (
    <div className="premium-row">
      <span className="premium-label">Premium (vs KRX)</span>
      <span className={`premium-value premium-${sign}`}>
        {fmtPct(premium.pctUsd)}
      </span>
      {premium.pctUsdt !== null && (
        <span className="premium-usdt" title="Using Upbit USDT-KRW">
          (USDT: {fmtPct(premium.pctUsdt)})
        </span>
      )}
      {guardChip}
      {krxClosed ? (
        <span
          className="signal-stale"
          title="KRX market closed — premium reflects stale reference price, not a tradeable signal"
        >
          KRX CLOSED
        </span>
      ) : (
        <SignalBadge ticker={ticker} currentPct={premium.pctUsd} />
      )}
    </div>
  );
}
