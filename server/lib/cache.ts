type CacheEntry<T> = {
  promise: Promise<T>;
  resolvedAt?: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function singleFlight<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing) {
    if (existing.resolvedAt === undefined) {
      return existing.promise;
    }
    if (now - existing.resolvedAt < ttlMs) {
      return existing.promise;
    }
  }

  const entry: CacheEntry<T> = { promise: undefined as unknown as Promise<T> };
  entry.promise = fn().then(
    (value) => {
      entry.resolvedAt = Date.now();
      return value;
    },
    (err) => {
      cache.delete(key);
      throw err;
    },
  );
  cache.set(key, entry as CacheEntry<unknown>);
  return entry.promise;
}

export function _clearCache() {
  cache.clear();
}
