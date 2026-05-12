import { useEffect, useRef, useState } from 'react';
import type { TickerPayload, FxRates, SessionState } from '@shared/types/prices.js';
import { fmtKrw, fmtUsd, fmtPct } from '../lib/format';
import { pickPrimary, pctVsClose } from '../lib/market-state';
import { PREMIUM_TIER_LABEL } from '../lib/labels';
import { PremiumGauge } from './PremiumGauge';
import { SignalBadge } from './SignalBadge';
import { InfoTip } from './InfoTip';

type Props = {
  ticker: string;
  label: string;
  payload?: TickerPayload;
  fx?: FxRates;
  session?: SessionState;
};

function premiumTier(pct: number | null | undefined): 'cool' | 'warm' | 'hot' | 'na' {
  if (pct === null || pct === undefined) return 'na';
  const a = Math.abs(pct);
  if (a < 1) return 'cool';
  if (a < 3) return 'warm';
  return 'hot';
}

const TOOLTIP = {
  premium: {
    term: '프리미엄',
    description: '한국 주식이 HL 야간 시장보다 얼마나 비싼지 (%). 양수=KRX 비쌈, 음수=HL 비쌈.',
  },
  signal: {
    term: 'Z-스코어 신호',
    description: '최근 100개 샘플 기준 프리미엄 표준편차. ±1 정상, ±2 관찰, ±3 매매.',
  },
  hl: {
    term: 'HL',
    description: 'Hyperliquid xyz 무기한 선물 — 한국 주식 24시간 거래 탈중앙 거래소.',
  },
  krx: {
    term: 'KRX',
    description: '한국거래소 — 평일 09:00–15:30, 실제 한국 주식 거래소.',
  },
};

// session 미정 시 안전 기본값 (closed)
const SAFE_SESSION: SessionState = {
  krx: false,
  krxAfter: true,
  krxNight: false,
  nyseRegular: false,
  nysePrePost: false,
  cme: true,
  hyperliquid: true,
  binance: true,
};

export function StockHeroCard({ ticker, label, payload, fx, session }: Props) {
  const [flashClass, setFlashClass] = useState<'' | 'flash-up' | 'flash-down'>('');
  const lastPriceRef = useRef<number | null>(null);

  // hooks 위반 방지: payload 없어도 같은 순서로 계산
  const safeSession = session ?? SAFE_SESSION;
  const sel = payload
    ? pickPrimary({ session: safeSession, hl: payload.hl, krx: payload.naver, fx })
    : { primary: null, secondary: null, contextLabel: '' };
  const primaryValue = sel.primary?.value ?? null;

  useEffect(() => {
    if (primaryValue === null) return;
    const prev = lastPriceRef.current;
    if (prev !== null && prev !== primaryValue) {
      setFlashClass(primaryValue > prev ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlashClass(''), 800);
      lastPriceRef.current = primaryValue;
      return () => clearTimeout(t);
    }
    lastPriceRef.current = primaryValue;
  }, [primaryValue]);

  if (!payload) {
    return (
      <article className="card stock-hero card-loading" data-testid="stock-hero-loading">
        <header className="card-head">
          <h3 className="ts-card-title">{label}</h3>
          <span className="ts-subtitle">{ticker}</span>
        </header>
        <div className="stock-hero-primary">—</div>
      </article>
    );
  }

  const primaryUnit = sel.primary?.unit;
  const primaryDisplay = primaryValue !== null
    ? (primaryUnit === 'KRW' ? fmtKrw(primaryValue, 0) : fmtUsd(primaryValue))
    : '—';

  // USDT 환산 (spec §3.4): primary KRW → /usdtKrw, primary USD → 그대로 (USD ≈ USDT)
  const usdtKrw = fx?.usdtKrw ?? 0;
  const usdtValue = primaryValue !== null && primaryUnit === 'KRW' && usdtKrw > 0
    ? primaryValue / usdtKrw
    : primaryUnit === 'USD' ? primaryValue : null;

  // 종가 변동률 (primary KRW 인 경우만; USD fallback 시 null)
  const previousClose = payload.naver?.previousClose;
  const pctClose = pctVsClose(primaryUnit === 'KRW' ? primaryValue : null, previousClose);
  const pctCloseClass = pctClose === null
    ? '' : pctClose > 0 ? 'change-up' : pctClose < 0 ? 'change-down' : 'change-flat';
  const pctArrow = pctClose === null ? '—' : pctClose > 0 ? '▲' : pctClose < 0 ? '▼' : '—';

  // Premium tier
  const premium = payload.premium;
  const premiumPct = payload.hl ? (premium?.pctUsd ?? null) : null;
  const tier = premiumTier(premiumPct);

  const krxStale = payload.naver?.status === 'stale';
  const isStaleMidSession = safeSession.krx && krxStale;

  return (
    <article className="card stock-hero">
      <header className="card-head">
        <h3 className="ts-card-title">{label}</h3>
        <div className="ts-subtitle">
          {ticker}
          <InfoTip {...TOOLTIP.krx} />
          {' KRX × '}
          <InfoTip {...TOOLTIP.hl} />
          {' Hyperliquid'}
        </div>
        {payload.hl && <span className="live-dot" title="HL live">●live</span>}
      </header>

      {/* PRIMARY */}
      <div className={`stock-hero-primary ts-hero-price ${flashClass}`}>
        {primaryDisplay}
      </div>
      <div className="stock-hero-primary-label ts-subtitle">
        {usdtValue !== null && <>≈ {fmtUsd(usdtValue)} USDT · </>}
        {sel.contextLabel}
      </div>

      {/* 종가 변동률 */}
      <div className="stock-hero-pct-close">
        {pctClose === null ? (
          <span className="pct-close-none">
            — <span className="pct-close-label">종가 데이터 없음</span>
          </span>
        ) : (
          <>
            <span className={`pct-close-value ${pctCloseClass}`}>
              {pctArrow} {fmtPct(pctClose)}
            </span>
            <span className="pct-close-label">종가 대비</span>
          </>
        )}
      </div>

      {/* Premium gauge + tier label */}
      <div className="stock-hero-secondary">
        <PremiumGauge pctUsd={premiumPct} tier={tier} />
        <div className="stock-hero-premium-label ts-subtitle">
          프리미엄 {PREMIUM_TIER_LABEL[tier]}
          <InfoTip {...TOOLTIP.premium} />
        </div>
      </div>

      {/* 보조 가격 + 24h */}
      <dl className="stock-hero-tertiary ts-meta">
        {sel.secondary ? (
          <div>
            <dt>{sel.secondary.source === 'hl' ? 'HL' : 'KRX'}</dt>
            <dd>{fmtKrw(sel.secondary.value, 0)}</dd>
          </div>
        ) : (
          <div>
            <dt>KRX</dt>
            <dd>—</dd>
          </div>
        )}
        <div>
          <dt>24h</dt>
          <dd className={
            payload.hl?.change24hPct == null ? '' :
            payload.hl.change24hPct > 0 ? 'change-up' :
            payload.hl.change24hPct < 0 ? 'change-down' : 'change-flat'
          }>
            {payload.hl?.change24hPct == null ? '—' : fmtPct(payload.hl.change24hPct)}
          </dd>
        </div>
      </dl>

      {/* Footer — signal or stale */}
      {isStaleMidSession ? (
        <footer className="stock-hero-footer">
          <span className="signal-stale">KRX 데이터 지연</span>
        </footer>
      ) : krxStale ? (
        <footer className="stock-hero-footer">
          <span className="signal-stale">KRX 휴장</span>
        </footer>
      ) : premiumPct !== null ? (
        <footer className="stock-hero-footer">
          <SignalBadge ticker={ticker} currentPct={premiumPct} />
          <InfoTip {...TOOLTIP.signal} />
        </footer>
      ) : null}
    </article>
  );
}
