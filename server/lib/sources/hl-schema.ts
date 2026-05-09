import type { PricePoint } from '@shared/types/prices.js';

export class SchemaError extends Error {
  constructor(message: string, public readonly raw?: unknown) {
    super(message);
    this.name = 'SchemaError';
  }
}

export type ParsedHl = Map<string, PricePoint>;

const REQUIRED_NUMERIC_FIELDS = ['markPx', 'prevDayPx', 'openInterest', 'dayNtlVlm', 'funding'] as const;
const REQUIRED_UNIVERSE_NUMBER_FIELDS = ['szDecimals', 'maxLeverage', 'marginTableId'] as const;

type RequiredNumericField = (typeof REQUIRED_NUMERIC_FIELDS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaError(message: string, raw?: unknown): never {
  throw new SchemaError(message, raw);
}

function readNumericString(
  ctx: Record<string, unknown>,
  field: RequiredNumericField,
  index: number,
): number {
  if (!(field in ctx)) {
    schemaError(`assetCtxs[${index}].${field} missing`, ctx);
  }

  const rawValue = ctx[field];
  if (typeof rawValue !== 'string') {
    schemaError(`assetCtxs[${index}].${field} must be numeric string`, { field, value: rawValue });
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    schemaError(`assetCtxs[${index}].${field} is not numeric`, { field, value: rawValue });
  }

  return value;
}

function validateUniverseEntry(rawEntry: unknown, index: number): string {
  if (!isRecord(rawEntry)) {
    schemaError(`meta.universe[${index}] must be object`, rawEntry);
  }

  const name = rawEntry.name;
  if (typeof name !== 'string' || name.length === 0) {
    schemaError(`meta.universe[${index}].name must be non-empty string`, rawEntry);
  }

  for (const field of REQUIRED_UNIVERSE_NUMBER_FIELDS) {
    if (typeof rawEntry[field] !== 'number' || !Number.isFinite(rawEntry[field])) {
      schemaError(`meta.universe[${index}].${field} must be finite number`, rawEntry);
    }
  }

  return name;
}

export function validateMetaAndAssetCtxs(raw: unknown, schemaVersion = 1): ParsedHl {
  if (!Array.isArray(raw) || raw.length !== 2) {
    schemaError('HL metaAndAssetCtxs response must be [meta, assetCtxs]', raw);
  }

  const [meta, assetCtxs] = raw;
  if (!isRecord(meta) || !Array.isArray(meta.universe)) {
    schemaError('HL meta.universe must be an array', meta);
  }

  if (!Array.isArray(assetCtxs)) {
    schemaError('HL assetCtxs must be an array', assetCtxs);
  }

  if (meta.universe.length !== assetCtxs.length) {
    schemaError(
      `HL universe/assetCtxs length mismatch: universe=${meta.universe.length}, assetCtxs=${assetCtxs.length}`,
      raw,
    );
  }

  const parsed: ParsedHl = new Map();

  meta.universe.forEach((rawUniverseEntry, index) => {
    const name = validateUniverseEntry(rawUniverseEntry, index);
    const rawCtx = assetCtxs[index];

    if (!isRecord(rawCtx)) {
      schemaError(`assetCtxs[${index}] must be object`, rawCtx);
    }

    const numericValues = REQUIRED_NUMERIC_FIELDS.reduce<Record<RequiredNumericField, number>>(
      (values, field) => {
        values[field] = readNumericString(rawCtx, field, index);
        return values;
      },
      {} as Record<RequiredNumericField, number>,
    );

    const markPx = numericValues.markPx;
    const prevDayPx = numericValues.prevDayPx;
    const openInterest = numericValues.openInterest;
    const dayNtlVlm = numericValues.dayNtlVlm;
    const funding = numericValues.funding;

    if (prevDayPx === 0) {
      schemaError(`assetCtxs[${index}].prevDayPx must not be zero`, rawCtx);
    }

    const now = Date.now();
    const symbol = `xyz_${name}`;
    const point: PricePoint = {
      source: 'hyperliquid',
      symbol,
      price: markPx,
      unit: 'USD',
      change24hPct: ((markPx - prevDayPx) / prevDayPx) * 100,
      volume24hUsd: dayNtlVlm,
      fundingRate8h: funding,
      openInterestUsd: openInterest * markPx,
      status: 'ok',
      asOf: now,
      receivedAt: now,
      schemaVersion,
    };

    parsed.set(symbol, point);
  });

  return parsed;
}
