export const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[${new Date().toISOString()}] INFO ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[${new Date().toISOString()}] WARN ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[${new Date().toISOString()}] ERROR ${msg}`, ...args),
};
