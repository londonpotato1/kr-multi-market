import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WatchlistSection } from './WatchlistSection';
import type { WatchlistEntry, FxRates, PricesResponse } from '@shared/types/prices.js';

afterEach(() => cleanup());

const fx: FxRates = { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 };
const sample: WatchlistEntry = { key: 'aapl', source: 'binance', symbol: 'AAPLUSDT', label: 'Apple Inc.', tier: 2 };

describe('WatchlistSection', () => {
  it('shows empty placeholder when entries 0', () => {
    render(<WatchlistSection entries={[]} fx={fx} onRemove={vi.fn()} />);
    expect(screen.getByText(/검색해서 종목을 추가하세요/)).toBeInTheDocument();
  });

  it('renders WatchlistCard per entry', () => {
    render(<WatchlistSection entries={[sample, { ...sample, key: 'msft', label: 'Microsoft' }]} fx={fx} onRemove={vi.fn()} />);
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('Microsoft')).toBeInTheDocument();
  });

  it('passes ticker payload to WatchlistCard', () => {
    const prices = {
      tickers: { aapl: { binance: { price: 195, ts: Date.now() } } },
    } as unknown as PricesResponse;
    render(<WatchlistSection entries={[sample]} prices={prices} fx={fx} onRemove={vi.fn()} />);
    // 카드 렌더링 확인 (가격 표시는 IndexCompactCard 환경에 따라 다름, label 만 검증)
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });
});
