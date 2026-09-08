import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { MailerService } from "../mailer/mailer.service";
import { inviteToken, numToRole, roleToNum, slugify, uniqueSuffix } from "../../common/utils/roles";

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  organizationSize: string | null;
  timezone: string;
  backgroundColor: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeWorkspace(w: WorkspaceRow): Record<string, unknown> {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    logo: null,
    organization_size: w.organizationSize,
    timezone: w.timezone,
    background_color: w.backgroundColor,
    owner: w.ownerId,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
  };
}

export function serializeMember(m: {
  id: string;
  workspaceId: string;
  memberId: string;
  role: string;
  isActive: boolean;
  member?: { id: string; email: string | null; displayName: string; avatar: string } | null;
}): Record<string, unknown> {
  return {
    id: m.id,
    workspace: m.workspaceId,
    member: m.member
      ? { id: m.member.id, email: m.member.email, display_name: m.member.displayName, avatar: m.member.avatar }
      : m.memberId,
    role: roleToNum(m.role),
    is_active: m.isActive,
  };
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async workspaceOrThrow(slug: string): Promise<WorkspaceRow> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    return ws;
  }

  async membershipOrThrow(workspaceId: string, userId: string): Promise<{ id: string; role: string }> {
    const wm = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, memberId: userId, isActive: true, deletedAt: null },
    });
    if (!wm) throw new ForbiddenException({ detail: "Not a workspace member." });
    return wm;
  }

  async listMine(userId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.workspace.findMany({
      where: { deletedAt: null, members: { some: { memberId: userId, isActive: true, deletedAt: null } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serializeWorkspace);
  }

  async create(userId: string, name: string, slug?: string, organizationSize?: string): Promise<Record<string, unknown>> {
    const cleanName = (name ?? "").trim();
    if (!cleanName) throw new ForbiddenException({ detail: "Name is required." });
    let candidate = (slug ?? "").trim().toLowerCase() || slugify(cleanName);
    // Normalize candidate (slugify already lowercases, but custom slug may contain invalid chars)
    candidate = candidate.replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || slugify(cleanName);
    for (let i = 0; i < 5; i += 1) {
      // Sequential on purpose: each candidate depends on the previous check (max 5 tries).
      // oxlint-disable-next-line eslint(no-await-in-loop)
      const taken = await this.prisma.workspace.findFirst({ where: { slug: candidate, deletedAt: null } });
      const isRestricted = WorkspacesService.RESTRICTED_SLUGS.has(candidate);
      if (!taken && !isRestricted) break;
      candidate = `${slugify(cleanName)}-${uniqueSuffix()}`;
    }
    const ws = await this.prisma.workspace.create({
      data: { name: cleanName, slug: candidate, organizationSize: organizationSize ?? null, ownerId: userId },
    });
    await this.prisma.workspaceMember.create({
      data: { workspaceId: ws.id, memberId: userId, role: "ADMIN" },
    });
    return serializeWorkspace(ws);
  }

  async update(slug: string, data: { name?: string; organization_size?: string; timezone?: string }): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const updated = await this.prisma.workspace.update({
      where: { id: ws.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.organization_size !== undefined ? { organizationSize: data.organization_size } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      },
    });
    return serializeWorkspace(updated);
  }

  async remove(slug: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.prisma.workspace.update({
      where: { id: ws.id },
      data: { deletedAt: new Date(), slug: `${ws.slug}-deleted-${Date.now()}` },
    });
    return { detail: "Workspace deleted." };
  }

  // Keep in sync with `packages/constants/src/workspace.ts:RESTRICTED_URLS` and
  // `apps/api/plane/utils/constants.py:RESTRICTED_WORKSPACE_SLUGS`
  private static readonly RESTRICTED_SLUGS = new Set([
    "404",
    "accounts",
    "api",
    "create-workspace",
    "god-mode",
    "installations",
    "invitations",
    "onboarding",
    "profile",
    "spaces",
    "workspace-invitations",
    "password",
    "flags",
    "monitor",
    "monitoring",
    "ingest",
    "plane-pro",
    "plane-ultimate",
    "enterprise",
    "plane-enterprise",
    "disco",
    "silo",
    "chat",
    "calendar",
    "drive",
    "channels",
    "upgrade",
    "billing",
    "sign-in",
    "sign-up",
    "signin",
    "signup",
    "config",
    "live",
    "admin",
    "m",
    "import",
    "importers",
    "integrations",
    "integration",
    "configuration",
    "initiatives",
    "initiative",
    "workflow",
    "workflows",
    "epics",
    "epic",
    "story",
    "mobile",
    "dashboard",
    "desktop",
    "onload",
    "real-time",
    "one",
    "pages",
    "business",
    "pro",
    "settings",
    "license",
    "licenses",
    "instances",
    "instance",
  ]);

  async slugAvailable(slug: string): Promise<{ available: boolean; status: boolean }> {
    const clean = (slug ?? "").trim().toLowerCase();
    if (!clean) return { available: false, status: false };
    if (WorkspacesService.RESTRICTED_SLUGS.has(clean)) return { available: false, status: false };
    const taken = await this.prisma.workspace.findFirst({ where: { slug: clean, deletedAt: null } });
    const ok = !taken;
    return { available: ok, status: ok };
  }

  // --- members ---

  async listMembers(workspaceId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.memberId) } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) =>
      serializeMember({ ...r, member: byId.get(r.memberId) ?? null }),
    );
  }

  async updateMember(workspaceId: string, memberId: string, role: unknown): Promise<Record<string, unknown>> {
    const row = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, id: memberId, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Member not found." });
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    if (row.memberId === ws.ownerId) throw new ForbiddenException({ detail: "Cannot change the owner role." });
    const updated = await this.prisma.workspaceMember.update({
      where: { id: row.id },
      data: { role: numToRole(role) },
    });
    return serializeMember(updated);
  }

  async removeMember(workspaceId: string, memberId: string): Promise<{ detail: string }> {
    const row = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, id: memberId, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Member not found." });
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    if (row.memberId === ws.ownerId) throw new ForbiddenException({ detail: "Cannot remove the owner." });
    await this.prisma.workspaceMember.update({ where: { id: row.id }, data: { isActive: false, deletedAt: new Date() } });
    return { detail: "Member removed." };
  }

  async leave(workspaceId: string, userId: string): Promise<{ detail: string }> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    if (ws.ownerId === userId) throw new ForbiddenException({ detail: "Owner cannot leave. Delete the workspace instead." });
    const row = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, memberId: userId, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Membership not found." });
    await this.prisma.workspaceMember.update({ where: { id: row.id }, data: { isActive: false, deletedAt: new Date() } });
    return { detail: "Left workspace." };
  }

  // --- invites ---

  async listInvites(workspaceId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.workspaceMemberInvite.findMany({
      where: { workspaceId, accepted: false },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ id: r.id, email: r.email, role: roleToNum(r.role), token: r.token, accepted: r.accepted }));
  }

  async invite(workspaceId: string, email: string, role: unknown, inviterName?: string): Promise<Record<string, unknown>> {
    const clean = email.trim().toLowerCase();
    // Re-invite: refresh the existing row (unique [email, workspace]) instead of failing.
    const existing = await this.prisma.workspaceMemberInvite.findFirst({ where: { workspaceId, email: clean } });
    let row;
    if (existing) {
      row = await this.prisma.workspaceMemberInvite.update({
        where: { id: existing.id },
        data: { accepted: false, respondedAt: null, role: numToRole(role), token: inviteToken() },
      });
    } else {
      row = await this.prisma.workspaceMemberInvite.create({
        data: { workspaceId, email: clean, role: numToRole(role), token: inviteToken() },
      });
    }
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    await this.mailer.sendWorkspaceInvite(clean, ws.name, inviterName ?? "A teammate");
    return { id: row.id, email: row.email, role: roleToNum(row.role), token: row.token };
  }

  async join(inviteId: string, userId: string): Promise<Record<string, unknown>> {
    const invite = await this.prisma.workspaceMemberInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.accepted) throw new NotFoundException({ detail: "Invitation not found." });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.email || user.email.toLowerCase() !== invite.email.toLowerCase())
      throw new ForbiddenException({ detail: "Invitation email does not match your account." });
    await this.prisma.workspaceMemberInvite.update({
      where: { id: invite.id },
      data: { accepted: true, respondedAt: new Date() },
    });
    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: invite.workspaceId, memberId: userId },
    });
    if (existing) {
      // Re-join (e.g. after leaving): reactivate with the invite's role.
      await this.prisma.workspaceMember.update({
        where: { id: existing.id },
        data: { isActive: true, deletedAt: null, role: invite.role },
      });
    } else {
      await this.prisma.workspaceMember.create({
        data: { workspaceId: invite.workspaceId, memberId: userId, role: invite.role },
      });
    }
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: invite.workspaceId } });
    return serializeWorkspace(ws);
  }

  // --- user properties / last visited ---

  async getUserProperties(workspaceId: string, userId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.workspaceUserProperties.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId },
      update: {},
    });
    return { filters: row.filters, display_filters: row.displayFilters, display_properties: row.displayProperties };
  }

  async updateUserProperties(
    workspaceId: string,
    userId: string,
    data: { filters?: unknown; display_filters?: unknown; display_properties?: unknown },
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.workspaceUserProperties.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: {
        workspaceId,
        userId,
        filters: (data.filters as object) ?? {},
        displayFilters: (data.display_filters as object) ?? {},
        displayProperties: (data.display_properties as object) ?? {},
      },
      update: {
        ...(data.filters !== undefined ? { filters: data.filters as object } : {}),
        ...(data.display_filters !== undefined ? { displayFilters: data.display_filters as object } : {}),
        ...(data.display_properties !== undefined ? { displayProperties: data.display_properties as object } : {}),
      },
    });
    return { filters: row.filters, display_filters: row.displayFilters, display_properties: row.displayProperties };
  }
}
