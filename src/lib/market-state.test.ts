import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { pickPrimary, pctVsClose, getStateBadge } from './market-state';
import type { SessionState, PricePoint, FxRates } from '@shared/types/prices.js';

afterEach(() => cleanup());

const now = Date.now();
const mkPP = (price: number, status: 'ok' | 'stale' = 'ok', source: PricePoint['source'] = 'hyperliquid'): PricePoint => ({
  source, symbol: '', price, unit: 'USD', status,
  asOf: now, receivedAt: now, schemaVersion: 1,
});
const mkSession = (overrides: Partial<SessionState> = {}): SessionState => ({
  krx: false, krxAfter: false, krxNight: false,
  nyseRegular: false, nysePrePost: false, cme: true,
  hyperliquid: true, binance: true, ...overrides,
});
const fxOk: FxRates = { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 };

describe('pickPrimary', () => {
  it('C1: krx ok + session open → primary=KRX, secondary=HL→KRW', () => {
    const result = pickPrimary({
      session: mkSession({ krx: true }),
      hl: mkPP(189, 'ok'),
      krx: mkPP(279000, 'ok', 'naver'),
      fx: fxOk,
    });
    expect(result.primary?.source).toBe('krx');
    expect(result.primary?.value).toBe(279000);
    expect(result.primary?.unit).toBe('KRW');
    expect(result.secondary?.source).toBe('hl');
    expect(result.secondary?.value).toBe(189 * 1470);
    expect(result.contextLabel).toContain('KRX');
  });

  it('C2: krx stale + session open → primary=HL→KRW + KRX 데이터 지연 라벨', () => {
    const result = pickPrimary({
      session: mkSession({ krx: true }),
      hl: mkPP(189, 'ok'),
      krx: mkPP(279000, 'stale', 'naver'),
      fx: fxOk,
    });
    expect(result.primary?.source).toBe('hl');
    expect(result.primary?.value).toBe(189 * 1470);
    expect(result.contextLabel).toContain('KRX 데이터 지연');
  });

  it('C3: session closed + HL ok + fx ok → primary=HL→KRW', () => {
    const result = pickPrimary({
      session: mkSession({ krx: false }),
      hl: mkPP(189, 'ok'),
      krx: mkPP(279000, 'ok', 'naver'),
      fx: fxOk,
    });
    expect(result.primary?.source).toBe('hl');
    expect(result.primary?.value).toBe(189 * 1470);
    expect(result.secondary?.source).toBe('krx');
  });

  it('C4: session closed + HL ok + fx 0 → primary=HL USD native', () => {
    const result = pickPrimary({
      session: mkSession({ krx: false }),
      hl: mkPP(189, 'ok'),
      fx: { ...fxOk, usdtKrw: 0 },
    });
    expect(result.primary?.source).toBe('hl');
    expect(result.primary?.unit).toBe('USD');
    expect(result.primary?.value).toBe(189);
  });

  it('C5: HL missing + KRX ok → primary=KRX + HL 가격 없음', () => {
    const result = pickPrimary({
      session: mkSession({ krx: false }),
      hl: undefined,
      krx: mkPP(279000, 'ok', 'naver'),
      fx: fxOk,
    });
    expect(result.primary?.source).toBe('krx');
    expect(result.contextLabel).toContain('HL');
    expect(result.secondary).toBeNull();
  });

  it('C6: both missing → primary null', () => {
    const result = pickPrimary({
      session: mkSession({ krx: false }),
      hl: undefined,
      krx: undefined,
      fx: fxOk,
    });
    expect(result.primary).toBeNull();
  });

  it('isStale flag on KRX primary when status=stale during open (C1 variant)', () => {
    const result = pickPrimary({
      session: mkSession({ krx: true }),
      hl: undefined,  // HL 없으면 stale KRX 라도 primary 가 KRX
      krx: mkPP(279000, 'stale', 'naver'),
      fx: fxOk,
    });
    expect(result.primary?.source).toBe('krx');
    expect(result.primary?.isStale).toBe(true);
  });
});

describe('pctVsClose', () => {
  it('positive change', () => {
    expect(pctVsClose(110, 100)).toBeCloseTo(10);
  });
  it('negative change', () => {
    expect(pctVsClose(90, 100)).toBeCloseTo(-10);
  });
  it('null when primaryKrw null', () => {
    expect(pctVsClose(null, 100)).toBeNull();
  });
  it('null when previousClose undefined', () => {
    expect(pctVsClose(110, undefined)).toBeNull();
  });
  it('null when previousClose === 0 (divide-by-zero guard)', () => {
    expect(pctVsClose(110, 0)).toBeNull();
  });
  it('null when previousClose < 0', () => {
    expect(pctVsClose(110, -50)).toBeNull();
  });
});

describe('getStateBadge', () => {
  it('open when session.krx === true', () => {
    expect(getStateBadge(mkSession({ krx: true }))).toBe('open');
  });
  it('night when !krx and krxAfter', () => {
    expect(getStateBadge(mkSession({ krx: false, krxAfter: true }))).toBe('night');
  });
  it('night when !krx and krxNight', () => {
    expect(getStateBadge(mkSession({ krx: false, krxNight: true }))).toBe('night');
  });
  it('holiday when !krx and !krxAfter and !krxNight', () => {
    expect(getStateBadge(mkSession({ krx: false }))).toBe('holiday');
  });
});
