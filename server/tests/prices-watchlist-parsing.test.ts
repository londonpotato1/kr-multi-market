import { describe, it, expect } from 'vitest';
import { parseWatchlist } from '../index.js';

describe('parseWatchlist', () => {
  it('parses single entry', () => {
    const result = parseWatchlist('aapl:yahoo:AAPL');
    expect(result).toEqual([{ key: 'aapl', source: 'yahoo', symbol: 'AAPL' }]);
  });

  it('parses multiple entries', () => {
    const result = parseWatchlist('aapl:yahoo:AAPL,kakao:naver:035720');
    expect(result).toEqual([
      { key: 'aapl', source: 'yahoo', symbol: 'AAPL' },
      { key: 'kakao', source: 'naver', symbol: '035720' },
    ]);
  });

  it('rejects invalid key (uppercase, special chars)', () => {
    const result = parseWatchlist('AAPL:yahoo:AAPL,bad!key:yahoo:T');
    expect(result).toEqual([]);
  });

  it('rejects invalid source (unknown)', () => {
    const result = parseWatchlist('aapl:invalid:AAPL');
    expect(result).toEqual([]);
  });

  it('rejects invalid symbol (special chars)', () => {
    const result = parseWatchlist('aapl:yahoo:AA-PL');
    expect(result).toEqual([]);
  });

  it('returns empty on empty query', () => {
    expect(parseWatchlist('')).toEqual([]);
    expect(parseWatchlist(undefined as unknown as string)).toEqual([]);
  });

  it('accepts exactly 32-char key/symbol (boundary)', () => {
    const k32 = 'a' + 'b'.repeat(31);   // 32자, a-z0-9 only OK
    const s32 = 'A'.repeat(32);          // 32자 A-Z0-9_
    const result = parseWatchlist(`${k32}:yahoo:${s32}`);
    expect(result).toEqual([{ key: k32, source: 'yahoo', symbol: s32 }]);
  });

  it('rejects key/symbol over 32 chars', () => {
    const k33 = 'a' + 'b'.repeat(32);   // 33자
    expect(parseWatchlist(`${k33}:yahoo:AAPL`)).toEqual([]);
  });

  it('over-split (a:b:c:d) — extra parts ignored, treats as a:b:c', () => {
    // 의도: part.split(':') 의 4번째 이상은 destructure 에서 버려짐
    // 따라서 'aapl:yahoo:AAPL:extra' 는 'aapl:yahoo:AAPL' 와 동일 결과
    const result = parseWatchlist('aapl:yahoo:AAPL:extra');
    expect(result).toEqual([{ key: 'aapl', source: 'yahoo', symbol: 'AAPL' }]);
  });

  it('rejects when exceeding MAX_WATCHLIST_ENTRIES (50)', () => {
    const entries = Array.from({ length: 60 }, (_, i) => `k${i}:yahoo:S${i}`).join(',');
    const result = parseWatchlist(entries);
    expect(result).toHaveLength(50);
  });
});
