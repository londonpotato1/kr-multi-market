import { useState, useCallback } from 'react';
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
  const [entries, setEntries] = useState<WatchlistEntry[]>(() => loadFromStorage());

  const add = useCallback((entry: WatchlistEntry): void => {
    if (!KEY_REGEX.test(entry.key) || entry.key.length > 32) {
      throw new Error(`잘못된 key 형식: ${entry.key}`);
    }
    if (!SYMBOL_REGEX.test(entry.symbol) || entry.symbol.length > 32) {
      throw new Error(`잘못된 symbol 형식: ${entry.symbol}`);
    }
    if (entries.length >= MAX_ENTRIES) {
      throw new Error(`최대 ${MAX_ENTRIES}개 까지만 추가 가능합니다`);
    }
    setEntries(prev => {
      // 충돌 시 auto-suffix
      let key = entry.key;
      if (prev.some(e => e.key === key)) {
        let i = 1;
        while (prev.some(e => e.key === `${entry.key}-${i}`)) i++;
        key = `${entry.key}-${i}`.slice(0, 32);
      }
      const next = [...prev, { ...entry, key }];
      saveToStorage(next);
      return next;
    });
    mutate((swrKey: unknown) => typeof swrKey === 'string' && swrKey.startsWith('/api/prices'));
  }, [entries.length]);

  const remove = useCallback((key: string): void => {
    setEntries(prev => {
      const next = prev.filter(e => e.key !== key);
      saveToStorage(next);
      return next;
    });
    mutate((swrKey: unknown) => typeof swrKey === 'string' && swrKey.startsWith('/api/prices'));
  }, []);

  return { entries, add, remove };
}
