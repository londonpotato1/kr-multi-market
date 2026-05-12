import { calcZScore, sampleCount, SIGNAL_CONSTANTS } from '../lib/signal';
import { SIGNAL_TIER_LABEL } from '../lib/labels';

type Props = { ticker: string; currentPct: number };

type Tier = { label: string; className: string };

function tierFromZScore(z: number): Tier {
  const a = Math.abs(z);
  if (a < 1) return { label: SIGNAL_TIER_LABEL.normal, className: 'sig-normal' };
  if (a < 2) return { label: SIGNAL_TIER_LABEL.watch, className: 'sig-watch' };
  if (a < 3) return { label: SIGNAL_TIER_LABEL.trade, className: 'sig-trade' };
  return { label: SIGNAL_TIER_LABEL.dislocated, className: 'sig-dislocated' };
}

function tierFromAbs(pct: number): Tier {
  const a = Math.abs(pct);
  if (a < 1) return { label: SIGNAL_TIER_LABEL.normal, className: 'sig-normal' };
  if (a < 3) return { label: SIGNAL_TIER_LABEL.watch, className: 'sig-watch' };
  if (a < 5) return { label: SIGNAL_TIER_LABEL.trade, className: 'sig-trade' };
  return { label: SIGNAL_TIER_LABEL.dislocated, className: 'sig-dislocated' };
}

export function SignalBadge({ ticker, currentPct }: Props) {
  const count = sampleCount(ticker);
  const minSamples = SIGNAL_CONSTANTS.MIN_SAMPLES_FOR_ZSCORE;

  if (count < minSamples) {
    const tier = tierFromAbs(currentPct);
    return (
      <span
        className={`signal-badge ${tier.className}`}
        title={`Fallback (absolute thresholds, ${count}/${minSamples} samples)`}
      >
        {tier.label}
        <span className="signal-collecting">({count}/{minSamples})</span>
      </span>
    );
  }

  const z = calcZScore(ticker, currentPct);
  if (z === null) {
    return (
      <span className="signal-badge sig-normal" title="No z-score available">
        —
      </span>
    );
  }
  const tier = tierFromZScore(z);
  return (
    <span
      className={`signal-badge ${tier.className}`}
      title={`z-score = ${z.toFixed(2)} (${count} samples)`}
    >
      {tier.label}
      <span className="signal-z">z={z.toFixed(2)}</span>
    </span>
  );
}
