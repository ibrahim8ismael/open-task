import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class ApiTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verify an X-Api-Token value; updates lastUsed + writes an activity row. */
  async verify(token: string, meta?: { path?: string; method?: string; ip?: string }): Promise<{ userId: string } | null> {
    if (!token.startsWith("plane_api_")) return null;
    const row = await this.prisma.aPIToken.findUnique({ where: { token } });
    if (!row || !row.isActive) return null;
    if (row.expiredAt && row.expiredAt.getTime() <= Date.now()) return null;
    await this.prisma.aPIToken.update({ where: { id: row.id }, data: { lastUsed: new Date() } }).catch(() => undefined);
    await this.prisma.aPIActivityLog
      .create({
        data: {
          tokenIdentifier: row.id,
          path: (meta?.path ?? "").slice(0, 500),
          method: meta?.method ?? "",
          responseCode: 200,
          ...(meta?.ip !== undefined ? { ipAddress: meta.ip } : {}),
        },
      })
      .catch(() => undefined);
    return { userId: row.userId };
  }

  async list(userId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.aPIToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      is_active: r.isActive,
      created_at: r.createdAt,
      last_used: r.lastUsed,
      expired_at: r.expiredAt,
    }));
  }

  async create(
    userId: string,
    dto: { label?: string; description?: string; workspace_id?: string; expires_in_days?: number },
  ): Promise<Record<string, unknown>> {
    if (dto.workspace_id) {
      const ws = await this.prisma.workspace.findFirst({ where: { id: dto.workspace_id, deletedAt: null } });
      if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    }
    const token = `plane_api_${randomBytes(20).toString("hex")}`;
    const row = await this.prisma.aPIToken.create({
      data: {
        userId,
        label: dto.label ?? "",
        description: dto.description ?? "",
        token,
        expiredAt: dto.expires_in_days ? new Date(Date.now() + dto.expires_in_days * 24 * 60 * 60 * 1000) : null,
        ...(dto.workspace_id !== undefined ? { workspaceId: dto.workspace_id } : {}),
      },
    });
    // Full value returned ONCE at creation (Django parity)
    return {
      id: row.id,
      label: row.label,
      description: row.description,
      token: row.token,
      created_at: row.createdAt,
      expired_at: row.expiredAt,
    };
  }

  async remove(userId: string, tokenId: string): Promise<void> {
    const row = await this.prisma.aPIToken.findFirst({ where: { id: tokenId, userId } });
    if (!row) throw new ForbiddenException({ detail: "Token not found." });
    await this.prisma.aPIToken.delete({ where: { id: row.id } });
  }
}
