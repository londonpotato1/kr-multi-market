import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IndexCompareCard } from './IndexCompareCard';
import type { TickerPayload, FxRates, PricePoint, Spread } from '@shared/types/prices.js';

const mkPp = (price: number, source: PricePoint['source'], symbol: string, unit: PricePoint['unit'] = 'USD'): PricePoint => ({
  source, symbol, price, unit,
  status: 'ok', asOf: Date.now(), receivedAt: Date.now(), schemaVersion: 1,
});

const mkFx = (officialUsdKrw: number, usdtKrw: number): FxRates => ({
  officialUsdKrw, usdtKrw,
  divergencePct: ((usdtKrw - officialUsdKrw) / officialUsdKrw) * 100,
});

describe('IndexCompareCard SP500 KRW unification', () => {
  test('SP500: HL pt × usdtKrw renders as KRW headline', () => {
    const payload: TickerPayload = {
      hl: mkPp(7400, 'hyperliquid', 'xyz_SP500', 'pt'),
      binance: mkPp(731, 'binance', 'SPYUSDT', 'USDT'),
    };
    const fx = mkFx(1380, 1380);
    const { container } = render(<IndexCompareCard {...{ ticker: 'sp500', label: 'S&P 500', payload, fx }} />);
    // Expected: 7400 × 1380 = 10,212,000 KRW. Format: ₩10,212,000
    expect(container.textContent).toMatch(/₩10,212,000/);
  });

  test('SP500: Binance SPY × usdtKrw × 10 renders as KRW (server reference ratio mirror)', () => {
    const payload: TickerPayload = {
      hl: mkPp(7400, 'hyperliquid', 'xyz_SP500', 'pt'),
      binance: mkPp(731, 'binance', 'SPYUSDT', 'USDT'),
    };
    const fx = mkFx(1380, 1380);
    const { container } = render(<IndexCompareCard {...{ ticker: 'sp500', label: 'S&P 500', payload, fx }} />);
    // Expected: 731 × 1380 × 10 = 10,087,800 KRW
    expect(container.textContent).toMatch(/₩10,087,800/);
  });

  test('SP500: spread chip shows normalized small percentage', () => {
    const spread: Spread = {
      maxPctDiff: 0.21,
      betweenSources: ['hyperliquid', 'binance'],
      normalized: true,
      impliedRatio: 10.12,
      ratioRange: [8, 12],
    };
    const payload: TickerPayload = {
      hl: mkPp(7400, 'hyperliquid', 'xyz_SP500', 'pt'),
      binance: mkPp(731, 'binance', 'SPYUSDT', 'USDT'),
      spread,
    };
    const fx = mkFx(1380, 1380);
    const { container } = render(<IndexCompareCard {...{ ticker: 'sp500', label: 'S&P 500', payload, fx }} />);
    // Spread should be visible somewhere
    expect(container.textContent).toMatch(/0\.21%|0\.21 ?%/);
  });

  test('EWY (non-SP500): no ×10 multiplier applied', () => {
    const payload: TickerPayload = {
      hl: mkPp(193.5, 'hyperliquid', 'xyz_EWY'),
      binance: mkPp(193.6, 'binance', 'EWYUSDT', 'USDT'),
    };
    const fx = mkFx(1380, 1380);
    const { container } = render(<IndexCompareCard {...{ ticker: 'ewy', label: 'EWY', payload, fx }} />);
    // Expected EWY KRW: 193.5 × 1380 = 267,030 (NOT multiplied by 10)
    // Should NOT match a 10x value like ₩2,670,300
    expect(container.textContent).toMatch(/₩267,030|₩266,/);
    expect(container.textContent).not.toMatch(/₩2,670,300|₩2,672,/);
  });
});
