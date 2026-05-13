import type {
  PricesResponse,
  PricePoint,
  TickerPayload,
  FxRates,
  SourceName,
  Result,
  Premium,
  Spread,
} from '@shared/types/prices.js';
import { buildFxRates, computePremiumWithSkew } from './normalize.js';
import { getSessionState } from './session.js';
import { recordSourceAttempt, getSourceHealth } from './health.js';
import { resolvePrevClose } from './prev-close-cache.js';
import { log } from './logger.js';

const SCHEMA_VERSION = 1;

// Map xyz_SYMBOL -> ticker key in response
const HL_SYMBOL_TO_TICKER: Record<string, string> = {
  xyz_SMSN: 'samsung',
  xyz_SKHX: 'skhynix',
  xyz_HYUNDAI: 'hyundai',
  xyz_KR200: 'kospi200f',
  xyz_EWY: 'ewy',
  xyz_SP500: 'sp500',
  xyz_KRW: 'usdkrw',
};

// Map Naver KRX symbol -> ticker key
const NAVER_SYMBOL_TO_TICKER: Record<string, string> = {
  '005930': 'samsung',
  '000660': 'skhynix',
  '005380': 'hyundai',
};

// Map Yahoo symbol -> ticker key. KRW=X is intentionally excluded here:
// it feeds FxRates via the existing FX path, not ticker venues.
// ES=F and ^GSPC both represent S&P 500; first-in-wins keeps ES=F primary
// when fetchYahoo requests futures before the cash index.
// v0.4.2: NQ 는 QQQ ETF only (NQ=F + ^NDX 제거 — §2.7 unit 정규화).
// 지수 pt 단위는 USDT-perp 와 scale 불일치 → 모든 source USD QQQ 통일.
const YAHOO_SYMBOL_TO_TICKER: Record<string, string> = {
  EWY: 'ewy',
  QQQ: 'nq',
  'ES=F': 'sp500',
  '^GSPC': 'sp500',
};

// Map Binance Futures symbol -> ticker key
const BINANCE_SYMBOL_TO_TICKER: Record<string, string> = {
  EWYUSDT: 'ewy',
  SPYUSDT: 'sp500',
  QQQUSDT: 'nq',
};

// Map Bybit Linear symbol -> ticker key (v0.4.2 — NQ redundancy via QQQ-USDT perp)
const BYBIT_SYMBOL_TO_TICKER: Record<string, string> = {
  QQQUSDT: 'nq',
};

// Map Bitget USDT-M symbol -> ticker key (v0.4.2 — NQ redundancy via QQQ-USDT perp)
const BITGET_SYMBOL_TO_TICKER: Record<string, string> = {
  QQQUSDT: 'nq',
};

// Polygon/TwelveData: QQQ ETF only — index symbol 제외 (unit 일관성, §2.7)
const POLYGON_SYMBOL_TO_TICKER: Record<string, string> = {
  QQQ: 'nq',
};

const TWELVEDATA_SYMBOL_TO_TICKER: Record<string, string> = {
  QQQ: 'nq',
};

// NQ has no Hyperliquid xyz equivalent in the current matrix, so its spread
// is Yahoo + Binance only when Yahoo is available.
const MULTI_VENUE_TICKERS = ['ewy', 'sp500', 'nq'] as const;
const SP500_RATIO_RANGE: [number, number] = [8, 12];
const SP500_REFERENCE_RATIO = 10.0;

export type SourceInputs = {
  hl: Result<PricePoint[]>;
  naver: Result<PricePoint[]>;
  yahoo: Result<PricePoint[]>;
  upbit: Result<PricePoint[]>;
  binance: Result<PricePoint[]>;
  bybit: Result<PricePoint[]>;
  bitget: Result<PricePoint[]>;
  polygon: Result<PricePoint[]>;
  twelvedata: Result<PricePoint[]>;
};

export function computeSpread(payload: TickerPayload, tickerKey: string): Spread | undefined {
  if (tickerKey === 'sp500') {
    if (!payload.hl || !payload.binance) return undefined;

    const hlPrice = payload.hl.price;
    const binancePrice = payload.binance.price;
    if (!Number.isFinite(hlPrice) || !Number.isFinite(binancePrice) || hlPrice <= 0 || binancePrice <= 0) {
      return undefined;
    }

    const inferredRatio = hlPrice / binancePrice;
    if (!Number.isFinite(inferredRatio)) return undefined;

    const [lo, hi] = SP500_RATIO_RANGE;
    if (inferredRatio < lo || inferredRatio > hi) {
      log.warn(`[sp500] inferred ratio ${inferredRatio.toFixed(2)} outside [${lo},${hi}]; suppressing spread (likely SPY split or schema drift)`);
      return undefined;
    }

    // HL xyz_SP500 is index points while Binance SPYUSDT is the SPY ETF.
    // Use the fixed design ratio (10.0) for comparison so ETF drift stays visible.
    const normalizedBinance = binancePrice * SP500_REFERENCE_RATIO;
    const denominator = Math.min(hlPrice, normalizedBinance);
    if (!Number.isFinite(normalizedBinance) || !Number.isFinite(denominator) || denominator <= 0) {
      return undefined;
    }

    const diffPct = Math.abs(hlPrice - normalizedBinance) / denominator * 100;
    if (!Number.isFinite(diffPct)) return undefined;

    return {
      maxPctDiff: diffPct,
      betweenSources: ['hyperliquid', 'binance'],
      normalized: true,
      impliedRatio: inferredRatio,
      ratioRange: SP500_RATIO_RANGE,
    };
  }

  const venues: Array<[SourceName, number]> = [];
  if (payload.hl && Number.isFinite(payload.hl.price) && payload.hl.price > 0) venues.push(['hyperliquid', payload.hl.price]);
  if (payload.yahoo && Number.isFinite(payload.yahoo.price) && payload.yahoo.price > 0) venues.push(['yahoo', payload.yahoo.price]);
  if (payload.binance && Number.isFinite(payload.binance.price) && payload.binance.price > 0) venues.push(['binance', payload.binance.price]);
  if (venues.length < 2) return undefined;

  let maxDiff = 0;
  let pair: [SourceName, SourceName] = [venues[0][0], venues[1][0]];
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const [, a] = venues[i];
      const [, b] = venues[j];
      const denominator = Math.min(a, b);
      if (!Number.isFinite(denominator) || denominator <= 0) continue;
      const diffPct = Math.abs(a - b) / denominator * 100;
      if (!Number.isFinite(diffPct)) continue;
      if (diffPct > maxDiff) {
        maxDiff = diffPct;
        pair = [venues[i][0], venues[j][0]];
      }
    }
  }
  return { maxPctDiff: maxDiff, betweenSources: pair };
}

function applyMarketCloseOverride(
  pp: PricePoint | undefined,
  marketOpen: boolean,
): PricePoint | undefined {
  if (!pp) return undefined;
  if (marketOpen) return pp;
  if (pp.status === 'ok') {
    return { ...pp, status: 'stale', staleReason: 'market_closed' };
  }
  return pp;
}

export function assemblePricesResponse(
  sources: SourceInputs,
  watchlist: ReadonlyArray<{ key: string; source: SourceName; symbol: string }> = [],
): PricesResponse {
  const ts = Date.now();
  const session = getSessionState(new Date());
  const tickers: Record<string, TickerPayload> = {};

  recordSourceAttempt('hyperliquid', sources.hl, ts);
  recordSourceAttempt('naver', sources.naver, ts);
  recordSourceAttempt('yahoo', sources.yahoo, ts);
  recordSourceAttempt('binance', sources.binance, ts);
  recordSourceAttempt('upbit', sources.upbit, ts);
  recordSourceAttempt('bybit', sources.bybit, ts);
  recordSourceAttempt('bitget', sources.bitget, ts);
  recordSourceAttempt('polygon', sources.polygon, ts);
  recordSourceAttempt('twelvedata', sources.twelvedata, ts);

  if (sources.hl.ok) {
    for (const pp of sources.hl.data) {
      const tickerKey = HL_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { hl: pp };
    }
  }

  if (sources.naver.ok) {
    for (const pp of sources.naver.data) {
      const tickerKey = NAVER_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { ...(tickers[tickerKey] ?? {}), naver: pp };
    }
  }

  if (sources.yahoo.ok) {
    for (const pp of sources.yahoo.data) {
      if (pp.symbol === 'KRW=X') continue;
      const tickerKey = YAHOO_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      const current = tickers[tickerKey] ?? {};
      if (current.yahoo) continue;
      tickers[tickerKey] = { ...current, yahoo: pp };
    }
  }

  const krxOpen = session.krx || session.krxAfter;
  for (const tickerKey of ['samsung', 'skhynix', 'hyundai']) {
    const t = tickers[tickerKey];
    if (t?.naver) {
      const naver = applyMarketCloseOverride(t.naver, krxOpen);
      if (naver) {
        // v0.4.0: previousClose 폴백 체인 — naver 직접 → 24h cache
        // (Yahoo Korean stock fetch 추가 시 resolvePrevClose 3번째 인자에 yahoo PricePoint.previousClose 전달)
        const resolved = resolvePrevClose(tickerKey, naver.previousClose);
        const merged: PricePoint = resolved
          ? { ...naver, previousClose: resolved.value, previousCloseSource: resolved.source }
          : naver;
        tickers[tickerKey] = { ...t, naver: merged };
      }
    }
  }

  const yahooMarketOpen: Record<string, boolean> = {
    ewy: session.nyseRegular || session.nysePrePost,
    sp500: session.cme || session.nyseRegular,
    nq: session.nyseRegular,  // QQQ ETF 는 NYSE 시간 (이전 NQ=F 는 cme 였음)
  };
  for (const [tickerKey, isOpen] of Object.entries(yahooMarketOpen)) {
    const t = tickers[tickerKey];
    if (t?.yahoo) {
      tickers[tickerKey] = { ...t, yahoo: applyMarketCloseOverride(t.yahoo, isOpen) };
    }
  }

  if (sources.binance.ok) {
    for (const pp of sources.binance.data) {
      const tickerKey = BINANCE_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { ...(tickers[tickerKey] ?? {}), binance: pp };
    }
  }

  if (sources.bybit.ok) {
    for (const pp of sources.bybit.data) {
      const tickerKey = BYBIT_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { ...(tickers[tickerKey] ?? {}), bybit: pp };
    }
  }

  if (sources.bitget.ok) {
    for (const pp of sources.bitget.data) {
      const tickerKey = BITGET_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { ...(tickers[tickerKey] ?? {}), bitget: pp };
    }
  }

  if (sources.polygon.ok) {
    for (const pp of sources.polygon.data) {
      const tickerKey = POLYGON_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { ...(tickers[tickerKey] ?? {}), polygon: pp };
    }
  }

  if (sources.twelvedata.ok) {
    for (const pp of sources.twelvedata.data) {
      const tickerKey = TWELVEDATA_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { ...(tickers[tickerKey] ?? {}), twelvedata: pp };
    }
  }

  // === v0.5.0: 동적 watchlist mapping ===
  // 정적 ticker 매핑이 모두 끝난 뒤 watchlist entry 별로 tickers[key] 추가.
  // 정적 ticker key 와 충돌 시 skip (client add 시 거부했어야 함, 방어).
  for (const entry of watchlist) {
    const sourceKey = entry.source === 'hyperliquid' ? 'hl' : entry.source;
    const sourceData = sources[sourceKey as keyof SourceInputs];
    if (!sourceData?.ok) continue;
    const pp = sourceData.data.find(p => p.symbol === entry.symbol);
    if (!pp) continue;
    if (tickers[entry.key]) continue;
    tickers[entry.key] = { [sourceKey]: pp } as TickerPayload;
  }

  const yahooKrwX = sources.yahoo.ok
    ? sources.yahoo.data.find(p => p.symbol === 'KRW=X')
    : undefined;

  const upbitKrwUsdt = sources.upbit.ok
    ? sources.upbit.data.find(p => p.symbol === 'KRW-USDT')
    : undefined;

  const hlKrw = sources.hl.ok
    ? sources.hl.data.find(p => p.symbol === 'xyz_KRW')
    : undefined;

  const fx: FxRates = buildFxRates(hlKrw, yahooKrwX, upbitKrwUsdt);

  for (const tickerKey of ['samsung', 'skhynix', 'hyundai']) {
    const t = tickers[tickerKey];
    if (!t || !t.hl) continue;
    const premium: Premium = computePremiumWithSkew(t.hl, t.naver, fx);
    tickers[tickerKey] = { ...t, premium };
  }

  for (const tickerKey of MULTI_VENUE_TICKERS) {
    const t = tickers[tickerKey];
    if (!t) continue;
    const spread = computeSpread(t, tickerKey);
    if (!spread) continue;
    tickers[tickerKey] = { ...t, spread };
  }

  return {
    ts,
    schemaVersion: SCHEMA_VERSION,
    fx,
    session,
    tickers,
    sourceHealth: getSourceHealth(),
  };
}
