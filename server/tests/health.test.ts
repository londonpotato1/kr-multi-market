import { describe, test, expect, beforeEach } from 'vitest';
import { recordSourceAttempt, getSourceHealth, _resetSourceHealth } from '../lib/health.js';

describe('source health tracker', () => {
  beforeEach(() => _resetSourceHealth());
  
  test('initial state has 5 sources at zero', () => {
    const h = getSourceHealth();
    expect(Object.keys(h)).toHaveLength(5);
    expect(h.hyperliquid.lastSuccess).toBe(0);
    expect(h.hyperliquid.consecutiveFailures).toBe(0);
  });
  
  test('successful attempt updates lastSuccess + resets failures', () => {
    recordSourceAttempt('naver', { ok: false, error: 'fail', latencyMs: 100 });
    recordSourceAttempt('naver', { ok: false, error: 'fail', latencyMs: 100 });
    expect(getSourceHealth().naver.consecutiveFailures).toBe(2);
    
    recordSourceAttempt('naver', { ok: true, data: [], latencyMs: 50 }, 1700000000000);
    const h = getSourceHealth().naver;
    expect(h.lastSuccess).toBe(1700000000000);
    expect(h.consecutiveFailures).toBe(0);
  });
  
  test('failed attempts accumulate', () => {
    for (let i = 0; i < 5; i++) {
      recordSourceAttempt('yahoo', { ok: false, error: 'HTTP 429', latencyMs: 100 });
    }
    expect(getSourceHealth().yahoo.consecutiveFailures).toBe(5);
    expect(getSourceHealth().yahoo.lastSuccess).toBe(0);
  });
  
  test('failed attempt preserves prior lastSuccess', () => {
    recordSourceAttempt('hyperliquid', { ok: true, data: [], latencyMs: 200 }, 1700000000000);
    recordSourceAttempt('hyperliquid', { ok: false, error: 'timeout', latencyMs: 5000 });
    const h = getSourceHealth().hyperliquid;
    expect(h.lastSuccess).toBe(1700000000000);
    expect(h.consecutiveFailures).toBe(1);
  });
  
  test('sources are independent', () => {
    recordSourceAttempt('naver', { ok: false, error: 'x', latencyMs: 100 });
    recordSourceAttempt('upbit', { ok: true, data: [], latencyMs: 50 });
    const h = getSourceHealth();
    expect(h.naver.consecutiveFailures).toBe(1);
    expect(h.upbit.consecutiveFailures).toBe(0);
  });
});
