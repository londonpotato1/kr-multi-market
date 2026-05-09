import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { log } from './lib/logger.js';
import { singleFlight } from './lib/cache.js';
import { fetchHyperliquid } from './lib/sources/hyperliquid.js';
import { fetchNaver } from './lib/sources/naver.js';
import { fetchYahoo } from './lib/sources/yahoo.js';
import { fetchUpbit } from './lib/sources/upbit.js';
import { fetchBinanceFutures } from './lib/sources/binance.js';
import { startHyperliquidWs, getLatestMids } from './lib/sources/hyperliquid-ws.js';
import { assemblePricesResponse } from './lib/assemble.js';
import { buildHealthzResponse } from './lib/healthz.js';
import type { PricesResponse } from '@shared/types/prices.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';
const HL_USE_WS = process.env.HL_USE_WS === 'true';

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

app.get('/api/healthz', (_req: Request, res: Response) => {
  res.json(buildHealthzResponse());
});

app.get('/api/prices', async (_req: Request, res: Response) => {
  try {
    // Single-flight: dedup concurrent requests, cache 4s
    const response = await singleFlight<PricesResponse>('prices', 4000, async () => {
      const [hl, naver, yahoo, upbit, binance] = await Promise.all([
        fetchHyperliquid(),
        fetchNaver(),
        fetchYahoo(['KRW=X', 'EWY', 'NQ=F', 'ES=F', '^NDX', '^GSPC']),
        fetchUpbit(),
        fetchBinanceFutures(),
      ]);
      return assemblePricesResponse({ hl, naver, yahoo, upbit, binance });
    });
    if (HL_USE_WS) {
      const ws = getLatestMids();
      if (ws.connected && ws.mids.size > 0) {
        for (const payload of Object.values(response.tickers)) {
          if (payload.hl) {
            const mid = ws.mids.get(payload.hl.symbol);
            if (mid !== undefined) {
              payload.hl.price = mid;
              payload.hl.asOf = ws.lastUpdate;
            }
          }
        }
      }
    }
    res.setHeader('Cache-Control', 's-maxage=4, stale-while-revalidate=10');
    res.json(response);
  } catch (err) {
    log.error('[/api/prices] unhandled', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

app.listen(PORT, () => {
  log.info(`server listening on http://localhost:${PORT}`);
});
