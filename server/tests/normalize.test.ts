import { describe, test, expect } from 'vitest';
import { buildFxRates, gdrGuard, computePremium } from '../lib/normalize.js';
import type { PricePoint } from '@shared/types/prices.js';

const mkPp = (
  price: number,
  source: PricePoint['source'] = 'yahoo',
  symbol = 'X',
  status: PricePoint['status'] = 'ok',
): PricePoint => ({
  source,
  symbol,
  price,
  unit: 'KRW',
  status,
  asOf: Date.now(),
  receivedAt: Date.now(),
  schemaVersion: 1,
});

describe('buildFxRates', () => {
  test('uses Yahoo KRW=X when available', () => {
    const fx = buildFxRates(
      mkPp(1461.9, 'hyperliquid', 'xyz_KRW'),
      mkPp(1462, 'yahoo', 'KRW=X'),
      mkPp(1473, 'upbit', 'KRW-USDT'),
    );

    expect(fx.officialUsdKrw).toBe(1462);
    expect(fx.usdtKrw).toBe(1473);
    expect(fx.hlInferredKrw).toBe(1461.9);
    expect(fx.divergencePct).toBeCloseTo(((1473 - 1462) / 1462) * 100, 4);
  });

  test('falls back to xyz_KRW when Yahoo missing', () => {
    const fx = buildFxRates(
      mkPp(1461.9, 'hyperliquid', 'xyz_KRW'),
      undefined,
      mkPp(1473, 'upbit', 'KRW-USDT'),
    );

    expect(fx.officialUsdKrw).toBe(1461.9);
    expect(fx.divergencePct).toBeCloseTo(((1473 - 1461.9) / 1461.9) * 100, 4);
  });

  test('handles missing Upbit (usdtKrw = 0, divergence = 0)', () => {
    const fx = buildFxRates(mkPp(1461.9, 'hyperliquid', 'xyz_KRW'), undefined, undefined);

    expect(fx.usdtKrw).toBe(0);
    expect(fx.divergencePct).toBe(0);
  });
});

describe('gdrGuard', () => {
  test('normal ratio (1.0)', () => {
    // hlUsd=200, fx=1462 -> 200*1462=292400, krxKrw=292400 -> ratio=1.0
    expect(gdrGuard(200, 292400, 1462)).toEqual({ state: 'normal' });
  });

  test('normal upper bound (1.05)', () => {
    expect(gdrGuard(200, 278476, 1462).state).toBe('normal');
  });

  test('warn boundary (1.10)', () => {
    expect(gdrGuard(200, 265818, 1462).state).toBe('warn');
  });

  test('blocked above 1.15', () => {
    const r = gdrGuard(200, 200000, 1462);

    expect(r.state).toBe('blocked');
    if (r.state === 'blocked') expect(r.reason).toBe('gdr_ratio_drift');
  });

  test('blocked on missing inputs', () => {
    expect(gdrGuard(undefined, 100000, 1462).state).toBe('blocked');
    expect(gdrGuard(200, undefined, 1462).state).toBe('blocked');
    expect(gdrGuard(200, 100000, undefined).state).toBe('blocked');
  });

  test('blocked on non-positive inputs', () => {
    expect(gdrGuard(-1, 100000, 1462).state).toBe('blocked');
    expect(gdrGuard(200, 0, 1462).state).toBe('blocked');
  });
});

describe('computePremium', () => {
  test('positive premium (HL above KRX)', () => {
    // hl=200 USD * 1462 = 292400 KRW. KRX=290000 -> +0.83%
    const fx = buildFxRates(undefined, mkPp(1462, 'yahoo', 'KRW=X'), mkPp(1473, 'upbit', 'KRW-USDT'));
    const p = computePremium(200, 290000, fx);

    expect(p.guard).toBe('normal');
    expect(p.pctUsd).toBeCloseTo(((292400 - 290000) / 290000) * 100, 2);
  });

  test('null premium when guard blocked', () => {
    const fx = buildFxRates(undefined, mkPp(1462, 'yahoo', 'KRW=X'), undefined);
    const p = computePremium(1000, 100000, fx);

    expect(p.guard).toBe('blocked');
    expect(p.pctUsd).toBeNull();
    expect(p.pctUsdt).toBeNull();
  });
});
