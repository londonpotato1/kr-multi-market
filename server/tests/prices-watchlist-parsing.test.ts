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
});
