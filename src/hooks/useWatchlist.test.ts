import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchlist, WATCHLIST_KEY, MAX_ENTRIES } from './useWatchlist';
import type { WatchlistEntry } from '@shared/types/prices.js';

const sample: WatchlistEntry = {
  key: 'aapl', source: 'binance', symbol: 'AAPLUSDT', label: 'Apple Inc.', tier: 2,
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('useWatchlist', () => {
  it('initializes empty when localStorage clean', () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([]);
  });

  it('add entry persists to localStorage', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.add(sample); });
    expect(result.current.entries).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(WATCHLIST_KEY)!)).toEqual([sample]);
  });

  it('auto-suffixes duplicate key', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.add(sample); });
    act(() => { result.current.add({ ...sample, symbol: 'AAPLBYBIT' }); });
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].key).toBe('aapl');
    expect(result.current.entries[1].key).toBe('aapl-1');
  });

  it('rejects when MAX_ENTRIES reached (single batch)', () => {
    const { result } = renderHook(() => useWatchlist());
    let err: Error | null = null;
    act(() => {
      try {
        for (let i = 0; i < MAX_ENTRIES + 1; i++) {
          result.current.add({ ...sample, key: `t${i}`, symbol: `T${i}USDT` });
        }
      } catch (e) {
        err = e as Error;
      }
    });
    expect(err?.message).toMatch(/최대|50/);
    expect(result.current.entries).toHaveLength(MAX_ENTRIES);
  });

  it('remove deletes entry', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.add(sample); });
    act(() => { result.current.remove(sample.key); });
    expect(result.current.entries).toEqual([]);
    expect(JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]')).toEqual([]);
  });

  it('recovers from corrupt localStorage', () => {
    localStorage.setItem(WATCHLIST_KEY, '{ invalid json');
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([]);
  });
});
