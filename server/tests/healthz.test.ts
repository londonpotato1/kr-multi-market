import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('/api/healthz', () => {
  test('uses package.json version and exact HealthzResponse shape', async () => {
    const { APP_VERSION, buildHealthzResponse } = await import('../lib/healthz.js');
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
    ) as { version: string };

    expect(APP_VERSION).toBe(pkg.version);
    expect(buildHealthzResponse()).toEqual({ ok: true, version: pkg.version });
  });
});
