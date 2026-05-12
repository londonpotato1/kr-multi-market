import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  storePrevClose,
  getPrevClose,
  resolvePrevClose,
  _resetPrevCloseCacheForTests,
} from '../lib/prev-close-cache.js';

describe('prev-close-cache', () => {
  beforeEach(() => {
    _resetPrevCloseCacheForTests();
  });

  it('stores and retrieves a value within TTL', () => {
    storePrevClose('samsung', 285500, 'naver');
    const cached = getPrevClose('samsung');
    expect(cached?.value).toBe(285500);
    expect(cached?.source).toBe('cache');
  });

  it('returns undefined for missing ticker', () => {
    expect(getPrevClose('unknown')).toBeUndefined();
  });

  it('does NOT store values <= 0', () => {
    storePrevClose('samsung', 0, 'naver');
    expect(getPrevClose('samsung')).toBeUndefined();
    storePrevClose('samsung', -100, 'naver');
    expect(getPrevClose('samsung')).toBeUndefined();
  });

  // Codex #1 ⚠️ fix: TTL expire 경로 fake-timer 검증
  it('expires entry after 24h TTL (fake timers)', () => {
    vi.useFakeTimers();
    try {
      storePrevClose('samsung', 285500, 'naver');
      expect(getPrevClose('samsung')?.value).toBe(285500);
      // 23시간 59분 → still alive
      vi.advanceTimersByTime((24 * 60 - 1) * 60 * 1000);
      expect(getPrevClose('samsung')?.value).toBe(285500);
      // +2분 = 24시간 1분 → expired
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(getPrevClose('samsung')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('resolvePrevClose — fallback chain', () => {
  beforeEach(() => {
    _resetPrevCloseCacheForTests();
  });

  it('prefers naver value when available', () => {
    const r = resolvePrevClose('samsung', 285500, 290000);
    expect(r?.value).toBe(285500);
    expect(r?.source).toBe('naver');
  });

  it('falls back to yahoo when naver missing', () => {
    const r = resolvePrevClose('samsung', undefined, 290000);
    expect(r?.value).toBe(290000);
    expect(r?.source).toBe('yahoo');
  });

  it('falls back to cache when both live sources missing', () => {
    // populate cache via prior successful call
    resolvePrevClose('samsung', 285500, undefined);
    // next call: both missing → cache
    _resetPrevCloseCacheForTests();
    storePrevClose('samsung', 280000, 'naver');
    const r = resolvePrevClose('samsung', undefined, undefined);
    expect(r?.value).toBe(280000);
    expect(r?.source).toBe('cache');
  });

  it('returns undefined when no source and no cache', () => {
    const r = resolvePrevClose('samsung', undefined, undefined);
    expect(r).toBeUndefined();
  });

  it('persists naver value to cache for later fallback', () => {
    resolvePrevClose('samsung', 285500, undefined);
    // simulate later call with no live sources
    const r = resolvePrevClose('samsung', undefined, undefined);
    expect(r?.source).toBe('cache');
    expect(r?.value).toBe(285500);
  });
});
