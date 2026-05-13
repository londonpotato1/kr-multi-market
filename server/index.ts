import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { log } from './lib/logger.js';
import { singleFlight } from './lib/cache.js';
import { SOURCE_TTL_MS, naverTtl } from './lib/source-cache.js';
import { fetchHyperliquid } from './lib/sources/hyperliquid.js';
import { fetchNaver, NAVER_SYMBOLS } from './lib/sources/naver.js';
import { fetchYahoo } from './lib/sources/yahoo.js';
import { fetchUpbit } from './lib/sources/upbit.js';
import { fetchBinanceFutures, BINANCE_SYMBOLS } from './lib/sources/binance.js';
import { fetchBybitLinear, BYBIT_SYMBOLS } from './lib/sources/bybit.js';
import { fetchBitgetFutures, BITGET_SYMBOLS } from './lib/sources/bitget.js';
import { fetchPolygon } from './lib/sources/polygon.js';
import { fetchTwelveData } from './lib/sources/twelvedata.js';
import { startHyperliquidWs, getLatestMids } from './lib/sources/hyperliquid-ws.js';
import { assemblePricesResponse } from './lib/assemble.js';
import { APP_VERSION } from './lib/healthz.js';
import { getSourceHealth } from './lib/health.js';
import { searchHandler } from './routes/search.js';
import type {
  HealthzResponse,
  InternalHealthResponse,
  SourceHealth,
  SourceName,
} from '@shared/types/prices.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';
const HL_USE_WS = process.env.HL_USE_WS === 'true';
const HEALTH_TOKEN = process.env.HEALTH_TOKEN;

if (HL_USE_WS) {
  log.info('[hl] WS mode enabled (HL_USE_WS=true)');
  startHyperliquidWs();
} else {
  log.info('[hl] REST polling mode (HL_USE_WS=false)');
}

app.use(
  cors({
    origin: isProd ? false : true,
    credentials: false,
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    log.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// === v0.5.0: watchlist 쿼리 파싱 ===
const KEY_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const SYMBOL_REGEX = /^[A-Za-z0-9_]+$/;
const VALID_SOURCES = new Set<SourceName>([
  'hyperliquid', 'naver', 'yahoo', 'binance', 'upbit',
  'bybit', 'bitget', 'polygon', 'twelvedata',
]);
const MAX_WATCHLIST_ENTRIES = 50;

export function parseWatchlist(
  query: string | undefined,
): Array<{ key: string; source: SourceName; symbol: string }> {
  if (!query) return [];
  const entries: Array<{ key: string; source: SourceName; symbol: string }> = [];
  for (const part of query.split(',')) {
    if (entries.length >= MAX_WATCHLIST_ENTRIES) break;
    const [key, source, symbol] = part.split(':');
    if (!key || !source || !symbol) continue;
    if (key.length > 32 || !KEY_REGEX.test(key)) continue;
    if (symbol.length > 32 || !SYMBOL_REGEX.test(symbol)) continue;
    if (!VALID_SOURCES.has(source as SourceName)) continue;
    entries.push({ key, source: source as SourceName, symbol });
  }
  return entries;
}

export async function healthzHandler(_req: Request, res: Response): Promise<void> {
  const response: HealthzResponse = { ok: true, version: APP_VERSION };
  res.json(response);
}

export async function internalHealthHandler(req: Request, res: Response): Promise<void> {
  const auth = req.headers.authorization;
  if (!HEALTH_TOKEN) {
    res.status(503).json({ ok: false, error: 'HEALTH_TOKEN not configured' });
    return;
  }
  if (auth !== `Bearer ${HEALTH_TOKEN}`) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  const health = getSourceHealth();
  const now = Date.now();
  const sources = {} as InternalHealthResponse['sources'];

  for (const [src, h] of Object.entries(health) as Array<[SourceName, SourceHealth]>) {
    const ageMs = h.lastSuccess > 0 ? now - h.lastSuccess : Number.POSITIVE_INFINITY;
    let status: InternalHealthResponse['sources'][SourceName]['status'];
    if (h.consecutiveFailures === 0 && ageMs < 30_000) status = 'ok';
    else if (h.consecutiveFailures < 3) status = 'degraded';
    else status = 'down';
    sources[src] = { status, lastSuccessAgoMs: h.lastSuccess > 0 ? ageMs : -1 };
  }

  const response: InternalHealthResponse = {
    ok: true,
    sources,
  };
  res.json(response);
}

export async function pricesHandler(_req: Request, res: Response): Promise<void> {
  try {
    // v0.4.1: source 별 독립 singleFlight TTL — HL/Binance/Bybit 1s, Upbit 2s,
    // Yahoo 5s, Naver 장중 2s/휴장 7s (spec §2.1, §2.4)
    // v0.4.2: bybit/bitget/polygon/twelvedata 추가. polygon (Wave 5a) + twelvedata (Wave 5b) 활성화.
    //         두 source 모두 env 키 없으면 fetcher 내부에서 disabled 반환 (sourceHealth 면제).
    // v0.5.0: ?watchlist=KEY:SOURCE:SYMBOL,... 동적 ticker 추가. source-별 symbol 합집합으로
    //         기존 fetcher 호출. fetchHyperliquid/fetchUpbit 은 시그니처 인자 없음 — 정적 universe 유지.
    const watchlist = parseWatchlist(
      typeof _req.query.watchlist === 'string' ? _req.query.watchlist : undefined,
    );
    const wlBySource: Record<SourceName, string[]> = {
      hyperliquid: [], naver: [], yahoo: [], binance: [], upbit: [],
      bybit: [], bitget: [], polygon: [], twelvedata: [],
    };
    for (const entry of watchlist) {
      wlBySource[entry.source].push(entry.symbol);
    }

    // ⚠️ CRITICAL — singleFlight cache stale 반환 방지:
    // watchlist 있는 source 는 bypass (Client A 의 wl 결과가 Client B 에 cache hit 으로 새는 correctness bug 차단).
    // watchlist 없으면 기존 singleFlight 그대로 (정적 7-ticker 대시보드 동시 요청 dedup 유지).
    // hyperliquid/upbit: 정적 universe. 동적 watchlist entry 는 silent-skip (Task 5 범위 외, WS allMids 통합은 follow-up).
    const [hlResult, naver, yahoo, upbit, binance, bybit, bitget, polygon, twelvedata] = await Promise.all([
      singleFlight('source:hyperliquid', SOURCE_TTL_MS.hyperliquid, fetchHyperliquid),
      wlBySource.naver.length > 0
        ? fetchNaver(Array.from(new Set([...NAVER_SYMBOLS, ...wlBySource.naver])))
        : singleFlight('source:naver', naverTtl(), fetchNaver),
      wlBySource.yahoo.length > 0
        ? fetchYahoo(Array.from(new Set(['KRW=X', 'EWY', 'QQQ', 'ES=F', '^GSPC', ...wlBySource.yahoo])))
        : singleFlight('source:yahoo', SOURCE_TTL_MS.yahoo,
            () => fetchYahoo(['KRW=X', 'EWY', 'QQQ', 'ES=F', '^GSPC'])),
      singleFlight('source:upbit', SOURCE_TTL_MS.upbit, fetchUpbit),
      wlBySource.binance.length > 0
        ? fetchBinanceFutures(Array.from(new Set([...BINANCE_SYMBOLS, ...wlBySource.binance])))
        : singleFlight('source:binance', SOURCE_TTL_MS.binance, fetchBinanceFutures),
      wlBySource.bybit.length > 0
        ? fetchBybitLinear(Array.from(new Set([...BYBIT_SYMBOLS, ...wlBySource.bybit])))
        : singleFlight('source:bybit', SOURCE_TTL_MS.bybit, fetchBybitLinear),
      wlBySource.bitget.length > 0
        ? fetchBitgetFutures(Array.from(new Set([...BITGET_SYMBOLS, ...wlBySource.bitget])))
        : singleFlight('source:bitget', SOURCE_TTL_MS.bitget, fetchBitgetFutures),
      wlBySource.polygon.length > 0
        ? fetchPolygon(Array.from(new Set(['QQQ', ...wlBySource.polygon])))
        : singleFlight('source:polygon', SOURCE_TTL_MS.polygon, () => fetchPolygon(['QQQ'])),
      wlBySource.twelvedata.length > 0
        ? fetchTwelveData(Array.from(new Set(['QQQ', ...wlBySource.twelvedata])))
        : singleFlight('source:twelvedata', SOURCE_TTL_MS.twelvedata, () => fetchTwelveData(['QQQ'])),
    ]);

    // ⚠️ 회귀 가드 (v0.4.1, spec §2.3) — 이 block 을 절대 `assemblePricesResponse` 아래로
    // 옮기지 말 것. assemble.ts 안에서 `computePremiumWithSkew(t.hl, t.naver, fx)` 가
    // `t.hl.asOf` 를 skew 계산에 사용. WS overlay 가 assemble 후 실행되면 skew 가
    // REST asOf 만 보고 WS 신선도 (<1s) 를 못 반영함 (Codex #2 BLOCK 사고).
    let hl = hlResult;
    if (HL_USE_WS && hl.ok) {
      const ws = getLatestMids();
      if (ws.connected && ws.mids.size > 0) {
        hl = {
          ...hl,
          data: hl.data.map((pp) => {
            const mid = ws.mids.get(pp.symbol);
            return mid !== undefined
              ? { ...pp, price: mid, asOf: ws.lastUpdate }
              : pp;
          }),
        };
      }
    }

    const response = assemblePricesResponse({ hl, naver, yahoo, upbit, binance, bybit, bitget, polygon, twelvedata }, watchlist);
    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=8');
    res.json(response);
  } catch (err) {
    log.error('[/api/prices] unhandled', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
}

app.get('/api/healthz', healthzHandler);
app.get('/api/internal/health', internalHealthHandler);
app.get('/api/prices', pricesHandler);
app.get('/api/search', searchHandler);

const isVercelEnv = !!process.env.VERCEL;
if (!isVercelEnv && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    log.info(`server listening on http://localhost:${PORT}`);
  });
}

export { app };
