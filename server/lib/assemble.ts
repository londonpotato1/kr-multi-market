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

export type SourceInputs = {
  hl: Result<PricePoint[]>;
  naver: Result<PricePoint[]>;
  yahoo: Result<PricePoint[]>;
  upbit: Result<PricePoint[]>;
};

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

  const sourceHealth: Partial<Record<SourceName, SourceHealth>> = {
    hyperliquid: { lastSuccess: sources.hl.ok ? ts : 0, consecutiveFailures: sources.hl.ok ? 0 : 1 },
    naver: { lastSuccess: sources.naver.ok ? ts : 0, consecutiveFailures: sources.naver.ok ? 0 : 1 },
    yahoo: { lastSuccess: sources.yahoo.ok ? ts : 0, consecutiveFailures: sources.yahoo.ok ? 0 : 1 },
    upbit: { lastSuccess: sources.upbit.ok ? ts : 0, consecutiveFailures: sources.upbit.ok ? 0 : 1 },
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
