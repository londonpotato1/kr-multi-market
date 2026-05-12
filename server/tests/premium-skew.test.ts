import { describe, it, expect } from 'vitest';
import { computePremiumWithSkew, MAX_PREMIUM_SKEW_MS } from '../lib/normalize.js';
import type { PricePoint, FxRates } from '@shared/types/prices.js';

const now = Date.now();
const fxOk: FxRates = { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 };
const mkPP = (price: number, asOf: number, source: PricePoint['source'] = 'hyperliquid'): PricePoint => ({
  source, symbol: '', price, unit: 'USD', status: 'ok',
  asOf, receivedAt: now, schemaVersion: 1,
});

describe('computePremiumWithSkew', () => {
  it('exports MAX_PREMIUM_SKEW_MS = 5000', () => {
    expect(MAX_PREMIUM_SKEW_MS).toBe(5000);
  });

  it('returns normal premium when skew within 5s', () => {
    const hl = mkPP(189, now);
    const naver = mkPP(279000, now - 3000, 'naver'); // 3s skew
    const result = computePremiumWithSkew(hl, naver, fxOk);
    expect(result.pctUsd).not.toBeNull();
    expect(result.guard).toBe('normal');
  });

  it('returns null + guard=warn when skew exceeds 5s', () => {
    const hl = mkPP(189, now);
    const naver = mkPP(279000, now - 6000, 'naver'); // 6s skew
    const result = computePremiumWithSkew(hl, naver, fxOk);
    expect(result.pctUsd).toBeNull();
    expect(result.guard).toBe('warn');
  });

  it('returns null + guard=blocked when hl undefined (matches existing computePremium)', () => {
    const naver = mkPP(279000, now, 'naver');
    const result = computePremiumWithSkew(undefined, naver, fxOk);
    expect(result.pctUsd).toBeNull();
    expect(result.guard).toBe('blocked');
  });

  it('returns null + guard=blocked when naver undefined (matches existing computePremium)', () => {
    const hl = mkPP(189, now);
    const result = computePremiumWithSkew(hl, undefined, fxOk);
    expect(result.pctUsd).toBeNull();
    expect(result.guard).toBe('blocked');
  });

  it('boundary: skew = exactly 5000ms → guard=normal (strict >)', () => {
    const hl = mkPP(189, now);
    const naver5000 = mkPP(279000, now - 5000, 'naver');
    expect(computePremiumWithSkew(hl, naver5000, fxOk).guard).toBe('normal');
    const naver5001 = mkPP(279000, now - 5001, 'naver');
    expect(computePremiumWithSkew(hl, naver5001, fxOk).guard).toBe('warn');
  });
});
