// src/lib/labels.ts — 한글 라벨 매핑 (v0.4.0)
// labels.ts: 한 도메인에 1 파일 — 모든 라벨 매핑이 여기 모임.
// 사용처: SignalBadge / StockHeroCard / IndexCompactCard / App.tsx countdown chip.

export const PREMIUM_TIER_LABEL = {
  cool: '잠잠',
  warm: '주의',
  hot: '과열',
  na: '데이터 없음',
} as const;

export const SIGNAL_TIER_LABEL = {
  normal: '정상',
  watch: '관찰',
  trade: '매매',
  dislocated: '이탈',
} as const;

export const STATE_BADGE_LABEL = {
  open: '🟢 장중',
  night: '🌙 야간',
  holiday: '🔴 휴장',
} as const;

export const CONTEXT_LABEL = {
  PRIMARY_LIVE: 'KRX 실시간 / HL 야간 발견가',
  PRIMARY_NIGHT: 'HL 야간 발견가 / KRX 전일 종가',
  HL_DOWN: 'HL 가격 없음',
  FX_DOWN: '환율 없음 — USD 표시',
  KRX_STALE: 'KRX 데이터 지연 — HL 임시 사용',
} as const;
