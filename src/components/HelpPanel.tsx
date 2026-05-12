export function HelpPanel() {
  return (
    <details className="help-panel" data-testid="help-panel">
      <summary>도움말 / 용어 설명 ⓘ</summary>
      <div className="help-content">
        <section>
          <h4>가격 변동</h4>
          <p>▲ 초록 = 상승 / ▼ 빨강 = 하락 / — 회색 = 보합 또는 데이터 없음</p>
        </section>
        <section>
          <h4>프리미엄 단계</h4>
          <p>잠잠 (±1% 이내) · 주의 (±1~3%) · 과열 (±3% 이상)</p>
        </section>
        <section>
          <h4>신호 단계 (Z-스코어)</h4>
          <p>정상 · 관찰 (±2σ) · 매매 (±3σ) · 이탈 (±3σ 초과)</p>
        </section>
        <section>
          <h4>거래소 약어</h4>
          <p>
            KRX = 한국거래소 · HL = Hyperliquid xyz · Binance = Binance 선물 · Yahoo = Yahoo Finance
          </p>
        </section>
      </div>
    </details>
  );
}
