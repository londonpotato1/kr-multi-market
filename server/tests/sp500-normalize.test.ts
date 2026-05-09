import { describe, test, expect } from 'vitest';
import { computeSpread } from '../lib/assemble.js';
import type { PricePoint, TickerPayload } from '@shared/types/prices.js';

const mkPp = (price: number, source: PricePoint['source'], symbol: string): PricePoint => ({
  source,
  symbol,
  price,
  unit: source === 'binance' ? 'USDT' : 'USD',
  status: 'ok',
  asOf: Date.now(),
  receivedAt: Date.now(),
  schemaVersion: 1,
});

describe('SP500 spread normalization', () => {
  test('normal SP500 ratio (~10.12) → normalized spread small', () => {
    const payload: TickerPayload = {
      hl: mkPp(7400, 'hyperliquid', 'xyz_SP500'),
      binance: mkPp(731, 'binance', 'SPYUSDT'),
    };

    const spread = computeSpread(payload, 'sp500');

    expect(spread).toBeDefined();
    expect(spread?.normalized).toBe(true);
    expect(spread?.impliedRatio).toBeCloseTo(10.12, 1);
    expect(spread?.maxPctDiff).toBeLessThan(2);
  });

  test('drift case (ratio outside [8,12]) → spread suppressed', () => {
    const payload: TickerPayload = {
      hl: mkPp(7400, 'hyperliquid', 'xyz_SP500'),
      binance: mkPp(500, 'binance', 'SPYUSDT'),
    };

    expect(computeSpread(payload, 'sp500')).toBeUndefined();
  });

  test('lower drift (ratio < 8) → spread suppressed', () => {
    const payload: TickerPayload = {
      hl: mkPp(7400, 'hyperliquid', 'xyz_SP500'),
      binance: mkPp(1100, 'binance', 'SPYUSDT'),
    };

    expect(computeSpread(payload, 'sp500')).toBeUndefined();
  });

  test('non-sp500 ticker (ewy) uses default cross-venue logic, unaffected', () => {
    const payload: TickerPayload = {
      hl: mkPp(193.5, 'hyperliquid', 'xyz_EWY'),
      binance: mkPp(193.6, 'binance', 'EWYUSDT'),
    };

    const spread = computeSpread(payload, 'ewy');

    expect(spread).toBeDefined();
    expect(spread?.normalized).toBeUndefined();
    expect(spread?.maxPctDiff).toBeLessThan(0.1);
  });

  test('SP500 with only HL (no Binance) → undefined', () => {
    const payload: TickerPayload = {
      hl: mkPp(7400, 'hyperliquid', 'xyz_SP500'),
    };

    expect(computeSpread(payload, 'sp500')).toBeUndefined();
  });
});
