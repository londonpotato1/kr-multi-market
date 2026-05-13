import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SearchDropdown } from './SearchDropdown';

afterEach(() => cleanup());

describe('SearchDropdown', () => {
  it('renders top 5 results', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      source: 'yahoo' as const, symbol: `T${i}`, label: `Ticker ${i}`, tier: 1 as const,
    }));
    render(<SearchDropdown response={{ tier: 1, results }} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('shows reason message when results empty', () => {
    render(<SearchDropdown response={{ tier: null, results: [], reason: 'not_found' }} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument();
  });

  it('click triggers onPick + onClose', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<SearchDropdown
      response={{ tier: 1, results: [{ source: 'yahoo', symbol: 'AAPL', label: 'Apple', tier: 1 }] }}
      onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByRole('option'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }));
    expect(onClose).toHaveBeenCalled();
  });
});
