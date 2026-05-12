import type { FxRates, GuardResult, Premium, PricePoint } from '@shared/types/prices.js';

const GDR_EPSILON = 1e-6;

function validPositivePrice(pp: PricePoint | undefined): number | undefined {
  if (!pp || !Number.isFinite(pp.price) || pp.price <= 0) {
    return undefined;
  }

  return pp.price;
}

/**
 * Build FxRates from per-source PricePoints. Resilient to missing sources.
 *
 * Priority for officialUsdKrw:
 *   1. Yahoo KRW=X (if available and ok)
 *   2. xyz_KRW from Hyperliquid (always available)
 *
 * usdtKrw: always from Upbit if available, else 0 (and divergencePct = 0)
 *
 * @param hlKrw       PricePoint for xyz_KRW (always present in HL response)
 * @param yahooKrwX   Optional PricePoint for KRW=X (Yahoo may rate-limit)
 * @param upbit       Optional PricePoint for KRW-USDT
 */
export function buildFxRates(
  hlKrw: PricePoint | undefined,
  yahooKrwX: PricePoint | undefined,
  upbit: PricePoint | undefined,
): FxRates {
  const yahooPrice = yahooKrwX?.status !== 'down' && yahooKrwX?.status !== 'degraded'
    ? validPositivePrice(yahooKrwX)
    : undefined;
  const hlInferredKrw = validPositivePrice(hlKrw);
  const officialUsdKrw = yahooPrice ?? hlInferredKrw ?? 0;
  const usdtKrw = validPositivePrice(upbit) ?? 0;
  const divergencePct = officialUsdKrw > 0 && usdtKrw > 0
    ? ((usdtKrw - officialUsdKrw) / officialUsdKrw) * 100
    : 0;

  return {
    officialUsdKrw,
    usdtKrw,
    hlInferredKrw,
    divergencePct,
  };
}

/**
 * GDR runtime guard (PLAN.md §4.3, Round 2 fail-closed).
 *
 * Returns:
 *   - 'normal' if ratio in [0.95, 1.05]
 *   - 'warn'   if ratio in [0.85, 1.15] but outside normal
 *   - 'blocked' otherwise (premium calc must be suppressed)
 *
 * Edge cases handled:
 *   - Missing inputs → 'blocked' with reason
 *   - Zero or non-finite values → 'blocked' with reason
 */
export function gdrGuard(
  hlUsd: number | undefined,
  krxKrw: number | undefined,
  fxOfficial: number | undefined,
): GuardResult {
  if (hlUsd === undefined || krxKrw === undefined || fxOfficial === undefined) {
    return { state: 'blocked', ratio: 0, reason: 'missing_or_invalid_input' };
  }
  if (!Number.isFinite(hlUsd) || !Number.isFinite(krxKrw) || !Number.isFinite(fxOfficial)) {
    return { state: 'blocked', ratio: 0, reason: 'missing_or_invalid_input' };
  }
  if (hlUsd <= 0 || krxKrw <= 0 || fxOfficial <= 0) {
    return { state: 'blocked', ratio: 0, reason: 'non_positive_input' };
  }

  const ratio = (hlUsd * fxOfficial) / krxKrw;
  if (ratio >= 0.95 - GDR_EPSILON && ratio <= 1.05 + GDR_EPSILON) {
    return { state: 'normal' };
  }
  if (ratio >= 0.85 - GDR_EPSILON && ratio <= 1.15 + GDR_EPSILON) {
    return { state: 'warn', ratio };
  }

  return { state: 'blocked', ratio, reason: 'gdr_ratio_drift' };
}

/**
 * Compute premium percentage with USDT and USD comparison.
 * Returns null premium values if guard is blocked.
 *
 * @param hlUsd      HL price in USD
 * @param krxKrw     KRX spot price in KRW
 * @param fx         FxRates from buildFxRates
 */
export function computePremium(
  hlUsd: number | undefined,
  krxKrw: number | undefined,
  fx: FxRates,
): Premium {
  const guard = gdrGuard(hlUsd, krxKrw, fx.officialUsdKrw);
  if (guard.state === 'blocked') {
    return { pctUsd: null, pctUsdt: null, guard: guard.state };
  }

  const hlKrwUsingUsd = (hlUsd as number) * fx.officialUsdKrw;
  const hlKrwUsingUsdt = (hlUsd as number) * fx.usdtKrw;
  const pctUsd = ((hlKrwUsingUsd - (krxKrw as number)) / (krxKrw as number)) * 100;
  const pctUsdt = Number.isFinite(fx.usdtKrw) && fx.usdtKrw > 0
    ? ((hlKrwUsingUsdt - (krxKrw as number)) / (krxKrw as number)) * 100
    : null;

  return { pctUsd, pctUsdt, guard: guard.state };
}

// spec §2.5: HL vs Naver fetch 시점 격차 > 5s 시 premium 신뢰성 낮음 → null + guard='warn'
export const MAX_PREMIUM_SKEW_MS = 5000;

export function computePremiumWithSkew(
  hl: PricePoint | undefined,
  naver: PricePoint | undefined,
  fx: FxRates,
): Premium {
  if (!hl || !naver) {
    // 기존 computePremium 동작 보존: 둘 중 하나 undefined → gdrGuard 'blocked'
    return { pctUsd: null, pctUsdt: null, guard: 'blocked' };
  }
  const skewMs = Math.abs(hl.asOf - naver.asOf);
  if (skewMs > MAX_PREMIUM_SKEW_MS) {
    return { pctUsd: null, pctUsdt: null, guard: 'warn' };
  }
  return computePremium(hl.price, naver.price, fx);
}
