import { describe, test, expect, beforeEach } from 'vitest';
import {
  appendPremium, calcZScore, sampleCount, clearAllPremiums,
  SIGNAL_CONSTANTS,
} from './signal';

describe('signal / appendPremium', () => {
  beforeEach(() => clearAllPremiums());
  
  test('appending increments sampleCount', () => {
    appendPremium('samsung', 1.5);
    appendPremium('samsung', 2.0);
    appendPremium('samsung', -0.3);
    expect(sampleCount('samsung')).toBe(3);
  });
  
  test('non-finite values are ignored', () => {
    appendPremium('samsung', NaN);
    appendPremium('samsung', Infinity);
    appendPremium('samsung', 1.0);
    expect(sampleCount('samsung')).toBe(1);
  });
  
  test('separate tickers do not collide', () => {
    appendPremium('samsung', 1);
    appendPremium('skhynix', 2);
    appendPremium('skhynix', 3);
    expect(sampleCount('samsung')).toBe(1);
    expect(sampleCount('skhynix')).toBe(2);
  });
});

describe('signal / calcZScore', () => {
  beforeEach(() => clearAllPremiums());
  
  test('returns null when sampleCount < 100', () => {
    for (let i = 0; i < 50; i++) appendPremium('samsung', 1.0);
    expect(calcZScore('samsung', 1.5)).toBeNull();
  });
  
  test('returns 0 when stddev is 0 (all same)', () => {
    for (let i = 0; i < 100; i++) appendPremium('samsung', 1.0);
    const z = calcZScore('samsung', 1.0);
    expect(z).toBe(0);
  });
  
  test('positive z when current > mean', () => {
    for (let i = 0; i < 100; i++) appendPremium('samsung', i % 2 === 0 ? 1.0 : 2.0);
    // mean = 1.5, stddev = 0.5
    const z = calcZScore('samsung', 3.0);
    expect(z).toBeCloseTo(3.0);
  });
  
  test('negative z when current < mean', () => {
    for (let i = 0; i < 100; i++) appendPremium('samsung', i % 2 === 0 ? 1.0 : 2.0);
    const z = calcZScore('samsung', 0.0);
    expect(z).toBeCloseTo(-3.0);
  });
  
  test('returns null for non-finite current', () => {
    for (let i = 0; i < 100; i++) appendPremium('samsung', 1.0);
    expect(calcZScore('samsung', NaN)).toBeNull();
  });
});

describe('signal / trim', () => {
  beforeEach(() => clearAllPremiums());
  
  test('drops samples older than 7 days', () => {
    const now = Date.now();
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    appendPremium('samsung', 1.0, eightDaysAgo);
    appendPremium('samsung', 2.0, now);
    expect(sampleCount('samsung')).toBe(1);
  });
  
  test('keeps samples within 7d window', () => {
    const now = Date.now();
    const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;
    appendPremium('samsung', 1.0, sixDaysAgo);
    appendPremium('samsung', 2.0, now);
    expect(sampleCount('samsung')).toBe(2);
  });
});

describe('signal / size cap', () => {
  beforeEach(() => clearAllPremiums());
  
  test('SIGNAL_CONSTANTS exported correctly', () => {
    expect(SIGNAL_CONSTANTS.MIN_SAMPLES_FOR_ZSCORE).toBe(100);
    expect(SIGNAL_CONSTANTS.MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(SIGNAL_CONSTANTS.FALLBACK_TRIM_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });
  
  test('clearAllPremiums removes only kr-mm: keys', () => {
    appendPremium('samsung', 1);
    localStorage.setItem('other-app:data', 'preserve');
    clearAllPremiums();
    expect(sampleCount('samsung')).toBe(0);
    expect(localStorage.getItem('other-app:data')).toBe('preserve');
  });
});
