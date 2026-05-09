import type { PricesResponse } from '@shared/types/prices.js';

const SOURCE_LABELS: Record<string, string> = {
  hyperliquid: 'Hyperliquid',
  naver:       'Naver',
  yahoo:       'Yahoo',
  binance:     'Binance',
  upbit:       'Upbit',
};

type Props = { sourceHealth?: PricesResponse['sourceHealth'] };

export function DegradedBanner({ sourceHealth }: Props) {
  if (!sourceHealth) return null;

  const degraded = Object.entries(sourceHealth).filter(
    ([, h]) => h.consecutiveFailures > 3,
  );
  if (degraded.length === 0) return null;

  const formatted = degraded
    .map(([src, h]) => `${SOURCE_LABELS[src] ?? src} (${h.consecutiveFailures} failures)`)
    .join(', ');

  return (
    <div className="degraded-banner" role="alert">
      <span className="degraded-icon" aria-hidden>⚠</span>
      <span className="degraded-text">Sources degraded: {formatted}</span>
    </div>
  );
}
