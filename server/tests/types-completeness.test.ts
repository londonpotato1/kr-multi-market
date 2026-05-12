import { describe, it, expect } from 'vitest';
import { getSourceHealth, _resetSourceHealth } from '../lib/health.js';
import type { SourceName } from '@shared/types/prices.js';

describe('types-completeness — SourceName runtime exhaustiveness', () => {
  it('health.ts state initializes all 9 SourceName keys', () => {
    _resetSourceHealth();
    const health = getSourceHealth();
    const expected: SourceName[] = [
      'hyperliquid', 'naver', 'yahoo', 'binance', 'upbit',
      'bybit', 'bitget', 'polygon', 'twelvedata',
    ];
    for (const key of expected) {
      expect(health[key]).toBeDefined();
      expect(health[key].lastSuccess).toBe(0);
      expect(health[key].consecutiveFailures).toBe(0);
    }
    // No extra keys
    expect(Object.keys(health).sort()).toEqual([...expected].sort());
  });
});
