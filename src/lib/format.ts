export const fmtUsd = (n: number, frac = 2) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac });

export const fmtKrw = (n: number, frac = 0) =>
  '₩' + n.toLocaleString('ko-KR', { minimumFractionDigits: frac, maximumFractionDigits: frac });

export const fmtPct = (n: number, frac = 2) =>
  (n >= 0 ? '+' : '') + n.toFixed(frac) + '%';

export const fmtCompactUsd = (n: number) => {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return fmtUsd(n);
};

export const fmtFunding = (rate: number) =>
  (rate * 100).toFixed(4) + '%';

export const fmtAge = (asOfMs: number) => {
  const ageS = Math.floor((Date.now() - asOfMs) / 1000);
  if (ageS < 60) return `${ageS}s ago`;
  if (ageS < 3600) return `${Math.floor(ageS / 60)}m ago`;
  return `${Math.floor(ageS / 3600)}h ago`;
};
