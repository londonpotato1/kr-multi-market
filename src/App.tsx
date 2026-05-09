import { usePrices } from './hooks/usePrices';
import { PriceCard } from './components/PriceCard';
import { IndexCompareCard } from './components/IndexCompareCard';
import { FxHeader } from './components/FxHeader';
import './App.css';

const STOCK_TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'samsung', label: '삼성전자' },
  { ticker: 'skhynix', label: 'SK하이닉스' },
  { ticker: 'hyundai', label: '현대차' },
];

const INDEX_TICKERS: Array<{
  ticker: string;
  label: string;
  singleVenue: boolean;
}> = [
  { ticker: 'kospi200f', label: 'KOSPI 200 Futures', singleVenue: true },
  { ticker: 'ewy',       label: 'EWY (iShares Korea ETF)', singleVenue: false },
  { ticker: 'sp500',     label: 'S&P 500', singleVenue: false },
  { ticker: 'nq',        label: 'Nasdaq 100', singleVenue: false },
  { ticker: 'usdkrw',    label: 'USD/KRW', singleVenue: true },
];

export default function App() {
  const { data, error, isLoading } = usePrices();
  const ts = data?.ts;

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <span className="logo-dot" aria-hidden />
          <div>
            <h1>kr-multi-market</h1>
            <div className="sub">Hyperliquid xyz · Phase 3 (HL + KRX + Yahoo + Binance + FX)</div>
          </div>
        </div>
        <FxHeader fx={data?.fx} />
        <div className="meta">
          {error ? <span className="err-pill">⚠ {(error as Error).message}</span> :
           isLoading ? <span className="muted">loading…</span> :
           ts ? <span className="muted">↻ {new Date(ts).toLocaleTimeString('ko-KR')}</span> : null}
        </div>
      </header>

      <h2 className="section-title">한국 주식 (KRX vs Hyperliquid)</h2>
      <main className="grid">
        {STOCK_TICKERS.map(({ ticker, label }) => (
          <PriceCard
            key={ticker}
            ticker={ticker}
            label={label}
            payload={data?.tickers[ticker]}
          />
        ))}
      </main>

      <h2 className="section-title">지수 / ETF (Multi-venue)</h2>
      <main className="grid">
        {INDEX_TICKERS.map(({ ticker, label, singleVenue }) =>
          singleVenue ? (
            <PriceCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers[ticker]}
            />
          ) : (
            <IndexCompareCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers[ticker]}
            />
          )
        )}
      </main>
    </div>
  );
}
