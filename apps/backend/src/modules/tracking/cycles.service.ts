import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { IssuesService, serializeBaseIssue } from "../issues/issues.service";

type CycleRow = {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  description: string;
  startDate: Date | null;
  endDate: Date | null;
  ownedById: string;
  progressSnapshot: unknown;
  sortOrder: number;
  archivedAt: Date | null;
  timezone: string;
  version: number;
};

export interface Progress {
  total_issues: number;
  completed_issues: number;
  backlog_issues: number;
  started_issues: number;
  unstarted_issues: number;
  cancelled_issues: number;
  total_estimate_points: number;
  completed_estimate_points: number;
  backlog_estimate_points: number;
  started_estimate_points: number;
  unstarted_estimate_points: number;
  cancelled_estimate_points: number;
  distribution: Record<string, number>;
}

const emptyProgress = (): Progress => ({
  total_issues: 0,
  completed_issues: 0,
  backlog_issues: 0,
  started_issues: 0,
  unstarted_issues: 0,
  cancelled_issues: 0,
  total_estimate_points: 0,
  completed_estimate_points: 0,
  backlog_estimate_points: 0,
  started_estimate_points: 0,
  unstarted_estimate_points: 0,
  cancelled_estimate_points: 0,
  distribution: {},
});

function snapshotEmpty(s: unknown): boolean {
  return !s || (typeof s === "object" && Object.keys(s as object).length === 0);
}

@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
    private readonly webhooks: WebhooksService,
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

  async cycleOrThrow(projectId: string, cycleId: string, includeArchived = false): Promise<CycleRow> {
    const c = await this.prisma.cycle.findFirst({
      where: { id: cycleId, projectId, deletedAt: null, ...(includeArchived ? {} : { archivedAt: null }) },
    });
    if (!c) throw new NotFoundException({ detail: "Cycle not found." });
    return c as CycleRow;
  }

  private closed(cycle: CycleRow): boolean {
    return !!cycle.endDate && cycle.endDate.getTime() < Date.now();
  }

  /** Live progress over current cycle issues (docs/03 §3.3). */
  async liveProgress(cycleId: string): Promise<Progress> {
    const out = emptyProgress();
    const links = await this.prisma.cycleIssue.findMany({ where: { cycleId } });
    if (!links.length) return out;
    const issues = await this.prisma.issue.findMany({
      where: { id: { in: links.map((l) => l.issueId) }, deletedAt: null },
    });
    const stateIds = [...new Set(issues.map((i) => i.stateId).filter((v): v is string => !!v))];
    const states = await this.prisma.state.findMany({ where: { id: { in: stateIds } } });
    const groupByState = new Map(states.map((s) => [s.id, s.group]));
    const pointIds = [...new Set(issues.map((i) => i.estimatePointId).filter((v): v is string => !!v))];
    const points = await this.prisma.estimatePoint.findMany({ where: { id: { in: pointIds } } });
    const valueByPoint = new Map(points.map((p) => [p.id, Number(p.value) || 0]));
    for (const i of issues) {
      const group = (i.stateId && groupByState.get(i.stateId)) || "backlog";
      out.total_issues += 1;
      const pts = (i.estimatePointId && valueByPoint.get(i.estimatePointId)) || 0;
      out.total_estimate_points += pts;
      if (i.stateId) out.distribution[i.stateId] = (out.distribution[i.stateId] ?? 0) + 1;
      switch (group) {
        case "completed":
          out.completed_issues += 1;
          out.completed_estimate_points += pts;
          break;
        case "cancelled":
          out.cancelled_issues += 1;
          out.cancelled_estimate_points += pts;
          break;
        case "started":
          out.started_issues += 1;
          out.started_estimate_points += pts;
          break;
        case "unstarted":
          out.unstarted_issues += 1;
          out.unstarted_estimate_points += pts;
          break;
        default:
          out.backlog_issues += 1;
          out.backlog_estimate_points += pts;
          break;
      }
    }
    return out;
  }

  async progressOf(cycle: CycleRow): Promise<Progress> {
    if (!snapshotEmpty(cycle.progressSnapshot)) return cycle.progressSnapshot as Progress;
    return this.liveProgress(cycle.id);
  }

  async serialize(cycle: CycleRow, userId?: string): Promise<Record<string, unknown>> {
    const progress = await this.progressOf(cycle);
    let isFavorite = false;
    if (userId) {
      const fav = await this.prisma.userFavorite.findFirst({
        where: { userId, entityType: "cycle", entityIdentifier: cycle.id },
      });
      isFavorite = !!fav;
    }
    return {
      id: cycle.id,
      name: cycle.name,
      description: cycle.description,
      start_date: cycle.startDate,
      end_date: cycle.endDate,
      owned_by: cycle.ownedById,
      project: cycle.projectId,
      workspace: cycle.workspaceId,
      sort_order: cycle.sortOrder,
      archived_at: cycle.archivedAt,
      timezone: cycle.timezone,
      version: cycle.version,
      progress_snapshot: snapshotEmpty(cycle.progressSnapshot) ? undefined : cycle.progressSnapshot,
      is_favorite: isFavorite,
      ...progress,
    };
  }

  // --- CRUD ---

  async list(slug: string, pid: string, userId: string, includeArchived = false): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const rows = await this.prisma.cycle.findMany({
      where: {
        projectId: pid,
        deletedAt: null,
        ...(includeArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
      },
      orderBy: { sortOrder: "asc" },
    });
    return Promise.all(rows.map((r) => this.serialize(r as CycleRow, userId)));
  }

  async create(
    slug: string,
    pid: string,
    userId: string,
    dto: { name: string; description?: string; start_date?: string; end_date?: string; owned_by?: string; timezone?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    if (!dto.name?.trim()) throw new ForbiddenException({ detail: "Name is required." });
    const min = await this.prisma.cycle.aggregate({ _min: { sortOrder: true }, where: { projectId: pid } });
    const row = await this.prisma.cycle.create({
      data: {
        projectId: pid,
        workspaceId: ws.id,
        name: dto.name.trim(),
        description: dto.description ?? "",
        startDate: dto.start_date ? new Date(dto.start_date) : null,
        endDate: dto.end_date ? new Date(dto.end_date) : null,
        ownedById: dto.owned_by ?? userId,
        timezone: dto.timezone ?? "UTC",
        sortOrder: (min._min.sortOrder ?? 65535) - 10000,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    this.webhooks.fire(ws.id, "cycle.created", { id: row.id, workspace: ws.id, project: pid, name: row.name });
    return this.serialize(row as CycleRow, userId);
  }

  async retrieve(slug: string, pid: string, cid: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    return this.serialize(await this.cycleOrThrow(pid, cid, true), userId);
  }

  async retrieveProgress(slug: string, pid: string, cid: string): Promise<Progress> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    return this.progressOf(await this.cycleOrThrow(pid, cid, true));
  }

  async update(
    slug: string,
    pid: string,
    cid: string,
    userId: string,
    dto: { name?: string; description?: string; start_date?: string | null; end_date?: string | null; owned_by?: string; timezone?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const cycle = await this.cycleOrThrow(pid, cid);
    if (this.closed(cycle)) throw new ForbiddenException({ detail: "Closed cycles cannot be edited." });
    const updated = await this.prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.start_date !== undefined ? { startDate: dto.start_date ? new Date(dto.start_date) : null } : {}),
        ...(dto.end_date !== undefined ? { endDate: dto.end_date ? new Date(dto.end_date) : null } : {}),
        ...(dto.owned_by !== undefined ? { ownedById: dto.owned_by } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        updatedBy: userId,
      },
    });
    this.webhooks.fire(ws.id, "cycle.updated", { id: cycle.id, workspace: ws.id, project: pid });
    return this.serialize(updated as CycleRow, userId);
  }

  async remove(slug: string, pid: string, cid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const cycle = await this.cycleOrThrow(pid, cid, true);
    await this.prisma.$transaction([
      this.prisma.cycleIssue.deleteMany({ where: { cycleId: cycle.id } }),
      this.prisma.cycle.update({ where: { id: cycle.id }, data: { deletedAt: new Date() } }),
    ]);
    this.webhooks.fire(ws.id, "cycle.deleted", { id: cycle.id, workspace: ws.id, project: pid });
    return { detail: "Cycle deleted." };
  }

  async setArchived(slug: string, pid: string, cid: string, archived: boolean): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const cycle = await this.cycleOrThrow(pid, cid, true);
    const updated = await this.prisma.cycle.update({
      where: { id: cycle.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    return this.serialize(updated as CycleRow);
  }

  // --- issues in cycle ---

  async cycleIssues(slug: string, pid: string, cid: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.cycleOrThrow(pid, cid, true);
    const links = await this.prisma.cycleIssue.findMany({ where: { cycleId: cid } });
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

  async addIssues(slug: string, pid: string, cid: string, issueIds: string[]): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const cycle = await this.cycleOrThrow(pid, cid);
    if (this.closed(cycle)) throw new ForbiddenException({ detail: "Closed cycles cannot be edited." });
    const valid = await this.prisma.issue.findMany({
      where: { id: { in: issueIds }, projectId: pid, deletedAt: null },
      select: { id: true },
    });
    await this.prisma.cycleIssue.createMany({
      data: valid.map((v) => ({ cycleId: cycle.id, issueId: v.id })),
      skipDuplicates: true,
    });
    return { detail: `${valid.length} issues added to cycle.` };
  }

  async removeIssue(slug: string, pid: string, cid: string, bridgeId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.cycleIssue.findFirst({ where: { id: bridgeId, cycleId: cid } });
    if (!row) throw new NotFoundException({ detail: "Cycle issue not found." });
    await this.prisma.cycleIssue.delete({ where: { id: row.id } });
    return { detail: "Issue removed from cycle." };
  }

  async transfer(slug: string, pid: string, cid: string, newCycleId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const cycle = await this.cycleOrThrow(pid, cid, true);
    const target = await this.cycleOrThrow(pid, newCycleId);
    if (this.closed(target)) throw new ForbiddenException({ detail: "Cannot transfer into a closed cycle." });
    const links = await this.prisma.cycleIssue.findMany({ where: { cycleId: cycle.id } });
    const issues = await this.prisma.issue.findMany({
      where: { id: { in: links.map((l) => l.issueId) }, deletedAt: null },
    });
    const stateIds = [...new Set(issues.map((i) => i.stateId).filter((v): v is string => !!v))];
    const states = await this.prisma.state.findMany({ where: { id: { in: stateIds } } });
    const completed = new Set(states.filter((s) => s.group === "completed" || s.group === "cancelled").map((s) => s.id));
    const incomplete = issues.filter((i) => !i.stateId || !completed.has(i.stateId));
    // Freeze snapshot of the old cycle, move incomplete issues
    const snapshot = await this.liveProgress(cycle.id);
    await this.prisma.$transaction([
      this.prisma.cycle.update({ where: { id: cycle.id }, data: { progressSnapshot: snapshot as object } }),
      this.prisma.cycleIssue.deleteMany({ where: { cycleId: cycle.id, issueId: { in: incomplete.map((i) => i.id) } } }),
      this.prisma.cycleIssue.createMany({
        data: incomplete.map((i) => ({ cycleId: target.id, issueId: i.id })),
        skipDuplicates: true,
      }),
    ]);
    return { detail: `${incomplete.length} issues transferred.` };
  }

  async dateCheck(
    slug: string,
    pid: string,
    dto: { start_date?: string; end_date?: string; cycle_id?: string },
  ): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    if (!dto.start_date || !dto.end_date) return [];
    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    const rows = await this.prisma.cycle.findMany({
      where: {
        projectId: pid,
        deletedAt: null,
        archivedAt: null,
        ...(dto.cycle_id ? { id: { not: dto.cycle_id } } : {}),
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, start_date: r.startDate, end_date: r.endDate }));
  }

  // --- favorites ---

  async favorite(slug: string, userId: string, cycleId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const cycle = await this.prisma.cycle.findFirst({ where: { id: cycleId, workspaceId: ws.id, deletedAt: null } });
    if (!cycle) throw new NotFoundException({ detail: "Cycle not found." });
    const row = await this.prisma.userFavorite.upsert({
      where: { entityType_entityIdentifier_userId: { entityType: "cycle", entityIdentifier: cycle.id, userId } },
      create: { workspaceId: ws.id, userId, entityType: "cycle", entityIdentifier: cycle.id, name: cycle.name },
      update: { name: cycle.name },
    });
    return { id: row.id, entity_type: row.entityType, entity_identifier: row.entityIdentifier };
  }

  async unfavorite(slug: string, userId: string, cycleId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.prisma.userFavorite.deleteMany({
      where: { workspaceId: ws.id, userId, entityType: "cycle", entityIdentifier: cycleId },
    });
    return { detail: "Removed from favorites." };
  }

  // --- workspace scope ---

  async workspaceCycles(slug: string, userId: string, activeOnly: boolean): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const memberships = await this.prisma.projectMember.findMany({
      where: { workspaceId: ws.id, memberId: userId, isActive: true, deletedAt: null },
    });
    const pids = memberships.map((m) => m.projectId);
    const now = new Date();
    const rows = await this.prisma.cycle.findMany({
      where: {
        workspaceId: ws.id,
        projectId: { in: pids.length ? pids : ["00000000-0000-0000-0000-000000000000"] },
        deletedAt: null,
        archivedAt: null,
        ...(activeOnly ? { startDate: { lte: now }, endDate: { gte: now } } : {}),
      },
      orderBy: { startDate: "asc" },
      take: 50,
    });
    const results = await Promise.all(rows.map((r) => this.serialize(r as CycleRow, userId)));
    return { results, count: results.length, next_cursor: "" };
  }
}
