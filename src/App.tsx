import { usePrices } from './hooks/usePrices';
import { StockHeroCard } from './components/StockHeroCard';
import { IndexCompactCard } from './components/IndexCompactCard';
import { FxHeader } from './components/FxHeader';
import { SessionBadges } from './components/SessionBadges';
import { DegradedBanner } from './components/DegradedBanner';
import { ThemeToggle } from './components/ThemeToggle';
import './App.css';

const STOCK_TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'samsung',  label: '삼성전자' },
  { ticker: 'skhynix',  label: 'SK하이닉스' },
  { ticker: 'hyundai',  label: '현대차' },
];

const INDEX_TICKERS: Array<{ ticker: string; label: string }> = [
  { ticker: 'ewy',       label: 'EWY' },
  { ticker: 'sp500',     label: 'S&P 500' },
  { ticker: 'nq',        label: 'Nasdaq 100' },
  { ticker: 'kospi200f', label: 'KOSPI 200F' },
];

export default function App() {
  const { data, error, isLoading } = usePrices();
  const ts = data?.ts;
  const krxClosed = !!data?.session && !data.session.krx;

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <span className="logo-dot" aria-hidden />
          <div>
            <h1>24시간 코스피</h1>
            <div className="sub">Korean × Bloomberg · v0.3.0</div>
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

      <section className="stocks-section">
        <h2 className="section-title">
          한국 주식 <span className="section-subtitle">KRX × Hyperliquid</span>
          {krxClosed && <span className="night-tag">● KRX CLOSED</span>}
        </h2>
        <div className="bento-3up">
          {STOCK_TICKERS.map(({ ticker, label }) => (
            <StockHeroCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers?.[ticker]}
              fx={data?.fx}
            />
          ))}
        </div>
      </section>

      <section className="indices-section">
        <h2 className="section-title">
          지수 / ETF <span className="section-subtitle">Multi-venue</span>
        </h2>
        <div className="bento-4up">
          {INDEX_TICKERS.map(({ ticker, label }) => (
            <IndexCompactCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers?.[ticker]}
              fx={data?.fx}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
