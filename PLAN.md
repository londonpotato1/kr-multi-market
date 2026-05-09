# kr-multi-market — ULTRAPLAN v5 (FINAL)

> Multi-venue realtime price comparison dashboard
> Reference site (inspiration only): https://hl-kr-stocks.vercel.app/
> Two rounds of peer review by Codex, Oracle, Momus, Metis incorporated.

---

## 0. User Decisions Locked (after Round 2)

| Q | Answer | Impact |
|---|---|---|
| **Q11** Stack | **A. Vite + React 18 + Node API + client localStorage** | Simplest, public Vercel friendly |
| **Q16** KIS necessity | **B. Defer KIS to v2** | xyz_KR200 is enough for KOSPI200 monitoring; Phase 2 deleted |
| **Q17** KIS account | N/A (deferred) | — |

**Schedule**: 14d → **10.5d** (KIS removal saves Phase 2 + token race + scale factor + monthly contract roll)

---

## 1. CHANGELOG vs v4

| Item | v4 | v5 (FINAL) |
|---|---|---|
| KIS integration | Phase 2 | **REMOVED** (deferred to v2) |
| KOSPI200F venues | xyz_KR200 + KIS night futures | **xyz_KR200 only** (single-venue card) |
| Premium history storage | server-side sqlite | **client-side localStorage** (server stateless, Vercel-friendly) |
| Tauri stack option B | listed as optional | **REMOVED** (user said "vercel에 올리자") |
| GDR guard threshold | [0.5, 2] single | **[0.95, 1.05] normal, [0.85, 1.15] warn, else fail-closed** (Oracle Round 2) |
| /api/health | single | **/api/healthz (public) + /api/internal/health (token auth)** (Oracle Round 2) |
| HL schema validator | Risk Register only | **Phase 1 implementation item** (Oracle Round 2) |
| SourceResult<T> | discriminated union | **simple `{ ok, data, error, latencyMs }`** (Metis: AI slop avoidance) |
| WebSocket | "noted" | **Phase 1 explicit option** (HL `allMids` WS, REST polling fallback) |
| gitleaks command | `gitleaks detect --staged` | **`gitleaks protect --staged`** (Momus Round 2 fix) |
| Phase 8 (deploy) QA | missing | **added** (Momus Round 2) |
| Calendar CI guard | missing | **added** (90d before lastHoliday triggers warning) |
| Phase count | 8 | **7** (KIS Phase 2 removed) |
| Schedule | 14d | **10.5d** |

---

## 2. Final Ticker x Source Matrix

| Ticker | Hyperliquid xyz | KRX (Naver) | Yahoo | Binance Futures | venues |
|---|---|---|---|---|---|
| Samsung | `xyz_SMSN` | `005930` | `005930.KS` (fb) | none | 2-3 |
| SK Hynix | `xyz_SKHX` | `000660` | `000660.KS` (fb) | none | 2-3 |
| Hyundai | `xyz_HYUNDAI` | `005380` | `005380.KS` (fb) | none | 2-3 |
| **KOSPI200F** | `xyz_KR200` | none | none | none | **1 (single venue)** |
| EWY | `xyz_EWY` | none | `EWY` | `EWYUSDT` | 3 |
| S&P 500 | `xyz_SP500` | none | `ES=F`, `^GSPC` | `SPYUSDT` | 3-4 |
| Nasdaq 100 | none | none | `NQ=F`, `^NDX` | `QQQUSDT` | 2-3 |
| USDKRW (official) | none | none | `KRW=X` | none | 1 (primary) |
| USDT-KRW (Korean) | `xyz_KRW` (after verify) | Upbit USDT-KRW | none | none | 1-2 |

### Dropped permanently
- BTC, ETH "mood" indicator (scope creep)
- Tauri build option (user explicitly chose Vercel)

### Deferred to v2
- KIS night futures cross-validation
- EWY NAV premium discount (T-1 stale)
- Order book depth display
- Position context (user PnL on each venue)
- Telegram alert hook
- Tradeable threshold indicator (round-trip cost subtraction)

---

## 3. KST 24-hour Sessions + Holidays

### Weekday (May 2026 EDT)
| KST | KRX | NYSE | CME | HL | Binance |
|---|---|---|---|---|---|
| 09:00-15:30 | regular | closed | live | live | live |
| 15:30-18:00 | after-hours | closed | live | live | live |
| 18:00-22:30 | after | pre-market | live | live | live |
| 22:30-05:00 | closed | regular | live | live | live |
| 05:00-09:00 | closed | after-hours | live | live | live |
| **06:00-07:00** | closed | after-hours | **CME closed** | live | live |

### Weekend boundary tests (Oracle Round 2 finding)
| KST | Real time (ET) | CME state |
|---|---|---|
| Friday 22:30 KST | Fri 09:30 ET | open |
| Saturday 06:00 KST | Fri 17:00 ET | **CME close (boundary)** |
| Saturday all | Sat all | closed |
| Sunday all | Sun all | closed |
| Monday 07:00 KST | Sun 18:00 ET | **CME open (boundary)** |

### Holiday calendar module (`server/lib/calendar.ts`)
- KRX_HOLIDAYS_2026, NYSE_HOLIDAYS_2026, CME_EARLY_CLOSE
- isKrxOpen, isNyseOpen, isCmeOpen with daily 17-18 ET break + holiday handling
- DST: `Intl.DateTimeFormat('en-US', {timeZone:'America/New_York'})` dynamic
- **CI guard**: if `now > lastHolidayDate - 90 days`, warn in test output

### UI degradation rules
- KRX holiday → KRX cards grayscale + "휴장" label
- NYSE holiday → EWY, SPY, QQQ grayscale
- CME closed (daily break or weekend) → NQ=F, ES=F grayscale
- HL, Binance: 24/7, never show holiday label

---

## 4. Conversion Math + Signals

### 4.1 FX rate split (Oracle Round 1 critical, kept in v5)

```typescript
type FxRates = {
  officialUsdKrw: number;  // Yahoo KRW=X — canonical for premium
  usdtKrw: number;          // Upbit USDT-KRW — Korean USDT premium
  hlInferredKrw?: number;   // xyz_KRW after direction verification
  divergencePct: number;    // (usdtKrw - officialUsdKrw) / officialUsdKrw * 100
};
```

**UI rule** (Oracle Round 2): Cards show **one prominent premium %** (using officialUsdKrw). Tooltip or secondary row shows USDT-based premium. Header: 3 pills (USD-KRW, USDT-KRW, kimchi delta). If divergence ≥ 5%, kimchi pill turns red.

### 4.2 Conversion formulas

```
hl_krw_eq_usd  = hl_price_usd * officialUsdKrw     // canonical
hl_krw_eq_usdt = hl_price_usd * usdtKrw            // parity check

premium_pct_usd  = (hl_krw_eq_usd  - krx_price_krw) / krx_price_krw * 100
premium_pct_usdt = (hl_krw_eq_usdt - krx_price_krw) / krx_price_krw * 100
```

### 4.3 GDR Runtime Guard (Oracle Round 2 — fail-closed 2-tier)

```typescript
function gdrGuard(ticker: string, hlUsd: number, krxKrw: number, fxOfficial: number): GuardResult {
  const ratio = (hlUsd * fxOfficial) / krxKrw;
  if (ratio >= 0.95 && ratio <= 1.05) return { state: 'normal' };
  if (ratio >= 0.85 && ratio <= 1.15) return { state: 'warn', ratio };
  return { state: 'blocked', ratio, reason: 'gdr_ratio_drift' };
}
```

State 'blocked' → premium calculation suppressed, card shows "스키마 변경 의심" warning.

### 4.4 KR200 Scale Factor (no longer blocking, single venue)

`xyz_KR200` is the only KOSPI200 source in v5. No need to verify scale factor against KIS. Display as raw index points + "KOSPI200 perp" label.

### 4.5 Z-score Signal (client-side localStorage)

**Major v5 change**: Premium history stored in browser localStorage (server stays stateless = Vercel-friendly).

```typescript
// client/src/lib/signal.ts
type PremiumSnapshot = { ticker: string; premiumPct: number; ts: number };

function appendPremium(ticker: string, premiumPct: number) {
  const key = `kr-mm:premium:${ticker}`;
  const arr = JSON.parse(localStorage.getItem(key) || '[]') as PremiumSnapshot[];
  arr.push({ ticker, premiumPct, ts: Date.now() });
  // Keep last 7 days only
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const trimmed = arr.filter(s => s.ts > cutoff);
  localStorage.setItem(key, JSON.stringify(trimmed));
}

function calcZScore(ticker: string, current: number): number | null {
  const key = `kr-mm:premium:${ticker}`;
  const arr = JSON.parse(localStorage.getItem(key) || '[]') as PremiumSnapshot[];
  if (arr.length < 100) return null;  // < 100 samples (~8 minutes) = fallback
  const values = arr.map(s => s.premiumPct);
  const mean = values.reduce((a,b)=>a+b,0) / values.length;
  const stddev = Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0) / values.length);
  if (stddev === 0) return 0;
  return (current - mean) / stddev;
}
```

**Display**:
- `|z| < 1`: text-dim, "정상"
- `1 ≤ |z| < 2`: yellow, "WATCH"
- `2 ≤ |z| < 3`: orange, "TRADE"
- `|z| ≥ 3`: red+pulse, "DISLOCATED"

Fallback (history < 100 rows = first 8 minutes): absolute thresholds 0.5%, 1.5%, 3% + label "데이터 수집 중 (X/100)".

5MB localStorage limit: ~7d × 17,280 rows × 80 bytes ≈ 9.6MB → trim to 5d if size approaches limit.

### 4.6 Volume + Funding Display (Round 1 Metis kept)

Each card:
- 24h volume (USD) — yellow warning on thin HL tickers (e.g., SAMSUNG approx 4M USD/day)
- Funding rate 8h — both HL + Binance perps
- Funding diff across venues for same underlying

---

## 5. Data Schema

### 5.1 PricePoint (per source)

```typescript
type SourceStatus = 'ok' | 'stale' | 'degraded' | 'down';

type PricePoint = {
  source: 'hyperliquid' | 'naver' | 'yahoo' | 'binance' | 'upbit';
  symbol: string;
  price: number;
  unit: 'USD' | 'KRW' | 'USDT' | 'pt';
  change24hPct?: number;
  volume24hUsd?: number;
  fundingRate8h?: number;
  openInterestUsd?: number;
  status: SourceStatus;
  asOf: number;          // venue timestamp ms
  receivedAt: number;    // server received ms
  staleReason?: string;  // 'market_closed' | 'vendor_5xx' | 'rate_limited' | ...
  schemaVersion: number; // = 1 for v5
};
```

### 5.2 Result wrapper (simplified, Metis Round 2)

```typescript
type Result<T> = { ok: true; data: T; latencyMs: number }
              | { ok: false; error: string; latencyMs: number };
```

No discriminated union complexity. Plain object. Each source adapter returns `Result<PricePoint[]>`.

### 5.3 /api/prices response

```json
{
  "ts": 1746759600000,
  "schemaVersion": 1,
  "fx": { "officialUsdKrw": 1462.0, "usdtKrw": 1361.5, "divergencePct": -6.87 },
  "session": { "krx": false, "krxNight": true, "nyseRegular": false, "cme": true, "hyperliquid": true, "binance": true },
  "tickers": {
    "samsung": {
      "naver": { "source":"naver", "symbol":"005930", "price":75000, "unit":"KRW", "status":"stale", "staleReason":"market_closed", ... },
      "hl":    { "source":"hyperliquid", "symbol":"xyz_SMSN", "price":205.23, "unit":"USD", "status":"ok", "fundingRate8h":0.000386, ... },
      "premium": { "pctUsd": -3.1, "pctUsdt": 2.5, "guard": "normal" }
    }
  },
  "sourceHealth": {
    "naver": { "lastSuccess": 1746759595000, "consecutiveFailures": 0 }
  }
}
```

(Z-score computed CLIENT-side from localStorage history — not in API response)

### 5.4 /api/healthz (public, minimal)
```json
{ "ok": true, "version": "0.1.0" }
```

### 5.5 /api/internal/health (token-protected)
```json
{
  "ok": true,
  "sources": {
    "hyperliquid": { "status":"ok", "lastSuccessAgoMs":4123 },
    ...
  }
}
```
Auth: `Authorization: Bearer ${HEALTH_TOKEN}` (env-set).

---

## 6. Project Structure (Vite + Node API)

```
kr-multi-market/
├── client/                         # Vite frontend (created by `pnpm create vite`)
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── StockCompareCard.tsx
│   │   │   ├── IndexCompareCard.tsx
│   │   │   ├── SignalBadge.tsx
│   │   │   ├── SessionBadge.tsx
│   │   │   └── HealthIndicator.tsx
│   │   ├── lib/
│   │   │   ├── signal.ts           # localStorage z-score
│   │   │   └── format.ts           # KRW, USD, pct formatters
│   │   ├── hooks/usePrices.ts      # SWR 5s
│   │   └── styles.css
│   └── vite.config.ts
├── server/                         # Express + Node API
│   ├── index.ts                    # /api/prices + /api/healthz + /api/internal/health
│   ├── lib/
│   │   ├── sources/
│   │   │   ├── hyperliquid.ts      # Phase 1 — schema validator + 7-ticker single fetch
│   │   │   ├── naver.ts            # Phase 2
│   │   │   ├── yahoo.ts            # Phase 3
│   │   │   ├── upbit.ts            # Phase 2
│   │   │   └── binance.ts          # Phase 3
│   │   ├── session.ts              # Phase 4
│   │   ├── calendar.ts             # Phase 4
│   │   ├── normalize.ts            # premium calc + GDR guard
│   │   ├── cache.ts                # 4s single-flight (in-memory)
│   │   └── logger.ts
│   └── tests/
│       ├── gdr-ratio.test.ts       # MANDATORY
│       ├── usdkrw-divergence.test.ts
│       ├── session-matrix.test.ts  # DST + holidays + weekend boundaries
│       ├── hl-schema.test.ts       # Phase 1 — fixture-based schema validation
│       └── signal-zscore.test.ts   # client signal correctness
├── shared/types/prices.ts          # PricePoint, Result types
├── .env.example
├── .env.local                      # gitignored
├── .gitignore
├── PLAN.md                         # this file
├── README.md
├── package.json                    # workspace root
└── pnpm-workspace.yaml
```

---

## 7. Security Checklist (public repo)

- [x] `.env*.local`, `.env`, `data/`, `node_modules/` in `.gitignore`
- [x] `.env.example` with key names only, empty values
- [x] No secrets in README or PLAN
- [x] `gitleaks protect --staged` pre-push hook (Momus correction)
- [x] HEALTH_TOKEN env-only (no client exposure)
- [x] Binance API key (if added later): read-only, no withdraw
- [x] CORS: API allows only own origin in production

---

## 8. Phased Implementation (LOCAL FIRST → Vercel last)

### Phase 0: Setup + GitHub repo + initial commit (DONE in this turn) — 0.5d

```bash
cd ~/Projects/london_projects
pnpm create vite kr-multi-market --template react-ts  # DONE
cd kr-multi-market
pnpm install                                          # IN PROGRESS
# Restructure: move Vite output to client/ subdir; create server/, shared/
# Add .env.example, strengthen .gitignore
gh repo create londonpotato1/kr-multi-market --public
git init && git add . && git commit -m "chore: bootstrap kr-multi-market"
git push -u origin main
brew install gitleaks
echo '#!/bin/sh\ngitleaks protect --staged' > .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

**QA scenarios**:
- `pnpm dev` → `localhost:5173` shows Vite default page
- `gh repo view londonpotato1/kr-multi-market --json visibility` → `"public"`
- `gitleaks protect --staged` → no findings
- `cat .gitignore` includes `.env.local`, `.env`, `node_modules`, `dist`
- PLAN.md exists at project root, committed

### Phase 1: Hyperliquid 7-ticker single-call + schema validator + WebSocket option — 2d

- `server/index.ts`: Express bootstrap, `/api/healthz`
- `server/lib/sources/hyperliquid.ts`: POST `metaAndAssetCtxs` with `dex:"xyz"`, parse 7 tickers (SMSN, SKHX, HYUNDAI, KR200, EWY, SP500, KRW)
- **Runtime schema validator** (Oracle Round 2): assert response shape, required fields, numeric coercion. Throw `SchemaError` if drift.
- `server/lib/cache.ts`: 4s single-flight Map+Promise dedup
- `server/tests/hl-schema.test.ts`: fixture-based test for missing field, renamed field, asset removed
- **WebSocket option** (Codex Round 2): `lib/sources/hyperliquid-ws.ts` with `allMids` subscription. ENV toggle `HL_USE_WS=true|false`. REST polling default for MVP simplicity.
- `client/src/App.tsx`: 7 cards rendering HL data
- `client/src/hooks/usePrices.ts`: SWR every 5s

**QA scenarios**:
- `curl localhost:3000/api/prices | jq '.tickers | keys | length'` ≥ 7
- Each ticker has `hl.status === "ok"`, `hl.fundingRate8h !== undefined`
- `pnpm test hl-schema` → all 4 fixture tests pass (valid, missing field, renamed, asset removed)
- 5s later → `ts` differs by 4-6s
- Browser: 7 cards display, prices flash teal-red on change
- Stop server, reload browser: cards show "down" status

### Phase 2: KRX (Naver) + FX split + GDR guard — 1.5d

- `server/lib/sources/naver.ts`: 005930, 000660, 005380 polling
- **Verify Naver works locally** (Korean IP)
- `server/lib/sources/upbit.ts`: USDT-KRW
- `server/lib/sources/yahoo.ts` (FX only): KRW=X primary
- `normalize.ts`: FX split + premium calc with GDR guard
- Header: 3 FX pills (USD-KRW, USDT-KRW, kimchi delta), red ≥5%
- 3 stock cards show KRX vs HL premium %

**QA scenarios**:
- `curl localhost:3000/api/prices | jq '.fx'` → 3 keys
- `pnpm test gdr-ratio` → SMSN, SKHX, HYUNDAI ratios in [0.95, 1.05]
- During 09:00-15:30 KST → 3 tickers show premium %
- After close → KRX cards stale, premium suppressed

### Phase 3: Yahoo + Binance Futures (3-venue comparison) — 1.5d

- `server/lib/sources/yahoo.ts` (full): multi-symbol `EWY,NQ=F,ES=F,^NDX,^GSPC`
- `server/lib/sources/binance.ts`: `EWYUSDT,SPYUSDT,QQQUSDT`
- **Verify Binance Korean IP not blocked locally**
- EWY 3-venue card (Yahoo, xyz_EWY, EWYUSDT)
- SP500 3-venue (ES=F, xyz_SP500, SPYUSDT)
- NQ 2-venue (NQ=F, QQQUSDT)
- KOSPI200F single-venue card (xyz_KR200 only)
- Spread table per multi-venue card

**QA scenarios**:
- `curl localhost:3000/api/prices | jq '.tickers.ewy | keys'` → `["yahoo","hl","binance","spread"]`
- NYSE-time mock → Yahoo `status:ok`. NYSE-closed mock → `status:stale`, `staleReason:market_closed`
- Binance EWYUSDT card shows funding rate
- KOSPI200F card shows xyz_KR200 only (no second column)

### Phase 4: Session matrix + holidays + auto night-mode — 1.5d

- `server/lib/session.ts`: 6 markets boolean (DST dynamic via `Intl.DateTimeFormat`)
- `server/lib/calendar.ts`: KRX, NYSE, CME holidays JSON for 2026
- Header: 6 session badges
- STALE visual: opacity 0.6, grayscale
- 15:30 KST → auto night-mode (KOSPI200, EWY, US futures move to top)
- Calendar CI guard: warn if `now > lastHoliday - 90d`

**QA scenarios**:
- `pnpm test session-matrix` → boundary tests pass (Sat 06:00, Sun 23:00, Mon 07:00)
- `pnpm test session-matrix` → DST 2026-03-08 transition correct
- Clock mock 14:00 → KRX live; 16:00 → KRX stale; 19:00 → KRX stale + KOSPI200F stays live
- KRX holiday mock 2026-05-05 → KRX cards labelled "휴장"
- Test output warns if 2027 calendar missing

### Phase 5: localStorage z-score signal + UI polish — 1.5d

- `client/src/lib/signal.ts`: append + zScore + trim 7d
- 5s after each fetch → append premium per ticker
- Card SignalBadge: z-score-based color
- Fallback (< 100 samples): absolute thresholds + label
- DISLOCATED: card outline pulse
- localStorage 5MB guard: trim to 5d if approaching

**QA scenarios**:
- `pnpm test signal-zscore` → known input → known z-score
- Browser DevTools localStorage: `kr-mm:premium:samsung` array growing every 5s
- Inject 100 mock premiums via console → SignalBadge becomes z-score-based
- Refresh page → history persists, signals continue
- localStorage cleared → fallback label "데이터 수집 중 (0/100)"

### Phase 6: /api/healthz + /api/internal/health + mobile + README — 1d

- `/api/healthz`: minimal `{ok, version}` (no auth)
- `/api/internal/health`: source detail + token auth
- Header: degraded banner if any source `consecutiveFailures > 3`
- Mobile responsive (Tailwind breakpoints)
- README: local exec + env vars + deployment + KIS skipped (deferred to v2) note

**QA scenarios**:
- `curl localhost:3000/api/healthz` → `{"ok":true,"version":"0.1.0"}`
- `curl localhost:3000/api/internal/health` (no token) → 401
- `curl -H "Authorization: Bearer $HEALTH_TOKEN" localhost:3000/api/internal/health` → source list
- iOS Safari mobile DevTools: cards stacked vertically, readable
- README has all 5 local-run steps + Vercel deploy steps

### Phase 7: Vercel deploy — 0.5d

- `vercel.json`: rewrites `/api/*` → server functions
- Server adapted to Vercel serverless (export per-route handlers)
- Vercel env vars: HEALTH_TOKEN, optional FINNHUB_TOKEN
- `vercel link` + first production deploy
- Custom domain optional

**QA scenarios** (Round 2 Momus):
- `vercel --prod` → deploy success, URL printed
- `curl https://<deployed>.vercel.app/api/healthz` → `{"ok":true}`
- Browser https://<deployed>.vercel.app/ → dashboard renders, 5s polling works
- localStorage z-score works on deployed URL (per-user history)
- Mobile Safari to deployed URL → renders correctly
- gitleaks: `git log --all -p | gitleaks detect --no-git --pipe` → no findings

**Total: 10.5 working days** (Round 2 estimate match)

---

## 9. Risk Register (v5 final)

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| **USDT-KRW kimchi double error** | Always | High | FX split + cross-validation done |
| **GDR 25x trap re-mistake** | 50%+ (Metis) | Very High | Runtime guard 2-tier + unit test done |
| **Naver IP blocked on Vercel** | Medium | High | Verify locally; Yahoo `.KS` fallback |
| **Binance Korean IP blocked** | Medium-High | Medium | Test locally; if blocked, EWY shows Yahoo + HL only |
| **HL `metaAndAssetCtxs` schema change** | Low | High | Phase 1 runtime validator + fixture tests |
| **HL xyz_KRW direction inversion** | Medium | Medium | Verify range against KRW=X before use |
| **KRX, NYSE, CME holiday miss** | 5-10x/year | Medium | calendar JSON + CI guard |
| **Public repo secret leak** | User error | Critical | gitleaks pre-push + .env.example only |
| **AI over-engineering (factory, abstract)** | High (Metis) | Medium | "3 lines if 3 lines suffice" rule |
| **localStorage 5MB exceeded** | Low (7d data) | Low | Auto-trim to 5d if approaching |
| **Calendar 2027 missing** | Annual | Medium | CI guard warns 90d before lastHoliday |

---

## 10. Mandatory Unit Tests

### `gdr-ratio.test.ts`
```typescript
test('xyz_SMSN times officialUsdKrw approx Naver 005930 within 5%', async () => {
  const hl = await fetchHyperliquid(['SMSN']);
  const naver = await fetchNaver(['005930']);
  const fx = await fetchYahoo(['KRW=X']);
  const inferred = hl.SMSN.price * fx.KRW.price;
  const ratio = inferred / naver['005930'].price;
  expect(ratio).toBeGreaterThanOrEqual(0.95);
  expect(ratio).toBeLessThanOrEqual(1.05);
});
```

### `usdkrw-divergence.test.ts`
```typescript
test('Upbit USDT-KRW vs Yahoo KRW=X divergence < 10%', async () => {
  const upbit = await fetchUpbit();
  const yahoo = await fetchYahoo(['KRW=X']);
  const divergence = Math.abs(upbit.usdtKrw - yahoo.krwx) / yahoo.krwx;
  expect(divergence).toBeLessThan(0.1);
});
```

### `session-matrix.test.ts`
```typescript
test('Saturday 06:00 KST = CME closed (boundary)', () => {
  const sat = new Date('2026-05-09T06:00:00+09:00');
  expect(getSessionState(sat).cme).toBe(false);
});
test('Sunday 23:00 KST = CME still closed', () => {});
test('Monday 07:00 KST = CME reopen', () => {});
test('KRX holiday 2026-05-05 = closed at 10:00 KST', () => {});
test('DST transition 2026-03-08 = NYSE open shifted', () => {});
```

### `hl-schema.test.ts`
```typescript
test('parses valid HL response', () => {});
test('throws SchemaError if asset removed from universe', () => {});
test('throws SchemaError if markPx renamed', () => {});
test('throws SchemaError if numeric field is null', () => {});
```

### `signal-zscore.test.ts`
```typescript
test('z-score calc with 100 samples', () => {});
test('z-score returns null if < 100 samples', () => {});
test('localStorage trim drops entries older than 7d', () => {});
test('localStorage size cap triggers 5d trim', () => {});
```

---

## 11. Definition of Done (Phase 7 end)

- [ ] `pnpm test` all 5 test files pass
- [ ] `pnpm dev` localhost displays 9 cards (3 stock + KOSPI200 + EWY + SP500 + NQ + USDKRW + degraded banner)
- [ ] 5s auto-refresh, prices flash teal-red on change
- [ ] 15:30 KST mock → auto night-mode
- [ ] 6 session badges accurate
- [ ] STALE cards opacity 0.6 + grayscale
- [ ] DISLOCATED z-score → pulse
- [ ] Mobile (iOS Safari) renders correctly
- [ ] `/api/healthz` public, `/api/internal/health` token-auth
- [ ] README: local exec + env vars + Vercel deploy + KIS deferred note
- [ ] `.env.local` passes gitleaks
- [ ] Holiday mock → calendar correctness
- [ ] FX kimchi ≥ 5% → header badge
- [ ] GDR guard 2-tier triggers correctly
- [ ] Vercel production deploy reachable
- [ ] localStorage z-score works on deployed URL

---

**END of ULTRAPLAN v5 (FINAL)**

Reviewed by: Codex (R1+R2), Oracle (R1+R2), Momus (R2 only — R1 path-rejected), Metis (R1+R2)
Locked by user: 2026-05-09
