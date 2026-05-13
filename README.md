# kr-multi-market

> 한국 주식 (Naver KRX) + Hyperliquid xyz dex + Yahoo + Binance Futures 멀티 venue 실시간 가격 비교 대시보드
> Reference site (영감만): https://hl-kr-stocks.vercel.app/

## Quickstart

```bash
# 1. Install
pnpm install

# 2. Setup env
cp .env.example .env.local
# Edit .env.local: generate HEALTH_TOKEN with `openssl rand -hex 32`

# 3. Run dev (concurrently: Vite client :5173 + Express server :3001)
pnpm dev

# Open browser: http://localhost:5173
```

## 종목 검색 (v0.5.0)

대시보드 상단 검색바에 종목명 또는 ticker 입력:

| 입력 예 | Tier 1 hit | Tier 2 hit | Tier 3 hit |
|---|---|---|---|
| `Apple`, `AAPL` | Finnhub `/search` (NASDAQ) | `AAPLUSDT` (Binance/Bybit/Bitget perp) | `xyz:AAPL` (HL xyz) |
| `삼성전자`, `005930` | Naver autocomplete (`ac.stock.naver.com/ac`, KRX) | — | — |
| `JP225` | Finnhub 0 hit | `JP225USDT` 0 hit | `xyz:JP225` (HL xyz) |

**검색 라우팅**: 한글 입력 → Naver Tier 1 (Finnhub fallback X). 영문 입력 → Finnhub Tier 1 → CEX perp probe (binance>bybit>bitget first-match) → HL xyz allMids.

**제약**:
- 주식/ETF 만 지원 (Finnhub `Common Stock`/`ETF` filter, 코인 자동 제외)
- 최대 50 종목 watchlist (localStorage 영구, multi-device sync X)
- 검색 source fail (Finnhub 429 / Naver 차단) graceful degradation (`tier: null`, `reason: 'naver_unavailable'` 등)
- `FINNHUB_TOKEN` 미설정 시 영문 Tier 1 비활성 (startup `WARN [search] FINNHUB_TOKEN not set ...` 출력)
- `upbit` source: `parseWatchlist` 가 허용하지만 동적 hydration 미지원 (fetcher 가 정적 KRW-USDT pair only, 검색 시스템도 upbit entry 생성 X). 사용자 직접 curl 시 silent miss — v0.5.1 follow-up.

**환경 변수**:
- `FINNHUB_TOKEN`: Finnhub.io 무료 키 (영문 검색 필수, [Source Matrix](#source-matrix-v042) 참조)
- 기타 v0.4.x 와 동일

## 종목 매트릭스

| 종목 | Hyperliquid xyz | KRX (Naver) | Yahoo | Binance Futures | venues |
|---|---|---|---|---|---|
| 삼성전자 | xyz_SMSN | 005930 | 005930.KS (fb) | — | 2-3 |
| SK하이닉스 | xyz_SKHX | 000660 | 000660.KS (fb) | — | 2-3 |
| 현대차 | xyz_HYUNDAI | 005380 | 005380.KS (fb) | — | 2-3 |
| KOSPI200F | xyz_KR200 | — | — | — | 1 |
| EWY | xyz_EWY | — | EWY | EWYUSDT | 3 |
| S&P 500 | xyz_SP500 | — | ES=F + ^GSPC | SPYUSDT | 3-4 |
| Nasdaq 100 | — | — | QQQ (Tier-4 Finnhub) | QQQUSDT (Bybit/Bitget 추가) | 2-6 |
| USDKRW | xyz_KRW | Upbit USDT-KRW | KRW=X | — | 2-3 |

## Source Matrix (v0.4.2)

| Source | Symbol | 가입 URL | Free quota | Note |
|---|---|---|---|---|
| Hyperliquid xyz | xyz:SMSN 등 7 | — | 무제한 | NQ 미상장 |
| Naver Finance | 005930 등 | — | 권장 7s polling | 한국 주식 |
| Yahoo Finance | EWY, QQQ, ES=F, ^GSPC | — | rate-limited (한국 IP 차단) | 1차 — NQ=F/^NDX 제거됨 (§2.7) |
| Finnhub | QQQ | https://finnhub.io/register | 60/min | Yahoo Tier-4 fallback (ETF only) |
| Binance Futures | EWYUSDT, SPYUSDT, QQQUSDT | — | 6000 weight/min | 1회 재시도 + Retry-After |
| **Bybit Linear** ★ | QQQUSDT | — | 60 req/s | v0.4.2 신규 |
| **Bitget USDT-M** ★ | QQQUSDT | — | 20 req/s | v0.4.2 신규 |
| Polygon.io (opt) | QQQ | https://polygon.io/dashboard/api-keys | 5/min free | paid 권장. ETF only (I:NDX 제외) |
| TwelveData (opt) | QQQ | https://twelvedata.com/account/api-keys | 800/day free | paid 권장. ETF only (NDX 제외) |
| Upbit | USDT-KRW | — | 무료 | FX 전용 |

### NQ Unit 정규화 (v0.4.2)

모든 NQ source 가 **QQQ ETF USD 가격** (~$570 range) 으로 통일됨. 이전 버전의 NQ=F futures pt + ^NDX index pt (단위 불일치) 는 v0.4.2 에서 제거.

### Vercel 배포 시 알려진 제약

v0.4.2 옵셔널 source (Polygon/TwelveData) 는 free tier 운영 시 daily quota 소진 위험. 프로덕션은 paid tier 권장.

## Architecture

```
┌─ Browser (Vite + React 18) ─────────────────────────┐
│  SWR refreshInterval=2s -> /api/prices               │
│  localStorage z-score signal (per-user, 7d)          │
│  PriceCard / IndexCompareCard / SessionBadges        │
└─────────────────────────────────────────────────────┘
                           ↓ /api/prices
┌─ Express server (Node) ──────────────────────────────┐
│  singleFlight 4s cache                               │
│  Promise.all([HL, Naver, Yahoo, Upbit, Binance])    │
│  buildFxRates + GDR guard + computePremium          │
│  getSessionState (DST + KRX/NYSE/CME holidays)       │
│  source health tracker (consecutiveFailures)        │
│  Cache-Control: s-maxage=2, stale-while-revalidate=8 │
└─────────────────────────────────────────────────────┘
                           ↓ vendor APIs
┌─ Vendor sources ─────────────────────────────────────┐
│  Hyperliquid xyz dex (POST metaAndAssetCtxs + WS)   │
│  Naver finance polling (multi-symbol with fallback) │
│  Yahoo Finance v7/v8 chart (3-tier fallback)        │
│  Upbit ticker (KRW-USDT)                             │
│  Binance Futures (TradFi equity perp)                │
└─────────────────────────────────────────────────────┘
```

## Environment Variables

| Name | Required | Description |
|---|---|---|
| `PORT` | No (3001) | Express server port |
| `NODE_ENV` | No | `development` (default) or `production` |
| `HEALTH_TOKEN` | Yes for production | Bearer token for /api/internal/health (use `openssl rand -hex 32`) |
| `HL_USE_WS` | No (false) | `true` enables Hyperliquid WebSocket allMids subscription |
| `FINNHUB_TOKEN` | No | Yahoo fallback if rate-limited (sign up at https://finnhub.io/) |

v2 (deferred):
- `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT` — KIS Open API for KRX night futures cross-validation

## Endpoints

- `GET /api/healthz` — public `{ok, version}` minimal liveness
- `GET /api/internal/health` — token-protected detailed source health (Bearer auth required)
- `GET /api/prices` — main payload, source 별 server-side cache (HL/Binance 1s · Upbit 2s · Yahoo 5s · Naver 동적) + 8s stale-while-revalidate

## Price refresh rate (v0.4.1)

| Source | TTL | Note |
|---|---|---|
| Hyperliquid (HL) | 1s (REST cache); WS 모드 시 <1s | `HL_USE_WS=true` 권장 |
| Binance Futures | 1s | |
| Upbit (USDT-KRW) | 2s | |
| Yahoo Finance | 5s | rate limit 보호 |
| Naver (KRX) | **장중 2s / 휴장 7s** | KRX session 동적 |
| SWR client refresh | 2s | server cache 경유 |

**Premium guard**: HL ↔ Naver 시점 격차 > 5s 시 premium null + `guard='warn'` (UI: tier-na). stale-mix 방지.

## Testing

```bash
# Unit + UI tests (Vitest, default skip integration)
pnpm test

# Live network integration tests (KRX hours preferred)
pnpm test:integration

# Type check
pnpm exec tsc --noEmit                           # client
pnpm exec tsc --noEmit -p server/tsconfig.json  # server

# Production build
pnpm build
```

## Project Structure

```
.
├── PLAN.md              # Full implementation plan (v5 FINAL, post-2-round peer review)
├── IMPLEMENTATION_PLAN.md  # 48-task breakdown
├── src/                 # Vite React frontend
│   ├── components/      # PriceCard, IndexCompareCard, SessionBadges
│   ├── hooks/           # usePrices (SWR), useZScore (localStorage)
│   └── App.tsx
├── server/              # Express API server
│   ├── index.ts
│   ├── lib/
│   │   ├── sources/     # Vendor adapters (hyperliquid, naver, yahoo, upbit, binance)
│   │   ├── session.ts   # KST session matrix + DST handling
│   │   ├── calendar.ts  # KRX/NYSE/CME holidays (2025-2026)
│   │   ├── normalize.ts # Premium calc + GDR guard + buildFxRates
│   │   └── cache.ts     # 4s single-flight
│   └── tests/           # Vitest unit + integration tests
├── shared/types/        # Shared TypeScript types (@shared/* alias)
└── public/
```

## v2 Backlog

- KIS night futures cross-validation (xyz_KR200 vs official KOSPI200F)
- EWY NAV premium/discount (T-1 stale, currently not displayed)
- Order book depth indicator (slippage estimation per venue)
- Position context (user PnL on each venue via read-only API keys)
- Tradeable threshold indicator (round-trip cost subtraction)
- Telegram alert hook (DISLOCATED z-score)
- Calendar 2027+ refresh

## Deploy Status — Local Only (v0.5.3)

**현재 v0.5.3은 로컬 운영 전용입니다.** 누구나 clone 후 `pnpm install + pnpm dev` 로 실행할 수 있습니다 (License: MIT).

### 로컬 실행 (사용자 권장)

```bash
# 1) Clone + install
git clone https://github.com/londonpotato1/kr-multi-market.git
cd kr-multi-market
pnpm install

# 2) Setup env
cp .env.example .env.local
# .env.local 에 HEALTH_TOKEN (`openssl rand -hex 32`) 채우기
# (선택) FINNHUB_TOKEN 채우면 영문 ticker 검색 활성 (https://finnhub.io 무료 60/min)
# (선택) HL_USE_WS=true 면 Hyperliquid 실시간 WS, false 면 1s REST

# 3) Run (concurrently: Vite client :5173 + Express server :3001)
pnpm dev
# http://localhost:5173 접속
```

데이터는 2초마다 자동 갱신됩니다 (v0.4.1 — source 별 cache TTL, "Price refresh rate" 섹션 참조). 브라우저 localStorage에 z-score 히스토리가 7일간 누적되며, 8분(100 샘플) 이후부터 z-score 기반 시그널이 표시됩니다. v0.5.0 부터 종목 검색 + 관심 종목 (최대 50개, localStorage 영구) 지원.

### 환경 변수 요약

| 변수 | 필수? | 비고 |
|---|---|---|
| `HEALTH_TOKEN` | production 만 | `openssl rand -hex 32` |
| `HL_USE_WS` | No (default false) | `true` 권장 (로컬 dev). Vercel/serverless 는 `false` |
| `FINNHUB_TOKEN` | No (graceful) | 영문 검색 / Yahoo Tier-4 fallback. 없으면 영문 Tier 1 비활성 |
| `POLYGON_API_KEY` | No | NQ Tier-5 fallback (옵션) |
| `TWELVEDATA_API_KEY` | No | NQ Tier-6 fallback (옵션) |

### 서버리스 배포 (옵션 — 미검증)

Vercel 어댑터 코드 (`api/*.ts` + `vercel.json`) 가 준비되어 있지만 maintainer 환경에서 미검증입니다. 시도 시 `HL_USE_WS=false` 필수 (serverless 는 long-lived WS 불가능).

**Vercel 배포 시 알려진 제약**:
- Naver finance polling — Vercel 미국 IP에서 차단 가능. `.KS` Yahoo fallback 으로 graceful degrade.
- Yahoo 429 — 현재 한국 IP에서도 발생 중. xyz_KRW (Hyperliquid) 가 `officialUsdKrw` fallback.
- localStorage z-score는 클라이언트별이라 deploy/local 모두 동일하게 동작.

## Why "KIS deferred to v2"?

User decision (Q16 in PLAN v5): xyz_KR200 perp on Hyperliquid trades 24/7 and is sufficient for KOSPI200 night-session monitoring. KIS Open API (한국투자증권) was the original Phase 5 plan for cross-validation but adds:
- 1-3 day account approval wait
- Token race condition complexity
- Korean IP requirement (not Vercel-friendly)
- Extra 2 days to MVP

Trade-off: lose precise night-futures price; gain 4 days + Vercel-friendly deploy.

## Tech Stack

- **Vite 8** + **React 19** (frontend)
- **Express 4** + **Node 22** (server, ESM NodeNext)
- **TypeScript 6** (strict, single-package monorepo via `@shared/*` alias)
- **Vitest 4** (happy-dom for client, node for server, `test.projects` split)
- **SWR 2** (client polling, 2s refresh + 1.5s dedup)
- **pnpm 11** (package manager)
- No Tailwind/CSS-in-JS — plain CSS with Hyperliquid mint `#97FCE4`

## Reviewers

This codebase passed 2 rounds of peer review:
- **Round 1**: Codex (adversarial), Oracle (architecture), Momus (plan critic), Metis (hidden intent)
- **Round 2**: same 4 reviewers verifying v3.1→v4 changes

See PLAN.md and IMPLEMENTATION_PLAN.md for the full plan + 48-task breakdown.

## License

MIT
