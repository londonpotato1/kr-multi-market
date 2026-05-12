import type { PricePoint, Result } from '@shared/types/prices.js';
import { log } from '../logger.js';

const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 5000;
const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://finance.naver.com/',
  'Accept': 'application/json, text/plain, */*',
};

// Symbol mapping: Naver code -> our ticker key
export const NAVER_SYMBOLS = ['005930', '000660', '005380'] as const;

type NaverDataItem = {
  cd?: string;
  itemCode?: string;
  symbolCode?: string;
  nv?: number;
  closePrice?: string;
  closePriceRaw?: string;
  nm?: string;
  sv?: number;
  cv?: number;
  cr?: number;
  fluctuationsRatio?: string;
  fluctuationsRatioRaw?: string;
  ov?: number;
  hv?: number;
  lv?: number;
  aq?: number;
  aa?: number;
  ms?: 'OPEN' | 'CLOSE' | string;
  marketStatus?: 'OPEN' | 'CLOSE' | string;
  // v0.4.0: 전일 종가 도출용 (전일대비 차이)
  compareToPreviousClosePrice?: string;
  compareToPreviousClosePriceRaw?: string;
};

type NaverResponse = {
  datas: NaverDataItem[];
  time?: number | string;
  pollingInterval?: number;
};

async function fetchNaverJson(url: string, signal: AbortSignal): Promise<NaverResponse> {
  const res = await fetch(url, { headers: NAVER_HEADERS, signal });
  if (!res.ok) {
    throw new Error(`Naver HTTP ${res.status}`);
  }
  return await res.json() as NaverResponse;
}

async function fetchRawNaver(symbols: readonly string[], signal: AbortSignal): Promise<NaverResponse> {
  const multiUrl = `https://polling.finance.naver.com/api/realtime/domestic/stocks?symbols=${symbols.join(',')}`;
  try {
    return await fetchNaverJson(multiUrl, signal);
  } catch (err) {
    log.warn(`[naver] multi-symbol endpoint failed, falling back to single-symbol calls: ${err instanceof Error ? err.message : String(err)}`);
  }

  const datas: NaverDataItem[] = [];
  let asOf: number | undefined;
  let pollingInterval: number | undefined;
  for (const symbol of symbols) {
    const singleUrl = `https://polling.finance.naver.com/api/realtime/domestic/stock/${symbol}`;
    const raw = await fetchNaverJson(singleUrl, signal);
    if (!raw || !Array.isArray(raw.datas)) {
      throw new Error(`Naver response missing datas[] for ${symbol}`);
    }
    datas.push(...raw.datas);
    asOf = Math.max(asOf ?? 0, parseNaverTime(raw.time)) || asOf;
    pollingInterval = pollingInterval ?? raw.pollingInterval;
  }

  return { datas, time: asOf, pollingInterval };
}

function isKrxRegularSession(now: Date = new Date()): boolean {
  // Convert to KST (UTC+9). KRX regular: Mon-Fri 09:00-15:30 KST.
  const kstFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = kstFmt.formatToParts(now);
  const day = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hh = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const mm = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  if (day === 'Sat' || day === 'Sun') return false;
  const minutes = hh * 60 + mm;
  return minutes >= 9 * 60 && minutes < 15 * 60 + 30;
}

function parseNaverNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number(value.replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNaverTime(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
    if (compact) {
      const [, year, month, day, hour, minute, second] = compact;
      const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

export async function fetchNaver(symbols: readonly string[] = NAVER_SYMBOLS): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let raw: NaverResponse;
    try {
      raw = await fetchRawNaver(symbols, controller.signal);
    } finally {
      clearTimeout(timeout);
    }

    if (!raw || !Array.isArray(raw.datas)) {
      return { ok: false, error: 'Naver response missing datas[]', latencyMs: Date.now() - start };
    }

    const isOpen = isKrxRegularSession();
    const status = isOpen ? 'ok' : 'stale';
    const staleReason = isOpen ? undefined : 'market_closed';
    const asOf = parseNaverTime(raw.time);
    const receivedAt = Date.now();

    const result: PricePoint[] = [];
    for (const item of raw.datas) {
      const symbol = item.cd ?? item.itemCode ?? item.symbolCode;
      const price = parseNaverNumber(item.nv ?? item.closePriceRaw ?? item.closePrice);
      if (!symbol || price === undefined) {
        log.warn(`[naver] skipping invalid item: cd=${symbol}`);
        continue;
      }
      // v0.4.0: 전일 종가 = 현재가 - 전일대비차이 (compareToPreviousClosePriceRaw)
      // compareRaw === 0 (거래정지/변동없음) 시 도출값 = 현재가 가 되어 오표시 위험 → undefined 로
      const previousCompare = parseNaverNumber(
        item.compareToPreviousClosePriceRaw ?? item.compareToPreviousClosePrice
      );
      const previousClose = previousCompare !== undefined && previousCompare !== 0 && price > 0
        ? price - previousCompare
        : undefined;
      // sanity guard (음수 또는 0 방지)
      const safePrevClose = previousClose !== undefined && previousClose > 0 ? previousClose : undefined;

      result.push({
        source: 'naver',
        symbol,
        price,
        unit: 'KRW',
        change24hPct: parseNaverNumber(item.cr ?? item.fluctuationsRatioRaw ?? item.fluctuationsRatio),
        volume24hUsd: undefined,
        status,
        asOf,
        receivedAt,
        staleReason,
        schemaVersion: SCHEMA_VERSION,
        previousClose: safePrevClose,
        previousCloseSource: safePrevClose !== undefined ? 'naver' : undefined,
      });
    }

    if (result.length === 0) {
      return { ok: false, error: 'Naver returned 0 valid items', latencyMs: Date.now() - start };
    }

    return { ok: true, data: result, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: `Timeout after ${TIMEOUT_MS}ms`, latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}
