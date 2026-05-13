import { useState, useCallback, useRef } from 'react';
import { useSWRConfig } from 'swr';
import type { WatchlistEntry, SourceName } from '@shared/types/prices.js';

export const WATCHLIST_KEY = 'kr-multi-market.watchlist.v1';
export const MAX_ENTRIES = 50;

const KEY_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const SYMBOL_REGEX = /^[A-Za-z0-9_]+$/;
const VALID_SOURCES: readonly SourceName[] = [
  'hyperliquid', 'naver', 'yahoo', 'binance', 'upbit',
  'bybit', 'bitget', 'polygon', 'twelvedata',
];

function loadFromStorage(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is WatchlistEntry => {
      return e
        && typeof e.key === 'string' && KEY_REGEX.test(e.key) && e.key.length <= 32
        && typeof e.source === 'string' && (VALID_SOURCES as readonly string[]).includes(e.source)
        && typeof e.symbol === 'string' && SYMBOL_REGEX.test(e.symbol) && e.symbol.length <= 32
        && typeof e.label === 'string'
        && [1, 2, 3].includes(e.tier);
    });
  } catch {
    return [];
  }
}

function saveToStorage(entries: WatchlistEntry[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(entries));
  } catch (err) {
    // QuotaExceededError 등 — state 와 storage divergence 발생 가능 (페이지 재로드 시 변경 사라짐).
    // caller 에 전파 X (UI 카드는 정상 표시되도록). console 경고만.
    console.warn('[useWatchlist] localStorage save failed:', err);
  }
}

/**
 * Watchlist hook. 단일 인스턴스로 사용 권장 (다중 인스턴스 시 in-memory state 분리됨).
 * localStorage 가 source of truth, page reload 시 복원.
 */
export function useWatchlist() {
  // useRef lazy init pattern — useRef 는 native lazy initializer 없음, 직접 분기.
  const entriesRef = useRef<WatchlistEntry[] | null>(null);
  if (entriesRef.current === null) {
    entriesRef.current = loadFromStorage();
  }
  const [entries, setEntries] = useState<WatchlistEntry[]>(() => entriesRef.current!);
  const { mutate } = useSWRConfig();

  const add = useCallback((entry: WatchlistEntry): void => {
    if (!KEY_REGEX.test(entry.key) || entry.key.length > 32) {
      throw new Error(`잘못된 key 형식: ${entry.key}`);
    }
    if (!SYMBOL_REGEX.test(entry.symbol) || entry.symbol.length > 32) {
      throw new Error(`잘못된 symbol 형식: ${entry.symbol}`);
    }
    if (entriesRef.current!.length >= MAX_ENTRIES) {
      throw new Error(`최대 ${MAX_ENTRIES}개 까지만 추가 가능합니다`);
    }
    // 충돌 시 auto-suffix — suffix 길이 동적 계산 후 base 잘라서 합 32자 보장
    let key = entry.key;
    if (entriesRef.current!.some(e => e.key === key)) {
      let i = 1;
      while (true) {
        const suffix = `-${i}`;
        const base = entry.key.slice(0, 32 - suffix.length);
        const candidate = `${base}${suffix}`;
        if (!entriesRef.current!.some(e => e.key === candidate)) {
          key = candidate;
          break;
        }
        i++;
      }
    }
    const next = [...entriesRef.current!, { ...entry, key }];
    entriesRef.current = next;
    setEntries(next);
    saveToStorage(next);
    mutate((swrKey: unknown) => typeof swrKey === 'string' && swrKey.startsWith('/api/prices'));
  }, [mutate]);

  const remove = useCallback((key: string): void => {
    const next = entriesRef.current!.filter(e => e.key !== key);
    entriesRef.current = next;
    setEntries(next);
    saveToStorage(next);
    mutate((swrKey: unknown) => typeof swrKey === 'string' && swrKey.startsWith('/api/prices'));
  }, [mutate]);

  return { entries, add, remove };
}
