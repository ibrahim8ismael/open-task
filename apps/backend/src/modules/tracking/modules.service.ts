import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ModuleStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IssuesService, serializeBaseIssue } from "../issues/issues.service";

/** Wire uses "in-progress" (Django); Prisma member is in_progress. */
export function toModuleStatus(value: unknown): ModuleStatus {
  const v = String(value ?? "planned");
  return (v === "in-progress" ? "in_progress" : v) as ModuleStatus;
}

function fromModuleStatus(status: string): string {
  return status === "in_progress" ? "in-progress" : status;
}

type ModuleRow = {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  description: string;
  startDate: Date | null;
  targetDate: Date | null;
  status: string;
  leadId: string | null;
  sortOrder: number;
  archivedAt: Date | null;
};

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
  ) {}

  async workspaceOrThrow(slug: string): Promise<{ id: string }> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    return ws;
  }

  async projectOrThrow(workspaceId: string, projectId: string): Promise<{ id: string }> {
    const p = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } });
    if (!p) throw new NotFoundException({ detail: "Project not found." });
    return p;
  }

  async moduleOrThrow(projectId: string, moduleId: string, includeArchived = false): Promise<ModuleRow> {
    const m = await this.prisma.module.findFirst({
      where: { id: moduleId, projectId, deletedAt: null, ...(includeArchived ? {} : { archivedAt: null }) },
    });
    if (!m) throw new NotFoundException({ detail: "Module not found." });
    return m as ModuleRow;
  }

  async progressOf(moduleId: string): Promise<Record<string, number>> {
    const links = await this.prisma.moduleIssue.findMany({ where: { moduleId } });
    if (!links.length) {
      return { total_issues: 0, completed_issues: 0, cancelled_issues: 0, started_issues: 0, unstarted_issues: 0, backlog_issues: 0 };
    }
    const issues = await this.prisma.issue.findMany({
      where: { id: { in: links.map((l) => l.issueId) }, deletedAt: null },
    });
    const stateIds = [...new Set(issues.map((i) => i.stateId).filter((v): v is string => !!v))];
    const states = await this.prisma.state.findMany({ where: { id: { in: stateIds } } });
    const groupByState = new Map(states.map((s) => [s.id, s.group]));
    const out = { total_issues: issues.length, completed_issues: 0, cancelled_issues: 0, started_issues: 0, unstarted_issues: 0, backlog_issues: 0 };
    for (const i of issues) {
      const group = (i.stateId && groupByState.get(i.stateId)) || "backlog";
      if (group === "completed") out.completed_issues += 1;
      else if (group === "cancelled") out.cancelled_issues += 1;
      else if (group === "started") out.started_issues += 1;
      else if (group === "unstarted") out.unstarted_issues += 1;
      else out.backlog_issues += 1;
    }
    return out;
  }

  async memberIds(moduleId: string): Promise<string[]> {
    const rows = await this.prisma.moduleMember.findMany({ where: { moduleId } });
    return rows.map((r) => r.memberId);
  }

  async serialize(module: ModuleRow, userId?: string): Promise<Record<string, unknown>> {
    const [progress, members] = await Promise.all([this.progressOf(module.id), this.memberIds(module.id)]);
    let isFavorite = false;
    if (userId) {
      const fav = await this.prisma.userFavorite.findFirst({
        where: { userId, entityType: "module", entityIdentifier: module.id },
      });
      isFavorite = !!fav;
    }
    return {
      id: module.id,
      name: module.name,
      description: module.description,
      start_date: module.startDate,
      target_date: module.targetDate,
      status: fromModuleStatus(module.status),
      lead: module.leadId,
      members,
      project: module.projectId,
      workspace: module.workspaceId,
      sort_order: module.sortOrder,
      archived_at: module.archivedAt,
      is_favorite: isFavorite,
      ...progress,
    };
  }

  // --- CRUD ---

  async list(slug: string, pid: string, userId: string, includeArchived = false): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const rows = await this.prisma.module.findMany({
      where: {
        projectId: pid,
        deletedAt: null,
        ...(includeArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
      },
      orderBy: { sortOrder: "asc" },
    });
    return Promise.all(rows.map((r) => this.serialize(r as ModuleRow, userId)));
  }

  async create(
    slug: string,
    pid: string,
    userId: string,
    dto: { name: string; description?: string; start_date?: string; target_date?: string; status?: string; lead?: string; members?: string[] },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    if (!dto.name?.trim()) throw new ForbiddenException({ detail: "Name is required." });
    const row = await this.prisma.module
      .create({
        data: {
          projectId: pid,
          workspaceId: ws.id,
          name: dto.name.trim(),
          description: dto.description ?? "",
          startDate: dto.start_date ? new Date(dto.start_date) : null,
          targetDate: dto.target_date ? new Date(dto.target_date) : null,
          status: toModuleStatus(dto.status),
          leadId: dto.lead ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      .catch((e: unknown) => {
        if ((e as { code?: string })?.code === "P2002")
          throw new ForbiddenException({ detail: "Module name already exists." });
        throw e;
      });
    if (dto.members?.length) {
      await this.prisma.moduleMember.createMany({
        data: dto.members.map((memberId) => ({ moduleId: row.id, memberId })),
        skipDuplicates: true,
      });
    }
    return this.serialize(row as ModuleRow, userId);
  }

  async retrieve(slug: string, pid: string, mid: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    return this.serialize(await this.moduleOrThrow(pid, mid, true), userId);
  }

  async update(
    slug: string,
    pid: string,
    mid: string,
    userId: string,
    dto: { name?: string; description?: string; start_date?: string | null; target_date?: string | null; status?: string; lead?: string | null; members?: string[] },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const module = await this.moduleOrThrow(pid, mid);
    if (dto.name && dto.name.trim() !== module.name) {
      const dup = await this.prisma.module.findFirst({
        where: { projectId: pid, name: dto.name.trim(), deletedAt: null, id: { not: module.id } },
      });
      if (dup) throw new ForbiddenException({ detail: "Module name already exists." });
    }
    const updated = await this.prisma.module.update({
      where: { id: module.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.start_date !== undefined ? { startDate: dto.start_date ? new Date(dto.start_date) : null } : {}),
        ...(dto.target_date !== undefined ? { targetDate: dto.target_date ? new Date(dto.target_date) : null } : {}),
        ...(dto.status !== undefined ? { status: toModuleStatus(dto.status) } : {}),
        ...(dto.lead !== undefined ? { leadId: dto.lead || null } : {}),
        updatedBy: userId,
      },
    });
    if (dto.members !== undefined) {
      await this.prisma.moduleMember.deleteMany({ where: { moduleId: module.id } });
      if (dto.members.length) {
        await this.prisma.moduleMember.createMany({
          data: dto.members.map((memberId) => ({ moduleId: module.id, memberId })),
          skipDuplicates: true,
        });
      }
    }
    return this.serialize(updated as ModuleRow, userId);
  }

  async remove(slug: string, pid: string, mid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const module = await this.moduleOrThrow(pid, mid, true);
    await this.prisma.$transaction([
      this.prisma.moduleIssue.deleteMany({ where: { moduleId: module.id } }),
      this.prisma.moduleMember.deleteMany({ where: { moduleId: module.id } }),
      this.prisma.module.update({ where: { id: module.id }, data: { deletedAt: new Date() } }),
    ]);
    return { detail: "Module deleted." };
  }

  async setArchived(slug: string, pid: string, mid: string, archived: boolean): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const module = await this.moduleOrThrow(pid, mid, true);
    const updated = await this.prisma.module.update({
      where: { id: module.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    return this.serialize(updated as ModuleRow);
  }

  // --- issues in module ---

  async moduleIssues(slug: string, pid: string, mid: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.moduleOrThrow(pid, mid, true);
    const links = await this.prisma.moduleIssue.findMany({ where: { moduleId: mid } });
    const rows = await this.prisma.issue.findMany({
      where: {
        id: { in: links.length ? links.map((l) => l.issueId) : ["00000000-0000-0000-0000-000000000000"] },
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: { sortOrder: "asc" },
    });
    const counts = await this.issues.countsFor(rows.map((r) => r.id));
    const serialized = rows.map((r) => serializeBaseIssue(r as never, counts));
    return {
      grouped_by: "",
      next_cursor: "",
      prev_cursor: "",
      next_page_results: false,
      prev_page_results: false,
      total_count: serialized.length,
      count: serialized.length,
      total_pages: 1,
      extra_stats: null,
      results: serialized,
      total_results: serialized.length,
    };
  }

  async addIssues(slug: string, pid: string, mid: string, issueIds: string[]): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.moduleOrThrow(pid, mid);
    const valid = await this.prisma.issue.findMany({
      where: { id: { in: issueIds }, projectId: pid, deletedAt: null },
      select: { id: true },
    });
    await this.prisma.moduleIssue.createMany({
      data: valid.map((v) => ({ moduleId: mid, issueId: v.id })),
      skipDuplicates: true,
    });
    return { detail: `${valid.length} issues added to module.` };
  }

  async removeIssue(slug: string, pid: string, mid: string, issueId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.prisma.moduleIssue.deleteMany({ where: { moduleId: mid, issueId } });
    return { detail: "Issue removed from module." };
  }

  /** Modules attached to one issue (+ attach/detach by module list). */
  async issueModules(slug: string, pid: string, issueId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const links = await this.prisma.moduleIssue.findMany({ where: { issueId } });
    const rows = await this.prisma.module.findMany({ where: { id: { in: links.map((l) => l.moduleId) }, deletedAt: null } });
    return rows.map((r) => ({ id: r.id, name: r.name, status: fromModuleStatus(r.status) }));
  }

  async setIssueModules(
    slug: string,
    pid: string,
    issueId: string,
    moduleIds: string[],
    removedIds: string[],
  ): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const issue = await this.prisma.issue.findFirst({ where: { id: issueId, projectId: pid, deletedAt: null } });
    if (!issue) throw new NotFoundException({ detail: "Issue not found." });
    if (removedIds.length) {
      await this.prisma.moduleIssue.deleteMany({ where: { issueId, moduleId: { in: removedIds } } });
    }
    if (moduleIds.length) {
      const valid = await this.prisma.module.findMany({
        where: { id: { in: moduleIds }, projectId: pid, deletedAt: null },
        select: { id: true },
      });
      await this.prisma.moduleIssue.createMany({
        data: valid.map((v) => ({ moduleId: v.id, issueId })),
        skipDuplicates: true,
      });
    }
    return { detail: "Issue modules updated." };
  }

  // --- links ---

  async listLinks(slug: string, pid: string, mid: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.moduleOrThrow(pid, mid, true);
    const rows = await this.prisma.moduleLink.findMany({ where: { moduleId: mid } });
    return rows.map((l) => ({ id: l.id, title: l.title, url: l.url, metadata: l.metadata }));
  }

  async createLink(slug: string, pid: string, mid: string, dto: { title?: string; url: string }): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.moduleOrThrow(pid, mid, true);
    if (!dto.url) throw new ForbiddenException({ detail: "URL is required." });
    const row = await this.prisma.moduleLink.create({
      data: {
        moduleId: mid,
        url: dto.url,
        ...(dto.title !== undefined ? { title: dto.title } : {}),
      },
    });
    return { id: row.id, title: row.title, url: row.url, metadata: row.metadata };
  }

  async deleteLink(slug: string, pid: string, mid: string, lid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.moduleOrThrow(pid, mid, true);
    await this.prisma.moduleLink.deleteMany({ where: { id: lid, moduleId: mid } });
    return { detail: "Link deleted." };
  }

  // --- favorites + workspace scope ---

  async favorite(slug: string, userId: string, moduleId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const module = await this.prisma.module.findFirst({ where: { id: moduleId, workspaceId: ws.id, deletedAt: null } });
    if (!module) throw new NotFoundException({ detail: "Module not found." });
    const row = await this.prisma.userFavorite.upsert({
      where: { entityType_entityIdentifier_userId: { entityType: "module", entityIdentifier: module.id, userId } },
      create: { workspaceId: ws.id, userId, entityType: "module", entityIdentifier: module.id, name: module.name },
      update: { name: module.name },
    });
    return { id: row.id, entity_type: row.entityType, entity_identifier: row.entityIdentifier };
  }

  async unfavorite(slug: string, userId: string, moduleId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.prisma.userFavorite.deleteMany({
      where: { workspaceId: ws.id, userId, entityType: "module", entityIdentifier: moduleId },
    });
    return { detail: "Removed from favorites." };
  }

  async workspaceModules(slug: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const memberships = await this.prisma.projectMember.findMany({
      where: { workspaceId: ws.id, memberId: userId, isActive: true, deletedAt: null },
    });
    const pids = memberships.map((m) => m.projectId);
    const rows = await this.prisma.module.findMany({
      where: {
        workspaceId: ws.id,
        projectId: { in: pids.length ? pids : ["00000000-0000-0000-0000-000000000000"] },
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const results = await Promise.all(rows.map((r) => this.serialize(r as ModuleRow, userId)));
    return { results, count: results.length, next_cursor: "" };
  }
}
