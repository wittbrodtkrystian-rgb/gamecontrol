// Limiter w pamięci procesu (okno przesuwne). Przy wielu instancjach zastąp wersją opartą o Redis (REDIS_URL).
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowSec: number): boolean {
  const now = Date.now(), from = now - windowSec * 1000;
  const arr = (hits.get(key) ?? []).filter((t) => t > from);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.length || v[v.length - 1] < from) hits.delete(k);
  return true;
}
export const _resetRateLimits = () => hits.clear();
