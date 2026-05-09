import type {
  PricesResponse,
  PricePoint,
  TickerPayload,
  FxRates,
  SessionState,
  SourceHealth,
  SourceName,
  Result,
  Premium,
} from '@shared/types/prices.js';
import { buildFxRates, computePremium } from './normalize.js';

const SCHEMA_VERSION = 1;

const STUB_SESSION: SessionState = {
  krx: false,
  krxAfter: false,
  krxNight: false,
  nyseRegular: false,
  nysePrePost: false,
  cme: false,
  hyperliquid: true,
  binance: true,
};

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
const YAHOO_SYMBOL_TO_TICKER: Record<string, string> = {
  EWY: 'ewy',
  'NQ=F': 'nq',
  'ES=F': 'sp500',
  '^GSPC': 'sp500',
  '^NDX': 'nq',
};

// Map Binance Futures symbol -> ticker key
const BINANCE_SYMBOL_TO_TICKER: Record<string, string> = {
  EWYUSDT: 'ewy',
  SPYUSDT: 'sp500',
  QQQUSDT: 'nq',
};

const MULTI_VENUE_TICKERS = ['ewy', 'sp500', 'nq'] as const;

export type SourceInputs = {
  hl: Result<PricePoint[]>;
  naver: Result<PricePoint[]>;
  yahoo: Result<PricePoint[]>;
  upbit: Result<PricePoint[]>;
  binance: Result<PricePoint[]>;
};

function computeSpread(payload: TickerPayload): TickerPayload['spread'] | undefined {
  const venues: Array<[SourceName, number]> = [];
  if (payload.hl?.price) venues.push(['hyperliquid', payload.hl.price]);
  if (payload.yahoo?.price) venues.push(['yahoo', payload.yahoo.price]);
  if (payload.binance?.price) venues.push(['binance', payload.binance.price]);
  if (venues.length < 2) return undefined;

  let maxDiff = 0;
  let pair: [SourceName, SourceName] = [venues[0][0], venues[0][0]];
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const [, a] = venues[i];
      const [, b] = venues[j];
      const diffPct = Math.abs(a - b) / Math.min(a, b) * 100;
      if (diffPct > maxDiff) {
        maxDiff = diffPct;
        pair = [venues[i][0], venues[j][0]];
      }
    }
  }
  return { maxPctDiff: maxDiff, betweenSources: pair };
}

export function assemblePricesResponse(sources: SourceInputs): PricesResponse {
  const ts = Date.now();
  const tickers: Record<string, TickerPayload> = {};

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

  if (sources.binance.ok) {
    for (const pp of sources.binance.data) {
      const tickerKey = BINANCE_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { ...(tickers[tickerKey] ?? {}), binance: pp };
    }
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
    const premium: Premium = computePremium(t.hl.price, t.naver?.price, fx);
    tickers[tickerKey] = { ...t, premium };
  }

  for (const tickerKey of MULTI_VENUE_TICKERS) {
    const t = tickers[tickerKey];
    if (!t) continue;
    const spread = computeSpread(t);
    if (!spread) continue;
    tickers[tickerKey] = { ...t, spread };
  }

  const sourceHealth: Partial<Record<SourceName, SourceHealth>> = {
    hyperliquid: { lastSuccess: sources.hl.ok ? ts : 0, consecutiveFailures: sources.hl.ok ? 0 : 1 },
    naver: { lastSuccess: sources.naver.ok ? ts : 0, consecutiveFailures: sources.naver.ok ? 0 : 1 },
    yahoo: { lastSuccess: sources.yahoo.ok ? ts : 0, consecutiveFailures: sources.yahoo.ok ? 0 : 1 },
    upbit: { lastSuccess: sources.upbit.ok ? ts : 0, consecutiveFailures: sources.upbit.ok ? 0 : 1 },
    binance: { lastSuccess: sources.binance.ok ? ts : 0, consecutiveFailures: sources.binance.ok ? 0 : 1 },
  };

  return {
    ts,
    schemaVersion: SCHEMA_VERSION,
    fx,
    session: STUB_SESSION,
    tickers,
    sourceHealth: sourceHealth as Record<SourceName, SourceHealth>,
  };
}
