import { getSessionState } from './session.js';

// Source 별 cache TTL (ms) — Naver 는 동적 (naverTtl() 참조).
export const SOURCE_TTL_MS = {
  hyperliquid: 1000,
  binance: 1000,
  upbit: 2000,
  yahoo: 5000,
  bybit: 1000,
  bitget: 1000,
  polygon: 12_000,      // 5/min free cap (60s / 12s = 5)
  twelvedata: 120_000,  // 800/day free cap (24h / 120s = 720 < 800)
} as const;

// Naver: KRX 장중 2s / 휴장 7s (spec §2.4 D).
// 7s 는 Naver 응답의 권장 pollingInterval.
export function naverTtl(): number {
  return getSessionState().krx ? 2000 : 7000;
}
