/** Minimal in-memory fixed-window throttle (per key). V1 single-instance. */
const hits = new Map<string, number[]>();

export function throttleCheck(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= limit;
}

export function throttleKey(ip: string, scope: string): string {
  return `${scope}:${ip}`;
}

export function clientIp(req: { ip?: string | undefined; headers: Record<string, unknown> }): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.ip ?? "unknown";
}

/** Parse "60/minute" | "10/second" | "500/hour" -> [limit, windowMs]. Falls back to 60/min. */
export function parseRateLimit(raw: string): [number, number] {
  const m = /^(\d+)\s*\/\s*(second|minute|hour)$/i.exec((raw ?? "").trim());
  if (!m) return [60, 60_000];
  const limit = Math.max(1, Number(m[1]));
  const unit = m[2].toLowerCase();
  const windowMs = unit === "second" ? 1_000 : unit === "hour" ? 3_600_000 : 60_000;
  return [limit, windowMs];
}
