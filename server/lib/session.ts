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

  return {
    krx,
    krxAfter,
    krxNight,
    nyseRegular,
    nysePrePost,
    cme,
    hyperliquid: true,
    binance: true,
  };
}
