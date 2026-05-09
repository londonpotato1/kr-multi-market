import type { SessionState } from '@shared/types/prices.js';

type Props = { session?: SessionState };

const BADGES: Array<{
  key: keyof SessionState;
  label: string;
  tooltip: string;
}> = [
  { key: 'krx',         label: 'KRX',    tooltip: 'KRX regular: Mon-Fri 09:00-15:30 KST' },
  { key: 'krxAfter',    label: 'KRX-A',  tooltip: 'KRX after-hours single price (15:40-16:00 / 16:00-18:00 KST)' },
  { key: 'krxNight',    label: 'KRX-N',  tooltip: 'KRX night futures (18:00-05:00+1 KST)' },
  { key: 'nyseRegular', label: 'NYSE',   tooltip: 'NYSE regular 09:30-16:00 ET (DST aware)' },
  { key: 'nysePrePost', label: 'NYSE-X', tooltip: 'NYSE pre-market (04:00-09:30) + after-hours (16:00-20:00) ET' },
  { key: 'cme',         label: 'CME',    tooltip: 'CME equity futures: Sun 18:00 ET → Fri 17:00 ET, daily 17:00-18:00 ET break' },
];

export function SessionBadges({ session }: Props) {
  if (!session) return null;
  return (
    <div className="session-badges">
      {BADGES.map(({ key, label, tooltip }) => {
        const live = !!session[key];
        return (
          <span
            key={key}
            className={`session-badge ${live ? 'session-live' : 'session-closed'}`}
            title={tooltip}
          >
            <span className="session-dot" aria-hidden />
            <span className="session-label">{label}</span>
          </span>
        );
      })}
      <span
        className="session-badge session-247"
        title="Hyperliquid + Binance: 24/7 (always live)"
      >
        <span className="session-dot session-dot-247" aria-hidden />
        <span className="session-label">HL/BN 24/7</span>
      </span>
    </div>
  );
}
