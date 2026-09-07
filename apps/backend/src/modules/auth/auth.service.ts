import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import type { Response } from "express";
import { PrismaService } from "../../common/prisma/prisma.service";
import { MailerService } from "../mailer/mailer.service";

const SESSION_COOKIE = "session-id";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAGIC_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  webBase(): string {
    return (process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  }

  returnCodesDev(): boolean {
    return (process.env.AUTH_RETURN_CODES_DEV ?? "true") !== "false";
  }

  // --- users ---

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  validEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, 12);
  }

  async createUser(email: string, password: string): Promise<SessionUser> {
    const normalized = this.normalizeEmail(email);
    const base = normalized.split("@")[0].replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "user";
    const username = `${base}-${randomUUID().slice(0, 8)}`;
    const user = await this.prisma.user.create({
      data: {
        username,
        email: normalized,
        displayName: normalized,
        passwordHash: await this.hashPassword(password),
      },
    });
    await this.prisma.profile.create({ data: { userId: user.id } });
    return { id: user.id, email: user.email };
  }

  // --- sessions ---

  async createSession(
    userId: string,
    req: { headers: Record<string, unknown>; ip?: string | undefined },
  ): Promise<string> {
    const sessionKey = randomUUID();
    const fwd = req.headers["x-forwarded-for"];
    const deviceInfo = {
      user_agent: String(req.headers["user-agent"] ?? ""),
      ip_address: typeof fwd === "string" && fwd ? fwd.split(",")[0].trim() : (req.ip ?? ""),
    };
    await this.prisma.session.create({
      data: {
        sessionKey,
        sessionData: JSON.stringify({ userId }),
        expireAt: new Date(Date.now() + SESSION_TTL_MS),
        deviceInfo,
        userId,
      },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { lastActive: new Date() } }).catch(() => undefined);
    return sessionKey;
  }

  setSessionCookie(res: Response, sessionKey: string): void {
    res.cookie(SESSION_COOKIE, sessionKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS,
    });
  }

  async destroySession(sessionKey: string | undefined, res: Response): Promise<void> {
    if (sessionKey) await this.prisma.session.delete({ where: { sessionKey } }).catch(() => undefined);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  // --- magic codes ---

  async issueMagicCode(email: string): Promise<{ code: string; dev: boolean }> {
    const normalized = this.normalizeEmail(email);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = createHash("sha256").update(`${normalized}:${code}`).digest("hex");
    await this.prisma.magicCode.create({
      data: { email: normalized, codeHash, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) },
    });
    const delivered = await this.mailer.sendMagicCode(normalized, code);
    // Code echoed in the API response only when SMTP is off AND dev mode
    return { code: delivered ? "" : code, dev: this.returnCodesDev() && !delivered };
  }

  async consumeMagicCode(email: string, code: string): Promise<"ok" | "invalid" | "expired"> {
    const normalized = this.normalizeEmail(email);
    const codeHash = createHash("sha256").update(`${normalized}:${code.trim()}`).digest("hex");
    const row = await this.prisma.magicCode.findFirst({
      where: { email: normalized, codeHash, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return "invalid";
    if (row.expiresAt.getTime() <= Date.now()) return "expired";
    await this.prisma.magicCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return "ok";
  }

  // --- password reset ---

  async issueResetToken(userId: string): Promise<{ token: string; hasEmail: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    if (user.email) {
      const delivered = await this.mailer.sendPasswordReset(user.email, userId, token);
      return { token: delivered ? "" : token, hasEmail: true };
    }
    return { token, hasEmail: false };
  }

  async consumeResetToken(token: string): Promise<string | null> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
    await this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return row.userId;
  }

  // --- redirection path (port of Django get_redirection_path) ---

  async redirectionPath(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile || !profile.isOnboarded) return "onboarding";
    if (profile.lastWorkspaceId) {
      const ws = await this.prisma.workspace.findFirst({
        where: {
          id: profile.lastWorkspaceId,
          deletedAt: null,
          members: { some: { memberId: userId, isActive: true, deletedAt: null } },
        },
      });
      if (ws) return ws.slug;
    }
    const fallback = await this.prisma.workspace.findFirst({
      where: { deletedAt: null, members: { some: { memberId: userId, isActive: true, deletedAt: null } } },
      orderBy: { createdAt: "asc" },
    });
    if (fallback) return fallback.slug;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      const invites = await this.prisma.workspaceMemberInvite.count({
        where: { email: user.email, accepted: false },
      });
      if (invites > 0) return "invitations";
    }
    return "create-workspace";
  }
}
