import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DEFAULT_STATES } from "../../common/utils/default-states";
import { PrismaService } from "../../common/prisma/prisma.service";
import { inviteToken, numToRole, roleToNum } from "../../common/utils/roles";
import { serializeWorkspace, WorkspacesService } from "../workspaces/workspaces.service";

interface ProjectRow {
  id: string;
  workspaceId: string;
  name: string;
  identifier: string;
  description: string;
  network: string;
  emoji: string | null;
  archiveIn: number;
  closeIn: number;
  moduleView: boolean;
  cycleView: boolean;
  issueViewsView: boolean;
  pageView: boolean;
  intakeView: boolean;
  archivedAt: Date | null;
  timezone: string;
  defaultStateId: string | null;
  estimateId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeProject(p: ProjectRow): Record<string, unknown> {
  return {
    id: p.id,
    workspace: p.workspaceId,
    name: p.name,
    identifier: p.identifier,
    description: p.description,
    network: p.network === "Secret" ? 0 : 2,
    emoji: p.emoji,
    cover_image: null,
    archive_in: p.archiveIn,
    close_in: p.closeIn,
    module_view: p.moduleView,
    cycle_view: p.cycleView,
    issue_views_view: p.issueViewsView,
    page_view: p.pageView,
    intake_view: p.intakeView,
    is_time_tracking: false,
    archived_at: p.archivedAt,
    timezone: p.timezone,
    default_state: p.defaultStateId,
    estimate: p.estimateId ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async projectOrThrow(workspaceId: string, projectId: string): Promise<ProjectRow> {
    const p = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } });
    if (!p) throw new NotFoundException({ detail: "Project not found." });
    return p;
  }

  async list(workspaceSlug: string, includeArchived = false): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const rows = await this.prisma.project.findMany({
      where: {
        workspaceId: ws.id,
        deletedAt: null,
        ...(includeArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serializeProject);
  }

  async details(workspaceSlug: string, projectId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const p = await this.projectOrThrow(ws.id, projectId);
    const totalMembers = await this.prisma.projectMember.count({
      where: { projectId: p.id, isActive: true, deletedAt: null },
    });
    return { ...serializeProject(p), total_members: totalMembers, workspace_detail: serializeWorkspace(ws) };
  }

  async create(
    workspaceSlug: string,
    userId: string,
    dto: { name: string; identifier: string; description?: string; network?: number | string; emoji?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const name = (dto.name ?? "").trim();
    const identifier = (dto.identifier ?? "").trim().toUpperCase();
    if (!name || !identifier) throw new ForbiddenException({ detail: "Name and identifier are required." });
    const dupIdent = await this.prisma.project.findFirst({
      where: { workspaceId: ws.id, identifier, deletedAt: null },
    });
    if (dupIdent) throw new ForbiddenException({ detail: "Project identifier already exists." });
    const dupName = await this.prisma.project.findFirst({ where: { workspaceId: ws.id, name, deletedAt: null } });
    if (dupName) throw new ForbiddenException({ detail: "Project name already exists." });
    const network = dto.network === 0 || dto.network === "Secret" ? "Secret" : "Public";

    const created = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId: ws.id,
          name,
          identifier,
          description: dto.description ?? "",
          network: network as "Secret" | "Public",
          ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        },
      });
      await tx.projectMember.create({
        data: { projectId: project.id, workspaceId: ws.id, memberId: userId, role: "ADMIN" },
      });
      let defaultStateId: string | null = null;
      for (const s of DEFAULT_STATES) {
        // Sequential on purpose: interactive transactions must not run concurrent writes.
        // oxlint-disable-next-line eslint(no-await-in-loop)
        const state = await tx.state.create({
          data: {
            projectId: project.id,
            workspaceId: ws.id,
            name: s.name,
            group: s.group as "backlog" | "unstarted" | "started" | "completed" | "cancelled" | "triage",
            color: s.color,
            isDefault: s.isDefault,
            isTriage: s.isTriage,
            sequence: s.sequence,
          },
        });
        if (s.isDefault) defaultStateId = state.id;
      }
      return tx.project.update({ where: { id: project.id }, data: { defaultStateId } });
    });
    return serializeProject(created);
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    dto: { name?: string; description?: string; emoji?: string; archive_in?: number; close_in?: number },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const p = await this.projectOrThrow(ws.id, projectId);
    if (dto.name && dto.name.trim() !== p.name) {
      const dup = await this.prisma.project.findFirst({
        where: { workspaceId: ws.id, name: dto.name.trim(), deletedAt: null, id: { not: p.id } },
      });
      if (dup) throw new ForbiddenException({ detail: "Project name already exists." });
    }
    const updated = await this.prisma.project.update({
      where: { id: p.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        ...(dto.archive_in !== undefined ? { archiveIn: dto.archive_in } : {}),
        ...(dto.close_in !== undefined ? { closeIn: dto.close_in } : {}),
      },
    });
    return serializeProject(updated);
  }

  async remove(workspaceSlug: string, projectId: string): Promise<{ detail: string }> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const p = await this.projectOrThrow(ws.id, projectId);
    await this.prisma.project.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    return { detail: "Project deleted." };
  }

  async archive(workspaceSlug: string, projectId: string, archived: boolean): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const p = await this.projectOrThrow(ws.id, projectId);
    const updated = await this.prisma.project.update({
      where: { id: p.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    return serializeProject(updated);
  }

  // --- members ---

  async listMembers(workspaceSlug: string, projectId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.memberId).filter((v): v is string => !!v) } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      id: r.id,
      project: r.projectId,
      member: r.memberId && byId.get(r.memberId)
        ? { id: r.memberId, email: byId.get(r.memberId)?.email, display_name: byId.get(r.memberId)?.displayName }
        : r.memberId,
      role: roleToNum(r.role),
      is_active: r.isActive,
    }));
  }

  async addMember(
    workspaceSlug: string,
    projectId: string,
    data: { member_id?: string; email?: string; role?: unknown },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    let userId = data.member_id;
    if (!userId && data.email) {
      const u = await this.prisma.user.findUnique({ where: { email: data.email.trim().toLowerCase() } });
      if (!u) throw new NotFoundException({ detail: "User not found." });
      userId = u.id;
    }
    if (!userId) throw new ForbiddenException({ detail: "member_id or email is required." });
    const wsMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: ws.id, memberId: userId, isActive: true, deletedAt: null },
    });
    if (!wsMember) throw new ForbiddenException({ detail: "User is not a workspace member." });
    const existing = await this.prisma.projectMember.findFirst({ where: { projectId, memberId: userId } });
    const role = numToRole(data.role);
    if (existing) {
      const updated = await this.prisma.projectMember.update({
        where: { id: existing.id },
        data: { isActive: true, deletedAt: null, role },
      });
      return { id: updated.id, role: roleToNum(updated.role) };
    }
    const created = await this.prisma.projectMember.create({
      data: { projectId, workspaceId: ws.id, memberId: userId, role },
    });
    return { id: created.id, role: roleToNum(created.role) };
  }

  async updateMember(
    workspaceSlug: string,
    projectId: string,
    memberId: string,
    role: unknown,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const row = await this.prisma.projectMember.findFirst({ where: { projectId, id: memberId, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Member not found." });
    const updated = await this.prisma.projectMember.update({ where: { id: row.id }, data: { role: numToRole(role) } });
    return { id: updated.id, role: roleToNum(updated.role) };
  }

  async removeMember(workspaceSlug: string, projectId: string, memberId: string): Promise<{ detail: string }> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const row = await this.prisma.projectMember.findFirst({ where: { projectId, id: memberId, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Member not found." });
    await this.prisma.projectMember.update({ where: { id: row.id }, data: { isActive: false, deletedAt: new Date() } });
    return { detail: "Member removed." };
  }

  // --- invites ---

  async listInvites(workspaceSlug: string, projectId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const rows = await this.prisma.projectMemberInvite.findMany({ where: { projectId, accepted: false } });
    return rows.map((r) => ({ id: r.id, email: r.email, role: roleToNum(r.role), token: r.token }));
  }

  async invite(
    workspaceSlug: string,
    projectId: string,
    email: string,
    role: unknown,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const clean = email.trim().toLowerCase();
    const row = await this.prisma.projectMemberInvite.create({
      data: { projectId, workspaceId: ws.id, email: clean, role: numToRole(role), token: inviteToken() },
    });
    return { id: row.id, email: row.email, role: roleToNum(row.role), token: row.token };
  }

  async identifiers(workspaceSlug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const rows = await this.prisma.project.findMany({
      where: { workspaceId: ws.id, deletedAt: null },
      select: { id: true, identifier: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.identifier, project: r.id }));
  }

  async detailsList(workspaceSlug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const rows = await this.prisma.project.findMany({
      where: { workspaceId: ws.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const withCounts = await Promise.all(
      rows.map(async (p) => {
        const totalMembers = await this.prisma.projectMember.count({
          where: { projectId: p.id, isActive: true, deletedAt: null },
        });
        return Object.assign(serializeProject(p), { total_members: totalMembers });
      }),
    );
    return withCounts;
  }

  async stats(workspaceSlug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const rows = await this.prisma.project.findMany({
      where: { workspaceId: ws.id, deletedAt: null, archivedAt: null },
    });
    return Promise.all(
      rows.map(async (p) => {
        const [total, completed, members, cycles, modules] = await Promise.all([
          this.prisma.issue.count({ where: { projectId: p.id, deletedAt: null, archivedAt: null } }),
          this.prisma.issue.count({
            where: { projectId: p.id, deletedAt: null, archivedAt: null, state: { is: { group: "completed" } } },
          }),
          this.prisma.projectMember.count({ where: { projectId: p.id, isActive: true, deletedAt: null } }),
          this.prisma.cycle.count({ where: { projectId: p.id, deletedAt: null, archivedAt: null } }),
          this.prisma.module.count({ where: { projectId: p.id, deletedAt: null, archivedAt: null } }),
        ]);
        return {
          id: p.id,
          total_issues: total,
          completed_issues: completed,
          total_cycles: cycles,
          total_members: members,
          total_modules: modules,
        };
      }),
    );
  }

  async myMembership(workspaceSlug: string, projectId: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const row = await this.prisma.projectMember.findFirst({
      where: { projectId, memberId: userId, isActive: true, deletedAt: null },
    });
    if (!row) throw new NotFoundException({ detail: "Membership not found." });
    return { id: row.id, project: row.projectId, member: row.memberId, role: roleToNum(row.role) };
  }

  async userProperties(workspaceSlug: string, projectId: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const row = await this.prisma.projectUserProperty.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId, workspaceId: ws.id },
      update: {},
    });
    return serializeProjectProps(row);
  }

  async updateUserProperties(
    workspaceSlug: string,
    projectId: string,
    userId: string,
    dto: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const data: Record<string, unknown> = {};
    if (dto.filters !== undefined) data.filters = dto.filters as object;
    if (dto.display_filters !== undefined) data.displayFilters = dto.display_filters as object;
    if (dto.display_properties !== undefined) data.displayProperties = dto.display_properties as object;
    if (dto.rich_filters !== undefined) data.richFilters = dto.rich_filters as object;
    if (dto.preferences !== undefined) data.preferences = dto.preferences as object;
    if (dto.sort_order !== undefined) data.sortOrder = Number(dto.sort_order);
    const row = await this.prisma.projectUserProperty.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: {
        userId,
        projectId,
        workspaceId: ws.id,
        filters: (data.filters as object | undefined) ?? {},
        displayFilters: (data.displayFilters as object | undefined) ?? {},
        displayProperties: (data.displayProperties as object | undefined) ?? {},
        richFilters: (data.richFilters as object | undefined) ?? {},
        preferences: (data.preferences as object | undefined) ?? {},
        sortOrder: (data.sortOrder as number | undefined) ?? 65535,
      },
      update: data as never,
    });
    return serializeProjectProps(row);
  }

  async favoriteProjects(workspaceSlug: string, userId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const rows = await this.prisma.userFavorite.findMany({
      where: { workspaceId: ws.id, userId, entityType: "project" },
    });
    return rows.map((r) => ({ id: r.id, entity_type: r.entityType, entity_identifier: r.entityIdentifier }));
  }

  async favoriteProject(workspaceSlug: string, userId: string, projectId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.projectOrThrow(ws.id, projectId);
    const row = await this.prisma.userFavorite.upsert({
      where: { entityType_entityIdentifier_userId: { entityType: "project", entityIdentifier: projectId, userId } },
      create: { workspaceId: ws.id, userId, entityType: "project", entityIdentifier: projectId },
      update: {},
    });
    return { id: row.id, entity_type: row.entityType, entity_identifier: row.entityIdentifier };
  }

  async unfavoriteProject(workspaceSlug: string, userId: string, projectId: string): Promise<{ detail: string }> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    await this.prisma.userFavorite.deleteMany({
      where: { workspaceId: ws.id, userId, entityType: "project", entityIdentifier: projectId },
    });
    return { detail: "Removed from favorites." };
  }

  async searchIssues(
    workspaceSlug: string,
    projectId: string,
    search: string,
  ): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const project = await this.projectOrThrow(ws.id, projectId);
    const full = await this.prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    const term = (search ?? "").trim();
    if (!term) return [];
    const rows = await this.prisma.issue.findMany({
      where: { projectId: project.id, deletedAt: null, name: { contains: term, mode: "insensitive" } },
      take: 20,
    });
    const states = await this.prisma.state.findMany({ where: { projectId: project.id } });
    const byId = new Map(states.map((s) => [s.id, s]));
    return rows.map((r) => {
      const st = r.stateId ? byId.get(r.stateId) : undefined;
      return {
        id: r.id,
        name: r.name,
        project_id: r.projectId,
        project__identifier: full.identifier,
        project__name: full.name,
        sequence_id: r.sequenceId,
        start_date: r.startDate,
        state__color: st?.color ?? "",
        state__group: st?.group ?? "",
        state__name: st?.name ?? "",
        workspace__slug: workspaceSlug,
        type_id: r.typeId,
      };
    });
  }

  async myProjectInvites(workspaceSlug: string, userId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.email) return [];
    const rows = await this.prisma.projectMemberInvite.findMany({
      where: { workspaceId: ws.id, email: user.email.toLowerCase(), accepted: false },
    });
    return rows.map((r) => ({ id: r.id, email: r.email, project: r.projectId, role: roleToNum(r.role) }));
  }

  async acceptProjectInvites(workspaceSlug: string, userId: string, projectIds: string[]): Promise<{ detail: string }> {
    const ws = await this.workspaces.workspaceOrThrow(workspaceSlug);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.email) return { detail: "No invitations." };
    const invites = await this.prisma.projectMemberInvite.findMany({
      where: { workspaceId: ws.id, email: user.email.toLowerCase(), accepted: false, projectId: { in: projectIds } },
    });
    await Promise.all(
      invites.map(async (inv) => {
        await this.prisma.projectMemberInvite.update({ where: { id: inv.id }, data: { accepted: true, respondedAt: new Date() } });
        const existing = await this.prisma.projectMember.findFirst({
          where: { projectId: inv.projectId, memberId: userId },
        });
        if (existing) {
          await this.prisma.projectMember.update({
            where: { id: existing.id },
            data: { isActive: true, deletedAt: null, role: inv.role },
          });
        } else {
          await this.prisma.projectMember.create({
            data: { projectId: inv.projectId, workspaceId: ws.id, memberId: userId, role: inv.role },
          });
        }
      }),
    );
    return { detail: `${invites.length} invitations accepted.` };
  }
}

function serializeProjectProps(row: {
  filters: unknown;
  displayFilters: unknown;
  displayProperties: unknown;
  richFilters: unknown;
  preferences: unknown;
  sortOrder: number;
}): Record<string, unknown> {
  const prefs = (row.preferences as Record<string, unknown>) ?? {};
  return {
    filters: row.filters,
    display_filters: row.displayFilters,
    display_properties: row.displayProperties,
    rich_filters: row.richFilters,
    sort_order: row.sortOrder,
    preferences: {
      pages: { block_display: false, ...(prefs.pages as object | undefined) },
      navigation: (prefs.navigation as object | undefined) ?? {},
    },
  };
}
