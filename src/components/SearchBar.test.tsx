import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SearchBar } from './SearchBar';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SearchBar', () => {
  it('renders input + button', () => {
    render(<SearchBar onAdd={vi.fn()} />);
    expect(screen.getByLabelText('종목 검색')).toBeInTheDocument();
    expect(screen.getByText('추가')).toBeInTheDocument();
  });

  it('disables button when query < 2 chars', () => {
    render(<SearchBar onAdd={vi.fn()} />);
    expect(screen.getByText('추가')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('종목 검색'), { target: { value: 'a' } });
    expect(screen.getByText('추가')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('종목 검색'), { target: { value: 'ap' } });
    expect(screen.getByText('추가')).not.toBeDisabled();
  });

  it('submits search + shows dropdown', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        tier: 1,
        results: [{ source: 'yahoo', symbol: 'AAPL', label: 'Apple Inc.', tier: 1 }],
      }), { status: 200 }) as unknown as Response,
    );
    render(<SearchBar onAdd={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('종목 검색'), { target: { value: 'Apple' } });
    fireEvent.click(screen.getByText('추가'));
    await screen.findByRole('option');
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });
});
