import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SchemaError, validateMetaAndAssetCtxs } from '../lib/sources/hl-schema.js';

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/hl/${name}.json`, import.meta.url), 'utf-8'));
}

function expectSchemaError(raw: unknown, messagePattern: RegExp) {
  try {
    validateMetaAndAssetCtxs(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(SchemaError);
    expect((error as SchemaError).message).toMatch(messagePattern);
    return;
  }

  throw new Error('Expected SchemaError');
}

describe('validateMetaAndAssetCtxs', () => {
  it('parses valid HL response into PricePoint map', () => {
    const parsed = validateMetaAndAssetCtxs(loadFixture('valid'));

    expect(parsed).toBeInstanceOf(Map);
    expect(parsed.size).toBe(2);
    expect(parsed.has('xyz_SMSN')).toBe(true);
    expect(parsed.has('xyz_KR200')).toBe(true);
  });

  it('throws SchemaError with markPx when markPx is missing', () => {
    expectSchemaError(loadFixture('missing-markPx'), /markPx/);
  });

  it('throws SchemaError with markPx when markPx is renamed', () => {
    expectSchemaError(loadFixture('renamed-px'), /markPx/);
  });

  it('throws SchemaError with length mismatch when asset ctx is removed', () => {
    expectSchemaError(loadFixture('asset-removed'), /length|mismatch/i);
  });
});
