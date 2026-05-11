# Dashboard Redesign — 한국 주식 Main Hierarchy + 가독성 Refactor

- **Date**: 2026-05-12
- **Version**: v2 (Codex review feedback fully applied)
- **Status**: Ready for writing-plans
- **Owner**: kr-multi-market (Korean × Bloomberg dashboard)
- **Target version**: v0.3.0

### Changelog v1 → v2 (Codex review)
- 🚨 B1: HL 누락 / `payload.hl===undefined` 폴백 정의 (§3.5)
- 🚨 B2: `fx.usdtKrw === 0 \|\| undefined` 폴백 정의 (§3.5)
- 🚨 B3: 레거시 CSS selector alias 계획 (§6.3)
- 🚨 B4: Wave 1 zero-change 검증 절차 (§12)
- ⚠️ §6 진입점 충돌 해소 + import 순서 명시 (§6.1)
- ⚠️ Premium / 24h `null` 처리 (§3.5)
- ⚠️ 키보드 `t` 강화 (textarea/contenteditable/modifier) (§9.2)
- ⚠️ WCAG CI gate — axe-core 자동화 (§9.3)
- ⚠️ PremiumGauge props 최소화 + generic 화 금지 (§7.3)
- ⚠️ Header/SectionTitle inline 유지 정책 (§7.4)
- ⚠️ 미사용 typography 토큰 제거 (§5.2)
- ⚠️ Wave 3 grep 검증 절차 (§12)
- ⚠️ §3.4 hover elevation 제거 (스코프 외)
- ⚠️ CSS 모듈화 별개 phase 가능성 명시 (§12)
- ⚠️ `shared/types` tsconfig path alias 검증 (§7.5)
- ⚠️ §7.2 pseudo-code TS 안전 표기 (`data?.tickers?.[ticker]`)
- ⚠️ 다크/라이트 screenshot smoke = 필수 격상 (§10)

---

## 1. Context & Motivation

현재 (`v0.2.0`) 대시보드는 다음 위계로 구성됨:

1. **Hero**: KOSPI 200 Futures 단일 거대 카드 (₩1,817,508, 80px+ 폰트)
2. **Sub**: `nightMode` (KRX 휴장) 분기로 Index 카드(EWY/SPX/NQ) 또는 한국 주식 테이블 중 하나가 위로
3. **Bottom**: 나머지 섹션 (한국 주식이 테이블 형태일 때 dense table 한 줄짜리)

사용자가 가장 자주 보는 정보 = **삼성전자/SK하이닉스/현대차의 HL→KRW 환산가 + Premium %** 인데, 이 정보가 가장 작은 영역(table row)에 들어가 있어 위계가 거꾸로다.

### Goals

1. **한국 주식 3종 (삼성전자/SK하이닉스/현대차)** 을 페이지 main hero 로 승격 — Bento 3-up 카드.
2. 각 stock 카드에서 **HL→KRW 환산가 (1순위)** + **Premium % (2순위)** 가 시각적 1·2 위계를 차지하도록 정보 레이아웃 재구성.
3. KOSPI 200 Futures, EWY, S&P 500, Nasdaq 100 은 **지수/ETF 섹션** 으로 강등 — 4-up compact bento.
4. **가독성 개선**: 타이포 스케일 정리, tabular-nums 일관 적용, 다크/라이트 contrast 검수.
5. **CSS 모듈화**: 1,245줄 단일 `App.css` 를 컴포넌트별 파일로 분할 (각 ≤ 200줄).
6. **다크/라이트 토글 시인성 개선**: 이미 구현된 `ThemeToggle` 의 위치/사이즈 강화 + 키보드 단축키 `t`.

### Non-Goals

- 데이터 소스 (Hyperliquid / Naver / Yahoo / Binance / Upbit) 변경 없음.
- 서버 API 응답 스키마 변경 없음 — `/api/prices` payload 그대로 사용.
- 새 종목 추가 없음 (3개 stock + 4개 index 유지).
- z-score 알고리즘 / SignalBadge 로직 변경 없음.
- v2 backlog (KIS, EWY NAV, order book depth 등) 미포함.

### 카파시 / AI slop 가드

- 1-use 추상화 금지: `<StockHero>` 컴포넌트는 3개 stock 에만 쓰이면 굳이 prop 일반화하지 않고 직접 컴포지션.
- 팩토리/매니저/헬퍼 양산 금지: 게이지 바는 inline JSX + CSS, 별도 컴포넌트 추출은 3회 이상 사용 시에만.
- "혹시 나중에" 토큰 추가 금지: 실제 사용처 있는 토큰만 정의.
- 사용자 미요청 기능 추가 금지: 차트/sparkline/알림 등은 별도 요청 시 별개 PR.

---

## 2. Visual Hierarchy

### 2.1 페이지 레이아웃 (전체)

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER                                                              │
│  ● kr-multi-market           USDT/KRW  Session badges    [☾◑☀] [↻]  │
│    Korean × Bloomberg                                                │
├──────────────────────────────────────────────────────────────────────┤
│  [DegradedBanner — only if source degraded]                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  한국 주식  · KRX × Hyperliquid                                        │
│  ┌─────────────┬─────────────┬─────────────┐                         │
│  │  삼성전자     │  SK하이닉스   │  현대차       │   ← MAIN (Bento 3-up)│
│  │  HERO        │  HERO        │  HERO        │                     │
│  └─────────────┴─────────────┴─────────────┘                         │
│                                                                      │
│  지수 / ETF  · Multi-venue                                            │
│  ┌────────┬────────┬────────┬────────┐                               │
│  │  EWY   │ S&P500 │ NASDAQ │ KOSPI  │     ← SUB (compact 4-up)     │
│  │        │        │   100  │  200F  │                              │
│  └────────┴────────┴────────┴────────┘                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 `nightMode` 분기 제거

- 현재 `App.tsx:26` 의 `nightMode = krxClosed` 분기 (Stock ↔ Index 순서 swap) → **삭제**.
- KRX 휴장 정보는 카드 내 `(closed)` 마커 + signal badge 의 `KRX CLOSED` 로 충분.
- 야간 시각적 신호가 필요하면 `한국 주식` 섹션 헤더 옆에 작은 `● NIGHT (KRX closed)` 칩 1개 표시 (위계 변경은 X, 상태 표시만 O).

---

## 3. Stock Hero Card (Bento 3-up)

### 3.1 카드 골격

```
┌──────────────────────────────────────────────────┐
│ 삼성전자                                    ●live │  TITLE ROW
│ samsung · 005930 · HL × KRX                     │  SUBTITLE
│                                                  │
│ ₩297,219                                         │  PRIMARY (HL→KRW)
│ HL → KRW · 24/7 발견가                            │  micro label
│                                                  │
│ ┌──────────┐                                     │
│ │ +4.23% ▲ │  PREMIUM (HOT)                     │  SECONDARY (Premium)
│ └──────────┘                                     │
│ ━━━━━━━━━━━━●━━━━━━━━━━                          │  gauge bar (-5%~+5%)
│ -5%        0%        +5%                         │
│                                                  │
│ KRX     ₩285,500   (closed)                      │  TERTIARY (KRX)
│ 24h     -2.32%                                   │
│                                                  │
│ ────────────────────────────────────────────     │  divider
│ SIGNAL  ⓘ KRX CLOSED · z=+1.4                    │  FOOTER
└──────────────────────────────────────────────────┘
```

### 3.2 정보 위계 (확정)

| 순위 | 정보 | 크기 / 무게 | 색 |
|---|---|---|---|
| 1 | HL → KRW 환산가 (₩297,219) | 52px / 700 / tabular-nums | `--text` |
| 2 | Premium % (+4.23% ▲) | 36px / 600 + gauge bar | `--up` / `--down` / `--text-dim` |
| 3 | KRX 가격 + 24h Δ | 16px / 500 / mono | `--text-dim` |
| 4 | Signal badge + KRX status | 11px / pill | semantic per state |

> **Meta (Vol/Funding/OI) 제거**: 현재 PriceCard 가 hero 모드에서 표시하던 24h Vol / Funding 8h / OI 는 stock 카드에서 **삭제** (정보 위계상 4순위 = 노이즈). 야간 가격발견 + premium 신호가 stock 카드의 본질. 필요 시 별도 detail view 로 v2 backlog. (카파시 룰: 사용자 미요청 정보 추가 금지)

### 3.3 Premium Gauge

- Range: `-5%` ~ `+5%` (clamp). 절대값 5% 초과 시 해당 끝 (-5% 또는 +5%) 에 dot + glow + `OVER` 마이크로 라벨.
- Track: `--gauge-track` (다크: `rgba(255,255,255,0.06)` / 라이트: `rgba(0,0,0,0.06)`).
- Fill direction: 0% 기준 양/음방향 색 분리.
- Tier 색 (premium 절대값):
  - `|p| < 1%` → `--premium-cool` (neutral celadon)
  - `1 ≤ |p| < 3%` → `--premium-warm` (hanji beige)
  - `|p| ≥ 3%` → `--premium-hot` (juhwang orange + 약한 glow)
- 접근성: `role="meter"`, `aria-valuemin="-5"`, `aria-valuemax="5"`, `aria-valuenow={pct}`, `aria-label="premium ${pct}%"`.

### 3.4 카드 인터랙션

- **Flash on price change**: 기존 `flash-up`/`flash-down` 0.8s 애니메이션 유지. **글로우 강도/색은 현행 그대로 유지** (v1 의 "+20%" 강화 항목은 스코프 외로 삭제 — 사용자 미요청).
- **Hover**: 현행 `.card:hover` 동작 그대로 유지. **신규 elevation 변경 없음** (v1 의 elevation +1 항목 삭제 — 스코프 외).
- **Click/Tap**: v0.3.0 에선 액션 없음 (별도 detail view 는 v2 backlog).

### 3.5 Null / Fallback / Degraded 상태 (Codex B1·B2·⚠️3 반영)

각 데이터 필드 누락 시 카드는 다음 규칙으로 렌더한다. **신규 컴포넌트 (`StockHeroCard`) 의 단위 테스트가 이 표를 1:1 로 커버해야 한다.**

| 필드 | 조건 | 표시 동작 |
|---|---|---|
| `payload === undefined` | 데이터 로드 전 | `loading-card` 골격 (현행 `.card-loading` 스타일 재사용) — 3개 위치 placeholder dash `—` |
| `payload.hl === undefined` | HL 다운 / 폴백 실패 | PRIMARY 영역에 `—` + 라벨 `HL UNAVAILABLE` (text-dim), PREMIUM gauge `disabled` 상태 (track 만 표시, fill 없음, `aria-disabled="true"`), KRX/24h 줄은 그대로 표시 (KRX 만 있는 카드도 가독성 유지) |
| `fx.usdtKrw === 0 \|\| undefined` | 환율 없음 | HL→KRW 환산 불가 → PRIMARY 를 `$xxx USD` (HL native) 로 fallback 표시 + 라벨 `KRW UNAVAIL — USD shown`. degraded source banner 도 이미 표시되므로 카드 내 중복 경고는 X |
| `payload.premium?.pctUsd == null` | KRX 마감 또는 계산 불가 | 36px premium 숫자 영역에 `—` + tier 색 적용 안 함 (neutral text-dim), gauge bar 는 fill 0% (center dot) + `aria-valuenow` 속성 자체를 **omit** (clamp 대신 omit 채택, `role="meter"` 만 유지) + 시각 라벨 `N/A` |
| `hl.change24hPct == null` | 24h 데이터 없음 | 24h 줄 `—` |
| `payload.naver?.status === 'stale'` | KRX 휴장 | KRX 가격 옆 `(closed)` 마커 (현행 동작 유지), signal badge `KRX CLOSED` (현행 유지) |
| `payload.naver === undefined` | KRX 데이터 자체 없음 | KRX 줄 `—` (라벨은 유지) |

**원칙**: 어떤 필드가 빠지더라도 카드 골격은 무너지지 않는다 (height, alignment 유지). 모든 빈 값은 `—` (em-dash) 로 통일.

---

## 4. Index/ETF Compact Card (4-up sub)

### 4.1 카드 골격 (간략)

```
┌────────────────────┐
│ EWY            ewy │
│ ₩283,945           │   ← PRIMARY (24px)
│ MAX SPREAD +0.01%  │
│ HL  $193.16  -1.6% │   ← venue rows (compact)
│ BIN $193.17  -1.1% │
└────────────────────┘
```

- 폭: stock card 의 ~70% (60px hero 폰트 → 24px 헤드라인).
- HL / Binance / Yahoo venue rows 는 한 줄씩 (현재 `VenueRow` 컴포넌트 그대로 reuse).
- `KOSPI 200 Futures` 도 동일 골격 — 4번째 슬롯 차지. venue 가 HL 하나뿐이라 venue row 1개만 표시.

---

## 5. Design Tokens

### 5.1 신규 토큰

```css
:root, [data-theme="dark"] {
  /* Premium gauge */
  --gauge-track:    rgba(255,255,255,0.06);
  --gauge-positive: var(--up);
  --gauge-negative: var(--down);

  /* Premium tier */
  --premium-cool:   var(--celadon);
  --premium-warm:   var(--hanji);
  --premium-hot:    var(--juhwang);

  /* 가독성 보정 (현재 #E8E4DA → 휘도 +12%) */
  --text: #F2EDE2;
}

[data-theme="light"] {
  --gauge-track:    rgba(0,0,0,0.06);
  --gauge-positive: var(--up);
  --gauge-negative: var(--down);
  --premium-cool:   var(--celadon);
  --premium-warm:   var(--hanji);
  --premium-hot:    var(--juhwang);
  /* --text: #1A1815 그대로 (이미 충분한 contrast) */
}

> Typography size 토큰은 § 5.2 의 `--ts-*` 묶음으로 단일화. 중복 정의 금지.
```

### 5.2 Typography scale (확정 — 사용처 있는 토큰만, ⚠️8 반영)

> 카파시 룰: 토큰은 **실제 사용처가 있을 때만** 정의. 미사용 토큰 0개 유지를 위해 PR 단계에서 `grep -r '--ts-' src/` 로 사용처 확인 의무.

| 토큰 | 크기 | 무게 | font-family | numeric | 사용처 |
|---|---|---|---|---|---|
| `--ts-hero-price` | 52px | 700 | Pretendard | tabular | `StockHeroCard` PRIMARY |
| `--ts-hero-premium` | 36px | 600 | Pretendard | tabular | `StockHeroCard` SECONDARY |
| `--ts-card-title` | 18px | 600 | Pretendard | — | `StockHeroCard` + `IndexCompactCard` title row |
| `--ts-subtitle` | 11px | 500 uppercase tracking-wider | Pretendard | — | 카드 subtitle (ticker · code · venue) |
| `--ts-meta` | 15px | 400 | JetBrains Mono | tabular | `StockHeroCard` TERTIARY (KRX/24h) |
| `--ts-index-headline` | 24px | 600 | Pretendard | tabular | `IndexCompactCard` PRIMARY |

**삭제된 v1 토큰**: `--ts-micro-label` (10px) — gauge 영역에서만 1회 사용 → inline `font-size: 10px` 로 유지, 토큰화 안 함 (1-use 추상화 금지).

전역 `font-variant-numeric: tabular-nums` 를 모든 `.num` 클래스에 보장 (현재 일부 누락 가능).

### 5.3 라이트 모드 contrast 검수

- WCAG AA 4.5:1 (본문), 3:1 (대형 텍스트) 통과 확인 필수.
- 현재 라이트 `--text-dim: #6B6557` on `--bg-2: #FFFFFF` = contrast ~5.2:1 (통과).
- 현재 라이트 `--text-muted: #9A9385` on `--bg-2: #FFFFFF` = contrast ~3.0:1 (대형 텍스트만 가능, 본문 사용 시 fail) → 본문에선 `--text-dim` 사용 강제, `--text-muted` 는 label only.
- 검증: 구현 시 axe-core 또는 수동 측정.

---

## 6. CSS Modularization

### 6.1 새 디렉토리 + 진입점 + import 순서 (⚠️1·⚠️2 반영)

**진입점 확정**: `src/App.css` 는 진입점 역할 그대로 유지하되, **내용물은 @import 만** 남긴다. 별도 `src/styles/index.css` 진입점은 만들지 않는다 (혼란 방지). `main.tsx` 의 `import './App.css'` 는 변경 없음.

```
src/App.css                  # 진입점 — @import 만 (5~20줄, cascade 순서 명시)

src/styles/
├── tokens.css               # :root + [data-theme] (현재 1~250)
├── base.css                 # reset, html/body, container, scrollbar
├── layout.css               # grid, sections, app-header
├── typography.css           # ts-* utility classes + .num
├── utilities.css            # .change-up/down, .flash-up/down
├── components/
│   ├── card-base.css        # 공통 .card, .card-loading, .card-hero (legacy alias)
│   ├── stock-hero.css       # ★ 신규 (Bento 3-up main)
│   ├── premium-gauge.css    # ★ 신규
│   ├── index-compact.css    # 강등된 4-up 지수/ETF
│   ├── fx-header.css
│   ├── session-badges.css
│   ├── signal-badge.css
│   ├── theme-toggle.css
│   ├── degraded-banner.css
│   └── premium-row.css
└── legacy.css               # ★ 신규 — Wave 1 동안만 존재하는 alias 셸 (§6.3 참조)
```

**App.css import 순서 (cascade 안전 보장, 절대 바꾸지 말 것)**: tokens → base → typography → layout → components/* → utilities → legacy 순으로 `@import` 한다. components 내부 순서는 알파벳 또는 의존 관계 순.

### 6.2 마이그레이션 전략 (Wave 1 zero-change 검증, B4 반영)

**Step 0 — Baseline 채증** (Wave 1 시작 전 필수):
1. 다크/라이트 양 테마에서 현재 페이지 스크린샷 캡처 → `docs/superpowers/specs/baseline/2026-05-12-{dark,light}.png` 저장
2. 현재 컴포넌트에서 사용 중인 클래스 inventory 추출: `grep` 으로 `src/components/*.tsx` 의 `className` 값을 수집하여 `baseline/component-classes.txt` 저장
3. 현재 `App.css` 의 셀렉터 inventory 추출: `grep` 으로 클래스 셀렉터 목록을 `baseline/css-selectors.txt` 저장

**Step 1**: `src/styles/tokens.css` 분리 (현재 1~250 잘라 이동) — App.css 에서 `@import` 로 연결.
**Step 2**: 나머지 모듈 분리. 각 분리 후 빌드 + vitest 통과 + Step 0 의 스크린샷 diff 비교.
**Step 3**: 분리 후 `App.css` 는 `@import` 만 남기는 진입점으로 정리.
**Step 4**: Wave 1 종료 조건 = (a) build 통과 (b) vitest 통과 (c) 다크/라이트 스크린샷 diff 0 (d) 컴포넌트 className inventory diff 0 (e) CSS 셀렉터 inventory diff 0.

각 모듈 ≤ 200줄 목표. 초과 시 sub-module 로 다시 분할.

### 6.3 레거시 CSS selector alias 계획 (B3 반영)

현 코드의 다음 클래스는 새 컴포넌트 도입 (Wave 2~3) 시점에 점진적으로 제거되지만, **Wave 1 (모듈화) 단계에선 동작 동일성을 보장하기 위해 그대로 유지** 한다.

| 레거시 클래스 | 현재 사용처 | Wave 1 동작 | 최종 처리 (Wave 4) |
|---|---|---|---|
| `.card-hero` | `PriceCard hero` mode (KOSPI 전용) | `card-base.css` 안에 그대로 유지 | 삭제 (StockHeroCard 가 hero prop 안 씀) |
| `.dense-stocks` / `.dense-stocks-wrapper` | App.tsx 의 stock table wrapper | `legacy.css` 로 이동 | 삭제 (table → bento 전환 완료) |
| `.stock-row` | PriceCard row mode | `legacy.css` | 삭제 (Wave 3 끝) |
| `.bento` | App.tsx 의 index grid | 그대로 + `.bento-3up` / `.bento-4up` 신규 클래스 병행 | `.bento` 단독 사용처 제거 후 삭제 |
| `.hero-section` / `.stock-section` / `.index-section` | App.tsx section wrapper | `.stocks-section` / `.indices-section` 으로 rename (Wave 2) | rename 완료 후 legacy 삭제 |
| `.night-badge` | nightMode 표시 | nightMode 분기 제거 시 같이 삭제 (Wave 2) | — |
| `.krx-row` / `.krx-label` / `.krx-value` / `.krx-status` | PriceCard hero 내부 KRX 행 | `legacy.css` | 삭제 (Wave 3 끝) |

**원칙**:
- Wave 1 에선 **신규 클래스 이름을 도입하지 않는다** — 순수 파일 이동만 수행. cascade 안전.
- Wave 2~3 신규 컴포넌트 도입 시에만 신규 클래스 (`stock-hero`, `index-compact`, `bento-3up`, `bento-4up`, `premium-gauge` 등) 추가.
- Wave 4 끝에 `legacy.css` 삭제 + grep 으로 미참조 확인.

---

## 7. Component Tree Changes

### 7.1 신규 / 변경 컴포넌트

```
src/components/
├── App.tsx                        [변경] section 순서 재배치, nightMode 분기 제거
├── StockHeroCard.tsx              [신규] Bento 3-up main (PriceCard renderAs='row' 대체)
├── IndexCompactCard.tsx           [신규] 강등된 지수/ETF compact (IndexCompareCard slim 버전)
├── PremiumGauge.tsx               [신규] -5~+5% 게이지 바 (3회 사용 → 컴포넌트화 정당)
├── PriceCard.tsx                  [폐기] StockHeroCard + IndexCompactCard 가 모든 케이스 대체 (Wave 3 끝에 삭제)
├── IndexCompareCard.tsx           [폐기] IndexCompactCard 가 대체 (SP500 10x ratio 로직 이전 후 Wave 3 끝에 삭제)
├── FxHeader.tsx                   [유지]
├── SessionBadges.tsx              [유지]
├── ThemeToggle.tsx                [유지 + 스타일 prominence ↑ + 키보드 't' 단축키 추가]
├── PremiumRow.tsx                 [유지, StockHeroCard 내부에서 calc 만 reuse]
├── VenueRow.tsx                   [유지, IndexCompactCard 에서 reuse]
├── SpreadRow.tsx                  [유지]
├── SignalBadge.tsx                [유지]
└── DegradedBanner.tsx             [유지]
```

### 7.2 `App.tsx` 변경 핵심

```tsx
// 변경 후 (의사 코드 — Header / SectionTitle 은 inline JSX 로 유지, 추출 X)
//  ⚠️ Codex: data?.tickers?.[ticker] 로 optional chaining 끝까지 (TS strict 안전)
export default function App() {
  const { data, error, isLoading } = usePrices();
  const krxClosed = !!data?.session && !data.session.krx;

  return (
    <div className="container">
      <header className="app-header">
        {/* 기존 brand + meta + FxHeader + SessionBadges + ThemeToggle 인라인 유지 */}
      </header>
      <DegradedBanner sourceHealth={data?.sourceHealth} />

      <section className="stocks-section">
        <h2 className="section-title">
          한국 주식 <span className="section-subtitle">KRX × Hyperliquid</span>
          {krxClosed && <span className="night-tag">● KRX CLOSED</span>}
        </h2>
        <div className="bento-3up">
          {STOCK_TICKERS.map(({ ticker, label }) => (
            <StockHeroCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers?.[ticker]}
              fx={data?.fx}
            />
          ))}
        </div>
      </section>

      <section className="indices-section">
        <h2 className="section-title">지수 / ETF <span className="section-subtitle">Multi-venue</span></h2>
        <div className="bento-4up">
          {[...INDEX_TICKERS, KOSPI_TICKER].map(({ ticker, label }) => (
            <IndexCompactCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers?.[ticker]}
              fx={data?.fx}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- `HeroSection` (KOSPI200 hero) 삭제.
- `StockSection` / `IndexSection` 의 nightMode 순서 swap 삭제.
- KOSPI200 은 `INDEX_TICKERS` 의 4번째 요소로 합류.
- **`Header` / `SectionTitle` 컴포넌트 추출 안 함** (§7.4 정책).
- TS strict 안전: `data?.tickers?.[ticker]` — `data?.tickers` 가 `undefined` 일 때 `[ticker]` 접근 안 함.

### 7.3 PremiumGauge props 최소 정책 (⚠️6 반영)

generic gauge 프레임워크로 팽창 금지. **단 하나의 책임**: premium % 를 -5~+5 범위에 그린다.

```tsx
// 정확히 이 props 만. 추가 prop 금지.
type Props = {
  pctUsd: number | null;   // -5~+5 clamp 는 컴포넌트 내부에서
  tier: 'cool' | 'warm' | 'hot' | 'na';  // 미리 계산된 tier (StockHeroCard 가 결정)
};
```

- `min`/`max`/`step`/`format`/`size` 등 일반화 props 금지.
- 다른 게이지 (예: 24h volatility, funding gauge) 등장 시 **별개 컴포넌트** 만들 것 — 기존 PremiumGauge 에 prop 추가 금지.
- 외부 라이브러리 (react-gauge-chart 등) 도입 금지 — 24줄 이내 inline SVG/CSS 로 충분.

### 7.4 Header / SectionTitle 추출 금지 정책 (⚠️7 반영)

- `App.tsx` 의 header (`brand + meta + FxHeader + SessionBadges + ThemeToggle` 묶음) → 현재 1회 사용. **inline JSX 유지** (별도 `<Header />` 추출 안 함).
- section title (`<h2>` 묶음) → stocks/indices 2회 사용이지만, 구조가 단순 (3줄 JSX) 하고 props 차이가 적어 **inline 반복 유지** (DRY 압박으로 추출하지 않음 — 카파시 룰).
- 3회 이상 반복되거나 로직이 복잡해질 때만 추출 (예: v0.4 이상에서 dynamic section 추가 시).

### 7.5 TypeScript path alias 검증 (⚠️12 반영)

- 현행 `@shared/types/prices.js` 임포트는 `tsconfig.app.json` 의 `paths` 설정에 의존. Wave 1 시작 전 다음을 확인:
  1. `tsconfig.app.json` 에 `"paths": { "@shared/*": ["./shared/*"] }` 존재
  2. `vite.config.ts` 의 `resolve.alias` 에 동일 매핑 존재
  3. 신규 컴포넌트 (`StockHeroCard`, `IndexCompactCard`, `PremiumGauge`) 도 동일 임포트 패턴 사용
- 누락 시 Wave 1 의 Step 0 baseline 단계에서 `tsc --noEmit` 으로 검출되어야 함.

---

## 8. Responsive

| Breakpoint | Stock bento | Index bento |
|---|---|---|
| ≥ 1280px | 3-col, gap 24px | 4-col, gap 16px |
| 960~1279px | 3-col, gap 16px | 2×2-col, gap 16px |
| 640~959px | 2-col + 1 stack | 2-col |
| < 640px | 1-col stack | 1-col stack |

- 카드 내부 폰트 사이즈는 `clamp()` 로 축소 (e.g., `clamp(36px, 4vw, 52px)` for hero price).
- `min-height` 으로 카드 비율 가드 (mobile 에서 카드가 1줄짜리로 찌그러지지 않도록).

---

## 9. Accessibility

### 9.1 시각 / 의미
- **색만으로 정보 전달 금지**: premium 양/음은 ▲/▼ 화살표 강제.
- **Gauge bar**: `role="meter"` + `aria-valuemin="-5"` + `aria-valuemax="5"` + `aria-valuenow={pct}` (단 null 일 땐 `aria-valuenow` 속성 자체 omit, `role="meter"` 만 유지 — §3.5 표 참조).
- **Focus ring**: 모든 interactive 요소에 `:focus-visible` 명확한 outline (현재 일부 누락 가능 → 점검).
- **Tab order**: header (toggle) → stock cards → index cards (DOM 순서 그대로).
- **Live region**: 에러/degraded 알림은 `aria-live="polite"` (현재 DegradedBanner 검증).

### 9.2 Theme toggle 키보드 단축키 `t` (⚠️4 반영)

```tsx
// 단축키 핸들러 가드 (정확한 규칙)
function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return true;          // modifier 조합은 무시
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}
```

- 단축키: 쉬프트 무관 소문자 `t` 만 처리 (대문자 T 도 동일 동작 — modifier 없는 단순 키).
- `<input>`, `<textarea>`, `<select>`, `[contenteditable]` 포커스 시 무시.
- Alt/Ctrl/Meta 조합 시 무시 (브라우저/OS 단축키 보호).
- `aria-pressed` 사용 또는 `aria-label="Toggle theme. Current: dark"` 유지.
- 단축키 등록은 `document.addEventListener('keydown', ...)` — cleanup 필수 (React `useEffect` return).

### 9.3 WCAG AA contrast CI gate (⚠️5 반영)

- **자동화**: vitest + `axe-core` (또는 `vitest-axe`) 로 `App.tsx` 렌더 결과를 다크/라이트 양 테마에서 검사. CI 의 `pnpm test` 단계에 포함하여 PR merge 차단 게이트로 사용.
- **수동 점검 항목** (CI 자동화로 못 잡는 영역):
  - `--text-muted` 가 본문 텍스트에 사용되지 않았는지 (label only 정책) — `grep` 으로 사용처 검토.
  - hover/focus/active 상태에서도 대비 유지되는지 (axe-core 가 정적 상태만 검사).
- **목표**: WCAG AA 4.5:1 (본문), 3:1 (대형 24px+ 텍스트). 라이트 모드 `--text-muted: #9A9385` on white = ~3.0:1 이므로 본문 사용 금지 (label only).

---

## 10. 검증 기준 (이 spec 의 완료 정의)

1. `pnpm build` 통과 (TS strict + Vite build).
2. `pnpm test` 통과 — 기존 `PriceCard` / `IndexCompareCard` 테스트는 새 컴포넌트 테스트로 갱신.
3. 신규 `StockHeroCard` / `IndexCompactCard` / `PremiumGauge` 단위 테스트 추가:
   - loading state (`payload === undefined`)
   - HL 누락 (`payload.hl === undefined`)
   - FX 누락 (`fx.usdtKrw === 0 \|\| undefined`)
   - premium `null` (KRX 마감)
   - 24h `null`
   - KRX 휴장 마커 (`stale`)
   - premium tier 분류 (cool/warm/hot/na)
   - gauge clamp (절대값 5% 초과 시 OVER 라벨)
4. **시각 회귀 (필수, ⚠️14 반영)**: 다크/라이트 양 모드에서 3개 stock + 4개 index 모두 스크린샷 캡처 후 baseline 과 diff 비교. PR 본문에 양 모드 스크린샷 첨부 의무. (별도 playwright/puppeteer 도입 없이 수동 스크린샷 + diff 도구로 충분 — 그러나 캡처 자체는 필수)
5. 라이트 모드 WCAG AA contrast 통과 (axe-core 자동화 CI gate — §9.3).
6. `App.css` 단일 파일 ≤ 50줄 (@import 만), 각 sub-module ≤ 200줄.
7. nightMode 분기 코드 완전 제거 (`grep` 으로 `nightMode` 0건 확인).
8. 키보드 단축키 `t` 작동 (다크↔라이트↔시스템 순환). `<input>`/`<textarea>`/`<select>`/`[contenteditable]`/modifier 조합에서 무시되는지 단위 테스트.
9. **Wave 4 끝**: `legacy.css` 삭제 + 레거시 클래스 (`.dense-stocks`, `.stock-row`, `.bento` 단독, `.hero-section`, `.night-badge`, `.krx-row` 등) 사용처 0건 (`grep` 검증).
10. 신규 토큰 `grep -r '--ts-' src/` 결과 = §5.2 표 정의된 토큰만 (미사용 0개).

---

## 11. Risks & Open Questions

| # | Risk | Mitigation |
|---|---|---|
| R1 | CSS 1245줄 → 10 파일 분할 중 cascade 순서 변경으로 시각 회귀 | §6.1 import 순서 + §6.2 Wave 1 Step 0 baseline 스크린샷 diff |
| R2 | `IndexCompareCard` 삭제 시 SP500 reference ratio 10x 로직 누락 | IndexCompactCard 에서 동일 ratio + `krw-conversions` 라벨 보존, 테스트 케이스 마이그레이션 |
| R3 | Premium gauge 컴포넌트 추가로 인한 yet-another-abstraction | 3회 사용 시에만 정당화 (3개 stock 카드 = 3회) ✓ + §7.3 props 최소 정책 |
| R4 | Hero 폰트 52px 가 mobile 에서 overflow | `clamp(36px, 8vw, 52px)` + `word-break: keep-all` |
| R5 | 한국어 라이트 모드 가독성 검수가 주관적 | axe-core CI gate (§9.3) + 사용자 시각 confirm (smoke 단계) |
| R6 | HL 또는 FX 누락 시 카드 깨짐 | §3.5 표의 7가지 null/degraded 케이스 단위 테스트로 강제 |
| R7 | Wave 1 모듈화 자체가 별개 리팩터로 일정 지연 위험 | §12 Wave 1 을 별개 phase 로 분리 가능 (사용자 결정 후 writing-plans 단계에서 확정) |
| R8 | 키보드 `t` 가 사용자 텍스트 입력 방해 | §9.2 `shouldIgnoreShortcut` 가드 + 단위 테스트 강제 |
| R9 | `@shared/types` path alias 누락으로 신규 컴포넌트 import 실패 | §7.5 Step 0 에서 tsconfig + vite alias 사전 검증 |

### Open Questions
- **Q-A**: Wave 1 (CSS 모듈화) 를 별개 phase 로 분리할 것인가, v0.3.0 안에 묶을 것인가? Codex 권장 = 분리. 사용자 결정 필요. (writing-plans 단계에서 phase 분할 시 결정)

---

## 12. Implementation Wave 구상 (writing-plans 단계로 넘김)

> 이 spec 승인 후 `writing-plans` 스킬이 정식 phase 분할 후 PLAN 작성. 여기선 큰 그림만:

- **Wave 1**: CSS 모듈화 + 신규 토큰 추가 (시각 동일, 기능 동일) — 회귀 없는 리팩토링
  - **Wave 1 종료 조건** (§6.2 Step 4): build / test / 다크·라이트 스크린샷 diff 0 / 컴포넌트 className inventory diff 0 / CSS 셀렉터 inventory diff 0
  - Step 0 의 baseline 채증 (스크린샷 + selector inventory) 가 사전 의무
- **Wave 2**: `StockHeroCard` + `PremiumGauge` 신규 컴포넌트 + App.tsx 위계 재배치 (한국 주식 main 으로 승격) + nightMode 분기 제거
- **Wave 3**: `IndexCompactCard` 신규 + KOSPI 강등 (4번째 슬롯) + **`PriceCard` + `IndexCompareCard` 삭제 전 grep 검증**:
  ```
  # 삭제 직전 의무 확인
  grep -rn "from.*PriceCard"      src/ --include='*.tsx' --include='*.ts'
  grep -rn "from.*IndexCompareCard" src/ --include='*.tsx' --include='*.ts'
  # 결과 = 삭제 대상 파일 자체 + 테스트 파일 외 0건이어야 함
  ```
- **Wave 4**: ThemeToggle prominence + 키보드 단축키 `t` (§9.2 가드 포함) + 라이트 모드 contrast axe-core 검수 + `legacy.css` 삭제 + 레거시 클래스 0건 확인
- **Wave 5**: 테스트 / 접근성 / 문서 정리 + smoke (브라우저 다크/라이트 양 모드 육안 확인 + PR 스크린샷 첨부)

각 Wave 끝마다 build + test + integration-audit (unused exported) 통과.

### Wave 1 분리 옵션 (Codex 권장, ⚠️11 반영)

CSS 1245줄 모듈화 자체가 별개 대형 리팩터이므로 **Wave 1 만 단독 phase 로 분리** 가능. 분리 시:
- Phase A (Wave 1 단독): CSS 모듈화 — visual zero-change PR — 작고 안전한 merge
- Phase B (Wave 2~5): 위계 재배치 + 신규 컴포넌트 + ThemeToggle + cleanup

장점: PR 크기 감소, 회귀 발생 시 격리 가능, 코드리뷰 부담 감소.
단점: 두 번에 걸친 머지 일정.

**결정 권한**: writing-plans 단계에서 사용자가 분리 / 단일 phase 중 선택.

---

## 13. References

- 현재 `src/App.css` (1,245 lines) — 토큰 + 컴포넌트 스타일 monolith
- 현재 `src/components/PriceCard.tsx` — hero / row 양형 모드 (둘 다 폐기)
- 현재 `src/components/IndexCompareCard.tsx` — 4-up compact 으로 슬림화
- Hyperliquid xyz dex symbol list — `xyz_SMSN`, `xyz_SKHX`, `xyz_HYUNDAI`, `xyz_KR200`, `xyz_EWY`, `xyz_SP500`
- 디자인 영감 (Korean × Bloomberg 테마 유지): 한지 베이지 + 청자 + 주홍 + 황금 토큰 그대로 사용
