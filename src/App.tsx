import { usePrices } from './hooks/usePrices';
import { PriceCard } from './components/PriceCard';
import { IndexCompareCard } from './components/IndexCompareCard';
import { FxHeader } from './components/FxHeader';
import { SessionBadges } from './components/SessionBadges';
import { DegradedBanner } from './components/DegradedBanner';
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
];

export default function App() {
  const { data, error, isLoading } = usePrices();
  const ts = data?.ts;

  const krxClosed = !!data?.session && !data.session.krx;
  const nightMode = krxClosed;

  const StockSection = (
    <section key="stock">
      <h2 className="section-title">한국 주식 (KRX vs Hyperliquid)</h2>
      <main className="grid">
        {STOCK_TICKERS.map(({ ticker, label }) => (
          <PriceCard
            key={ticker}
            ticker={ticker}
            label={label}
            payload={data?.tickers[ticker]}
            fx={data?.fx}
          />
        ))}
      </main>
    </section>
  );

  const IndexSection = (
    <section key="index">
      <h2 className="section-title">
        지수 / ETF (Multi-venue)
        {nightMode && (
          <span className="night-badge" title="KRX closed → indexes promoted to top">
            ● NIGHT MODE
          </span>
        )}
      </h2>
      <main className="grid">
        {INDEX_TICKERS.map(({ ticker, label, singleVenue }) =>
          singleVenue ? (
            <PriceCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers[ticker]}
              fx={data?.fx}
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
    </section>
  );

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <span className="logo-dot" aria-hidden />
          <div>
            <h1>kr-multi-market</h1>
            <div className="sub">Hyperliquid xyz · Phase 4 (sessions + night-mode)</div>
          </div>
        </div>
        <div className="meta">
          <FxHeader fx={data?.fx} />
          <SessionBadges session={data?.session} />
          {error ? (
            <span className="err-pill">⚠ {(error as Error).message}</span>
          ) : isLoading ? (
            <span className="muted">loading…</span>
          ) : ts ? (
            <span className="muted">↻ {new Date(ts).toLocaleTimeString('ko-KR')}</span>
          ) : null}
        </div>
      </header>

      <DegradedBanner sourceHealth={data?.sourceHealth} />

      {nightMode ? (
        <>
          {IndexSection}
          {StockSection}
        </>
      ) : (
        <>
          {StockSection}
          {IndexSection}
        </>
      )}
    </div>
  );
}
