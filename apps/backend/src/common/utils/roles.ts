import { randomUUID } from "node:crypto";

export const ROLE_TO_NUM: Record<string, number> = { ADMIN: 20, MEMBER: 15, GUEST: 5 };
export const NUM_TO_ROLE: Record<number, "ADMIN" | "MEMBER" | "GUEST"> = { 20: "ADMIN", 15: "MEMBER", 5: "GUEST" };

export function roleToNum(role: string): number {
  return ROLE_TO_NUM[role] ?? 15;
}

export function numToRole(n: unknown): "ADMIN" | "MEMBER" | "GUEST" {
  if (typeof n === "number" && NUM_TO_ROLE[n]) return NUM_TO_ROLE[n];
  if (typeof n === "string" && ROLE_TO_NUM[n.toUpperCase()] !== undefined)
    return n.toUpperCase() as "ADMIN" | "MEMBER" | "GUEST";
  return "MEMBER";
}

/** Slugify a workspace/project name: lower, alnum+dash. */
export function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";
  return base;
}

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 4);
}

export function inviteToken(): string {
  return randomUUID().replace(/-/g, "");
}
