import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StockHeroCard } from './StockHeroCard';
import type { TickerPayload, FxRates, SessionState } from '@shared/types/prices.js';

afterEach(() => cleanup());

const now = Date.now();
const fxOk: FxRates = { officialUsdKrw: 1471.7, usdtKrw: 1470, divergencePct: 0 };
const fxZero: FxRates = { officialUsdKrw: 0, usdtKrw: 0, divergencePct: 0 };

const sessionOpen: SessionState = {
  krx: true, krxAfter: false, krxNight: false,
  nyseRegular: false, nysePrePost: false, cme: true,
  hyperliquid: true, binance: true,
  krxMinsUntilClose: 90,
};
const sessionClosed: SessionState = {
  krx: false, krxAfter: true, krxNight: false,
  nyseRegular: false, nysePrePost: false, cme: true,
  hyperliquid: true, binance: true,
  krxMinsUntilOpen: 1020,
};

const payloadFull: TickerPayload = {
  hl: { source: 'hyperliquid', symbol: 'xyz_SMSN', price: 189, unit: 'USD', change24hPct: -2.32, status: 'ok', asOf: now, receivedAt: now, schemaVersion: 1 },
  naver: { source: 'naver', symbol: '005930', price: 279000, unit: 'KRW', status: 'ok', asOf: now, receivedAt: now, schemaVersion: 1, previousClose: 281200, previousCloseSource: 'naver' },
  premium: { pctUsd: -0.85, pctUsdt: -0.8, guard: 'normal' },
};

describe('StockHeroCard v0.4.0', () => {
  it('loading skeleton when payload undefined', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={undefined} fx={fxOk} session={sessionOpen} />);
    expect(screen.getByTestId('stock-hero-loading')).toBeInTheDocument();
  });

  it('session open → primary=KRX (279,000), secondary=HL→KRW (277,830)', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} session={sessionOpen} />);
    expect(screen.getByText(/₩279,000/, { selector: '.stock-hero-primary' })).toBeInTheDocument();
    expect(screen.getByText(/277,830/)).toBeInTheDocument();
  });

  it('session closed → primary=HL→KRW (277,830), secondary=KRX (279,000)', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} session={sessionClosed} />);
    expect(screen.getByText(/₩277,830/, { selector: '.stock-hero-primary' })).toBeInTheDocument();
    expect(screen.getByText(/279,000/)).toBeInTheDocument();
  });

  it('shows 종가 기준 변동률 (KRX vs previousClose, session open)', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} session={sessionOpen} />);
    // (279000 - 281200) / 281200 * 100 = -0.7824%
    expect(screen.getByText(/-0\.78%/)).toBeInTheDocument();
    expect(screen.getByText('종가 대비')).toBeInTheDocument();
  });

  it('shows "종가 데이터 없음" when previousClose undefined', () => {
    const payload = {
      ...payloadFull,
      naver: { ...payloadFull.naver!, previousClose: undefined, previousCloseSource: undefined },
    };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} session={sessionOpen} />);
    expect(screen.getByText(/종가 데이터 없음/)).toBeInTheDocument();
  });

  it('shows USDT sub-label under PRIMARY (open session)', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} session={sessionOpen} />);
    // KRX primary 279000 / 1470 ≈ $189.80
    expect(screen.getByText(/\$189\.80 USDT/)).toBeInTheDocument();
  });

  it('USD fallback when fx.usdtKrw === 0 (closed session)', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxZero} session={sessionClosed} />);
    expect(screen.getByText(/\$189\.00/)).toBeInTheDocument();
    expect(screen.getByText(/환율 없음/)).toBeInTheDocument();
  });

  it('uses Korean premium tier label (잠잠)', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} session={sessionOpen} />);
    expect(screen.getByText(/잠잠/)).toBeInTheDocument();
  });

  it('renders at least 3 InfoTip ⓘ buttons', () => {
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payloadFull} fx={fxOk} session={sessionOpen} />);
    const tips = screen.getAllByRole('button').filter((b) => b.classList.contains('info-tip'));
    expect(tips.length).toBeGreaterThanOrEqual(3);
  });

  it('shows ⚠️ stale icon when KRX stale during open hours', () => {
    const payload: TickerPayload = {
      ...payloadFull,
      naver: { ...payloadFull.naver!, status: 'stale', staleReason: 'market_closed' },
    };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} session={sessionOpen} />);
    // sub-label과 footer 양쪽에 "KRX 데이터 지연" 텍스트가 존재 — footer의 signal-stale span 명시
    expect(screen.getByText('KRX 데이터 지연', { selector: '.signal-stale' })).toBeInTheDocument();
  });

  it('shows "(휴장)" marker when naver stale + session closed', () => {
    const payload: TickerPayload = {
      ...payloadFull,
      naver: { ...payloadFull.naver!, status: 'stale' },
    };
    render(<StockHeroCard ticker="samsung" label="삼성전자" payload={payload} fx={fxOk} session={sessionClosed} />);
    expect(screen.getByText(/휴장/)).toBeInTheDocument();
  });
});
