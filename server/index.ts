import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { log } from './lib/logger.js';
import { singleFlight } from './lib/cache.js';
import { SOURCE_TTL_MS, naverTtl } from './lib/source-cache.js';
import { fetchHyperliquid } from './lib/sources/hyperliquid.js';
import { fetchNaver } from './lib/sources/naver.js';
import { fetchYahoo } from './lib/sources/yahoo.js';
import { fetchUpbit } from './lib/sources/upbit.js';
import { fetchBinanceFutures } from './lib/sources/binance.js';
import { startHyperliquidWs, getLatestMids } from './lib/sources/hyperliquid-ws.js';
import { assemblePricesResponse } from './lib/assemble.js';
import { APP_VERSION } from './lib/healthz.js';
import { getSourceHealth } from './lib/health.js';
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
    // v0.4.1: source 별 독립 singleFlight TTL — HL/Binance 1s, Upbit 2s,
    // Yahoo 5s, Naver 장중 2s/휴장 7s (spec §2.1, §2.4)
    const [hlResult, naver, yahoo, upbit, binance] = await Promise.all([
      singleFlight('source:hyperliquid', SOURCE_TTL_MS.hyperliquid, fetchHyperliquid),
      singleFlight('source:naver',       naverTtl(),                fetchNaver),
      singleFlight('source:yahoo',       SOURCE_TTL_MS.yahoo,
        () => fetchYahoo(['KRW=X', 'EWY', 'NQ=F', 'ES=F', '^NDX', '^GSPC'])),
      singleFlight('source:upbit',       SOURCE_TTL_MS.upbit,       fetchUpbit),
      singleFlight('source:binance',     SOURCE_TTL_MS.binance,     fetchBinanceFutures),
    ]);

    // v0.4.1: HL WS overlay BEFORE assemble — skew guard (computePremiumWithSkew)
    // 가 WS asOf 신선도 (<1s) 를 반영하도록 함. spec §2.3 의도.
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

    const response = assemblePricesResponse({ hl, naver, yahoo, upbit, binance });
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

const isVercelEnv = !!process.env.VERCEL;
if (!isVercelEnv && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    log.info(`server listening on http://localhost:${PORT}`);
  });
}

export { app };
