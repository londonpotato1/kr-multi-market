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
});
