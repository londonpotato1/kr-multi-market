import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { IndexCompactCard } from './IndexCompactCard';
import type { TickerPayload, FxRates, SourceName } from '@shared/types/prices.js';

afterEach(() => cleanup());

const now = Date.now();
const fxOk: FxRates = { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 };

const mkPP = (overrides: Partial<{ symbol: string; price: number; unit: 'USD' | 'USDT' | 'pt' | 'KRW'; change24hPct: number; source: SourceName }>) => ({
  source: (overrides.source ?? 'hyperliquid') as SourceName,
  symbol: overrides.symbol ?? '',
  price: overrides.price ?? 0,
  unit: overrides.unit ?? ('USD' as const),
  change24hPct: overrides.change24hPct,
  status: 'ok' as const,
  asOf: now,
  receivedAt: now,
  schemaVersion: 1,
});

const payloadEwy: TickerPayload = {
  hl: mkPP({ source: 'hyperliquid', symbol: 'xyz_EWY', price: 193.16, unit: 'USD', change24hPct: -1.63 }),
  binance: mkPP({ source: 'binance', symbol: 'EWYUSDT', price: 193.17, unit: 'USDT', change24hPct: -1.07 }),
  spread: { maxPctDiff: 0.01, betweenSources: ['hyperliquid', 'binance'] },
};

const payloadSp500: TickerPayload = {
  hl: mkPP({ source: 'hyperliquid', symbol: 'xyz_SP500', price: 7414.80, unit: 'pt', change24hPct: 0.02 }),
  binance: mkPP({ source: 'binance', symbol: 'SPYUSDT', price: 739.73, unit: 'USDT', change24hPct: 0.14 }),
  spread: { maxPctDiff: 0.24, betweenSources: ['hyperliquid', 'binance'] },
};

describe('IndexCompactCard', () => {
  it('renders loading skeleton when payload is undefined', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={undefined} fx={fxOk} />);
    expect(screen.getByText('EWY')).toBeInTheDocument();
    expect(screen.getByTestId('index-compact-loading')).toBeInTheDocument();
  });

  it('renders headline in KRW from HL price × usdtKrw', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxOk} />);
    // 193.16 * 1470 = 283,945
    expect(screen.getByText(/₩283,945/, { selector: '.index-compact-headline' })).toBeInTheDocument();
  });

  it('falls back to USD headline when fx.usdtKrw is 0', () => {
    const fxZero: FxRates = { officialUsdKrw: 0, usdtKrw: 0, divergencePct: 0 };
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxZero} />);
    // headline + venue-price 둘 다 $193.16 → headline selector 로 좁힘
    expect(screen.getByText(/\$193\.16/, { selector: '.index-compact-headline' })).toBeInTheDocument();
  });

  it('applies SP500 10x ratio to Binance KRW conversion (Binance × 10)', () => {
    render(<IndexCompactCard ticker="sp500" label="S&P 500" payload={payloadSp500} fx={fxOk} />);
    // HL: 7414.80 * 1470 = 10,899,756  | Binance: 739.73 * 1470 * 10 = 10,874,031
    expect(screen.getByText(/10,899,756/, { selector: '.index-compact-headline' })).toBeInTheDocument();
    expect(screen.getByText(/10,874,031/)).toBeInTheDocument();
    expect(screen.getByText(/HL=index pt, Binance=SPY ETF/i)).toBeInTheDocument();
  });

  it('does NOT apply 10x ratio for non-sp500 tickers', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxOk} />);
    // 193.17 * 1470 = 283,960 (no x10)
    expect(screen.getByText(/283,960/)).toBeInTheDocument();
  });

  it('renders KOSPI200F with only HL venue (no Binance)', () => {
    const payloadKospi: TickerPayload = {
      hl: mkPP({ source: 'hyperliquid', symbol: 'xyz_KR200', price: 1236.40, unit: 'USD', change24hPct: 1.60 }),
    };
    render(<IndexCompactCard ticker="kospi200f" label="KOSPI 200F" payload={payloadKospi} fx={fxOk} />);
    expect(screen.getByText('KOSPI 200F')).toBeInTheDocument();
    // 1236.40 * 1470 = 1,817,508
    expect(screen.getByText(/₩1,817,508/)).toBeInTheDocument();
  });
});
