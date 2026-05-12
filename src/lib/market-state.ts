import type { SessionState, PricePoint, FxRates } from '@shared/types/prices.js';
import { CONTEXT_LABEL } from './labels';

export type Primary = {
  value: number;
  unit: 'KRW' | 'USD';
  source: 'krx' | 'hl';
  isStale?: boolean;
};

export type StateBadge = 'open' | 'night' | 'holiday';

export function pickPrimary(args: {
  session: SessionState;
  hl?: PricePoint;
  krx?: PricePoint;
  fx?: FxRates;
}): {
  primary: Primary | null;
  secondary: Primary | null;
  contextLabel: string;
} {
  const { session, hl, krx, fx } = args;
  const usdtKrw = fx?.usdtKrw ?? 0;
  const fxOk = usdtKrw > 0;
  const hlKrw: Primary | null = (hl && fxOk)
    ? { value: hl.price * usdtKrw, unit: 'KRW', source: 'hl' }
    : null;
  const krxP: Primary | null = krx
    ? { value: krx.price, unit: 'KRW', source: 'krx', isStale: krx.status === 'stale' }
    : null;

  // C6: both missing
  if (!hl && !krx) return { primary: null, secondary: null, contextLabel: '데이터 없음' };

  // C5: HL missing, KRX present
  if (!hl && krx) {
    return { primary: krxP, secondary: null, contextLabel: CONTEXT_LABEL.HL_DOWN };
  }

  // C2: krx stale mid-session AND HL available → use HL
  if (session.krx && krx?.status === 'stale' && hl) {
    if (hlKrw) {
      return { primary: hlKrw, secondary: krxP, contextLabel: CONTEXT_LABEL.KRX_STALE };
    }
    // fx not ok → fall through to USD native below
  }

  // C1: open + krx ok → primary=KRX
  if (session.krx && krx?.status === 'ok') {
    return { primary: krxP, secondary: hlKrw, contextLabel: CONTEXT_LABEL.PRIMARY_LIVE };
  }

  // C3 / C4: closed → HL
  if (hl) {
    if (fxOk && hlKrw) {
      return { primary: hlKrw, secondary: krxP, contextLabel: CONTEXT_LABEL.PRIMARY_NIGHT };
    }
    // C4: fx 0 → USD native
    return {
      primary: { value: hl.price, unit: 'USD', source: 'hl' },
      secondary: krxP,
      contextLabel: CONTEXT_LABEL.FX_DOWN,
    };
  }

  return { primary: null, secondary: null, contextLabel: '데이터 없음' };
}

export function pctVsClose(primaryKrw: number | null, previousClose: number | undefined): number | null {
  if (primaryKrw === null || previousClose === undefined || previousClose <= 0) return null;
  return ((primaryKrw - previousClose) / previousClose) * 100;
}

export function getStateBadge(session: SessionState): StateBadge {
  if (session.krx) return 'open';
  if (session.krxAfter || session.krxNight) return 'night';
  return 'holiday';
}
