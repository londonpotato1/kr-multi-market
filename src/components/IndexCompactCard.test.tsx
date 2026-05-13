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
    expect(screen.getByText(/₩1,817,508/, { selector: '.index-compact-headline' })).toBeInTheDocument();
  });

  // Codex #3 ⚠️ gap: HL undefined → Binance KRW fallback (legacy IndexCompareCard 동작 보존)
  it('falls back to Binance KRW headline when HL is missing', () => {
    const payload: TickerPayload = {
      hl: undefined,
      binance: mkPP({ source: 'binance', symbol: 'EWYUSDT', price: 193.17, unit: 'USDT', change24hPct: -1.07 }),
    };
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payload} fx={fxOk} />);
    // 193.17 * 1470 = 283,960
    expect(screen.getByText(/₩283,960/, { selector: '.index-compact-headline' })).toBeInTheDocument();
  });

  // v0.4.0 W4.2: USDT sub-label
  it('renders USDT sub-label below KRW headline', () => {
    render(<IndexCompactCard ticker="ewy" label="EWY" payload={payloadEwy} fx={fxOk} />);
    // headlineKrw = 193.16 * 1470 = 283,945.2 → /1470 ≈ 193.16 → "$193.16 USDT"
    expect(screen.getByText(/≈ \$193\.16 USDT/)).toBeInTheDocument();
  });

  // Codex #3 ⚠️ gap: spread undefined → SpreadRow null 리턴, 카드는 정상 렌더
  it('renders without SpreadRow when payload.spread is undefined', () => {
    const payload: TickerPayload = {
      hl: mkPP({ source: 'hyperliquid', symbol: 'xyz_EWY', price: 193.16, unit: 'USD', change24hPct: -1.63 }),
      spread: undefined,
    };
    const { container } = render(<IndexCompactCard ticker="ewy" label="EWY" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/₩283,945/, { selector: '.index-compact-headline' })).toBeInTheDocument();
    expect(container.querySelector('.spread-row')).toBeNull();
  });
});

// PricePoint 헬퍼 — mkPP 재사용
const mkNqPP = (source: SourceName, price: number, change = 1.63) => mkPP({
  source,
  symbol: source === 'hyperliquid' ? 'xyz_NQ' : 'QQQ',
  price,
  unit: (source === 'binance' || source === 'bybit' || source === 'bitget') ? 'USDT' : 'USD',
  change24hPct: change,
});

describe('IndexCompactCard NQ — v0.4.2 fallback chain + 5 VenueRow', () => {
  it('uses Binance when HL+Yahoo missing (priority: hl > yahoo > binance > bybit > bitget)', () => {
    const payload: TickerPayload = {
      binance: mkNqPP('binance', 572.45),
    };
    render(<IndexCompactCard ticker="nq" label="Nasdaq" payload={payload} fx={fxOk} />);
    // 572.45 * 1470 = 841,501.5 → 841,502 (rounded)
    expect(screen.getByText(/₩841,502/, { selector: '.index-compact-headline' })).toBeInTheDocument();
    expect(screen.getByText(/출처\s+Binance/)).toBeInTheDocument();
  });

  it('uses Bybit when Binance also missing', () => {
    const payload: TickerPayload = { bybit: mkNqPP('bybit', 572.45) };
    render(<IndexCompactCard ticker="nq" label="Nasdaq" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/출처\s+Bybit/)).toBeInTheDocument();
  });

  it('uses Bitget when Bybit also missing', () => {
    const payload: TickerPayload = { bitget: mkNqPP('bitget', 572.45) };
    render(<IndexCompactCard ticker="nq" label="Nasdaq" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/출처\s+Bitget/)).toBeInTheDocument();
  });

  it('uses Polygon when no perp source available', () => {
    const payload: TickerPayload = { polygon: mkNqPP('polygon', 572.45) };
    render(<IndexCompactCard ticker="nq" label="Nasdaq" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/출처\s+Polygon/)).toBeInTheDocument();
  });

  it('uses TwelveData as last fallback', () => {
    const payload: TickerPayload = { twelvedata: mkNqPP('twelvedata', 572.45) };
    render(<IndexCompactCard ticker="nq" label="Nasdaq" payload={payload} fx={fxOk} />);
    expect(screen.getByText(/출처\s+TwelveData/)).toBeInTheDocument();
  });

  it('renders bybit + bitget VenueRows when present', () => {
    const payload: TickerPayload = {
      binance: mkNqPP('binance', 572.45),
      bybit: mkNqPP('bybit', 572.50),
      bitget: mkNqPP('bitget', 572.40),
    };
    render(<IndexCompactCard ticker="nq" label="Nasdaq" payload={payload} fx={fxOk} />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
    expect(screen.getByText('Bybit')).toBeInTheDocument();
    expect(screen.getByText('Bitget')).toBeInTheDocument();
  });

  it('v0.5.1: naver-only payload → KRW headline (no USDT 환산)', () => {
    const payload: TickerPayload = {
      naver: mkPP({ source: 'naver', symbol: '012330', price: 646000, unit: 'KRW', change24hPct: 17.88 }),
    };
    render(<IndexCompactCard ticker="mobis" label="현대모비스" payload={payload} fx={fxOk} />);
    // 646,000 KRW 원형 (fx 변환 없이)
    expect(screen.getByText(/₩646,000/, { selector: '.index-compact-headline' })).toBeInTheDocument();
    // USDT 환산 hidden
    expect(screen.queryByText(/≈.*USDT/)).not.toBeInTheDocument();
    // VenueRow 에 KRX 렌더
    expect(screen.getByText('KRX')).toBeInTheDocument();
  });

  it('does NOT render Polygon/TwelveData as VenueRow (headline fallback only)', () => {
    const payload: TickerPayload = {
      binance: mkNqPP('binance', 572.45),
      polygon: mkNqPP('polygon', 572.50),
      twelvedata: mkNqPP('twelvedata', 572.40),
    };
    render(<IndexCompactCard ticker="nq" label="Nasdaq" payload={payload} fx={fxOk} />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
    expect(screen.queryByText('Polygon', { selector: '.venue-pill' })).not.toBeInTheDocument();
    expect(screen.queryByText('Twelve Data', { selector: '.venue-pill' })).not.toBeInTheDocument();
  });
});
