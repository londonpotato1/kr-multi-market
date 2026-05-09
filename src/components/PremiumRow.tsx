import type { Premium } from '@shared/types/prices.js';
import { fmtPct } from '../lib/format';

type Props = { premium?: Premium };

export function PremiumRow({ premium }: Props) {
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
    </div>
  );
}
