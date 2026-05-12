import { describe, it, expect, vi } from 'vitest';
import { SOURCE_TTL_MS, naverTtl } from '../lib/source-cache.js';
import * as session from '../lib/session.js';

describe('SOURCE_TTL_MS', () => {
  it('defines TTL for hyperliquid/binance/upbit/yahoo', () => {
    expect(SOURCE_TTL_MS.hyperliquid).toBe(1000);
    expect(SOURCE_TTL_MS.binance).toBe(1000);
    expect(SOURCE_TTL_MS.upbit).toBe(2000);
    expect(SOURCE_TTL_MS.yahoo).toBe(5000);
  });
});

describe('naverTtl', () => {
  it('returns 2000 during KRX open session', () => {
    vi.spyOn(session, 'getSessionState').mockReturnValue({
      krx: true, krxAfter: false, krxNight: false,
      nyseRegular: false, nysePrePost: false, cme: true,
      hyperliquid: true, binance: true,
    });
    expect(naverTtl()).toBe(2000);
    vi.restoreAllMocks();
  });

  it('returns 7000 when KRX closed', () => {
    vi.spyOn(session, 'getSessionState').mockReturnValue({
      krx: false, krxAfter: true, krxNight: false,
      nyseRegular: false, nysePrePost: false, cme: true,
      hyperliquid: true, binance: true,
    });
    expect(naverTtl()).toBe(7000);
    vi.restoreAllMocks();
  });
});
