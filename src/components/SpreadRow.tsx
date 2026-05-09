import type { TickerPayload } from '@shared/types/prices.js';
import { fmtPct } from '../lib/format';

type Props = { spread?: TickerPayload['spread']; warningNote?: string };

export function SpreadRow({ spread, warningNote }: Props) {
  if (!spread) return null;
  const isLarge = Math.abs(spread.maxPctDiff) > 5;
  return (
    <div className={`spread-row ${isLarge ? 'spread-warn' : ''}`}>
      <span className="spread-label">Max venue spread</span>
      <span className="spread-value">{fmtPct(spread.maxPctDiff)}</span>
      <span className="spread-pair">
        ({spread.betweenSources[0]} ↔ {spread.betweenSources[1]})
      </span>
      {warningNote && <span className="spread-note">⚠ {warningNote}</span>}
    </div>
  );
}
