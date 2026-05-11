# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한국 주식 3종을 페이지 main hero (Bento 3-up) 로 승격하고, KOSPI200/지수를 sub 로 강등하며, 1,245-line `App.css` 를 컴포넌트별 모듈로 분할하고, 다크/라이트 토글 시인성을 개선한다. 정보 위계 = HL→KRW (1순위) + Premium% (2순위) + KRX (3순위).

**Architecture:** 2-Phase 분리. Phase A 는 시각 zero-change 의 순수 CSS 모듈화 (1245줄 → 10 모듈 + legacy.css shell). Phase B 는 신규 `StockHeroCard` / `IndexCompactCard` / `PremiumGauge` 컴포넌트 도입과 `App.tsx` 위계 재배치 + `nightMode` 분기 제거 + 레거시 컴포넌트 (`PriceCard`, `IndexCompareCard`) 삭제.

**Tech Stack:** Vite 8 + React 19 + TypeScript 6 (strict) + Express 4 + Vitest 4 + happy-dom + SWR 2 + Pretendard/JetBrains Mono. pnpm 11. No Tailwind — 순수 CSS variables (Korean × Bloomberg 토큰: 한지/청자/주홍/황금).

**Spec reference:** `(spec dir)/2026-05-12-dashboard-redesign-design.md`

**Path 단축 표기**: 본 plan 에서 자주 등장하는 디렉토리는 다음 약식으로 표기:
- `(spec dir)` = `docs/superpowers/specs`
- `(base)` = `docs/superpowers/specs/baseline` (예시/example/sample/template 디렉토리; baseline 채증 산출물 저장소)

---

## File Inventory

### Phase A (Wave 1) — 신규 생성 (CSS 모듈화 example)

```
src/App.css                              [REWRITE] 진입점, @import only (~20 lines)
src/styles/tokens.css                    [CREATE] :root + dark/light theme tokens
src/styles/base.css                      [CREATE] reset, html/body, container
src/styles/typography.css                [CREATE] .num + ts-* utility
src/styles/layout.css                    [CREATE] grid, sections, app-header
src/styles/utilities.css                 [CREATE] .change-up/down, .flash-up/down
src/styles/legacy.css                    [CREATE] alias shell (Wave 4 끝 삭제)
src/styles/components/card-base.css      [CREATE]
src/styles/components/fx-header.css      [CREATE]
src/styles/components/session-badges.css [CREATE]
src/styles/components/signal-badge.css   [CREATE]
src/styles/components/theme-toggle.css   [CREATE]
src/styles/components/degraded-banner.css[CREATE]
src/styles/components/premium-row.css    [CREATE]

(base)/dark.png                          [CREATE] sample screenshot (dark theme)
(base)/light.png                         [CREATE] sample screenshot (light theme)
(base)/component-classes.txt             [CREATE] test snapshot of className values
(base)/css-selectors.txt                 [CREATE] sample of selectors in App.css
(base)/README.md                         [CREATE]
```

### Phase B (Wave 2~5) — 신규 컴포넌트 + 정리

```
src/components/StockHeroCard.tsx         [CREATE] Bento 3-up main card
src/components/StockHeroCard.test.tsx    [CREATE]
src/components/IndexCompactCard.tsx      [CREATE] 4-up sub card (KOSPI 포함)
src/components/IndexCompactCard.test.tsx [CREATE]
src/components/PremiumGauge.tsx          [CREATE] -5~+5% inline SVG/CSS gauge
src/components/PremiumGauge.test.tsx     [CREATE]
src/styles/components/stock-hero.css     [CREATE]
src/styles/components/premium-gauge.css  [CREATE]
src/styles/components/index-compact.css  [CREATE]

src/App.tsx                              [MODIFY] 위계 재배치, nightMode 제거
src/components/ThemeToggle.tsx           [MODIFY] 키보드 `t` shortcut + guard
src/components/ThemeToggle.test.tsx      [MODIFY] 새 키보드 테스트 추가

src/components/PriceCard.tsx             [DELETE] Wave 3 끝
src/components/PriceCard.test.tsx        [DELETE 또는 마이그레이션]
src/components/IndexCompareCard.tsx      [DELETE] Wave 3 끝
src/components/IndexCompareCard.test.tsx [DELETE 또는 마이그레이션]
src/styles/legacy.css                    [DELETE] Wave 4 끝

package.json                             [MODIFY] devDep: vitest-axe (Wave 4)
src/tests/a11y.test.tsx                  [CREATE] axe-core WCAG gate (Wave 4)
src/tests/setup.ts                       [CREATE] vitest-axe matcher (Wave 4)
```

---

## Agent Workflow

> 실행 방식: **subagent-driven** 모드 기준 (inline 모드라도 prompt template / 카파시 가드는 동일하게 적용).

### Per-Task Agent 매핑

| Task | 1차 agent (구현) | 2차 agent (검증) | Codex 체크포인트 | 병렬 |
|---|---|---|---|---|
| A0 | bash 직접 (스크린샷 + grep) | — | — | — |
| A1 | coder | quick-validator + selector diff | — | A0 후 |
| A2 | coder | quick-validator + selector diff | — | A1 후 (sequential — cascade) |
| A3 | coder | quick-validator + selector diff | — | A2 후 |
| A4 | coder | quick-validator + diff + 시각 육안 | — | A3 후 |
| A5 | coder | quick-validator | — | A4 후 |
| A6 | bash 직접 (검증 only) | — | **✅ Codex #1** (Phase A 종료 PR 리뷰) | A5 후 |
| B1 PremiumGauge | coder (TDD) | tester → code-reviewer | — | A6 후, B2/B3 와 병렬 가능 |
| B2 StockHeroCard | coder (TDD) | tester → code-reviewer | **✅ Codex #2** (null/fallback 7케이스 검증) | B1 의존 (PremiumGauge import), B3 와 병렬 |
| B3 IndexCompactCard | coder (TDD) | tester → code-reviewer | **✅ Codex #3** (SP500 10x 보존 검증) | A6 후, B2 와 병렬 |
| B4 grid CSS | coder | quick-validator | — | B2 + B3 후 |
| B5 App.tsx | coder | code-reviewer | — | B4 후 (sequential) |
| B6 ThemeToggle | coder (TDD) | tester | — | B5 후, B7 과 병렬 |
| B7 axe-core | coder | tester | — | B5 후, B6 과 병렬 |
| B8 legacy 컴포넌트 삭제 | refactor-cleaner | code-reviewer | — | B6 + B7 후 |
| B9 legacy.css 삭제 | refactor-cleaner | quick-validator | — | B8 후 |
| B10 smoke | bash + 사용자 수동 | — | **✅ Codex #4** (전체 v0.3.0 PR final 리뷰) | B9 후 (마지막) |

### 병렬 실행 가능 묶음

```
Phase A: A0 → A1 → A2 → A3 → A4 → A5 → A6 → [Codex #1]   (sequential, cascade 안전)
Phase B:
  A6 종료 →
    ├─ B1 ────────────┐
    │                  │
    ├─ B3 ─────────────┤ B2 (B1 + B3 결과 사용 가능, B3 와 병렬) → [Codex #2]
    │                  │
    │                  ▼
    │                B4 grid CSS
    │                  ▼
    │                B5 App.tsx                                          
    │                  ▼
    │      ┌─────────┴─────────┐
    │      ▼                   ▼
    │     B6 ThemeToggle      B7 axe-core
    │      └─────────┬─────────┘
    │                ▼
    │              B8 → B9 → B10 → [Codex #4]
    └──→ B3 → [Codex #3 (B3 끝 직후)]
```

> 실용적 권장: **A 는 strict sequential**, **B1/B3 만 병렬**, B5 이후는 다시 sequential. 너무 공격적 병렬화는 cascade/import 충돌 위험.

### 필수 Prompt Injection (모든 subagent 호출 시)

모든 coder / tester / code-reviewer / refactor-cleaner 호출 prompt 끝에 **반드시** 다음 블록을 포함한다 (사용자 글로벌 룰 `agent-directives.md` 의 §11 강제 사항):

```
[카파시 스타일 / AI slop 금지 — 의무 검증]
- 이 코드가 3줄로 될 걸 과추상화했는가?
- 1-use 헬퍼/팩토리/매니저 양산은 없는가?
- "혹시 나중에" 보존 코드가 끼어 있는가?
- 사용자 지시 없는 로직/기능이 삽입됐는가?
- 미사용 export / type / token 이 생겼는가?

[리뷰 에이전트만] 발견된 slop 은 severity 무관 별도 섹션으로 보고할 것.
```

### 두 단계 리뷰 (subagent-driven 모드 기본)

각 Task 5-step 완료 후:
1. **quick-validator**: `pnpm exec tsc --noEmit -p tsconfig.app.json` + `pnpm exec eslint . --quiet` — 빠른 피드백
2. **code-reviewer**: 카파시 가드 포함, 코드 품질·보안·관습 검증

둘 중 하나라도 fail → 같은 Task 를 **fresh subagent** 로 재실행 (최대 2회). 2회 후도 실패 시 사용자에게 escalate.

### Codex 체크포인트 상세 (4 회)

| # | 시점 | 무엇을 검토 | Codex prompt 핵심 |
|---|---|---|---|
| **Codex #1** | Phase A 종료 (A6 후) | CSS 모듈화 visual zero-change 보장, cascade 순서, legacy.css alias 완전성 | "1245-line monolith 를 10 모듈로 분리. visual diff 0 보장? 빠진 selector? cascade 순서 위험?" |
| **Codex #2** | B2 끝 직후 | StockHeroCard 의 §3.5 null/fallback 7케이스 누락 여부 + TS 안전성 | "spec §3.5 표 7개 케이스 모두 단위 테스트로 커버됐는가? edge case 빠진 거 없나? `payload.hl` undefined → KRX row 만 렌더링 정상?" |
| **Codex #3** | B3 끝 직후 | IndexCompactCard 의 SP500 10x ratio 보존 + KOSPI 1-venue 케이스 | "기존 IndexCompareCard 의 SP500 10x ratio 로직이 100% 이전됐는가? KOSPI 200F (HL only, no Binance) 렌더 OK?" |
| **Codex #4** | B10 끝, PR 직전 | 전체 v0.3.0 final 리뷰 — 시각/접근성/카파시/회귀 | "Phase A + Phase B 통합. spec §10 검증 기준 10개 모두 충족? AI slop 잔재? 라이트 모드 contrast?" |

각 Codex 호출은 `Agent` tool 의 `codex:codex-rescue` subagent_type 으로. 첫 호출 (Codex #1) 은 `git diff HEAD~6` 결과 + spec link 제공.

### 롤백 정책

- **Task 실패 (단일 commit)**: `git reset --hard HEAD~1` 후 fresh subagent 로 재실행.
- **Wave 종료 검증 실패** (예: A6 의 selector diff != 0): 해당 Wave 의 모든 commit revert → 문제 task 부터 재계획.
- **Codex 체크포인트 BLOCK**: 해당 Wave 내 추가 task 진행 정지 + Codex 지적 사항 inline fix → 재검증 → 통과 후 다음 Wave.

### 카파시 가드 자동 grep (Wave 종료마다)

```bash
# 미사용 토큰
grep -roE '\-\-ts-[a-z-]+' src/ --include='*.ts' --include='*.tsx' --include='*.css' \
  | awk -F: '{print $2}' | sort -u > /tmp/ts-used.txt
grep -oE '\-\-ts-[a-z-]+\s*:' src/styles/typography.css \
  | awk -F: '{print $1}' | sort -u > /tmp/ts-defined.txt
diff /tmp/ts-defined.txt /tmp/ts-used.txt  # Expected: defined ⊆ used

# 1-use 헬퍼
grep -rn "^function [a-z]" src/components/ --include='*.tsx' | wc -l  # 카운트 모니터링
```

---

# Phase A — CSS Modularization (Wave 1)

> 목표: 시각 zero-change. baseline 스크린샷 vs 분리 후 스크린샷 diff = 0. PR 한 개로 깨끗하게 머지.

## Task A0: Baseline 채증 + Phase 시작 commit

**Files:**
- Create under `(base)/`: `component-classes.txt`, `css-selectors.txt`, `README.md`
- Create under `(base)/`: `dark.png` (수동 screenshot), `light.png` (수동 screenshot)

- [ ] **Step 1: dev 서버 가동 확인**

```bash
# 이미 실행 중인지 확인
lsof -iTCP:5173 -sTCP:LISTEN -n -P | head -2

# 없으면 시작
pnpm dev
# 다른 터미널에서 http://localhost:5173 접속
```
Expected: 200 OK 응답.

- [ ] **Step 2: 다크/라이트 두 모드에서 스크린샷 캡처 (수동)**

브라우저 `http://localhost:5173` 접속 → 우상단 ThemeToggle 클릭으로 다크/라이트 양쪽 캡처.
- 다크 → `(base)/dark.png` 로 저장 (sample 시각 baseline)
- 라이트 → `(base)/light.png` 로 저장
- 캡처 영역: 전체 페이지 (header 부터 하단 footer 까지). 1920×1080 권장.

- [ ] **Step 3: 컴포넌트 className inventory 추출 (test 용 baseline)**

```bash
BASE=docs/superpowers/specs/baseline
grep -rohE 'className="[^"]+"' src/components src/App.tsx | sort -u > "$BASE/component-classes.txt"
wc -l "$BASE/component-classes.txt"
```
Expected: 50~120 라인.

- [ ] **Step 4: CSS 셀렉터 inventory 추출**

```bash
BASE=docs/superpowers/specs/baseline
grep -oE '^\.[a-zA-Z][a-zA-Z0-9_-]*' src/App.css | sort -u > "$BASE/css-selectors.txt"
wc -l "$BASE/css-selectors.txt"
```
Expected: 80~200 라인.

- [ ] **Step 5: README 작성 + commit**

```bash
BASE=docs/superpowers/specs/baseline
cat > "$BASE/README.md" << 'EOF'
# Wave 1 Baseline

Pre-modularization snapshot for visual + selector regression check.

- dark.png / light.png — sample full-page screenshots at 1920x1080
- component-classes.txt — test snapshot of className values
- css-selectors.txt — sample of class selectors in App.css

Wave 1 종료 조건: 분리 후 동일 명령으로 재추출 → diff 0.
EOF

git add "$BASE/"
git commit -m "chore(plan): wave1 baseline screenshots + selector inventory"
```

## Task A1: tokens.css 추출 (variables 분리)

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/App.css:1-250` (잘라낸 후 `@import` 로 대체)

- [ ] **Step 1: tokens.css 생성 (App.css 1~250 라인 그대로 이동)**

```bash
sed -n '1,250p' src/App.css > src/styles/tokens.css
# 잘라낸 부분 머리에 주석 추가
sed -i '' '1i\
/* tokens.css — :root + dark/light theme (extracted from App.css Wave 1) */\
' src/styles/tokens.css
```

- [ ] **Step 2: App.css 의 1~250 라인 삭제 + @import 추가 (진입점 시작)**

```bash
# 250 줄 삭제
sed -i '' '1,250d' src/App.css
# 머리에 @import 추가
{ echo "@import './styles/tokens.css';"; cat src/App.css; } > /tmp/App.css.new
mv /tmp/App.css.new src/App.css
```

- [ ] **Step 3: 빌드 + 시각 확인**

```bash
pnpm exec tsc --noEmit -p tsconfig.app.json   # TS 영향 없어야 함
pnpm test                                       # vitest 통과
```
브라우저 새로고침 후 다크/라이트 양 모드 시각 동일성 육안 확인.

- [ ] **Step 4: 셀렉터 inventory 재추출 + diff (test 용 sample)**

```bash
BASE=docs/superpowers/specs/baseline
grep -oE '^\.[a-zA-Z][a-zA-Z0-9_-]*' src/App.css src/styles/tokens.css \
  | sed 's/^[^:]*://' | sort -u > /tmp/post-a1.txt
diff "$BASE/css-selectors.txt" /tmp/post-a1.txt
```
Expected: diff 0 (셀렉터 이름 변경 없음, 단순 이동).

- [ ] **Step 5: commit**

```bash
git add src/App.css src/styles/tokens.css
git commit -m "refactor(css): extract tokens.css from App.css (Wave 1)"
```

## Task A2: base + typography + layout + utilities 추출

**Files:**
- Create: `src/styles/base.css`, `src/styles/typography.css`, `src/styles/layout.css`, `src/styles/utilities.css`
- Modify: `src/App.css` (해당 영역 삭제 + @import 추가)

- [ ] **Step 1: 현재 App.css 구조 파악**

```bash
grep -n "^[*.#a-z]" src/App.css | head -60
```
Expected: section 별 selector 분포 확인.

- [ ] **Step 2: base.css 추출 (reset + html/body/#root/.container)**

`src/App.css` 에서 다음 selector 들을 잘라 `src/styles/base.css` 로 이동:
- `*` (box-sizing reset)
- `html, body, #root`
- `.container`
- `::-webkit-scrollbar*` (있다면)

- [ ] **Step 3: typography.css 추출 (.num + font utility)**

`src/App.css` 에서 `.num`, `.num-col` 등을 `src/styles/typography.css` 로 이동.

```css
.num { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 4: layout.css 추출 (grid, sections, app-header)**

`src/App.css` 에서:
- `.app-header`, `.brand`, `.brand .sub`, `.meta`, `.meta-controls`
- `.bento`, `.hero-section`, `.stock-section`, `.index-section`
- `.section-title`, `.section-subtitle`
- `.dense-stocks*`, `.stock-row`

→ `src/styles/layout.css` 로 이동.

- [ ] **Step 5: utilities.css 추출 (.change-*, .flash-*)**

```css
.change-up { color: var(--up); }
.change-down { color: var(--down); }
.change-flat { color: var(--text-dim); }
.flash-up { /* keyframe animation 그대로 */ }
.flash-down { /* keyframe animation 그대로 */ }
@keyframes flash-up-anim { /* ... */ }
@keyframes flash-down-anim { /* ... */ }
```

- [ ] **Step 6: App.css 에 @import 추가 (tokens 다음 줄들)**

```css
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/typography.css';
@import './styles/layout.css';
/* 컴포넌트는 다음 Task ... */
@import './styles/utilities.css';

/* 남은 코드 (still inline 인 컴포넌트 스타일들) */
```

- [ ] **Step 7: 빌드 + 시각 확인 + selector diff**

```bash
BASE=docs/superpowers/specs/baseline
pnpm build && pnpm test
grep -roE '^\.[a-zA-Z][a-zA-Z0-9_-]*' src/App.css src/styles/ \
  | sed 's/^[^:]*://' | sort -u > /tmp/post-a2.txt
diff "$BASE/css-selectors.txt" /tmp/post-a2.txt
```
Expected: diff 0.

- [ ] **Step 8: commit**

```bash
git add src/App.css src/styles/
git commit -m "refactor(css): extract base/typography/layout/utilities (Wave 1)"
```

## Task A3: components/* 추출 (9 컴포넌트 CSS)

**Files:**
- Create: 9 files under `src/styles/components/`
- Modify: `src/App.css` (해당 영역 삭제 + @import)

> 각 컴포넌트별로 selector 묶음을 옮긴다. 이름이 명확히 카드/배지/배너에 속하는 것만 컴포넌트 파일로. 모호한 것은 다음 Task A4 의 `legacy.css` 로.

- [ ] **Step 1: card-base.css**

`src/App.css` 에서 다음을 `src/styles/components/card-base.css` 로 이동:
- `.card`, `.card-head`, `.card-loading`, `.card-hero`, `.price-skel`, `.ticker-id`
- `.price`, `.price-usd-sub`, `.change`, `.meta-grid`
- `@keyframes flash-up-anim` 가 utilities 가 아니라 card 영역에 있다면 여기로

- [ ] **Step 2: fx-header.css**

`.fx-header`, `.fx-pill*` 관련 selector 이동.

- [ ] **Step 3: session-badges.css**

`.session-badges`, `.session-badge*` 관련 selector 이동.

- [ ] **Step 4: signal-badge.css**

`.signal-badge`, `.sig-*` (`.sig-normal`, `.sig-watch`, `.sig-trade`, `.sig-dislocated`), `.signal-stale`, `.signal-collecting`, `.signal-z` 이동.

- [ ] **Step 5: theme-toggle.css**

`.theme-toggle`, `.theme-icon`, `.theme-label`, `.theme-toggle:hover`, `.theme-toggle:focus-visible` 이동.

- [ ] **Step 6: degraded-banner.css**

`.degraded-banner*` 관련 selector 이동.

- [ ] **Step 7: premium-row.css**

`.premium-row`, `.premium-label`, `.premium-value`, `.premium-up`, `.premium-down`, `.premium-usdt`, `.premium-warn-chip`, `.premium-blocked`, `.premium-pending` 이동.

- [ ] **Step 8: index-compact.css + stock-hero.css + premium-gauge.css 는 placeholder 로 비워둠 (Phase B 에서 채움)**

```bash
mkdir -p src/styles/components
echo "/* placeholder — filled in Phase B */" > src/styles/components/index-compact.css
echo "/* placeholder — filled in Phase B */" > src/styles/components/stock-hero.css
echo "/* placeholder — filled in Phase B */" > src/styles/components/premium-gauge.css
```

- [ ] **Step 9: App.css @import 순서 갱신**

```css
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/typography.css';
@import './styles/layout.css';
@import './styles/components/card-base.css';
@import './styles/components/stock-hero.css';      /* placeholder */
@import './styles/components/premium-gauge.css';   /* placeholder */
@import './styles/components/index-compact.css';   /* placeholder */
@import './styles/components/fx-header.css';
@import './styles/components/session-badges.css';
@import './styles/components/signal-badge.css';
@import './styles/components/theme-toggle.css';
@import './styles/components/degraded-banner.css';
@import './styles/components/premium-row.css';
@import './styles/utilities.css';
/* legacy.css 는 Task A4 에서 추가 */
```

- [ ] **Step 10: 빌드 + 시각 확인 + diff**

```bash
BASE=docs/superpowers/specs/baseline
pnpm build && pnpm test
grep -roE '^\.[a-zA-Z][a-zA-Z0-9_-]*' src/App.css src/styles/ \
  | sed 's/^[^:]*://' | sort -u > /tmp/post-a3.txt
diff "$BASE/css-selectors.txt" /tmp/post-a3.txt
```
Expected: diff 0.

- [ ] **Step 11: commit**

```bash
git add src/styles/components/ src/App.css
git commit -m "refactor(css): extract 7 component CSS files (Wave 1)"
```

## Task A4: legacy.css 추출 + App.css 진입점화

**Files:**
- Create: `src/styles/legacy.css`
- Modify: `src/App.css` (모든 inline 코드 제거 → @import only)

- [ ] **Step 1: 남은 App.css 의 inline 코드를 legacy.css 로 이동**

남은 selector 들 (분류 애매한 것들 — 예: `.night-badge`, `.krw-conversions`, `.krx-row`, `.krx-label`, `.krx-value`, `.krx-status`, `.err-pill`, `.muted`, `.loading-row` 등) 을 `src/styles/legacy.css` 로 이동.

```bash
# App.css 에서 @import 블록 외 모든 라인을 추출
grep -v '^@import' src/App.css > /tmp/legacy-candidate.css
# 머리에 주석 추가
cat > src/styles/legacy.css << 'EOF'
/* legacy.css — Wave 1~3 동안 동작 동일성 보장용 alias shell.
 * Wave 4 끝에 미참조 확인 후 삭제.
 */
EOF
cat /tmp/legacy-candidate.css >> src/styles/legacy.css
```

- [ ] **Step 2: App.css 를 @import only 진입점으로**

```css
/* src/App.css — 진입점, 순서 절대 바꾸지 말 것 */
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/typography.css';
@import './styles/layout.css';
@import './styles/components/card-base.css';
@import './styles/components/stock-hero.css';
@import './styles/components/premium-gauge.css';
@import './styles/components/index-compact.css';
@import './styles/components/fx-header.css';
@import './styles/components/session-badges.css';
@import './styles/components/signal-badge.css';
@import './styles/components/theme-toggle.css';
@import './styles/components/degraded-banner.css';
@import './styles/components/premium-row.css';
@import './styles/utilities.css';
@import './styles/legacy.css';
```

- [ ] **Step 3: App.css 줄 수 확인**

```bash
wc -l src/App.css
```
Expected: ≤ 20 lines.

- [ ] **Step 4: 빌드 + 시각 확인 (full smoke)**

```bash
pnpm build && pnpm test
# 브라우저 http://localhost:5173 → 다크 / 라이트 양 모드 모두 baseline 과 동일한지 육안 확인
```

- [ ] **Step 5: selector diff (Wave 1 종료 조건 검증)**

```bash
BASE=docs/superpowers/specs/baseline
grep -roE '^\.[a-zA-Z][a-zA-Z0-9_-]*' src/styles/ src/App.css \
  | sed 's/^[^:]*://' | sort -u > /tmp/post-a4.txt
diff "$BASE/css-selectors.txt" /tmp/post-a4.txt
```
Expected: diff 0.

- [ ] **Step 6: 컴포넌트 className diff**

```bash
BASE=docs/superpowers/specs/baseline
grep -rohE 'className="[^"]+"' src/components src/App.tsx | sort -u > /tmp/post-a4-classes.txt
diff "$BASE/component-classes.txt" /tmp/post-a4-classes.txt
```
Expected: diff 0 (Wave 1 은 컴포넌트 안 건드림).

- [ ] **Step 7: 사후 스크린샷 캡처 + 시각 diff 육안 확인**

다크/라이트 양 모드 다시 캡처해서 baseline 과 비교 (이미지 diff 도구 또는 육안). visual 차이 0 확인.

- [ ] **Step 8: commit**

```bash
git add src/App.css src/styles/legacy.css
git commit -m "refactor(css): finalize App.css as @import-only entrypoint + legacy.css shell (Wave 1)"
```

## Task A5: 신규 토큰 추가 (Phase B 준비)

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/typography.css`

> 신규 토큰을 추가하되 **사용처는 Phase B 까지 없다**. 시각 변경 없음 (다크 모드 `--text` 미세 휘도 보정 외).

- [ ] **Step 1: 다크 모드 신규 토큰 추가**

`src/styles/tokens.css` 의 `[data-theme="dark"]` 블록 끝부분에 추가:

```css
  /* === Phase B 신규 토큰 (Wave 2~3 에서 사용) === */
  --gauge-track:    rgba(255,255,255,0.06);
  --gauge-positive: var(--up);
  --gauge-negative: var(--down);
  --premium-cool:   var(--celadon);
  --premium-warm:   var(--hanji);
  --premium-hot:    var(--juhwang);

  /* 가독성 보정 (#E8E4DA → 휘도 +12%) */
  --text: #F2EDE2;
```
(`--text` 는 기존 정의 위에 덮어쓰기 — 다크 모드만 변경)

- [ ] **Step 2: 라이트 모드 신규 토큰 추가**

`[data-theme="light"]` 블록 끝부분에:

```css
  /* === Phase B 신규 토큰 === */
  --gauge-track:    rgba(0,0,0,0.06);
  --gauge-positive: var(--up);
  --gauge-negative: var(--down);
  --premium-cool:   var(--celadon);
  --premium-warm:   var(--hanji);
  --premium-hot:    var(--juhwang);
  /* --text 변경 없음 (라이트는 충분한 대비) */
```

- [ ] **Step 3: 신규 typography utility 클래스 추가**

`src/styles/typography.css` 에 추가:

```css
/* === Phase B 신규 ts-* utility === */
.ts-hero-price   { font-size: 52px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ts-hero-premium { font-size: 36px; font-weight: 600; font-variant-numeric: tabular-nums; }
.ts-card-title   { font-size: 18px; font-weight: 600; }
.ts-subtitle     { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
.ts-meta         { font-size: 15px; font-weight: 400; font-family: 'JetBrains Mono Variable', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.ts-index-headline { font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 4: 빌드 + 시각 확인**

```bash
pnpm build && pnpm test
# 다크 모드에서 텍스트가 미세하게 밝아진 것 외 시각 변경 없어야 함
```

- [ ] **Step 5: commit**

```bash
git add src/styles/tokens.css src/styles/typography.css
git commit -m "feat(css): add Phase B tokens (gauge/premium tier/ts-* + text +12% luminance)"
```

## Task A6: Wave 1 종료 검증 + Phase A merge 준비

**Files:** (검증 only)

- [ ] **Step 1: 모든 모듈 줄 수 확인 (≤ 200)**

```bash
wc -l src/App.css src/styles/*.css src/styles/components/*.css
```
Expected: `App.css ≤ 20`, 각 모듈 ≤ 200. 초과 시 sub-module 분할.

- [ ] **Step 2: 빌드 + 전체 테스트**

```bash
pnpm build
pnpm test
```
Expected: 모두 통과.

- [ ] **Step 3: 다크/라이트 양 모드 시각 회귀 확인**

수동: 브라우저 `http://localhost:5173` → ThemeToggle 로 다크↔라이트 양 모드 모두 baseline 과 일치 / 라이트 모드 색 대비 정상 확인.

- [ ] **Step 4: Codex #1 체크포인트 — Phase A 종료 PR 리뷰**

```
Agent tool 호출:
  subagent_type: codex:codex-rescue
  prompt: |
    Mode: REVIEW ONLY — no code changes.
    
    Context: Phase A of dashboard-redesign PLAN just completed.
    Branch HEAD has 6 commits (A0 baseline, A1 tokens.css, A2 base+typography+layout+utilities,
    A3 components/*, A4 legacy.css + App.css entrypoint, A5 new tokens).
    Goal of Phase A: split 1245-line monolithic src/App.css into 10 modules with ZERO visual change.
    
    Please verify:
    1. Visual diff zero (dark + light theme). Check baseline screenshots vs current.
    2. CSS cascade order in src/App.css @import block is safe.
    3. Legacy alias coverage — are all legacy class selectors still defined somewhere?
    4. New tokens (--gauge-*, --premium-*, --ts-*, --text +12%) — are any defined but unused?
    5. App.css ≤ 20 lines, each sub-module ≤ 200 lines.
    6. Component className inventory unchanged.
    
    Spec ref: docs/superpowers/specs/2026-05-12-dashboard-redesign-design.md (§6.1~§6.3)
    
    [카파시 스타일 / AI slop 금지 — 의무 검증]
    - 1-use 추상화 추가됐는가?
    - 미사용 토큰 새로 정의됐는가?
    - "혹시 나중에" 보존된 selector 있는가?
    
    Output: BLOCK / FLAG / PASS verdict + concrete file:line references.
```

Expected: PASS. BLOCK 시 지적 사항 inline fix → 재호출. 통과 후 다음 step.

- [ ] **Step 5: Wave 1 PR commit (또는 별개 머지)**

```bash
git log --oneline | head -10
# 최근 6 commit (A0~A5) 확인
```

Phase A 완료. 사용자 / 외부 리뷰 → 머지 → Phase B 시작.

---

# Phase B — Component Restructure (Wave 2~5)

> 목표: Bento 3-up 한국 주식 main + KOSPI 강등 + 신규 컴포넌트 + 레거시 정리.

## Task B1: PremiumGauge 컴포넌트 (TDD)

**Files:**
- Create: `src/components/PremiumGauge.tsx`
- Create: `src/components/PremiumGauge.test.tsx`
- Modify: `src/styles/components/premium-gauge.css`

- [ ] **Step 1: Write the failing tests**

`src/components/PremiumGauge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PremiumGauge } from './PremiumGauge';

describe('PremiumGauge', () => {
  it('renders meter with valuemin -5 / valuemax +5 / valuenow=pct', () => {
    render(<PremiumGauge pctUsd={2.5} tier="warm" />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuemin', '-5');
    expect(meter).toHaveAttribute('aria-valuemax', '5');
    expect(meter).toHaveAttribute('aria-valuenow', '2.5');
  });

  it('omits aria-valuenow when pctUsd is null (KRX closed)', () => {
    render(<PremiumGauge pctUsd={null} tier="na" />);
    const meter = screen.getByRole('meter');
    expect(meter).not.toHaveAttribute('aria-valuenow');
    expect(meter).toHaveAttribute('aria-disabled', 'true');
  });

  it('clamps values beyond +5 and shows OVER label', () => {
    render(<PremiumGauge pctUsd={7.8} tier="hot" />);
    expect(screen.getByText(/over/i)).toBeInTheDocument();
  });

  it('clamps values beyond -5 and shows OVER label', () => {
    render(<PremiumGauge pctUsd={-12} tier="hot" />);
    expect(screen.getByText(/over/i)).toBeInTheDocument();
  });

  it('applies tier class for color (cool/warm/hot/na)', () => {
    const { container, rerender } = render(<PremiumGauge pctUsd={0.5} tier="cool" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-cool');
    rerender(<PremiumGauge pctUsd={2} tier="warm" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-warm');
    rerender(<PremiumGauge pctUsd={4} tier="hot" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-hot');
    rerender(<PremiumGauge pctUsd={null} tier="na" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-na');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/components/PremiumGauge.test.tsx
```
Expected: FAIL — "Cannot find module './PremiumGauge'"

- [ ] **Step 3: Implement PremiumGauge**

`src/components/PremiumGauge.tsx`:

```tsx
type Tier = 'cool' | 'warm' | 'hot' | 'na';

type Props = {
  pctUsd: number | null;
  tier: Tier;
};

const MIN = -5;
const MAX = 5;

export function PremiumGauge({ pctUsd, tier }: Props) {
  const isNull = pctUsd === null;
  const isOver = !isNull && (pctUsd > MAX || pctUsd < MIN);
  const clamped = isNull ? 0 : Math.max(MIN, Math.min(MAX, pctUsd));
  const posPct = ((clamped - MIN) / (MAX - MIN)) * 100;
  const fillFrom = Math.min(50, posPct);
  const fillTo = Math.max(50, posPct);

  const ariaProps: Record<string, string | number | boolean> = {
    role: 'meter',
    'aria-valuemin': MIN,
    'aria-valuemax': MAX,
  };
  if (isNull) {
    ariaProps['aria-disabled'] = true;
    ariaProps['aria-label'] = 'premium unavailable';
  } else {
    ariaProps['aria-valuenow'] = pctUsd;
    ariaProps['aria-label'] = `premium ${pctUsd.toFixed(2)} percent`;
  }

  return (
    <div className={`premium-gauge tier-${tier}${isNull ? ' is-null' : ''}`} {...ariaProps}>
      <div className="premium-gauge-track" />
      {!isNull && (
        <div
          className="premium-gauge-fill"
          style={{ left: `${fillFrom}%`, width: `${fillTo - fillFrom}%` }}
        />
      )}
      <div className="premium-gauge-zero" />
      {!isNull && (
        <div className="premium-gauge-dot" style={{ left: `${posPct}%` }} />
      )}
      <div className="premium-gauge-scale">
        <span>-5%</span><span>0%</span><span>+5%</span>
      </div>
      {isOver && <span className="premium-gauge-over">OVER</span>}
    </div>
  );
}
```

- [ ] **Step 4: Write CSS** (`src/styles/components/premium-gauge.css` placeholder 대체)

```css
.premium-gauge {
  position: relative;
  height: 28px;
  margin-top: 8px;
}
.premium-gauge-track {
  position: absolute; left: 0; right: 0; top: 11px; height: 6px;
  background: var(--gauge-track);
  border-radius: 3px;
}
.premium-gauge-fill {
  position: absolute; top: 11px; height: 6px;
  border-radius: 3px;
  transition: left 200ms ease, width 200ms ease, background-color 200ms ease;
}
.premium-gauge-zero {
  position: absolute; left: 50%; top: 6px; width: 1px; height: 16px;
  background: var(--text-muted);
  opacity: 0.4;
  transform: translateX(-0.5px);
}
.premium-gauge-dot {
  position: absolute; top: 8px; width: 12px; height: 12px;
  border-radius: 50%;
  transform: translateX(-6px);
  transition: left 200ms ease, background-color 200ms ease;
}
.premium-gauge-scale {
  position: absolute; left: 0; right: 0; top: 20px;
  display: flex; justify-content: space-between;
  font-size: 9px; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.premium-gauge-over {
  position: absolute; right: 0; top: -14px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.08em;
  color: var(--juhwang);
}
.premium-gauge.tier-cool .premium-gauge-fill,
.premium-gauge.tier-cool .premium-gauge-dot { background: var(--premium-cool); }
.premium-gauge.tier-warm .premium-gauge-fill,
.premium-gauge.tier-warm .premium-gauge-dot { background: var(--premium-warm); }
.premium-gauge.tier-hot  .premium-gauge-fill,
.premium-gauge.tier-hot  .premium-gauge-dot { background: var(--premium-hot); box-shadow: 0 0 8px var(--juhwang-soft); }
.premium-gauge.tier-na   .premium-gauge-fill,
.premium-gauge.tier-na   .premium-gauge-dot { display: none; }
.premium-gauge.is-null .premium-gauge-track { opacity: 0.5; }
```

- [ ] **Step 5: Run tests to verify pass**

```bash
pnpm test -- src/components/PremiumGauge.test.tsx
```
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/PremiumGauge.tsx src/components/PremiumGauge.test.tsx src/styles/components/premium-gauge.css
git commit -m "feat(client): add PremiumGauge -5~+5% meter (Wave 2)"
```

## Task B2: StockHeroCard 컴포넌트 (TDD, null/fallback 7케이스 커버)

**Files:**
- Create: `src/components/StockHeroCard.tsx`
- Create: `src/components/StockHeroCard.test.tsx`
- Modify: `src/styles/components/stock-hero.css`

- [ ] **Step 1: Write the failing tests (spec §3.5 표 1:1 매핑)**

`src/components/StockHeroCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockHeroCard } from './StockHeroCard';
import type { TickerPayload, FxRates } from '@shared/types/prices.js';

const fxOk: FxRates = { usdtKrw: 1470, usdKrw: 1471.7, source: 'upbit', officialUsdKrw: 1471.7 };
const fxZero: FxRates = { usdtKrw: 0, usdKrw: 0, source: 'upbit', officialUsdKrw: 0 };

const payloadFull: TickerPayload = {
  hl: { symbol: 'xyz_SMSN', price: 202.19, unit: 'USD', change24hPct: -2.32, asOfMs: Date.now() },
  naver: { price: 285500, status: 'ok', asOfMs: Date.now() },
  premium: { pctUsd: 4.23, pctUsdt: 4.20, guard: 'ok' },
};

describe('StockHeroCard', () => {
  it('renders loading skeleton when payload is undefined', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={undefined} fx={fxOk} />);
    expect(screen.getByText('삼성전자')).toBeInTheDocument();
    expect(screen.getByTestId('stock-hero-loading')).toBeInTheDocument();
  });

  it('renders HL-> KRW as PRIMARY when fx + hl available', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} />);
    // 202.19 * 1470 = 297,219.3
    expect(screen.getByText(/₩297,219/)).toBeInTheDocument();
  });

  it('falls back to USD primary when fx.usdtKrw === 0', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxZero} />);
    expect(screen.getByText(/\$202\.19/)).toBeInTheDocument();
    expect(screen.getByText(/KRW UNAVAIL/i)).toBeInTheDocument();
  });

  it('shows HL UNAVAILABLE when payload.hl is missing', () => {
    const payload = { ...payloadFull, hl: undefined };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload as TickerPayload} fx={fxOk} />);
    expect(screen.getByText(/HL UNAVAILABLE/i)).toBeInTheDocument();
    // KRX row should still render
    expect(screen.getByText(/₩285,500/)).toBeInTheDocument();
  });

  it('renders premium "—" + tier-na gauge when premium.pctUsd is null (KRX closed)', () => {
    const payload = {
      ...payloadFull,
      premium: { pctUsd: null, pctUsdt: null, guard: 'ok' as const },
      naver: { price: 285500, status: 'stale' as const, asOfMs: Date.now(), staleReason: 'krx-closed' },
    };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows "(closed)" marker when KRX is stale', () => {
    const payload = { ...payloadFull, naver: { price: 285500, status: 'stale' as const, asOfMs: Date.now() } };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/\(closed\)/)).toBeInTheDocument();
  });

  it('shows "—" for KRX row when naver is missing entirely', () => {
    const payload = { ...payloadFull, naver: undefined };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload as TickerPayload} fx={fxOk} />);
    const krxRow = screen.getByText('KRX').closest('div');
    expect(krxRow?.textContent).toMatch(/—/);
  });

  it('shows "—" for 24h when change24hPct is null', () => {
    const payload = { ...payloadFull, hl: { ...payloadFull.hl!, change24hPct: null } };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload as TickerPayload} fx={fxOk} />);
    const row = screen.getByText('24h').closest('div');
    expect(row?.textContent).toMatch(/—/);
  });

  it('classifies premium tier: cool < 1%, warm 1-3%, hot >= 3%', () => {
    const mk = (pct: number) => ({
      ...payloadFull,
      premium: { pctUsd: pct, pctUsdt: pct, guard: 'ok' as const },
    });
    const { container, rerender } = render(
      <StockHeroCard ticker="samsung" label="삼성전자" payload={mk(0.5)} fx={fxOk} />
    );
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-cool');
    rerender(<StockHeroCard ticker="samsung" label="삼성전자" payload={mk(2)} fx={fxOk} />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-warm');
    rerender(<StockHeroCard ticker="samsung" label="삼성전자" payload={mk(4.23)} fx={fxOk} />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-hot');
  });
});
```

- [ ] **Step 2: Run tests to verify all fail**

```bash
pnpm test -- src/components/StockHeroCard.test.tsx
```
Expected: 9 FAIL — "Cannot find module './StockHeroCard'"

- [ ] **Step 3: Implement StockHeroCard**

`src/components/StockHeroCard.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { TickerPayload, FxRates } from '@shared/types/prices.js';
import { fmtKrw, fmtUsd, fmtPct } from '../lib/format';
import { PremiumGauge } from './PremiumGauge';
import { SignalBadge } from './SignalBadge';

type Props = {
  ticker: string;
  label: string;
  payload?: TickerPayload;
  fx?: FxRates;
};

function premiumTier(pct: number | null | undefined): 'cool' | 'warm' | 'hot' | 'na' {
  if (pct === null || pct === undefined) return 'na';
  const a = Math.abs(pct);
  if (a < 1) return 'cool';
  if (a < 3) return 'warm';
  return 'hot';
}

export function StockHeroCard({ ticker, label, payload, fx }: Props) {
  const hl = payload?.hl;
  const [flashClass, setFlashClass] = useState<'' | 'flash-up' | 'flash-down'>('');
  const lastPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hl) return;
    const prev = lastPriceRef.current;
    if (prev !== null && prev !== hl.price) {
      setFlashClass(hl.price > prev ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlashClass(''), 800);
      lastPriceRef.current = hl.price;
      return () => clearTimeout(t);
    }
    lastPriceRef.current = hl.price;
  }, [hl?.price, hl]);

  if (!payload) {
    return (
      <article className="card stock-hero card-loading" data-testid="stock-hero-loading">
        <header className="card-head">
          <h3 className="ts-card-title">{label}</h3>
          <span className="ts-subtitle">{ticker}</span>
        </header>
        <div className="stock-hero-primary">—</div>
      </article>
    );
  }

  const usdtKrw = fx?.usdtKrw ?? 0;
  const fxAvailable = usdtKrw > 0;
  const krwFromHl = hl && fxAvailable ? hl.price * usdtKrw : null;
  const showHlAsPrimary = !!hl;

  const premium = payload.premium;
  const premiumPct = premium?.pctUsd ?? null;
  const tier = premiumTier(premiumPct);
  const change = hl?.change24hPct;
  const changeClass = change == null
    ? ''
    : change > 0 ? 'change-up' : change < 0 ? 'change-down' : 'change-flat';

  const krx = payload.naver;
  const krxClosed = krx?.status === 'stale';

  return (
    <article className="card stock-hero">
      <header className="card-head">
        <h3 className="ts-card-title">{label}</h3>
        <div className="ts-subtitle">{ticker} · KRX × Hyperliquid</div>
        {hl && <span className="live-dot" title="HL live">●live</span>}
      </header>

      {/* PRIMARY: HL → KRW */}
      <div className={`stock-hero-primary ts-hero-price ${flashClass}`}>
        {!showHlAsPrimary ? (
          <>
            <span className="stock-hero-dash">—</span>
            <div className="stock-hero-primary-label ts-subtitle">HL UNAVAILABLE</div>
          </>
        ) : !fxAvailable ? (
          <>
            {fmtUsd(hl!.price)}
            <div className="stock-hero-primary-label ts-subtitle">KRW UNAVAIL — USD shown</div>
          </>
        ) : (
          <>
            {fmtKrw(krwFromHl!, 0)}
            <div className="stock-hero-primary-label ts-subtitle">HL → KRW · 24/7 발견가</div>
          </>
        )}
      </div>

      {/* SECONDARY: Premium */}
      <div className="stock-hero-secondary">
        <div className={`stock-hero-premium ts-hero-premium premium-${tier}`}>
          {premiumPct === null ? '—' : (premiumPct >= 0 ? '▲ ' : '▼ ') + fmtPct(premiumPct)}
        </div>
        <div className="stock-hero-premium-label ts-subtitle">
          PREMIUM {tier === 'hot' && '· HOT'}{tier === 'warm' && '· WARM'}{tier === 'cool' && '· COOL'}{tier === 'na' && '· N/A'}
        </div>
        <PremiumGauge pctUsd={premiumPct} tier={tier} />
      </div>

      {/* TERTIARY: KRX + 24h */}
      <dl className="stock-hero-tertiary ts-meta">
        <div>
          <dt>KRX</dt>
          <dd>
            {krx ? (
              <>
                {fmtKrw(krx.price, 0)}
                {krxClosed && <span className="closed-tag"> (closed)</span>}
              </>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt>24h</dt>
          <dd className={changeClass}>{change == null ? '—' : fmtPct(change)}</dd>
        </div>
      </dl>

      {/* FOOTER: Signal */}
      {premiumPct !== null && !krxClosed && (
        <footer className="stock-hero-footer">
          <SignalBadge ticker={ticker} currentPct={premiumPct} />
        </footer>
      )}
      {krxClosed && (
        <footer className="stock-hero-footer">
          <span className="signal-stale">KRX CLOSED</span>
        </footer>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Write CSS** (`src/styles/components/stock-hero.css` placeholder 대체)

```css
.stock-hero {
  padding: 24px;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stock-hero .card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.stock-hero .card-head h3 { color: var(--text); }
.stock-hero .card-head .ts-subtitle { color: var(--text-dim); flex-basis: 100%; }
.stock-hero .live-dot {
  color: var(--live-indicator, #00B894);
  font-size: 11px;
  letter-spacing: 0.05em;
}

.stock-hero-primary {
  font-size: clamp(36px, 5vw, 52px);
  line-height: 1.05;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  word-break: keep-all;
}
.stock-hero-primary-label {
  color: var(--text-dim);
  margin-top: 4px;
}
.stock-hero-dash { color: var(--text-muted); }

.stock-hero-secondary {
  border-top: 1px solid var(--border-subtle);
  padding-top: 12px;
}
.stock-hero-premium {
  font-size: clamp(28px, 3.2vw, 36px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.stock-hero-premium.premium-cool { color: var(--premium-cool); }
.stock-hero-premium.premium-warm { color: var(--premium-warm); }
.stock-hero-premium.premium-hot  { color: var(--premium-hot); }
.stock-hero-premium.premium-na   { color: var(--text-muted); }
.stock-hero-premium-label { color: var(--text-dim); margin-top: 2px; }

.stock-hero-tertiary {
  border-top: 1px solid var(--border-subtle);
  padding-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  color: var(--text-dim);
}
.stock-hero-tertiary dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.stock-hero-tertiary dd { font-size: 15px; color: var(--text); }
.stock-hero-tertiary .closed-tag { color: var(--text-muted); font-size: 12px; }

.stock-hero-footer {
  margin-top: auto;
  border-top: 1px solid var(--border-subtle);
  padding-top: 12px;
}

.stock-hero:hover { border-color: var(--celadon-border); }
```

- [ ] **Step 5: Run tests to verify pass**

```bash
pnpm test -- src/components/StockHeroCard.test.tsx
```
Expected: 9 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/StockHeroCard.tsx src/components/StockHeroCard.test.tsx src/styles/components/stock-hero.css
git commit -m "feat(client): add StockHeroCard (Bento 3-up main, null/fallback 7-case coverage)"
```

- [ ] **Step 7: Codex #2 체크포인트 — null/fallback 검증**

```
Agent tool 호출:
  subagent_type: codex:codex-rescue
  prompt: |
    Mode: REVIEW ONLY.
    
    Context: src/components/StockHeroCard.tsx just implemented with 9 unit tests.
    Spec §3.5 defines 7 null/fallback cases. Verify all 7 are covered:
    
    1. payload === undefined → loading skeleton
    2. payload.hl === undefined → "HL UNAVAILABLE" + KRX row still renders
    3. fx.usdtKrw === 0 || undefined → USD fallback + "KRW UNAVAIL — USD shown"
    4. payload.premium?.pctUsd == null → "—" + tier-na gauge (aria-valuenow omit, aria-disabled true)
    5. hl.change24hPct == null → 24h row "—"
    6. payload.naver?.status === 'stale' → "(closed)" marker + KRX CLOSED signal
    7. payload.naver === undefined → KRX row "—"
    
    Also check:
    - premiumTier() classification: cool < 1, warm 1-3, hot >= 3
    - PremiumGauge receives only {pctUsd, tier} props (no generic gauge expansion)
    - data?.tickers?.[ticker] optional chaining (TS strict safe)
    
    Spec ref: docs/superpowers/specs/2026-05-12-dashboard-redesign-design.md (§3.5)
    
    [카파시 스타일 / AI slop 금지 — 의무 검증]
    
    Output: BLOCK / FLAG / PASS + missing cases list.
```

Expected: PASS. 누락 케이스 발견 시 단위 테스트 추가 + 구현 보완.

## Task B3: IndexCompactCard 컴포넌트 (TDD, SP500 10x 보존)

**Files:**
- Create: `src/components/IndexCompactCard.tsx`
- Create: `src/components/IndexCompactCard.test.tsx`
- Modify: `src/styles/components/index-compact.css`

- [ ] **Step 1: Write the failing tests**

`src/components/IndexCompactCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndexCompactCard } from './IndexCompactCard';
import type { TickerPayload, FxRates } from '@shared/types/prices.js';

const fxOk: FxRates = { usdtKrw: 1470, usdKrw: 1471.7, source: 'upbit', officialUsdKrw: 1471.7 };

const payloadEwy: TickerPayload = {
  hl: { symbol: 'xyz_EWY', price: 193.16, unit: 'USD', change24hPct: -1.63, asOfMs: Date.now() },
  binance: { symbol: 'EWYUSDT', price: 193.17, unit: 'USDT', change24hPct: -1.07, asOfMs: Date.now() },
  yahoo: undefined,
  spread: { maxBps: 1, minBps: 0 },
};

const payloadSp500: TickerPayload = {
  hl: { symbol: 'xyz_SP500', price: 7414.80, unit: 'pt', change24hPct: 0.02, asOfMs: Date.now() },
  binance: { symbol: 'SPYUSDT', price: 739.73, unit: 'USDT', change24hPct: 0.14, asOfMs: Date.now() },
  yahoo: undefined,
  spread: { maxBps: 24, minBps: 0 },
};

describe('IndexCompactCard', () => {
  it('renders loading skeleton when payload is undefined', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={undefined} fx={fxOk} />);
    expect(screen.getByText('EWY')).toBeInTheDocument();
    expect(screen.getByTestId('index-compact-loading')).toBeInTheDocument();
  });

  it('renders headline in KRW from HL price × usdtKrw', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxOk} />);
    // 193.16 * 1470 = 283,945
    expect(screen.getByText(/₩283,945/)).toBeInTheDocument();
  });

  it('falls back to USD headline when fx.usdtKrw is 0', () => {
    const fxZero: FxRates = { usdtKrw: 0, usdKrw: 0, source: 'upbit', officialUsdKrw: 0 };
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxZero} />);
    expect(screen.getByText(/\$193\.16/)).toBeInTheDocument();
  });

  it('applies SP500 10x ratio to Binance KRW conversion (Binance × 10)', () => {
    render(<IndexCompactCard ticker="sp500" label="S&P 500" payload={payloadSp500} fx={fxOk} />);
    // HL: 7414.80 * 1470 = 10,899,756  | Binance: 739.73 * 1470 * 10 = 10,874,031
    expect(screen.getByText(/10,899,756/)).toBeInTheDocument();
    expect(screen.getByText(/10,874,031/)).toBeInTheDocument();
    expect(screen.getByText(/HL=index pt, Binance=SPY ETF/i)).toBeInTheDocument();
  });

  it('does NOT apply 10x ratio for non-sp500 tickers', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxOk} />);
    // 193.17 * 1470 = 283,960 (no x10)
    expect(screen.getByText(/283,960/)).toBeInTheDocument();
  });

  it('renders venue rows for HL and Binance', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxOk} />);
    expect(screen.getAllByText(/193\.16/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/193\.17/).length).toBeGreaterThan(0);
  });

  it('renders KOSPI200F with only HL venue', () => {
    const payloadKospi: TickerPayload = {
      hl: { symbol: 'xyz_KR200', price: 1236.40, unit: 'USD', change24hPct: 1.60, asOfMs: Date.now() },
      binance: undefined,
      yahoo: undefined,
      spread: undefined,
    };
    render(<IndexCompactCard ticker="kospi200f" label="KOSPI 200F" payload={payloadKospi} fx={fxOk} />);
    expect(screen.getByText('KOSPI 200F')).toBeInTheDocument();
    expect(screen.getByText(/₩1,817,508/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify all fail**

```bash
pnpm test -- src/components/IndexCompactCard.test.tsx
```
Expected: 7 FAIL.

- [ ] **Step 3: Implement IndexCompactCard**

`src/components/IndexCompactCard.tsx`:

```tsx
import type { TickerPayload, FxRates } from '@shared/types/prices.js';
import { VenueRow } from './VenueRow';
import { SpreadRow } from './SpreadRow';
import { fmtKrw, fmtUsd } from '../lib/format';

const SP500_REFERENCE_RATIO = 10;

type Props = {
  ticker: string;
  label: string;
  payload?: TickerPayload;
  fx?: FxRates;
};

export function IndexCompactCard({ ticker, label, payload, fx }: Props) {
  const hasAnyVenue = !!(payload?.hl || payload?.binance || payload?.yahoo);
  if (!payload || !hasAnyVenue) {
    return (
      <article className="card index-compact card-loading" data-testid="index-compact-loading">
        <header className="card-head">
          <h3 className="ts-card-title">{label}</h3>
          <span className="ts-subtitle">{ticker}</span>
        </header>
        <div className="index-compact-headline">—</div>
      </article>
    );
  }

  const usdtKrw = fx?.usdtKrw ?? 0;
  const fxAvailable = usdtKrw > 0;
  const sp500Multiplier = ticker === 'sp500' ? SP500_REFERENCE_RATIO : 1;

  const hlKrw = payload.hl && fxAvailable ? payload.hl.price * usdtKrw : null;
  const binanceKrw = payload.binance && fxAvailable
    ? payload.binance.price * usdtKrw * sp500Multiplier
    : null;
  const headlineKrw = hlKrw ?? binanceKrw;

  const showKrwHeadline = fxAvailable && headlineKrw !== null;
  const showUsdHeadline = !fxAvailable && !!payload.hl;

  return (
    <article className="card index-compact">
      <header className="card-head">
        <h3 className="ts-card-title">{label}</h3>
        <span className="ts-subtitle">{ticker}</span>
      </header>

      {showKrwHeadline && (
        <div className="index-compact-headline ts-index-headline">
          {fmtKrw(headlineKrw!, 0)}
        </div>
      )}
      {showUsdHeadline && (
        <div className="index-compact-headline ts-index-headline">
          {fmtUsd(payload.hl!.price)}
        </div>
      )}

      <div className="venues">
        <VenueRow source="hyperliquid" pp={payload.hl} />
        <VenueRow source="yahoo" pp={payload.yahoo} />
        <VenueRow source="binance" pp={payload.binance} />
      </div>

      {ticker === 'sp500' && hlKrw !== null && binanceKrw !== null && (
        <div className="krw-conversions num" title="Both venues normalized to KRW via Upbit USDT-KRW + server reference ratio 10x for SPY">
          HL: {fmtKrw(hlKrw, 0)} | Binance×10: {fmtKrw(binanceKrw, 0)}
        </div>
      )}
      {ticker !== 'sp500' && hlKrw !== null && binanceKrw !== null && (
        <div className="krw-conversions num">
          HL: {fmtKrw(hlKrw, 0)} | Binance: {fmtKrw(binanceKrw, 0)}
        </div>
      )}

      <SpreadRow
        spread={payload.spread}
        warningNote={ticker === 'sp500' ? 'HL=index pt, Binance=SPY ETF (~10x ratio, server-normalized)' : undefined}
      />
    </article>
  );
}
```

- [ ] **Step 4: Write CSS** (`src/styles/components/index-compact.css` placeholder 대체)

```css
.index-compact {
  padding: 16px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.index-compact .card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.index-compact-headline {
  font-size: clamp(20px, 2.5vw, 24px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.index-compact .venues { margin-top: 4px; }
.index-compact .krw-conversions {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}
.index-compact:hover { border-color: var(--celadon-border); }
```

- [ ] **Step 5: Run tests to verify pass**

```bash
pnpm test -- src/components/IndexCompactCard.test.tsx
```
Expected: 7 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/IndexCompactCard.tsx src/components/IndexCompactCard.test.tsx src/styles/components/index-compact.css
git commit -m "feat(client): add IndexCompactCard (4-up sub, SP500 10x ratio preserved)"
```

- [ ] **Step 7: Codex #3 체크포인트 — SP500 10x ratio + KOSPI 케이스 검증**

```
Agent tool 호출:
  subagent_type: codex:codex-rescue
  prompt: |
    Mode: REVIEW ONLY.
    
    Context: src/components/IndexCompactCard.tsx just implemented, replaces legacy IndexCompareCard.tsx.
    The legacy component had specific SP500 10x ratio normalization logic. Verify it's 100% preserved.
    
    Please verify:
    1. SP500_REFERENCE_RATIO = 10 constant copied verbatim.
    2. sp500Multiplier applied to Binance KRW conversion (not HL).
    3. "Binance×10" label shown only for ticker === 'sp500'.
    4. SpreadRow warningNote "HL=index pt, Binance=SPY ETF" shown only for sp500.
    5. KOSPI 200F (ticker === 'kospi200f', HL only, no Binance/Yahoo) renders headline without errors.
    6. fx.usdtKrw === 0 falls back to USD headline (only when HL available).
    7. payload undefined → loading skeleton.
    
    Compare line-by-line: legacy src/components/IndexCompareCard.tsx vs new IndexCompactCard.tsx.
    Anything dropped silently?
    
    Spec ref: docs/superpowers/specs/2026-05-12-dashboard-redesign-design.md (§4, §11 R2)
    
    [카파시 스타일 / AI slop 금지 — 의무 검증]
    
    Output: BLOCK / FLAG / PASS + missing logic list.
```

Expected: PASS. 누락 발견 시 inline fix.

## Task B4: Bento grid CSS + section title 갱신

**Files:**
- Modify: `src/styles/layout.css`

- [ ] **Step 1: Add bento grids**

`src/styles/layout.css` 끝에 추가:

```css
/* Phase B: 새 bento grids */
.stocks-section { margin-top: 24px; }
.indices-section { margin-top: 32px; }

.bento-3up {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.bento-4up {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1279px) {
  .bento-3up { grid-template-columns: repeat(2, 1fr); }
  .bento-3up > :nth-child(3) { grid-column: 1 / -1; }
  .bento-4up { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 959px) {
  .bento-3up { grid-template-columns: 1fr; }
  .bento-3up > :nth-child(3) { grid-column: auto; }
  .bento-4up { grid-template-columns: 1fr; }
}

.section-title .night-tag {
  margin-left: 12px;
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 500;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```
Expected: 통과 (CSS only 변경).

- [ ] **Step 3: Commit**

```bash
git add src/styles/layout.css
git commit -m "feat(css): add bento-3up/4up grids + night-tag style (Wave 2)"
```

## Task B5: App.tsx 위계 재배치 + nightMode 분기 제거

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace App.tsx**

`src/App.tsx` 전체를 다음으로 교체:

```tsx
import { usePrices } from './hooks/usePrices';
import { StockHeroCard } from './components/StockHeroCard';
import { IndexCompactCard } from './components/IndexCompactCard';
import { FxHeader } from './components/FxHeader';
import { SessionBadges } from './components/SessionBadges';
import { DegradedBanner } from './components/DegradedBanner';
import { ThemeToggle } from './components/ThemeToggle';
import './App.css';

const STOCK_TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'samsung',  label: '삼성전자' },
  { ticker: 'skhynix',  label: 'SK하이닉스' },
  { ticker: 'hyundai',  label: '현대차' },
];

const INDEX_TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'ewy',       label: 'EWY' },
  { ticker: 'sp500',     label: 'S&P 500' },
  { ticker: 'nq',        label: 'Nasdaq 100' },
  { ticker: 'kospi200f', label: 'KOSPI 200F' },
];

export default function App() {
  const { data, error, isLoading } = usePrices();
  const ts = data?.ts;
  const krxClosed = !!data?.session && !data.session.krx;

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <span className="logo-dot" aria-hidden />
          <div>
            <h1>kr-multi-market</h1>
            <div className="sub">Korean × Bloomberg · v0.3.0</div>
          </div>
        </div>
        <div className="meta">
          <FxHeader fx={data?.fx} />
          <SessionBadges session={data?.session} />
          <div className="meta-controls">
            <ThemeToggle />
            {error ? (
              <span className="err-pill">⚠ {(error as Error).message}</span>
            ) : isLoading ? (
              <span className="muted">loading…</span>
            ) : ts ? (
              <span className="muted num">↻ {new Date(ts).toLocaleTimeString('ko-KR')}</span>
            ) : null}
          </div>
        </div>
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
        <h2 className="section-title">
          지수 / ETF <span className="section-subtitle">Multi-venue</span>
        </h2>
        <div className="bento-4up">
          {INDEX_TICKERS.map(({ ticker, label }) => (
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

- [ ] **Step 2: Verify nightMode removed**

```bash
grep -rn "nightMode" src/ --include='*.tsx' --include='*.ts'
```
Expected: 0 hits.

- [ ] **Step 3: 빌드 + 테스트**

```bash
pnpm build && pnpm test
```
Expected: 모두 통과. 브라우저 새로고침 → 한국 주식 3종이 main, 지수 4종이 sub.

- [ ] **Step 4: 다크/라이트 양 모드 시각 확인 (수동, sample 캡처)**

브라우저에서 ThemeToggle 로 다크↔라이트 전환 후 양쪽 모두 정상 렌더 확인. 스크린샷 캡처 → baseline 디렉토리에 `after-B5-dark.png` / `after-B5-light.png` 로 저장 (PR 첨부용 sample).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx docs/superpowers/specs/baseline/
git commit -m "feat(client): promote Korean stocks to main (Bento 3-up), demote KOSPI to indices 4th slot, remove nightMode branch (Wave 2)"
```

## Task B6: ThemeToggle 키보드 't' shortcut + 가드

**Files:**
- Modify: `src/components/ThemeToggle.tsx`
- Modify: `src/components/ThemeToggle.test.tsx`

- [ ] **Step 1: Write the failing tests (TDD, 가드 케이스)**

`src/components/ThemeToggle.test.tsx` 끝에 추가:

```tsx
import { fireEvent } from '@testing-library/react';

describe('ThemeToggle keyboard shortcut "t"', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('cycles theme on plain "t" keypress', () => {
    render(<ThemeToggle />);
    // initial = system (defaults to dark in jsdom env w/o matchMedia light)
    fireEvent.keyDown(document, { key: 't' });
    // dark → light (cycle order: dark → light → system → dark)
    expect(localStorage.getItem('kr-mm:theme')).toBe('light');
  });

  it('ignores "t" when focus is on <input>', () => {
    render(
      <>
        <ThemeToggle />
        <input data-testid="text" />
      </>
    );
    const input = screen.getByTestId('text');
    input.focus();
    const before = localStorage.getItem('kr-mm:theme');
    fireEvent.keyDown(input, { key: 't' });
    expect(localStorage.getItem('kr-mm:theme')).toBe(before);
  });

  it('ignores "t" when focus is on <textarea>', () => {
    render(
      <>
        <ThemeToggle />
        <textarea data-testid="ta" />
      </>
    );
    const ta = screen.getByTestId('ta');
    ta.focus();
    const before = localStorage.getItem('kr-mm:theme');
    fireEvent.keyDown(ta, { key: 't' });
    expect(localStorage.getItem('kr-mm:theme')).toBe(before);
  });

  it('ignores "t" when focus is on [contenteditable]', () => {
    render(
      <>
        <ThemeToggle />
        <div data-testid="ce" contentEditable />
      </>
    );
    const ce = screen.getByTestId('ce');
    ce.focus();
    const before = localStorage.getItem('kr-mm:theme');
    fireEvent.keyDown(ce, { key: 't' });
    expect(localStorage.getItem('kr-mm:theme')).toBe(before);
  });

  it('ignores Ctrl+t / Meta+t / Alt+t (modifier combos)', () => {
    render(<ThemeToggle />);
    const before = localStorage.getItem('kr-mm:theme');
    fireEvent.keyDown(document, { key: 't', ctrlKey: true });
    fireEvent.keyDown(document, { key: 't', metaKey: true });
    fireEvent.keyDown(document, { key: 't', altKey: true });
    expect(localStorage.getItem('kr-mm:theme')).toBe(before);
  });
});
```

- [ ] **Step 2: Run new tests to verify fail**

```bash
pnpm test -- src/components/ThemeToggle.test.tsx
```
Expected: new tests FAIL.

- [ ] **Step 3: Add keyboard handler to ThemeToggle**

`src/components/ThemeToggle.tsx` 의 `ThemeToggle` 함수 안 `cycle` 정의 후에 추가:

```tsx
// 키보드 't' shortcut — guard against form inputs + modifier combos
useEffect(() => {
  function shouldIgnore(e: KeyboardEvent): boolean {
    if (e.altKey || e.ctrlKey || e.metaKey) return true;
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key !== 't' && e.key !== 'T') return;
    if (shouldIgnore(e)) return;
    cycle();
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [cycle]);
```

- [ ] **Step 4: Run all ThemeToggle tests**

```bash
pnpm test -- src/components/ThemeToggle.test.tsx
```
Expected: 모두 PASS.

- [ ] **Step 5: Update button title to mention 't' shortcut**

`ThemeToggle.tsx` 의 `<button title={...}>` 을:

```tsx
title={`Theme: ${label} (click or press 't' to cycle dark → light → system)`}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ThemeToggle.tsx src/components/ThemeToggle.test.tsx
git commit -m "feat(client): add 't' keyboard shortcut to ThemeToggle w/ input-focus + modifier guard (Wave 4)"
```

## Task B7: WCAG axe-core CI gate

**Files:**
- Modify: `package.json`, `vitest.config.ts`
- Create: `src/tests/a11y.test.tsx`, `src/tests/setup.ts`

- [ ] **Step 1: Install vitest-axe**

```bash
pnpm add -D vitest-axe@^0.1.0 jest-axe@^9.0.0
```

- [ ] **Step 2: Setup file**

`src/tests/setup.ts`:

```ts
import 'vitest-axe/extend-expect';
```

- [ ] **Step 3: Vitest config — setupFiles**

`vitest.config.ts` 의 client project 에 `setupFiles` 추가:

```ts
{
  extends: true,
  test: {
    name: 'client',
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.ts'],
  },
},
```

- [ ] **Step 4: Write a11y test**

`src/tests/a11y.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { SWRConfig } from 'swr';
import App from '../App';

const stubData = {
  ts: Date.now(),
  fx: { usdtKrw: 1470, usdKrw: 1471.7, source: 'upbit', officialUsdKrw: 1471.7 },
  session: { krx: false, nyse: false, cme: true },
  sourceHealth: {},
  tickers: {
    samsung: {
      hl: { symbol: 'xyz_SMSN', price: 202.19, unit: 'USD', change24hPct: -2.32, asOfMs: Date.now() },
      naver: { price: 285500, status: 'ok', asOfMs: Date.now() },
      premium: { pctUsd: 4.23, pctUsdt: 4.2, guard: 'ok' },
    },
    skhynix: {
      hl: { symbol: 'xyz_SKHX', price: 1323, unit: 'USD', change24hPct: 4.99, asOfMs: Date.now() },
      naver: { price: 1880000, status: 'ok', asOfMs: Date.now() },
      premium: { pctUsd: 3.63, pctUsdt: 3.5, guard: 'ok' },
    },
    hyundai: {
      hl: { symbol: 'xyz_HYUNDAI', price: 441, unit: 'USD', change24hPct: -2.21, asOfMs: Date.now() },
      naver: { price: 646000, status: 'ok', asOfMs: Date.now() },
      premium: { pctUsd: 0.46, pctUsdt: 0.4, guard: 'ok' },
    },
    ewy: {
      hl: { symbol: 'xyz_EWY', price: 193.16, unit: 'USD', change24hPct: -1.63, asOfMs: Date.now() },
      binance: { symbol: 'EWYUSDT', price: 193.17, unit: 'USDT', change24hPct: -1.07, asOfMs: Date.now() },
    },
    sp500: {
      hl: { symbol: 'xyz_SP500', price: 7414.80, unit: 'pt', change24hPct: 0.02, asOfMs: Date.now() },
      binance: { symbol: 'SPYUSDT', price: 739.73, unit: 'USDT', change24hPct: 0.14, asOfMs: Date.now() },
    },
    nq: {
      hl: undefined,
      binance: { symbol: 'QQQUSDT', price: 713.45, unit: 'USDT', change24hPct: 0.06, asOfMs: Date.now() },
    },
    kospi200f: {
      hl: { symbol: 'xyz_KR200', price: 1236.40, unit: 'USD', change24hPct: 1.60, asOfMs: Date.now() },
    },
  },
};

describe('axe a11y — App in both themes', () => {
  it('has no critical violations in dark theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { container } = render(
      <SWRConfig value={{ fetcher: () => stubData, dedupingInterval: 0 }}>
        <App />
      </SWRConfig>
    );
    const results = await axe(container);
    const critical = (results.violations || []).filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  it('has no critical violations in light theme', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { container } = render(
      <SWRConfig value={{ fetcher: () => stubData, dedupingInterval: 0 }}>
        <App />
      </SWRConfig>
    );
    const results = await axe(container);
    const critical = (results.violations || []).filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
});
```

- [ ] **Step 5: Run a11y test**

```bash
pnpm test -- src/tests/a11y.test.tsx
```
Expected: PASS (critical violations 0). Fail 시 violations 메시지 보고 fix.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/tests/ vitest.config.ts
git commit -m "feat(test): add axe-core a11y gate for dark/light themes (Wave 4)"
```

## Task B8: Legacy 컴포넌트 삭제 (`PriceCard`, `IndexCompareCard`)

**Files:**
- Delete: `src/components/PriceCard.tsx`, `src/components/PriceCard.test.tsx` (있다면)
- Delete: `src/components/IndexCompareCard.tsx`, `src/components/IndexCompareCard.test.tsx`

- [ ] **Step 1: 소비자 grep 검증 (삭제 전 필수)**

```bash
grep -rn "from.*PriceCard"      src/ --include='*.tsx' --include='*.ts' | grep -v 'PriceCard.test'
grep -rn "from.*IndexCompareCard" src/ --include='*.tsx' --include='*.ts' | grep -v 'IndexCompareCard.test'
```
Expected: **0 hits** (둘 다). App.tsx 가 Task B5 에서 신규 컴포넌트만 사용하도록 변경됨.

- [ ] **Step 2: 파일 삭제**

```bash
rm -f src/components/PriceCard.tsx
rm -f src/components/PriceCard.test.tsx 2>/dev/null || true
rm -f src/components/IndexCompareCard.tsx
rm -f src/components/IndexCompareCard.test.tsx
```

- [ ] **Step 3: 빌드 + 테스트**

```bash
pnpm build && pnpm test
```
Expected: 모두 통과.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/
git commit -m "refactor(client): remove legacy PriceCard + IndexCompareCard (replaced by StockHeroCard + IndexCompactCard)"
```

## Task B9: legacy.css 삭제 + 미참조 검증

**Files:**
- Delete: `src/styles/legacy.css`
- Modify: `src/App.css` (legacy.css @import 제거)

- [ ] **Step 1: legacy.css 내 셀렉터 사용처 grep**

```bash
# legacy.css 안의 모든 클래스 셀렉터 추출
grep -oE '^\.[a-zA-Z][a-zA-Z0-9_-]*' src/styles/legacy.css | sort -u > /tmp/legacy-classes.txt
# 각 클래스가 components/App.tsx 에서 사용되는지 확인
while read cls; do
  name="${cls#.}"
  hits=$(grep -rn "$name" src/components src/App.tsx 2>/dev/null | wc -l)
  echo "$cls $hits"
done < /tmp/legacy-classes.txt
```
Expected: 모든 클래스가 0 hits. 살아있는 클래스가 있으면 해당 컴포넌트 정리 또는 클래스 변경.

- [ ] **Step 2: 파일 삭제 + @import 라인 제거**

```bash
rm src/styles/legacy.css
# App.css 에서 legacy 라인 제거
sed -i '' "/legacy\.css/d" src/App.css
```

- [ ] **Step 3: 빌드 + 테스트 + 시각 확인**

```bash
pnpm build && pnpm test
```
브라우저 새로고침 → 다크/라이트 양 모드 정상 렌더 확인.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git rm src/styles/legacy.css
git commit -m "chore(css): remove legacy.css shell (no more references)"
```

## Task B10: 최종 검증 + smoke + PR 스크린샷

**Files:** (검증 only)

- [ ] **Step 1: 전체 검증 단계 모두 실행**

```bash
pnpm build                                                        # TS strict + Vite
pnpm exec tsc --noEmit -p tsconfig.app.json                       # client TS
pnpm exec tsc --noEmit -p server/tsconfig.json                    # server TS
pnpm test                                                          # vitest 전체
```
Expected: 모두 통과.

- [ ] **Step 2: spec §10 완료 조건 모두 체크**

수동 체크:
- [x] 1. `pnpm build` 통과
- [x] 2. `pnpm test` 통과
- [x] 3. StockHeroCard / IndexCompactCard / PremiumGauge 단위 테스트 7~9 케이스 통과
- [x] 4. 다크/라이트 양 모드 시각 회귀 캡처 (sample) 첨부
- [x] 5. axe-core critical 0 (Task B7)
- [x] 6. App.css ≤ 20 라인, 각 sub-module ≤ 200 라인 (Task A6)
- [x] 7. `grep -rn "nightMode" src/` 0건
- [x] 8. 키보드 `t` 단축키 작동 + guard 단위 테스트 통과
- [x] 9. `legacy.css` 없음, 레거시 클래스 사용처 0건
- [x] 10. `--ts-*` 토큰 사용처 = §5.2 정의 6개만

```bash
grep -rn "nightMode" src/                           # Expected: 0
grep -roE '\-\-ts-[a-z-]+' src/styles/ src/components/ | sort -u  # 6 토큰만
ls src/styles/legacy.css 2>/dev/null && echo "FAIL: legacy.css still exists"
```

- [ ] **Step 3: 다크/라이트 양 모드 스크린샷 (최종, PR 첨부용 sample)**

브라우저 캡처:
- baseline 디렉토리에 `final-dark.png` / `final-light.png`

- [ ] **Step 4: 사용자 smoke 요청**

```
브라우저 http://localhost:5173 직접 열어서:
1. 다크 모드에서 한국 주식 3종이 메인으로 크게 보이는지
2. KOSPI 200F 가 지수 섹션 4번째 슬롯에 작게 들어있는지
3. ThemeToggle 클릭 → 라이트 모드 정상 전환
4. 키보드 't' 키 → 토글 작동
5. <input> 에 포커스 두고 't' 키 → 토글 안 됨
6. 5초마다 가격 flash 애니메이션 작동
7. premium gauge 가 ±5% 범위 내에서 dot 위치 정확
```

- [ ] **Step 5: 최종 commit**

```bash
git add docs/superpowers/specs/baseline/
git commit -m "chore(docs): final dark/light screenshots after Phase B (v0.3.0)"
```

- [ ] **Step 6: Codex #4 체크포인트 — 전체 v0.3.0 final 리뷰**

```
Agent tool 호출:
  subagent_type: codex:codex-rescue
  prompt: |
    Mode: REVIEW ONLY. Pre-merge final review of dashboard-redesign v0.3.0.
    
    Context: Phase A (CSS modularization) + Phase B (component restructure) all completed.
    Total commits: ~16 (A0-A5, B1-B10).
    
    Spec ref: docs/superpowers/specs/2026-05-12-dashboard-redesign-design.md
    Plan ref: docs/superpowers/plans/2026-05-12-dashboard-redesign.md
    
    Please verify spec §10 검증 기준 (all 10 items):
    1. pnpm build passes
    2. pnpm test passes (all suites incl. a11y)
    3. StockHeroCard / IndexCompactCard / PremiumGauge unit tests cover 7+ null/fallback cases
    4. dark/light screenshots attached at baseline dir
    5. axe-core critical violations = 0 (both themes)
    6. App.css <= 20 lines, each sub-module <= 200 lines
    7. grep "nightMode" src/ → 0 hits
    8. keyboard 't' shortcut + input-focus/modifier guards pass tests
    9. legacy.css deleted, no legacy class references
    10. --ts-* tokens used only as defined in spec §5.2 (6 tokens)
    
    Plus regression check:
    - 라이트 모드 WCAG AA contrast (--text-muted on white)
    - Korean stocks 3 cards = main bento, KOSPI 200F = 4th slot in indices section
    - "(closed)" marker + KRX CLOSED signal when KRX closed
    - flash-up/flash-down animation still works
    
    [카파시 스타일 / AI slop 금지 — 의무 검증]
    - 새로 추가된 1-use 헬퍼 있는가?
    - Header/SectionTitle 추출됐는가? (spec §7.4: inline 유지가 정답)
    - Generic gauge framework 로 팽창했는가?
    - 사용자 미요청 기능 (sparkline/chart/alert) 추가됐는가?
    
    Output: BLOCK / FLAG / PASS verdict per spec §10 item.
    If PASS, this PR is ready for human merge.
```

Expected: PASS. BLOCK 발견 시 v0.3.0 머지 보류, 지적 사항 fix → 재호출.

- [ ] **Step 7: 사용자에게 v0.3.0 머지/태그 결정 위임**

PR 생성 또는 master 머지 결정을 사용자에게 요청. 본 plan 범위 밖.

---

## Wave 종료별 검증 매트릭스

| Wave | 종료 시점 | build | test | 시각 diff | grep 검증 |
|---|---|---|---|---|---|
| Wave 1 (A6 끝) | CSS 모듈화 완료 | ✓ | ✓ | dark/light diff 0 | className diff 0 + CSS selector diff 0 |
| Wave 2 (B5 끝) | 한국 주식 main + nightMode 제거 | ✓ | ✓ | 새 레이아웃 캡처 | `nightMode` 0 hits |
| Wave 3 (B8 끝) | Legacy 컴포넌트 삭제 | ✓ | ✓ | 동일 | `PriceCard` / `IndexCompareCard` import 0 hits |
| Wave 4 (B7+B9 끝) | a11y gate + legacy.css 삭제 | ✓ | ✓ + axe critical 0 | 동일 | legacy 클래스 0 hits |
| Wave 5 (B10 끝) | 최종 smoke | ✓ | ✓ | final 캡처 | 모든 spec §10 체크 |

---

## Open Decisions (Plan 실행 시 사용자 입력 필요)

1. **Phase 분리 머지 vs 단일 머지**: spec §12 Q-A — Wave 1 (Phase A) 만 별개 PR 로 머지하고 후속 머지로 Phase B 진행할지, 또는 모든 Wave 후 한 번에 머지할지. 추천: Phase 분리 (Codex 권장).
2. **Execution mode**: subagent-driven (per-task fresh subagent + review) vs inline (한 세션에서 batch 실행 with checkpoint).
3. **PR target branch**: 직접 master 머지 vs feature branch + review.

---

## References

- Spec: `(spec dir)/2026-05-12-dashboard-redesign-design.md`
- Existing files inspected: `src/App.tsx` (139 lines), `src/App.css` (1245 lines), `src/components/PriceCard.tsx`, `src/components/IndexCompareCard.tsx`, `src/components/ThemeToggle.tsx`, `src/components/PremiumRow.tsx`, `src/components/SignalBadge.tsx`, `src/lib/format.ts`
- TS path alias: `@shared/*` → `shared/*` (tsconfig.app.json + vite.config.ts + vitest.config.ts 모두 설정 확인됨)
- Test env: vitest 4 + happy-dom + `src/tests/setup.ts` (Wave 4 추가)
