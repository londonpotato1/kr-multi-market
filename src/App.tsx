import { usePrices } from './hooks/usePrices';
import { PriceCard } from './components/PriceCard';
import { IndexCompareCard } from './components/IndexCompareCard';
import { FxHeader } from './components/FxHeader';
import { SessionBadges } from './components/SessionBadges';
import { DegradedBanner } from './components/DegradedBanner';
import { ThemeToggle } from './components/ThemeToggle';
import './App.css';

const STOCK_TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'samsung', label: '삼성전자' },
  { ticker: 'skhynix', label: 'SK하이닉스' },
  { ticker: 'hyundai', label: '현대차' },
];

const INDEX_TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'ewy',   label: 'EWY' },
  { ticker: 'sp500', label: 'S&P 500' },
  { ticker: 'nq',    label: 'Nasdaq 100' },
];

export default function App() {
  const { data, error, isLoading } = usePrices();
  const ts = data?.ts;
  const krxClosed = !!data?.session && !data.session.krx;
  const nightMode = krxClosed;

  const HeroSection = (
    <section key="hero" className="hero-section">
      <PriceCard
        ticker="kospi200f"
        label="KOSPI 200 Futures"
        payload={data?.tickers['kospi200f']}
        fx={data?.fx}
        hero
      />
    </section>
  );

  const StockSection = (
    <section key="stock" className="stock-section">
      <h2 className="section-title">한국 주식 <span className="section-subtitle">KRX × Hyperliquid</span></h2>
      <div className="dense-stocks-wrapper">
        <table className="dense-stocks">
          <thead>
            <tr>
              <th>티커</th>
              <th className="num-col">KRX</th>
              <th className="num-col">HL → KRW</th>
              <th className="num-col">24h Δ</th>
              <th className="num-col">Premium</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {STOCK_TICKERS.map(({ ticker, label }) => (
              <PriceCard
                key={ticker}
                ticker={ticker}
                label={label}
                payload={data?.tickers[ticker]}
                fx={data?.fx}
                renderAs="row"
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const IndexSection = (
    <section key="index" className="index-section">
      <h2 className="section-title">
        지수 / ETF <span className="section-subtitle">Multi-venue</span>
        {nightMode && (
          <span className="night-badge" title="KRX closed → indexes promoted to top">● NIGHT MODE</span>
        )}
      </h2>
      <main className="bento">
        {INDEX_TICKERS.map(({ ticker, label }) => (
          <IndexCompareCard
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

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <span className="logo-dot" aria-hidden />
          <div>
            <h1>kr-multi-market</h1>
            <div className="sub">Korean × Bloomberg · v0.2.0</div>
          </div>
        </div>
        <div className="meta">
          <FxHeader fx={data?.fx} />
          <SessionBadges session={data?.session} />
          <div className="meta-controls">
            <ThemeToggle />
            {error ? (
              <span className="err-pill">⚠ {(error as Error).message}</span>
            ) : isLoading ? (
              <span className="muted">loading…</span>
            ) : ts ? (
              <span className="muted num">↻ {new Date(ts).toLocaleTimeString('ko-KR')}</span>
            ) : null}
          </div>
        </div>
      </header>

      <DegradedBanner sourceHealth={data?.sourceHealth} />

      {/* Hero always at top */}
      {HeroSection}

      {/* Night mode reorders Stock vs Index */}
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
