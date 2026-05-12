import { describe, it, expect } from 'vitest';

// 전일 종가 도출 공식 검증 (naver.ts 의 inline 계산을 그대로 복제)
// 실제 통합 테스트는 fetch mock 이 필요해서 여기선 도출 로직만 unit 검증
function derivePreviousClose(price: number, compareRaw: number | undefined): number | undefined {
  if (compareRaw === undefined) return undefined;
  const prev = price - compareRaw;
  return prev > 0 ? prev : undefined;
}

describe('Naver previousClose 도출 공식', () => {
  it('현재가 278,500 + 전일대비 -7,000 → 전일종가 285,500', () => {
    expect(derivePreviousClose(278500, -7000)).toBe(285500);
  });

  it('현재가 1,880,000 + 전일대비 +30,000 → 전일종가 1,850,000', () => {
    expect(derivePreviousClose(1880000, 30000)).toBe(1850000);
  });

  it('compareRaw undefined 시 undefined 반환', () => {
    expect(derivePreviousClose(278500, undefined)).toBeUndefined();
  });

  it('도출값 음수 시 undefined (sanity guard)', () => {
    expect(derivePreviousClose(100, 200)).toBeUndefined();
  });

  it('도출값 0 시 undefined (divide-by-zero 방지)', () => {
    expect(derivePreviousClose(100, 100)).toBeUndefined();
  });
});
