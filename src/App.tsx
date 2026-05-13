import { usePrices } from './hooks/usePrices';
import { useWatchlist } from './hooks/useWatchlist';
import { StockHeroCard } from './components/StockHeroCard';
import { IndexCompactCard } from './components/IndexCompactCard';
import { FxHeader } from './components/FxHeader';
import { SessionBadges } from './components/SessionBadges';
import { DegradedBanner } from './components/DegradedBanner';
import { ThemeToggle } from './components/ThemeToggle';
import { HelpPanel } from './components/HelpPanel';
import { SearchBar } from './components/SearchBar';
import { WatchlistSection } from './components/WatchlistSection';
import { getStateBadge } from './lib/market-state';
import { STATE_BADGE_LABEL } from './lib/labels';
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

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export default function App() {
  const { entries, add, remove } = useWatchlist();
  const watchlistQuery = entries.map(e => `${e.key}:${e.source}:${e.symbol}`).join(',');
  const { data, error, isLoading } = usePrices(watchlistQuery || undefined);
  const ts = data?.ts;
  const badge = data?.session ? getStateBadge(data.session) : null;
  const badgeLabel = badge ? STATE_BADGE_LABEL[badge] : null;
  const mins = data?.session
    ? badge === 'open' ? data.session.krxMinsUntilClose
    : badge === 'night' ? data.session.krxMinsUntilOpen
    : undefined
    : undefined;
  const countdownSuffix = mins !== undefined
    ? ` (${badge === 'open' ? '마감' : '개장'}까지 ${formatMins(mins)})`
    : '';

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <span className="logo-dot" aria-hidden />
          <div>
            <h1>코스피 24시간 트래커</h1>
            <div className="sub">한국 주식의 24시간 거래소(HL) 가격과 KRX 종가 비교 · v0.4.0</div>
          </div>
        </div>
        <div className="meta">
          <FxHeader fx={data?.fx} />
          {badge && (
            <span className={`market-countdown state-${badge}`} aria-live="polite">
              {badgeLabel}{countdownSuffix}
            </span>
          )}
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

      <SearchBar onAdd={add} />

      <DegradedBanner sourceHealth={data?.sourceHealth} />

      <HelpPanel />

      <section className="stocks-section">
        <h2 className="section-title">
          한국 주식 <span className="section-subtitle">KRX × Hyperliquid</span>
        </h2>
        <div className="bento-3up">
          {STOCK_TICKERS.map(({ ticker, label }) => (
            <StockHeroCard
              key={ticker}
              ticker={ticker}
              label={label}
              payload={data?.tickers?.[ticker]}
              fx={data?.fx}
              session={data?.session}
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

      <WatchlistSection entries={entries} prices={data} fx={data?.fx} onRemove={remove} />
    </div>
  );
}
