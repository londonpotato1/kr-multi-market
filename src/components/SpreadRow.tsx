import type { TickerPayload } from '@shared/types/prices.js';
import { fmtPct } from '../lib/format';
import { InfoTip } from './InfoTip';

type Props = { spread?: TickerPayload['spread']; warningNote?: string };

export function SpreadRow({ spread, warningNote }: Props) {
  if (!spread) return null;
  const isLarge = Math.abs(spread.maxPctDiff) > 5;
  return (
    <div className={`spread-row ${isLarge ? 'spread-warn' : ''}`}>
      <span className="spread-label">
        거래소 간 격차 최대
        <InfoTip
          term="거래소 간 격차"
          description="여러 거래소(HL/Binance/Yahoo) 가격 차이. 큰 격차는 차익 기회 또는 데이터 이상."
        />
      </span>
      <span className="spread-value">{fmtPct(spread.maxPctDiff)}</span>
      <span className="spread-pair">
        ({spread.betweenSources[0]} ↔ {spread.betweenSources[1]})
      </span>
      {warningNote && <span className="spread-note">⚠ {warningNote}</span>}
    </div>
  );
}
