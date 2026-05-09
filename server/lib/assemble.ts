import type {
  PricesResponse,
  PricePoint,
  TickerPayload,
  FxRates,
  SessionState,
  SourceHealth,
  SourceName,
  Result,
} from '@shared/types/prices.js';

const SCHEMA_VERSION = 1;

// Phase 1: only HL data is real. fx/session/sourceHealth are stubs filled in Phases 2-6.
const STUB_FX: FxRates = {
  officialUsdKrw: 0,
  usdtKrw: 0,
  divergencePct: 0,
};

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

export function assemblePricesResponse(hl: Result<PricePoint[]>): PricesResponse {
  const ts = Date.now();
  const tickers: Record<string, TickerPayload> = {};
  const sourceHealth: Partial<Record<SourceName, SourceHealth>> = {
    hyperliquid: {
      lastSuccess: hl.ok ? ts : 0,
      consecutiveFailures: hl.ok ? 0 : 1,
    },
  };

  if (hl.ok) {
    for (const pp of hl.data) {
      const tickerKey = HL_SYMBOL_TO_TICKER[pp.symbol];
      if (!tickerKey) continue;
      tickers[tickerKey] = { hl: pp };
    }
  }

  return {
    ts,
    schemaVersion: SCHEMA_VERSION,
    fx: STUB_FX,
    session: STUB_SESSION,
    tickers,
    sourceHealth: sourceHealth as Record<SourceName, SourceHealth>,
  };
}
