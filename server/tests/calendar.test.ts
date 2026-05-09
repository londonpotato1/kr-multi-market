import { describe, test, expect } from 'vitest';
import {
  isKrxHoliday, isNyseHoliday, isCmeEquityHoliday,
  getNyseEarlyClose, getCmeEarlyClose,
  KRX_HOLIDAYS_2026, NYSE_HOLIDAYS_2026, LAST_CALENDAR_DATE,
} from '../lib/calendar.js';

describe('calendar / KRX', () => {
  test('Lunar New Year 2026-02-16 is KRX holiday at 10:00 KST', () => {
    expect(isKrxHoliday(new Date('2026-02-16T10:00:00+09:00'))).toBe(true);
  });

  test('Children\'s Day 2026-05-05 is KRX holiday', () => {
    expect(isKrxHoliday(new Date('2026-05-05T10:00:00+09:00'))).toBe(true);
  });

  test('Random weekday 2026-05-12 is NOT KRX holiday', () => {
    expect(isKrxHoliday(new Date('2026-05-12T10:00:00+09:00'))).toBe(false);
  });

  test('Christmas 2026-12-25 is KRX holiday', () => {
    expect(isKrxHoliday(new Date('2026-12-25T10:00:00+09:00'))).toBe(true);
  });

  test('KRX_HOLIDAYS_2026 has 12+ entries', () => {
    expect(KRX_HOLIDAYS_2026.length).toBeGreaterThanOrEqual(12);
  });
});

describe('calendar / NYSE', () => {
  test('MLK Day 2026-01-19 is NYSE holiday', () => {
    expect(isNyseHoliday(new Date('2026-01-19T15:00:00-05:00'))).toBe(true);
  });

  test('Good Friday 2026-04-03 is NYSE holiday', () => {
    expect(isNyseHoliday(new Date('2026-04-03T12:00:00-04:00'))).toBe(true);
  });

  test('Random weekday 2026-05-12 is NOT NYSE holiday', () => {
    expect(isNyseHoliday(new Date('2026-05-12T15:00:00-04:00'))).toBe(false);
  });
});

describe('calendar / Early closes', () => {
  test('Day before July 4 (2026-07-02) has 13:00 ET early close', () => {
    const ec = getNyseEarlyClose(new Date('2026-07-02T15:00:00-04:00'));
    expect(ec?.closeEt).toBe('13:00');
  });

  test('Christmas Eve 2026-12-24 has early close', () => {
    expect(getCmeEarlyClose(new Date('2026-12-24T15:00:00-05:00'))?.closeEt).toBe('13:00');
  });

  test('Random day has no early close', () => {
    expect(getNyseEarlyClose(new Date('2026-05-12T15:00:00-04:00'))).toBeUndefined();
  });
});

describe('calendar / CME', () => {
  test('CME equity holiday tracks NYSE', () => {
    expect(isCmeEquityHoliday(new Date('2026-12-25T15:00:00-05:00'))).toBe(true);
  });
});

describe('calendar / CI guard exports', () => {
  test('LAST_CALENDAR_DATE is end of 2026', () => {
    expect(LAST_CALENDAR_DATE.getFullYear()).toBe(2026);
  });

  test('NYSE_HOLIDAYS_2026 has 10 entries', () => {
    expect(NYSE_HOLIDAYS_2026.length).toBe(10);
  });
});
