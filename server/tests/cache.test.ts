import { describe, test, expect, beforeEach, vi } from 'vitest';
import { singleFlight, _clearCache } from '../lib/cache.js';

describe('singleFlight', () => {
  beforeEach(() => _clearCache());

  test('dedups concurrent calls (same key, in-flight)', async () => {
    const fn = vi.fn(async () => 'result');
    const [a, b, c] = await Promise.all([
      singleFlight('k', 1000, fn),
      singleFlight('k', 1000, fn),
      singleFlight('k', 1000, fn),
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a).toBe('result');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test('returns cached value within TTL, refetches after TTL', async () => {
    let counter = 0;
    const fn = async () => ++counter;

    const v1 = await singleFlight('k', 50, fn);
    expect(v1).toBe(1);

    const v2 = await singleFlight('k', 50, fn);
    expect(v2).toBe(1);

    await new Promise((r) => setTimeout(r, 60));
    const v3 = await singleFlight('k', 50, fn);
    expect(v3).toBe(2);
  });

  test('does NOT cache errors', async () => {
    let attempt = 0;
    const fn = async () => {
      attempt++;
      if (attempt === 1) throw new Error('first fail');
      return 'ok';
    };

    await expect(singleFlight('k', 1000, fn)).rejects.toThrow('first fail');
    const v = await singleFlight('k', 1000, fn);
    expect(v).toBe('ok');
    expect(attempt).toBe(2);
  });
});
