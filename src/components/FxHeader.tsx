import type { FxRates } from '@shared/types/prices.js';
import { fmtKrw, fmtPct } from '../lib/format';

type Props = { fx?: FxRates };

export function FxHeader({ fx }: Props) {
  if (!fx) {
    return (
      <div className="fx-pills">
        <span className="fx-pill muted">FX loading...</span>
      </div>
    );
  }

  const officialFmt = fx.officialUsdKrw > 0 ? fmtKrw(fx.officialUsdKrw, 2) : '—';
  const usdtFmt = fx.usdtKrw > 0 ? fmtKrw(fx.usdtKrw, 2) : '—';
  const kimchiClass = Math.abs(fx.divergencePct) >= 5 ? 'fx-pill-warn' : 'fx-pill';

  return (
    <div className="fx-pills">
      <div className="fx-pill" title="Yahoo KRW=X (or xyz:KRW fallback)">
        <span className="fx-label">USD/KRW</span>
        <span className="fx-value">{officialFmt}</span>
      </div>
      <div className="fx-pill" title="Upbit KRW-USDT (Korean USDT premium)">
        <span className="fx-label">USDT/KRW</span>
        <span className="fx-value">{usdtFmt}</span>
      </div>
      <div className={kimchiClass} title="(usdtKrw - officialUsdKrw) / officialUsdKrw">
        <span className="fx-label">Kimchi</span>
        <span className="fx-value">{fmtPct(fx.divergencePct)}</span>
      </div>
    </div>
  );
}
