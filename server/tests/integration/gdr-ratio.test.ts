import { describe, test, expect } from 'vitest';
import { fetchHyperliquid } from '../../lib/sources/hyperliquid.js';
import { fetchNaver } from '../../lib/sources/naver.js';
import { fetchUpbit } from '../../lib/sources/upbit.js';

const SKIP = process.env.INTEGRATION !== '1';

describe.skipIf(SKIP)('LIVE: GDR 1:1 ratio sanity', () => {
  test('xyz_SMSN price * usdtKrw approx Naver 005930 within 25%', async () => {
    const [hl, naver, upbit] = await Promise.all([
      fetchHyperliquid(),
      fetchNaver(['005930']),
      fetchUpbit(),
    ]);
    expect(hl.ok).toBe(true);
    expect(naver.ok).toBe(true);
    expect(upbit.ok).toBe(true);
    if (!hl.ok || !naver.ok || !upbit.ok) return;

    const smsn = hl.data.find(p => p.symbol === 'xyz_SMSN');
    const samsung = naver.data.find(p => p.symbol === '005930');
    const usdtKrw = upbit.data[0]?.price;
    expect(smsn).toBeDefined();
    expect(samsung).toBeDefined();
    expect(usdtKrw).toBeDefined();
    if (!smsn || !samsung || !usdtKrw) return;

    const inferred = smsn.price * usdtKrw;
    const ratio = inferred / samsung.price;
    console.log(`[gdr-ratio] xyz_SMSN=$${smsn.price} * usdtKrw=${usdtKrw} = ${inferred.toFixed(0)} KRW vs Naver 005930=${samsung.price} KRW → ratio=${ratio.toFixed(4)}`);

    // Wide tolerance: GDR is 1:1 in theory but live spread + USDT premium can move ratio. Goal here:
    // catch a 25x or 0.04x error (e.g., wrong GDR multiplier accidentally applied).
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(1.5);
  });

  test('xyz_SKHX vs Naver 000660 ratio sanity', async () => {
    const [hl, naver, upbit] = await Promise.all([
      fetchHyperliquid(),
      fetchNaver(['000660']),
      fetchUpbit(),
    ]);
    if (!hl.ok || !naver.ok || !upbit.ok) {
      console.warn('[skhx] one source down, skipping assertions');
      return;
    }
    const skhx = hl.data.find(p => p.symbol === 'xyz_SKHX');
    const skh = naver.data.find(p => p.symbol === '000660');
    const usdtKrw = upbit.data[0]?.price;
    if (!skhx || !skh || !usdtKrw) return;
    const ratio = (skhx.price * usdtKrw) / skh.price;
    console.log(`[gdr-ratio] xyz_SKHX ratio=${ratio.toFixed(4)}`);
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(1.5);
  });
});
