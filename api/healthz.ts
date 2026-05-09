import type { VercelRequest, VercelResponse } from '@vercel/node';
import { healthzHandler } from '../server/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await healthzHandler(
    req as unknown as Parameters<typeof healthzHandler>[0],
    res as unknown as Parameters<typeof healthzHandler>[1],
  );
}
