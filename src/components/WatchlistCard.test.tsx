import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WatchlistCard } from './WatchlistCard';
import type { WatchlistEntry, FxRates } from '@shared/types/prices.js';

afterEach(() => cleanup());

const entry: WatchlistEntry = { key: 'aapl', source: 'binance', symbol: 'AAPLUSDT', label: 'Apple Inc.', tier: 2 };
const fx: FxRates = { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 };

describe('WatchlistCard', () => {
  it('renders X button + IndexCompactCard', () => {
    render(<WatchlistCard entry={entry} payload={undefined} fx={fx} onRemove={vi.fn()} />);
    expect(screen.getByLabelText('Apple Inc. 삭제')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });

  it('X click triggers onRemove with key', () => {
    const onRemove = vi.fn();
    render(<WatchlistCard entry={entry} payload={undefined} fx={fx} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Apple Inc. 삭제'));
    expect(onRemove).toHaveBeenCalledWith('aapl');
  });

  it('hides venue rows in watchlist compact card but keeps headline (v0.5.2 hideVenues)', () => {
    const naverEntry: WatchlistEntry = {
      key: 'mobis',
      source: 'naver',
      symbol: '012330',
      label: '현대모비스',
      tier: 1,
    };
    const payload = {
      naver: {
        source: 'naver' as const,
        symbol: '012330',
        price: 646000,
        unit: 'KRW' as const,
        status: 'ok' as const,
        asOf: Date.now(),
        receivedAt: Date.now(),
        schemaVersion: 1,
      },
    };
    render(<WatchlistCard entry={naverEntry} payload={payload} fx={fx} onRemove={vi.fn()} />);
    expect(screen.getByText(/₩646,000/)).toBeInTheDocument();
    // venues 섹션의 'KRX' venue-pill 이 안 나옴 (hideVenues 효과)
    expect(screen.queryByText('KRX')).not.toBeInTheDocument();
  });
});
