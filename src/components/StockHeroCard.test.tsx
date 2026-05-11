import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StockHeroCard } from './StockHeroCard';
import type { TickerPayload, FxRates } from '@shared/types/prices.js';

afterEach(() => cleanup());

const now = Date.now();
const fxOk: FxRates = { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 };
const fxZero: FxRates = { officialUsdKrw: 0, usdtKrw: 0, divergencePct: 0 };

const payloadFull: TickerPayload = {
  hl: { source: 'hyperliquid', symbol: 'xyz_SMSN', price: 202.19, unit: 'USD', change24hPct: -2.32, status: 'ok', asOf: now, receivedAt: now, schemaVersion: 1 },
  naver: { source: 'naver', symbol: '005930', price: 285500, unit: 'KRW', status: 'ok', asOf: now, receivedAt: now, schemaVersion: 1 },
  premium: { pctUsd: 4.23, pctUsdt: 4.20, guard: 'normal' },
};

describe('StockHeroCard', () => {
  it('renders loading skeleton when payload is undefined', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={undefined} fx={fxOk} />);
    expect(screen.getByText('삼성전자')).toBeInTheDocument();
    expect(screen.getByTestId('stock-hero-loading')).toBeInTheDocument();
  });

  it('renders HL→KRW as PRIMARY when fx + hl available', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} />);
    // 202.19 * 1470 = 297,219.3 → ₩297,219 (frac 0)
    expect(screen.getByText(/₩297,219/)).toBeInTheDocument();
  });

  it('falls back to USD primary when fx.usdtKrw === 0', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxZero} />);
    expect(screen.getByText(/\$202\.19/)).toBeInTheDocument();
    expect(screen.getByText(/KRW UNAVAIL/i)).toBeInTheDocument();
  });

  it('shows HL UNAVAILABLE when payload.hl is missing', () => {
    const payload = { ...payloadFull, hl: undefined };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/HL UNAVAILABLE/i)).toBeInTheDocument();
    expect(screen.getByText(/₩285,500/)).toBeInTheDocument();
  });

  // Codex #2 ⚠️: HL undefined → gauge 도 NA 강제 (premium 수치는 HL 기반이므로 무의미)
  it('forces gauge to tier-na (aria-disabled) when HL is missing even if premium present', () => {
    const payload = { ...payloadFull, hl: undefined };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-disabled', 'true');
    expect(meter.className).toContain('tier-na');
  });

  // Codex #2 ⚠️ Case 3: fx === undefined (전체 객체 없음) → USD fallback
  it('falls back to USD primary when fx is undefined entirely', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={undefined} />);
    expect(screen.getByText(/\$202\.19/)).toBeInTheDocument();
    expect(screen.getByText(/KRW UNAVAIL/i)).toBeInTheDocument();
  });

  it('renders premium "—" + tier-na gauge when premium.pctUsd is null (KRX closed)', () => {
    const payload: TickerPayload = {
      ...payloadFull,
      premium: { pctUsd: null, pctUsdt: null, guard: 'normal' },
      naver: { source: 'naver', symbol: '005930', price: 285500, unit: 'KRW', status: 'stale', asOf: now, receivedAt: now, schemaVersion: 1, staleReason: 'krx-closed' },
    };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-disabled', 'true');
    // premium row, KRX row 둘 다 — 있을 수 있음
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows "(closed)" marker AND "KRX CLOSED" footer when KRX is stale', () => {
    // Codex #2 ⚠️ Case 6: footer 도 검증
    const payload: TickerPayload = {
      ...payloadFull,
      naver: { source: 'naver', symbol: '005930', price: 285500, unit: 'KRW', status: 'stale', asOf: now, receivedAt: now, schemaVersion: 1 },
    };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/\(closed\)/)).toBeInTheDocument();
    expect(screen.getByText('KRX CLOSED')).toBeInTheDocument();
  });

  it('shows "—" for KRX row when naver is missing entirely', () => {
    const payload = { ...payloadFull, naver: undefined };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    const krxLabel = screen.getByText('KRX');
    // KRX 라벨의 부모 행 (div) 안에 '—' 가 있는지
    const krxRow = krxLabel.closest('div');
    expect(krxRow?.textContent).toMatch(/—/);
  });

  it('shows "—" for 24h when change24hPct is undefined', () => {
    const payload: TickerPayload = {
      ...payloadFull,
      hl: { ...payloadFull.hl!, change24hPct: undefined },
    };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} />);
    const row = screen.getByText('24h').closest('div');
    expect(row?.textContent).toMatch(/—/);
  });

  it('classifies premium tier: cool < 1%, warm 1-3%, hot >= 3%', () => {
    const mk = (pct: number): TickerPayload => ({
      ...payloadFull,
      premium: { pctUsd: pct, pctUsdt: pct, guard: 'normal' },
    });
    const { container, rerender } = render(
      <StockHeroCard ticker="samsung" label="삼성전자" payload={mk(0.5)} fx={fxOk} />
    );
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-cool');
    rerender(<StockHeroCard ticker="samsung" label="삼성전자" payload={mk(2)} fx={fxOk} />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-warm');
    rerender(<StockHeroCard ticker="samsung" label="삼성전자" payload={mk(4.23)} fx={fxOk} />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-hot');
  });
});
