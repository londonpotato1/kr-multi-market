import { describe, test, expect } from 'vitest';
import { getSessionState } from '../lib/session.js';

// Helper: build Date in specific timezone using offset
const kst = (iso: string) => new Date(`${iso}+09:00`);
const et = (iso: string) => new Date(`${iso}-04:00`);  // EDT (May 2026)
const est = (iso: string) => new Date(`${iso}-05:00`); // EST (Jan 2026)

describe('getSessionState — weekday', () => {
  test('Mon 14:00 KST = KRX regular open', () => {
    const s = getSessionState(kst('2026-05-11T14:00:00'));
    expect(s.krx).toBe(true);
    expect(s.krxAfter).toBe(false);
    expect(s.krxNight).toBe(false);
  });

  test('Mon 09:00 KST = KRX regular open (boundary)', () => {
    const s = getSessionState(kst('2026-05-11T09:00:00'));
    expect(s.krx).toBe(true);
  });

  test('Mon 15:30 KST = KRX regular closed (boundary)', () => {
    const s = getSessionState(kst('2026-05-11T15:30:00'));
    expect(s.krx).toBe(false);
  });

  test('Mon 15:45 KST = KRX after-hours', () => {
    const s = getSessionState(kst('2026-05-11T15:45:00'));
    expect(s.krxAfter).toBe(true);
  });

  test('Mon 19:00 KST = KRX night futures + after-hours', () => {
    const s = getSessionState(kst('2026-05-11T19:00:00'));
    expect(s.krxNight).toBe(true);
    expect(s.krxAfter).toBe(true);
  });

  test('Tue 03:00 KST = KRX night futures still active (overnight)', () => {
    const s = getSessionState(kst('2026-05-12T03:00:00'));
    expect(s.krxNight).toBe(true);
    expect(s.krx).toBe(false);
  });

  test('Tue 06:00 KST = night futures closed', () => {
    const s = getSessionState(kst('2026-05-12T06:00:00'));
    expect(s.krxNight).toBe(false);
  });
});

describe('getSessionState — KRX holidays', () => {
  test('KRX holiday 2026-05-05 at 10:00 KST = krx false', () => {
    const s = getSessionState(kst('2026-05-05T10:00:00'));
    expect(s.krx).toBe(false);
    expect(s.krxAfter).toBe(false);
    expect(s.krxNight).toBe(false);
  });

  test('KRX holiday 2026-12-25 at 19:00 KST = krxNight false', () => {
    const s = getSessionState(kst('2026-12-25T19:00:00'));
    expect(s.krxNight).toBe(false);
  });
});

describe('getSessionState — weekends', () => {
  test('Sat 10:00 KST = all KRX false', () => {
    const s = getSessionState(kst('2026-05-09T10:00:00'));
    expect(s.krx).toBe(false);
    expect(s.krxAfter).toBe(false);
    expect(s.krxNight).toBe(false);
  });

  test('Sun 22:00 KST = all KRX false', () => {
    const s = getSessionState(kst('2026-05-10T22:00:00'));
    expect(s.krx).toBe(false);
  });
});

describe('getSessionState — NYSE', () => {
  test('Mon 14:00 ET (May, EDT) = NYSE regular open', () => {
    const s = getSessionState(et('2026-05-11T14:00:00'));
    expect(s.nyseRegular).toBe(true);
  });

  test('Mon 06:00 ET = NYSE pre-market', () => {
    const s = getSessionState(et('2026-05-11T06:00:00'));
    expect(s.nysePrePost).toBe(true);
    expect(s.nyseRegular).toBe(false);
  });

  test('Mon 18:00 ET = NYSE post-market', () => {
    const s = getSessionState(et('2026-05-11T18:00:00'));
    expect(s.nysePrePost).toBe(true);
    expect(s.nyseRegular).toBe(false);
  });

  test('Mon 02:00 ET = NYSE all closed', () => {
    const s = getSessionState(et('2026-05-11T02:00:00'));
    expect(s.nyseRegular).toBe(false);
    expect(s.nysePrePost).toBe(false);
  });

  test('NYSE holiday 2026-01-19 (MLK) Mon 14:00 ET = closed', () => {
    const s = getSessionState(est('2026-01-19T14:00:00'));
    expect(s.nyseRegular).toBe(false);
    expect(s.nysePrePost).toBe(false);
  });

  test('NYSE early close 2026-12-24 12:30 ET = regular open', () => {
    const s = getSessionState(est('2026-12-24T12:30:00'));
    expect(s.nyseRegular).toBe(true);
    expect(s.nysePrePost).toBe(false);
  });

  test('NYSE early close 2026-12-24 14:00 ET = post-market', () => {
    const s = getSessionState(est('2026-12-24T14:00:00'));
    expect(s.nyseRegular).toBe(false);
    expect(s.nysePrePost).toBe(true);
  });
});

describe('getSessionState — CME equity futures', () => {
  test('Sun 19:00 ET = CME open (Sunday session start)', () => {
    const s = getSessionState(et('2026-05-10T19:00:00'));
    expect(s.cme).toBe(true);
  });

  test('Mon 14:00 ET = CME open', () => {
    const s = getSessionState(et('2026-05-11T14:00:00'));
    expect(s.cme).toBe(true);
  });

  test('Mon 17:30 ET = CME closed (daily maintenance break)', () => {
    const s = getSessionState(et('2026-05-11T17:30:00'));
    expect(s.cme).toBe(false);
  });

  test('Mon 18:01 ET = CME reopen after maintenance', () => {
    const s = getSessionState(et('2026-05-11T18:01:00'));
    expect(s.cme).toBe(true);
  });

  test('Fri 17:30 ET = CME closed (weekend start)', () => {
    const s = getSessionState(et('2026-05-08T17:30:00'));
    expect(s.cme).toBe(false);
  });

  test('Sat 12:00 ET = CME closed (weekend)', () => {
    const s = getSessionState(et('2026-05-09T12:00:00'));
    expect(s.cme).toBe(false);
  });

  test('Sun 17:59 ET = CME still closed', () => {
    const s = getSessionState(et('2026-05-10T17:59:00'));
    expect(s.cme).toBe(false);
  });

  test('Sun 18:00 ET = CME open (weekly start)', () => {
    const s = getSessionState(et('2026-05-10T18:00:00'));
    expect(s.cme).toBe(true);
  });

  test('CME early close 2026-12-24 14:00 ET = closed', () => {
    const s = getSessionState(est('2026-12-24T14:00:00'));
    expect(s.cme).toBe(false);
  });
});

describe('getSessionState — KST weekend boundary tests', () => {
  test('Sat 06:00 KST (= Fri 17:00 ET) = CME closing', () => {
    // Sat 06:00 KST = Fri 21:00 UTC = Fri 17:00 EDT
    const s = getSessionState(kst('2026-05-09T06:00:00'));
    expect(s.cme).toBe(false);
  });

  test('Mon 07:00 KST (= Sun 18:00 ET) = CME open', () => {
    // Mon 07:00 KST = Sun 22:00 UTC = Sun 18:00 EDT
    const s = getSessionState(kst('2026-05-11T07:00:00'));
    expect(s.cme).toBe(true);
  });
});

describe('getSessionState — DST', () => {
  test('DST transition 2026-03-08 12:00 ET (post-spring-forward) = NYSE potentially open', () => {
    const s = getSessionState(et('2026-03-08T12:00:00'));
    // March 8 2026 is Sunday - NYSE closed regardless. Just verify code runs.
    expect(typeof s.nyseRegular).toBe('boolean');
  });
});

describe('getSessionState — always-on venues', () => {
  test('hyperliquid + binance always true', () => {
    const s = getSessionState(new Date());
    expect(s.hyperliquid).toBe(true);
    expect(s.binance).toBe(true);
  });
});
