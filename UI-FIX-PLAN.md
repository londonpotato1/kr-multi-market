# UI Fix Plan v1 (post-screenshot)

> User reported 4 issues from live dashboard screenshot. This plan addresses each
> with root-cause analysis + concrete fix + QA criteria. To be reviewed by Codex
> before implementation.

---

## Issue 1: 빈값 표시 ("—") in venue rows

### Symptom (from screenshot)
- **NQ 카드**: HL XYZ "—" 표시 (HL에 xyz_NQ 없음)
- **EWY 카드**: YAHOO "—" 표시 (Yahoo 429)
- **SP500 카드**: YAHOO "—" 표시 (Yahoo 429)

### Root cause
`src/components/VenueRow.tsx:26-33` — `pp` undefined일 때 row를 **렌더하되 "—" 표시**:
```typescript
if (!pp) {
  return (
    <div className="venue-row venue-missing">
      <span className="venue-label">{SOURCE_LABELS[source]}</span>
      <span className="muted">—</span>
    </div>
  );
}
```

### Fix
**Return `null` instead of placeholder row**. 빈 venue는 카드에서 자체적으로 제외.

```typescript
if (!pp) return null;
```

### Files
- `src/components/VenueRow.tsx` — 6 line removal

### Side effect
- IndexCompareCard에서 호출하는 venue 리스트(HL/Yahoo/Binance)가 줄어들 수 있음
- e.g., NQ 카드는 Binance 1행만 표시 (HL, Yahoo 모두 hidden)
- SpreadRow는 venues < 2 일 때 자동 hidden (이미 IndexCompareCard에서 처리)

### QA
- NQ 카드: "HL XYZ —"와 "YAHOO —" 행 사라짐. Binance 1행만.
- EWY 카드: "YAHOO —" 행 사라짐. HL + Binance 2행만.
- SP500 카드: 같음. SpreadRow는 그대로 (HL + Binance 2 venues).

---

## Issue 2: Sources degraded — Yahoo 7 failures

### Symptom (from screenshot)
빨간 배너: **"⚠ Sources degraded: Yahoo (7 failures)"** 영구 표시 중.

### Root cause
1. Yahoo Finance API가 우리 IP를 영구 rate-limit (모든 v7/v8 endpoint 429)
2. `server/lib/health.ts`가 5초마다 실패 누적 → consecutiveFailures 무한 증가
3. `DegradedBanner.tsx`는 `consecutiveFailures > 3` 조건으로 banner 표시
4. **Yahoo는 영구 차단 상태이므로 banner가 영구 표시됨 (noise)**

### 실용적 분석
Yahoo가 fail해도 다른 venue가 cover:
- FX: `xyz_KRW` (Hyperliquid, fallback) — 작동 중
- EWY: `xyz_EWY` + `EWYUSDT` (HL + Binance) — 작동 중
- SP500: `xyz_SP500` + `SPYUSDT` — 작동 중
- NQ: `QQQUSDT` (Binance) — 작동 중

→ Yahoo는 **optional/best-effort** 소스. Banner의 essential alert에서 제외해야 함.

### Fix (3-step)

**Step 2A: Source 분류** — `shared/types/prices.ts` 또는 별도 const
```typescript
export const ESSENTIAL_SOURCES: SourceName[] = ['hyperliquid', 'naver', 'binance', 'upbit'];
export const OPTIONAL_SOURCES: SourceName[] = ['yahoo'];
```

**Step 2B: DegradedBanner 필터링** — `src/components/DegradedBanner.tsx`
```typescript
const ESSENTIAL = ['hyperliquid', 'naver', 'binance', 'upbit'];

const degraded = Object.entries(sourceHealth)
  .filter(([src]) => ESSENTIAL.includes(src))  // ← only essential sources
  .filter(([, h]) => h.consecutiveFailures > 3);
```

**Step 2C: Yahoo 영구 차단 표시** — Header SessionBadges 옆에 작은 "Yahoo: blocked" pill (optional, 정보용)
- 또는 internal/health에서만 detail 노출, UI는 silent

### Alternative considered (rejected)
- ❌ **Yahoo retry interval 늘리기** (5분에 한 번): 성능 개선이지만 banner 문제 해결 안 됨
- ❌ **Yahoo 호출 자체 제거**: 향후 IP 변경/bypass로 작동 가능성 있고, EWY/NQ Yahoo 데이터 가치 보존
- ❌ **임계값 5 → 100으로 상향**: hack, root cause 해결 X

### Files
- `src/components/DegradedBanner.tsx` — essential filter 추가 (~3 line)
- (옵션) `shared/types/prices.ts` — ESSENTIAL_SOURCES export

### QA
- Yahoo만 failing 상태 → DegradedBanner 안 보임 ✅
- HL/Naver/Binance/Upbit 중 하나가 4회+ 실패 → DegradedBanner 표시
- internal/health에서는 모든 source detail 그대로 (sysadmin 시각 보존)

---

## Issue 3: DISLOCATED — 모든 KRX 카드

### Symptom (from screenshot)
삼성/SK하이닉스/현대 모두 **⚠ warn DISLOCATED (5/100)** + premium +12.29%, +8.89%, +4.18%

### Root cause
1. **현재 토요일 18:27 KST** → KRX 마감 상태 (`naver.status === 'stale'`)
2. KRX 마감가는 금요일 종가 (₩268,500 Samsung)
3. HL xyz_SMSN은 24/7 trading → 현재 $206.23 (live)
4. Premium = (HL × FX - KRX) / KRX × 100 = +12.29% (자연스러운 정상 갭, 트레이딩 신호 아님)
5. SignalBadge는 `count < 100` 조건에서 absolute fallback 사용 → `|pct| > 3% → DISLOCATED`

### Issue analysis
**문제는 SignalBadge가 stale-vs-live 비교를 정상 시그널처럼 표시하는 것.**
- KRX live 시간(09:00-15:30 KST)에는 의미있는 비교
- KRX stale 시간에는 **"reference price drift"** 일 뿐, 트레이딩 시그널 아님

### Fix (2 layers)

**Step 3A: PremiumRow에 KRX status 인지** — `src/components/PremiumRow.tsx`
- props에 `krxStatus?: SourceStatus` 추가
- KRX `status === 'stale'` 시 SignalBadge 대신 "STALE comparison" dim 라벨 표시
- premium 수치는 그대로 표시 (정보 가치 있음)

**Step 3B: PriceCard에서 status 전달** — `src/components/PriceCard.tsx`
- `<PremiumRow ticker={ticker} premium={payload.premium} krxStatus={payload.naver?.status} />`

**Step 3C (선택): Absolute fallback threshold 완화** — `src/components/SignalBadge.tsx`
- 현재: 0.5% / 1.5% / 3%
- 변경: 1% / 3% / 5% (더 보수적)
- 이유: KRX live 시간에도 GDR 자체의 normal premium이 1-2% 가능

### Files
- `src/components/PremiumRow.tsx` — krxStatus prop + stale 분기
- `src/components/PriceCard.tsx` — pass naver.status
- `src/components/SignalBadge.tsx` — absolute fallback 임계값 조정 (선택)
- `src/App.css` — `.signal-stale` 스타일 추가

### QA
- 토요일 (KRX stale) → SignalBadge 자리에 "STALE" dim 라벨, 색 회색
- 월요일 14:00 KST (KRX live) → 정상 SignalBadge (정상/WATCH/TRADE/DISLOCATED)
- premium pctUsd 수치는 두 경우 모두 표시

---

## Issue 4: USD/KRW 카드 (둘째 줄) 제거

### Symptom (from screenshot)
둘째 줄에 USD/KRW 카드 단독으로 표시 (xyz_KRW $1,461.90). 헤더 우측 상단에 이미 USD/KRW + USDT/KRW + Kimchi pills 있어 **중복**.

### Root cause
`src/App.tsx:24` — `INDEX_TICKERS` 배열에 `{ ticker: 'usdkrw', label: 'USD/KRW', singleVenue: true }` 포함됨.

### Fix
**INDEX_TICKERS에서 usdkrw 항목 제거.**

```typescript
const INDEX_TICKERS: Array<{
  ticker: string;
  label: string;
  singleVenue: boolean;
}> = [
  { ticker: 'kospi200f', label: 'KOSPI 200 Futures', singleVenue: true },
  { ticker: 'ewy',       label: 'EWY (iShares Korea ETF)', singleVenue: false },
  { ticker: 'sp500',     label: 'S&P 500', singleVenue: false },
  { ticker: 'nq',        label: 'Nasdaq 100', singleVenue: false },
  // usdkrw removed — already shown in header FX pills
];
```

### Files
- `src/App.tsx` — 1 line removal

### QA
- 둘째 줄 (KOSPI200F/EWY/SP500/NQ) 만 표시
- 헤더 FX pills 그대로 (USD/KRW, USDT/KRW, Kimchi)
- /api/prices `tickers.usdkrw` 응답은 그대로 (FX 계산용 server-side로 사용 중, 클라이언트에서 카드로만 안 그림)

---

## Implementation Order

1. **Issue 4 first** (1 line, lowest risk) — USDKRW 카드 제거
2. **Issue 1** (VenueRow null) — 깔끔한 빈 행 처리
3. **Issue 2** (DegradedBanner essential filter) — Yahoo noise 제거
4. **Issue 3** (PremiumRow stale 인지) — DISLOCATED 정확도 개선

각 단계 commit + push. 단일 wave (sequential, 모두 다른 작은 파일).

## Total estimated effort
- 약 30-45분 (single agent, sequential)
- LOC change: ~30 lines across 5 files

## Risks / Open questions
1. **Yahoo permanent block**: IP 변경 (다른 컴퓨터, VPN) 시 작동 가능. 코드 retain은 OK. 다만 server cost 절약을 위해 long-term: 5분 backoff 도입 고려 (out of scope)
2. **Stale label 표시**: KRX after-hours 단일가 시간(15:30-16:00)에도 stale로 표시될 텐데, 그건 정상 (단일가는 정규가 다름)
3. **NQ에 venue 1개만 남음**: SpreadRow 자동 hidden인지 IndexCompareCard 코드 확인 필요 (이미 venues.length < 2 체크 있다고 가정)

## Codex review request
Please verify:
1. Issue 1: VenueRow null이 IndexCompareCard layout 깨뜨리지 않나?
2. Issue 2: ESSENTIAL_SOURCES 분류가 적절한가? Upbit이 essential이 맞나? (USDT-KRW 단일 정보)
3. Issue 3: stale 시 SignalBadge 숨기는 게 옳은 결정? premium 수치는 표시해도 OK?
4. Issue 4: 카드 제거가 다른 코드에 영향 없는지?
5. 누락된 issue 있나? (스크린샷 분석)
