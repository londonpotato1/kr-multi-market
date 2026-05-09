import { log } from './logger.js';

// Format: 'YYYY-MM-DD' as ISO date string
export const KRX_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01',  // New Year
  '2026-02-16',  // Lunar New Year (1/1)
  '2026-02-17',  // Lunar New Year (1/2)
  '2026-02-18',  // Lunar New Year (1/3)
  '2026-03-02',  // Substitute for Independence Movement Day (3/1 Sun)
  '2026-05-01',  // Labor Day
  '2026-05-05',  // Children's Day
  '2026-05-25',  // Buddha's Birthday (per 2026 lunar calendar — verify)
  '2026-08-15',  // Liberation Day (Sat)
  '2026-09-24',  // Chuseok
  '2026-09-25',  // Chuseok
  '2026-09-28',  // Substitute Chuseok holiday
  '2026-10-09',  // Hangul Day
  '2026-12-25',  // Christmas
  '2026-12-31',  // Year-end market close
] as const;

export const NYSE_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01',
  '2026-01-19',
  '2026-02-16',
  '2026-04-03',
  '2026-05-25',
  '2026-06-19',
  '2026-07-03',  // observed
  '2026-09-07',
  '2026-11-26',
  '2026-12-25',
] as const;

export type EarlyClose = { date: string; closeEt: string }; // 'HH:MM' ET

export const NYSE_EARLY_CLOSE_2026: readonly EarlyClose[] = [
  { date: '2026-07-02', closeEt: '13:00' },
  { date: '2026-11-27', closeEt: '13:00' },
  { date: '2026-12-24', closeEt: '13:00' },
] as const;

// Last calendar date — used for CI guard
export const LAST_CALENDAR_DATE = new Date('2026-12-31T23:59:59+09:00');

// Format Date as 'YYYY-MM-DD' in given timezone
function isoDate(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  // 'en-CA' yields 'YYYY-MM-DD' format
  return fmt.format(d);
}

export function isKrxHoliday(d: Date = new Date()): boolean {
  const isoKst = isoDate(d, 'Asia/Seoul');
  return KRX_HOLIDAYS_2026.includes(isoKst);
}

export function isNyseHoliday(d: Date = new Date()): boolean {
  const isoEt = isoDate(d, 'America/New_York');
  return NYSE_HOLIDAYS_2026.includes(isoEt);
}

export function getNyseEarlyClose(d: Date = new Date()): EarlyClose | undefined {
  const isoEt = isoDate(d, 'America/New_York');
  return NYSE_EARLY_CLOSE_2026.find(ec => ec.date === isoEt);
}

// CME equity futures = NYSE holidays + early closes
export function isCmeEquityHoliday(d: Date = new Date()): boolean {
  return isNyseHoliday(d);
}

export function getCmeEarlyClose(d: Date = new Date()): EarlyClose | undefined {
  return getNyseEarlyClose(d);
}

// CI guard: warn if approaching last calendar date
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const checkedAtModuleLoad = Date.now();
if (checkedAtModuleLoad > LAST_CALENDAR_DATE.getTime() - NINETY_DAYS_MS) {
  const daysLeft = Math.floor((LAST_CALENDAR_DATE.getTime() - checkedAtModuleLoad) / (24 * 60 * 60 * 1000));
  log.warn(`[calendar] less than 90 days to last holiday entry (${daysLeft} days remaining). Refresh calendar with 2027 holidays before year-end.`);
}
