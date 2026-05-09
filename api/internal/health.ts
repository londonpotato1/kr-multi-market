import type { VercelRequest, VercelResponse } from '@vercel/node';
import { internalHealthHandler } from '../../server/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await internalHealthHandler(
    req as unknown as Parameters<typeof internalHealthHandler>[0],
    res as unknown as Parameters<typeof internalHealthHandler>[1],
  );
}
