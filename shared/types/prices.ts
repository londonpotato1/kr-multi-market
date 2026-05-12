export type SourceName = 'hyperliquid' | 'naver' | 'yahoo' | 'binance' | 'upbit'
                       | 'bybit' | 'bitget' | 'polygon' | 'twelvedata';

export type SourceStatus = 'ok' | 'stale' | 'degraded' | 'down';

export type PricePoint = {
  source: SourceName;
  symbol: string;
  price: number;
  unit: 'USD' | 'KRW' | 'USDT' | 'pt';
  change24hPct?: number;
  volume24hUsd?: number;
  fundingRate8h?: number;
  openInterestUsd?: number;
  status: SourceStatus;
  asOf: number;
  receivedAt: number;
  staleReason?: string;
  schemaVersion: number;
  // === v0.4.0 신규 (KRX 전일 종가, Naver/Yahoo only) ===
  previousClose?: number;
  previousCloseSource?: 'naver' | 'yahoo' | 'cache';
};

export type Result<T> =
  | { ok: true; data: T; latencyMs: number }
  | { ok: false; error: string; latencyMs: number };

export type FxRates = {
  officialUsdKrw: number;
  usdtKrw: number;
  hlInferredKrw?: number;
  divergencePct: number;
};

export type GuardState = 'normal' | 'warn' | 'blocked';

export type GuardResult =
  | { state: 'normal' }
  | { state: 'warn'; ratio: number }
  | { state: 'blocked'; ratio: number; reason: string };

export type SessionState = {
  krx: boolean;
  krxAfter: boolean;
  krxNight: boolean;
  nyseRegular: boolean;
  nysePrePost: boolean;
  cme: boolean;
  hyperliquid: true;
  binance: true;
  // === v0.4.0 신규 — KRX 카운트다운 ===
  krxMinsUntilOpen?: number;   // 마감 또는 휴장 시 set
  krxMinsUntilClose?: number;  // 장중에 set
};

export type Premium = {
  pctUsd: number | null;
  pctUsdt: number | null;
  guard: GuardState;
};

export type Spread = {
  maxPctDiff: number;
  betweenSources: [SourceName, SourceName];
  normalized?: boolean;
  impliedRatio?: number;
  ratioRange?: [number, number];
};

export type TickerPayload = {
  hl?: PricePoint;
  naver?: PricePoint;
  yahoo?: PricePoint;
  binance?: PricePoint;
  upbit?: PricePoint;
  // === v0.4.2 신규 ===
  bybit?: PricePoint;
  bitget?: PricePoint;
  polygon?: PricePoint;
  twelvedata?: PricePoint;
  premium?: Premium;
  spread?: Spread;
};

export type SourceHealth = {
  lastSuccess: number;
  consecutiveFailures: number;
};

export type PricesResponse = {
  ts: number;
  schemaVersion: number;
  fx: FxRates;
  session: SessionState;
  tickers: Record<string, TickerPayload>;
  sourceHealth: Record<SourceName, SourceHealth>;
};

export type HealthzResponse = {
  ok: boolean;
  version: string;
};

export type InternalHealthResponse = {
  ok: boolean;
  sources: Record<SourceName, { status: SourceStatus; lastSuccessAgoMs: number }>;
};
