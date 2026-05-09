import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pricesHandler } from '../server/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await pricesHandler(
    req as unknown as Parameters<typeof pricesHandler>[0],
    res as unknown as Parameters<typeof pricesHandler>[1],
  );
}
