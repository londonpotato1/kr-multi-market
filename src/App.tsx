import { usePrices } from './hooks/usePrices';
import { PriceCard } from './components/PriceCard';
import { FxHeader } from './components/FxHeader';
import './App.css';

const TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'samsung',   label: '삼성전자' },
  { ticker: 'skhynix',   label: 'SK하이닉스' },
  { ticker: 'hyundai',   label: '현대차' },
  { ticker: 'kospi200f', label: 'KOSPI 200 Futures' },
  { ticker: 'ewy',       label: 'EWY (iShares Korea ETF)' },
  { ticker: 'sp500',     label: 'S&P 500' },
  { ticker: 'usdkrw',    label: 'USD/KRW' },
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
            <div className="sub">Hyperliquid xyz · Phase 2 (HL + KRX + FX)</div>
          </div>
        </div>
        <FxHeader fx={data?.fx} />
        <div className="meta">
          {error ? <span className="err-pill">⚠ {(error as Error).message}</span> :
           isLoading ? <span className="muted">loading…</span> :
           ts ? <span className="muted">↻ {new Date(ts).toLocaleTimeString('ko-KR')}</span> : null}
        </div>
      </header>
      <main className="grid">
        {TICKERS.map(({ ticker, label }) => (
          <PriceCard
            key={ticker}
            ticker={ticker}
            label={label}
            payload={data?.tickers[ticker]}
          />
        ))}
      </main>
    </div>
  );
}
