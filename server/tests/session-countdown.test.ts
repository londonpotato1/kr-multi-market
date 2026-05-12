import { describe, it, expect } from 'vitest';
import { getSessionState } from '../lib/session.js';

describe('session countdown — KRX', () => {
  it('returns krxMinsUntilClose during open hours', () => {
    // 평일 14:00 KST = 05:00 UTC, KRX 마감(15:30 KST)까지 90분
    const krxOpen = new Date('2025-01-15T05:00:00Z');
    const s = getSessionState(krxOpen);
    expect(s.krx).toBe(true);
    expect(s.krxMinsUntilClose).toBe(90);
    expect(s.krxMinsUntilOpen).toBeUndefined();
  });

  it('returns krxMinsUntilOpen after market close on weekday', () => {
    // 수요일 16:00 KST = 07:00 UTC. 다음 개장은 목요일 09:00 KST = 17시간 후.
    const afterClose = new Date('2025-01-15T07:00:00Z');
    const s = getSessionState(afterClose);
    expect(s.krx).toBe(false);
    expect(s.krxMinsUntilOpen).toBe(17 * 60);
    expect(s.krxMinsUntilClose).toBeUndefined();
  });

  it('returns krxMinsUntilOpen early morning before 09:00 KST', () => {
    // 평일 08:00 KST = -1d 23:00 UTC. 같은 날 09:00 KST 까지 60분.
    const earlyMorning = new Date('2025-01-14T23:00:00Z'); // 수요일 08:00 KST
    const s = getSessionState(earlyMorning);
    expect(s.krx).toBe(false);
    expect(s.krxMinsUntilOpen).toBe(60);
  });

  it('handles weekend — Saturday → Monday open', () => {
    // 토요일 12:00 KST = 03:00 UTC. 월요일 09:00 KST 까지 = 약 45시간 (2700분)
    const saturday = new Date('2025-01-18T03:00:00Z');
    const s = getSessionState(saturday);
    expect(s.krx).toBe(false);
    expect(s.krxMinsUntilOpen).toBeDefined();
    expect(s.krxMinsUntilOpen).toBe(45 * 60); // 2700
  });
});
