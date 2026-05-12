import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { SWRConfig } from 'swr';
import App from '../App';

afterEach(() => cleanup());

const now = Date.now();
const stubData = {
  ts: now,
  schemaVersion: 1,
  fx: { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 },
  session: { krx: false, krxAfter: false, krxNight: true, nyseRegular: false, nysePrePost: false, cme: true, hyperliquid: true as const, binance: true as const, krxMinsUntilOpen: 1020 },
  sourceHealth: {
    hyperliquid: { lastSuccess: now, consecutiveFailures: 0 },
    naver: { lastSuccess: now, consecutiveFailures: 0 },
    yahoo: { lastSuccess: now, consecutiveFailures: 0 },
    binance: { lastSuccess: now, consecutiveFailures: 0 },
    upbit: { lastSuccess: now, consecutiveFailures: 0 },
  },
  tickers: {
    samsung: {
      hl: { source: 'hyperliquid' as const, symbol: 'xyz_SMSN', price: 202.19, unit: 'USD' as const, change24hPct: -2.32, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
      naver: { source: 'naver' as const, symbol: '005930', price: 285500, unit: 'KRW' as const, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1, previousClose: 290000, previousCloseSource: 'naver' as const },
      premium: { pctUsd: 4.23, pctUsdt: 4.2, guard: 'normal' as const },
    },
    skhynix: {
      hl: { source: 'hyperliquid' as const, symbol: 'xyz_SKHX', price: 1323, unit: 'USD' as const, change24hPct: 4.99, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
      naver: { source: 'naver' as const, symbol: '000660', price: 1880000, unit: 'KRW' as const, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1, previousClose: 1860000, previousCloseSource: 'naver' as const },
      premium: { pctUsd: 3.63, pctUsdt: 3.5, guard: 'normal' as const },
    },
    hyundai: {
      hl: { source: 'hyperliquid' as const, symbol: 'xyz_HYUNDAI', price: 441, unit: 'USD' as const, change24hPct: -2.21, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
      naver: { source: 'naver' as const, symbol: '005380', price: 646000, unit: 'KRW' as const, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1, previousClose: 642000, previousCloseSource: 'naver' as const },
      premium: { pctUsd: 0.46, pctUsdt: 0.4, guard: 'normal' as const },
    },
    ewy: {
      hl: { source: 'hyperliquid' as const, symbol: 'xyz_EWY', price: 193.16, unit: 'USD' as const, change24hPct: -1.63, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
      binance: { source: 'binance' as const, symbol: 'EWYUSDT', price: 193.17, unit: 'USDT' as const, change24hPct: -1.07, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
    },
    sp500: {
      hl: { source: 'hyperliquid' as const, symbol: 'xyz_SP500', price: 7414.80, unit: 'pt' as const, change24hPct: 0.02, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
      binance: { source: 'binance' as const, symbol: 'SPYUSDT', price: 739.73, unit: 'USDT' as const, change24hPct: 0.14, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
    },
    nq: {
      binance: { source: 'binance' as const, symbol: 'QQQUSDT', price: 713.45, unit: 'USDT' as const, change24hPct: 0.06, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
    },
    kospi200f: {
      hl: { source: 'hyperliquid' as const, symbol: 'xyz_KR200', price: 1236.40, unit: 'USD' as const, change24hPct: 1.60, status: 'ok' as const, asOf: now, receivedAt: now, schemaVersion: 1 },
    },
  },
};

describe('axe a11y — App in both themes (Wave 4 WCAG gate)', () => {
  it('has no critical violations in dark theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { container } = render(
      <SWRConfig value={{ fetcher: () => stubData, dedupingInterval: 0, provider: () => new Map() }}>
        <App />
      </SWRConfig>
    );
    const results = await axe(container);
    const critical = (results.violations || []).filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  it('has no critical violations in light theme', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { container } = render(
      <SWRConfig value={{ fetcher: () => stubData, dedupingInterval: 0, provider: () => new Map() }}>
        <App />
      </SWRConfig>
    );
    const results = await axe(container);
    const critical = (results.violations || []).filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
});
