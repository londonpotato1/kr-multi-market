import type { PricePoint, Result } from '@shared/types/prices.js';
import { validateMetaAndAssetCtxs, SchemaError } from './hl-schema.js';
import { log } from '../logger.js';

const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
const TARGET_SYMBOLS = ['SMSN', 'SKHX', 'HYUNDAI', 'KR200', 'EWY', 'SP500', 'KRW'] as const;
const HL_TIMEOUT_MS = 5000;
const SCHEMA_VERSION = 1;

function normalizeXyzNames(raw: unknown): unknown {
  if (!Array.isArray(raw) || raw.length !== 2) {
    return raw;
  }

  const [meta, assetCtxs] = raw;
  if (typeof meta !== 'object' || meta === null || !Array.isArray((meta as { universe?: unknown }).universe)) {
    return raw;
  }

  const universe = (meta as { universe: unknown[] }).universe.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return entry;
    }

    const name = (entry as { name?: unknown }).name;
    if (typeof name !== 'string' || !name.startsWith('xyz:')) {
      return entry;
    }

    return { ...entry, name: name.slice('xyz:'.length) };
  });

  return [{ ...meta, universe }, assetCtxs];
}

/**
 * Fetch 7 target tickers from Hyperliquid xyz DEX in a single info call.
 * Returns a Result wrapper. Errors are returned (not thrown) per Result contract.
 */
export async function fetchHyperliquid(): Promise<Result<PricePoint[]>> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HL_TIMEOUT_MS);
    let raw: unknown;
    try {
      const res = await fetch(HL_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: 'xyz' }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status} ${res.statusText}`, latencyMs: Date.now() - start };
      }
      raw = await res.json();
    } finally {
      clearTimeout(timeout);
    }

    // Validate + parse via T1.3 validator
    const parsed = validateMetaAndAssetCtxs(normalizeXyzNames(raw), SCHEMA_VERSION);

    // Filter to target 7 symbols
    const result: PricePoint[] = [];
    for (const symbol of TARGET_SYMBOLS) {
      const key = `xyz_${symbol}`;
      const pp = parsed.get(key);
      if (pp) {
        result.push(pp);
      } else {
        log.warn(`[hyperliquid] target symbol missing from xyz universe: ${key}`);
      }
    }

    if (result.length === 0) {
      return { ok: false, error: 'No target symbols found in HL xyz universe', latencyMs: Date.now() - start };
    }

    return { ok: true, data: result, latencyMs: Date.now() - start };
  } catch (err) {
    if (err instanceof SchemaError) {
      return { ok: false, error: `Schema drift: ${err.message}`, latencyMs: Date.now() - start };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: `Timeout after ${HL_TIMEOUT_MS}ms`, latencyMs: Date.now() - start };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}
