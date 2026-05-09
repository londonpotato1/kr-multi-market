# kr-multi-market

Multi-venue realtime price comparison dashboard for Korean stocks, KOSPI200, EWY, and US indices.

> Reference site (inspiration only): https://hl-kr-stocks.vercel.app/
> See [PLAN.md](./PLAN.md) for the full implementation plan (v5 FINAL, post-2-round peer review).

## Tickers

| Symbol | Hyperliquid xyz | KRX (Naver) | Yahoo | Binance Futures |
|---|---|---|---|---|
| Samsung 005930 | xyz_SMSN | 005930 | 005930.KS (fb) | — |
| SK Hynix 000660 | xyz_SKHX | 000660 | 000660.KS (fb) | — |
| Hyundai 005380 | xyz_HYUNDAI | 005380 | 005380.KS (fb) | — |
| KOSPI200F | xyz_KR200 | — | — | — |
| EWY (iShares Korea ETF) | xyz_EWY | — | EWY | EWYUSDT |
| S&P 500 | xyz_SP500 | — | ES=F, ^GSPC | SPYUSDT |
| Nasdaq 100 | — | — | NQ=F, ^NDX | QQQUSDT |
| USDKRW | xyz_KRW | Upbit USDT-KRW | KRW=X | — |

## Stack

- **Vite + React 18 + TypeScript** (frontend)
- **Express + Node** (API server)
- **Tailwind CSS** (styling)
- **SWR** (5s polling)
- **Client-side localStorage z-score** (premium history, server stays stateless)
- **No external DB** (Vercel serverless friendly)

## Local development

```bash
# Install dependencies
pnpm install

# Copy env template
cp .env.example .env.local
# Edit .env.local and fill in HEALTH_TOKEN (use: openssl rand -hex 32)

# Start dev server (frontend on :5173, API on :3001)
pnpm dev
```

Visit http://localhost:5173.

## Production deploy (Vercel)

```bash
pnpm vercel link
pnpm vercel env add HEALTH_TOKEN production
pnpm vercel --prod
```

## Project structure

```
.
├── PLAN.md              # Full implementation plan (v5 FINAL)
├── src/                 # Vite React frontend
├── server/              # Express API server
│   ├── index.ts
│   ├── lib/
│   │   ├── sources/     # Vendor adapters (hyperliquid, naver, yahoo, upbit, binance)
│   │   ├── session.ts   # KST session matrix
│   │   ├── calendar.ts  # KRX/NYSE/CME holidays
│   │   ├── normalize.ts # Premium calc + GDR guard
│   │   └── cache.ts     # 4s single-flight
│   └── tests/           # Vitest unit tests
├── shared/types/        # Shared TypeScript types
└── public/
```

## Notes

- **KIS integration deferred to v2** — `xyz_KR200` provides 24/7 KOSPI200 monitoring, sufficient for night-session gap detection.
- **5-second polling** — server-side single-flight cache (4s) ensures vendor calls remain bounded regardless of client count.
- **Public deployment safe** — no API keys for primary data sources; `HEALTH_TOKEN` only protects internal health endpoint.
