export type PremiumSnapshot = { ticker: string; premiumPct: number; ts: number };

const KEY_PREFIX = 'kr-mm:premium:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;       // 7 days
const FALLBACK_TRIM_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const SIZE_CAP_BYTES = 4_500_000;                  // ~4.5 MB before forcing trim
const MIN_SAMPLES_FOR_ZSCORE = 100;

function key(ticker: string): string {
  return `${KEY_PREFIX}${ticker}`;
}

function safeGet(ticker: string): PremiumSnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key(ticker));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr as PremiumSnapshot[] : [];
  } catch {
    return [];
  }
}

function safeSet(ticker: string, arr: PremiumSnapshot[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key(ticker), JSON.stringify(arr));
  } catch {
    // QuotaExceededError — caller should have called trimAll() first
  }
}

function totalSize(): number {
  if (typeof localStorage === 'undefined') return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    const v = localStorage.getItem(k);
    total += k.length + (v?.length ?? 0);
  }
  return total;
}

function trimToWindow(arr: PremiumSnapshot[], windowMs: number): PremiumSnapshot[] {
  const cutoff = Date.now() - windowMs;
  return arr.filter(s => s.ts > cutoff);
}

function trimAllToWindow(windowMs: number): void {
  if (typeof localStorage === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw) as PremiumSnapshot[];
      const trimmed = trimToWindow(arr, windowMs);
      localStorage.setItem(k, JSON.stringify(trimmed));
    } catch {
      // skip
    }
  }
}

export function appendPremium(ticker: string, premiumPct: number, now: number = Date.now()): void {
  if (typeof localStorage === 'undefined') return;
  if (!Number.isFinite(premiumPct)) return;
  const arr = safeGet(ticker);
  arr.push({ ticker, premiumPct, ts: now });
  // Trim to 7d window
  const trimmed = trimToWindow(arr, MAX_AGE_MS);
  // Check global size; if approaching cap, force trim all keys to 5d
  if (totalSize() > SIZE_CAP_BYTES) {
    trimAllToWindow(FALLBACK_TRIM_MS);
  }
  safeSet(ticker, trimmed);
}

export function calcZScore(ticker: string, current: number): number | null {
  if (!Number.isFinite(current)) return null;
  const arr = safeGet(ticker);
  if (arr.length < MIN_SAMPLES_FOR_ZSCORE) return null;
  const values = arr.map(s => s.premiumPct);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return 0;
  return (current - mean) / stddev;
}

export function sampleCount(ticker: string): number {
  return safeGet(ticker).length;
}

export function clearAllPremiums(): void {
  if (typeof localStorage === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

// Exposed constants for tests / consumers
export const SIGNAL_CONSTANTS = {
  MAX_AGE_MS,
  FALLBACK_TRIM_MS,
  SIZE_CAP_BYTES,
  MIN_SAMPLES_FOR_ZSCORE,
} as const;
