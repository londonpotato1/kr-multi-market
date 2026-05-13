import { useState, useCallback, useRef } from 'react';
import { mutate } from 'swr';
import type { WatchlistEntry } from '@shared/types/prices.js';

export const WATCHLIST_KEY = 'kr-multi-market.watchlist.v1';
export const MAX_ENTRIES = 50;

const KEY_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const SYMBOL_REGEX = /^[A-Za-z0-9_]+$/;

function loadFromStorage(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is WatchlistEntry => {
      return e && typeof e.key === 'string'
        && typeof e.source === 'string'
        && typeof e.symbol === 'string'
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
    console.warn('[useWatchlist] localStorage save failed:', err);
  }
}

export function useWatchlist() {
  const entriesRef = useRef<WatchlistEntry[]>(loadFromStorage());
  const [entries, setEntries] = useState<WatchlistEntry[]>(() => entriesRef.current);

  const add = useCallback((entry: WatchlistEntry): void => {
    if (!KEY_REGEX.test(entry.key) || entry.key.length > 32) {
      throw new Error(`잘못된 key 형식: ${entry.key}`);
    }
    if (!SYMBOL_REGEX.test(entry.symbol) || entry.symbol.length > 32) {
      throw new Error(`잘못된 symbol 형식: ${entry.symbol}`);
    }
    if (entriesRef.current.length >= MAX_ENTRIES) {
      throw new Error(`최대 ${MAX_ENTRIES}개 까지만 추가 가능합니다`);
    }
    // 충돌 시 auto-suffix — suffix 길이 동적 계산 (i 자릿수 변동) 후 base 잘라서 합 32자 보장
    let key = entry.key;
    if (entriesRef.current.some(e => e.key === key)) {
      let i = 1;
      // 1차 추정 (suffix 1자리) 으로 base 결정 후 충돌 검사
      // i 가 자릿수 늘면 base 다시 조정해서 32자 유지
      while (true) {
        const suffix = `-${i}`;
        const base = entry.key.slice(0, 32 - suffix.length);
        const candidate = `${base}${suffix}`;
        if (!entriesRef.current.some(e => e.key === candidate)) {
          key = candidate;
          break;
        }
        i++;
      }
    }
    const next = [...entriesRef.current, { ...entry, key }];
    entriesRef.current = next;
    setEntries(next);
    saveToStorage(next);
    mutate((swrKey: unknown) => typeof swrKey === 'string' && swrKey.startsWith('/api/prices'));
  }, []);

  const remove = useCallback((key: string): void => {
    const next = entriesRef.current.filter(e => e.key !== key);
    entriesRef.current = next;
    setEntries(next);
    saveToStorage(next);
    mutate((swrKey: unknown) => typeof swrKey === 'string' && swrKey.startsWith('/api/prices'));
  }, []);

  return { entries, add, remove };
}
