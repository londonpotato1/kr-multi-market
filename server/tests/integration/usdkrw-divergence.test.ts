import { describe, test, expect } from 'vitest';
import { fetchUpbit } from '../../lib/sources/upbit.js';
import { fetchHyperliquid } from '../../lib/sources/hyperliquid.js';

const SKIP = process.env.INTEGRATION !== '1';

describe.skipIf(SKIP)('LIVE: USDT/KRW vs USD/KRW divergence', () => {
  test('Upbit USDT-KRW vs HL xyz_KRW divergence < 15% (kimchi premium tolerance)', async () => {
    const [upbit, hl] = await Promise.all([fetchUpbit(), fetchHyperliquid()]);
    expect(upbit.ok).toBe(true);
    expect(hl.ok).toBe(true);
    if (!upbit.ok || !hl.ok) return;

    const usdt = upbit.data[0]?.price;
    const xyzKrw = hl.data.find(p => p.symbol === 'xyz_KRW')?.price;
    expect(usdt).toBeDefined();
    expect(xyzKrw).toBeDefined();
    if (!usdt || !xyzKrw) return;

    const divergence = Math.abs(usdt - xyzKrw) / xyzKrw;
    console.log(`[usdkrw-div] Upbit=${usdt} HL_xyz=${xyzKrw} divergence=${(divergence*100).toFixed(2)}%`);

    // Allow up to 15% kimchi premium (historical max ~10%, with margin).
    expect(divergence).toBeLessThan(0.15);
  });
});
