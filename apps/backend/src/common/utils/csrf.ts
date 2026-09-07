import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  return process.env.SESSION_SECRET ?? "change-me-in-prod-min-32-chars";
}

/** Issue a stateless CSRF token: base64(rand).base64(hmac). */
export function issueCsrfToken(): string {
  const rand = randomBytes(32).toString("base64url");
  const sig = createHmac("sha256", secret()).update(rand).digest("base64url");
  return `${rand}.${sig}`;
}

/** Verify a token issued by issueCsrfToken. */
export function verifyCsrfToken(token: string | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const expected = createHmac("sha256", secret()).update(parts[0]).digest("base64url");
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
