type Tier = 'cool' | 'warm' | 'hot' | 'na';

type Props = {
  pctUsd: number | null;
  tier: Tier;
};

const MIN = -5;
const MAX = 5;

export function PremiumGauge({ pctUsd, tier }: Props) {
  const isNull = pctUsd === null;
  const isOver = !isNull && (pctUsd > MAX || pctUsd < MIN);
  const clamped = isNull ? 0 : Math.max(MIN, Math.min(MAX, pctUsd));
  const posPct = ((clamped - MIN) / (MAX - MIN)) * 100;
  const fillFrom = Math.min(50, posPct);
  const fillTo = Math.max(50, posPct);

  const ariaProps: Record<string, string | number | boolean> = {
    role: 'meter',
    'aria-valuemin': MIN,
    'aria-valuemax': MAX,
  };
  if (isNull) {
    ariaProps['aria-disabled'] = true;
    ariaProps['aria-label'] = 'premium unavailable';
  } else {
    ariaProps['aria-valuenow'] = pctUsd;
    ariaProps['aria-label'] = `premium ${pctUsd.toFixed(2)} percent`;
  }

  return (
    <div className={`premium-gauge tier-${tier}${isNull ? ' is-null' : ''}`} {...ariaProps}>
      <div className="premium-gauge-track" />
      {!isNull && (
        <div
          className="premium-gauge-fill"
          style={{ left: `${fillFrom}%`, width: `${fillTo - fillFrom}%` }}
        />
      )}
      <div className="premium-gauge-zero" />
      {!isNull && (
        <div className="premium-gauge-dot" style={{ left: `${posPct}%` }} />
      )}
      <div className="premium-gauge-scale">
        <span>-5%</span><span>0%</span><span>+5%</span>
      </div>
      {isOver && <span className="premium-gauge-over">OVER</span>}
    </div>
  );
}
