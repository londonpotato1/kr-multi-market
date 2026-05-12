import type { SessionState } from '@shared/types/prices.js';
import {
  isKrxHoliday,
  isNyseHoliday,
  isCmeEquityHoliday,
  getNyseEarlyClose,
  getCmeEarlyClose,
} from './calendar.js';

type TimeParts = { weekday: string; hh: number; mm: number };

// Extract weekday/hour/minute in a specific timezone.
function tzParts(d: Date, timeZone: string): TimeParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(d);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hh = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const mm = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return { weekday, hh, mm };
}

function isWeekday(weekday: string): boolean {
  return weekday !== 'Sat' && weekday !== 'Sun';
}

// Minutes since midnight in given timezone.
function minutesOfDay(d: Date, timeZone: string): number {
  const { hh, mm } = tzParts(d, timeZone);
  return hh * 60 + mm;
}

function closeEtToMinutes(closeEt: string): number {
  const [hh, mm] = closeEt.split(':').map(Number);
  return hh * 60 + mm;
}

export function getSessionState(now: Date = new Date()): SessionState {
  // KRX (Asia/Seoul)
  const kstP = tzParts(now, 'Asia/Seoul');
  const kstMins = minutesOfDay(now, 'Asia/Seoul');
  const krxWeekday = isWeekday(kstP.weekday);
  const krxNotHoliday = !isKrxHoliday(now);

  const krx = krxWeekday && krxNotHoliday &&
    kstMins >= 9 * 60 && kstMins < 15 * 60 + 30;

  const krxAfter = krxWeekday && krxNotHoliday && (
    (kstMins >= 15 * 60 + 30 && kstMins < 16 * 60) ||
    (kstMins >= 18 * 60 && kstMins < 20 * 60)
  );

  const krxNight = krxNotHoliday && (
    (krxWeekday && kstMins >= 18 * 60) ||
    (kstP.weekday !== 'Sun' && kstP.weekday !== 'Mon' && kstMins < 5 * 60)
  );

  // NYSE (America/New_York)
  const etP = tzParts(now, 'America/New_York');
  const etMins = minutesOfDay(now, 'America/New_York');
  const nyseWeekday = isWeekday(etP.weekday);
  const nyseNotHoliday = !isNyseHoliday(now);
  const nyseEarlyClose = getNyseEarlyClose(now);
  const regularEnd = nyseEarlyClose
    ? closeEtToMinutes(nyseEarlyClose.closeEt)
    : 16 * 60;

  const nyseRegular = nyseWeekday && nyseNotHoliday &&
    etMins >= 9 * 60 + 30 && etMins < regularEnd;

  const nysePrePost = nyseWeekday && nyseNotHoliday && (
    (etMins >= 4 * 60 && etMins < 9 * 60 + 30) ||
    (etMins >= regularEnd && etMins < 20 * 60)
  );

  // CME equity futures (America/New_York for break timing)
  const cmeNotHoliday = !isCmeEquityHoliday(now);
  const cmeEarlyClose = getCmeEarlyClose(now);
  const cmeEarlyEnd = cmeEarlyClose ? closeEtToMinutes(cmeEarlyClose.closeEt) : undefined;
  let cme = false;
  if (cmeNotHoliday) {
    if (cmeEarlyEnd !== undefined) {
      cme = etP.weekday !== 'Sat' && etP.weekday !== 'Sun' && etMins < cmeEarlyEnd;
    } else if (etP.weekday === 'Sun') {
      cme = etMins >= 18 * 60;
    } else if (etP.weekday === 'Sat') {
      cme = false;
    } else if (etP.weekday === 'Fri') {
      cme = etMins < 17 * 60;
    } else {
      cme = etMins < 17 * 60 || etMins >= 18 * 60;
    }
  }

  // === v0.4.0 — KRX 카운트다운 ===
  let krxMinsUntilOpen: number | undefined;
  let krxMinsUntilClose: number | undefined;
  const krxCloseMins = 15 * 60 + 30; // 15:30 KST

  if (krx) {
    krxMinsUntilClose = Math.max(0, krxCloseMins - kstMins);
  } else {
    krxMinsUntilOpen = computeMinsUntilNextKrxOpen(now);
  }

  return {
    krx,
    krxAfter,
    krxNight,
    nyseRegular,
    nysePrePost,
    cme,
    hyperliquid: true,
    binance: true,
    krxMinsUntilOpen,
    krxMinsUntilClose,
  };
}

// Compute minutes until next KRX open (09:00 KST on next weekday non-holiday).
function computeMinsUntilNextKrxOpen(now: Date): number {
  const kstP = tzParts(now, 'Asia/Seoul');
  const kstMins = minutesOfDay(now, 'Asia/Seoul');
  const krxOpenMins = 9 * 60; // 09:00 KST

  // Same-day open (예: 08:00 KST → 09:00 KST 까지)
  if (isWeekday(kstP.weekday) && !isKrxHoliday(now) && kstMins < krxOpenMins) {
    return krxOpenMins - kstMins;
  }

  // Otherwise scan next 7 days for first weekday non-holiday
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const cp = tzParts(candidate, 'Asia/Seoul');
    if (isWeekday(cp.weekday) && !isKrxHoliday(candidate)) {
      // Mins from now to candidate day's 09:00 KST
      const minsTodayRemaining = 24 * 60 - kstMins; // today까지
      const fullDaysBetween = dayOffset - 1; // intermediate full days
      const total = minsTodayRemaining + fullDaysBetween * 24 * 60 + krxOpenMins;
      return total;
    }
  }
  return 0; // 안전 폴백 (7일 내 영업일 없음은 사실상 불가능)
}
