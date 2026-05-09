import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { HealthzResponse } from '@shared/types/prices.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkgPath = join(__dirname, '..', '..', 'package.json');
const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

export const APP_VERSION = pkgJson.version;

export function buildHealthzResponse(): HealthzResponse {
  return { ok: true, version: APP_VERSION };
}
