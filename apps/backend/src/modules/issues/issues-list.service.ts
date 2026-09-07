import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IssuesService, serializeBaseIssue, visibleWhere } from "./issues.service";

export type ListQuery = Record<string, string | string[] | undefined>;

function csv(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : String(v).split(",");
  return arr.map((s) => s.trim()).filter(Boolean);
}

function splitNull(values: string[]): { ids: string[]; wantNull: boolean } {
  const ids = values.filter((v) => v.toLowerCase() !== "null" && v.toLowerCase() !== "none");
  return { ids, wantNull: ids.length !== values.length };
}

const ORDER_MAP: Record<string, { field: string; dir: "asc" | "desc" }> = {
  created_at: { field: "createdAt", dir: "asc" },
  "-created_at": { field: "createdAt", dir: "desc" },
  updated_at: { field: "updatedAt", dir: "asc" },
  "-updated_at": { field: "updatedAt", dir: "desc" },
  sort_order: { field: "sortOrder", dir: "asc" },
  "-sort_order": { field: "sortOrder", dir: "desc" },
  target_date: { field: "targetDate", dir: "asc" },
  "-target_date": { field: "targetDate", dir: "desc" },
  sequence_id: { field: "sequenceId", dir: "asc" },
  "-sequence_id": { field: "sequenceId", dir: "desc" },
};

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url");
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString()) as { offset?: number };
    return typeof parsed.offset === "number" && parsed.offset >= 0 ? Math.floor(parsed.offset) : 0;
  } catch {
    return 0;
  }
}

function dateRangeFilter(after: unknown, before: unknown): Record<string, Date> | undefined {
  const range: Record<string, Date> = {};
  if (after) range.gte = new Date(String(after));
  if (before) range.lte = new Date(String(before));
  return Object.keys(range).length ? range : undefined;
}

@Injectable()
export class IssuesListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
  ) {}

  private async applyJoinFilters(
    projectId: string,
    baseIds: string[] | null,
    q: ListQuery,
  ): Promise<string[] | null> {
    // Assignee/label filters need join-table lookups; intersect with base set.
    const assignees = csv(q.assignees);
    const labels = csv(q.labels);
    if (!assignees.length && !labels.length) return baseIds;
    let ids: Set<string> | null = baseIds ? new Set(baseIds) : null;
    if (assignees.length) {
      const { ids: aids, wantNull } = splitNull(assignees);
      const matched = new Set<string>();
      if (aids.length) {
        const rows = await this.prisma.issueAssignee.findMany({ where: { assigneeId: { in: aids } } });
        const inProject = await this.prisma.issue.findMany({
          where: { id: { in: rows.map((r) => r.issueId) }, projectId, deletedAt: null },
          select: { id: true },
        });
        for (const r of inProject) matched.add(r.id);
      }
      if (wantNull) {
        const assigned = await this.prisma.issueAssignee.findMany({});
        const assignedIds = new Set(assigned.map((r) => r.issueId));
        const unassigned = await this.prisma.issue.findMany({
          where: { projectId, deletedAt: null },
          select: { id: true },
        });
        for (const r of unassigned) if (!assignedIds.has(r.id)) matched.add(r.id);
      }
      ids = ids === null ? matched : new Set([...ids].filter((x) => matched.has(x)));
    }
    if (labels.length) {
      const { ids: lids, wantNull } = splitNull(labels);
      const matched = new Set<string>();
      if (lids.length) {
        const rows = await this.prisma.issueLabel.findMany({ where: { labelId: { in: lids } } });
        const inProject = await this.prisma.issue.findMany({
          where: { id: { in: rows.map((r) => r.issueId) }, projectId, deletedAt: null },
          select: { id: true },
        });
        for (const r of inProject) matched.add(r.id);
      }
      if (wantNull) {
        const tagged = await this.prisma.issueLabel.findMany({});
        const taggedIds = new Set(tagged.map((r) => r.issueId));
        const untagged = await this.prisma.issue.findMany({
          where: { projectId, deletedAt: null },
          select: { id: true },
        });
        for (const r of untagged) if (!taggedIds.has(r.id)) matched.add(r.id);
      }
      ids = ids === null ? matched : new Set([...ids].filter((x) => matched.has(x)));
    }
    return ids === null ? null : [...ids];
  }

  async list(
    workspaceSlug: string,
    projectId: string,
    q: ListQuery,
    bodyFilters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new ForbiddenException({ detail: "Workspace not found." });
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId: ws.id, deletedAt: null },
    });
    if (!project) throw new ForbiddenException({ detail: "Project not found." });

    const merged: ListQuery = { ...q };
    if (bodyFilters) {
      for (const [k, v] of Object.entries(bodyFilters)) {
        if (Array.isArray(v)) merged[k] = v.map(String).join(",");
        else if (v !== undefined && v !== null) merged[k] = String(v);
      }
    }

    const where: Record<string, unknown> = { ...(visibleWhere(project.id) as object) };
    const state = csv(merged.state);
    if (state.length) {
      const { ids, wantNull } = splitNull(state);
      const ors: unknown[] = [];
      if (ids.length) ors.push({ stateId: { in: ids } });
      if (wantNull) ors.push({ stateId: null });
      where.AND = [...((where.AND as unknown[]) ?? []), { OR: ors }];
    }
    const priority = csv(merged.priority);
    if (priority.length) where.priority = { in: priority };
    const createdBy = csv(merged.created_by);
    if (createdBy.length) where.createdBy = { in: createdBy };
    const types = csv(merged.type);
    if (types.length) where.typeId = { in: types };
    const points = csv(merged.estimate_point);
    if (points.length) {
      const { ids, wantNull } = splitNull(points);
      const ors: unknown[] = [];
      if (ids.length) ors.push({ estimatePointId: { in: ids } });
      if (wantNull) ors.push({ estimatePointId: null });
      where.AND = [...((where.AND as unknown[]) ?? []), { OR: ors }];
    }
    const targetRange = dateRangeFilter(merged.target_date_after, merged.target_date_before);
    if (targetRange) where.targetDate = targetRange;
    const startRange = dateRangeFilter(merged.start_date_after, merged.start_date_before);
    if (startRange) where.startDate = startRange;
    const search = merged.search ?? merged.q;
    if (search) where.name = { contains: String(search), mode: "insensitive" };

    // Join-table filters (assignees/labels incl. null semantics)
    let idSet = await this.applyJoinFilters(project.id, null, merged);
    if (idSet !== null) where.id = { in: idSet.length ? idSet : ["00000000-0000-0000-0000-000000000000"] };

    const order = ORDER_MAP[String(merged.order_by ?? "sort_order")] ?? ORDER_MAP.sort_order;
    const perPage = Math.min(Math.max(Number(merged.per_page ?? 100) || 100, 1), 500);
    const offset = decodeCursor(typeof merged.cursor === "string" ? merged.cursor : undefined);

    const total = await this.prisma.issue.count({ where: where as never });
    const rows = await this.prisma.issue.findMany({
      where: where as never,
      orderBy: [{ [order.field]: order.dir }, { id: "asc" }],
      skip: offset,
      take: perPage + 1,
    });
    const page = rows.slice(0, perPage);
    const hasMore = rows.length > perPage;
    const counts = await this.issues.countsFor(page.map((r) => r.id));
    const serialized = page.map((r) => serializeBaseIssue(r as never, counts));

    const groupBy = typeof merged.group_by === "string" ? merged.group_by : "";
    let results: unknown = serialized;
    if (groupBy) {
      const groups = new Map<string, Record<string, unknown>[]>();
      const keyOf = (item: Record<string, unknown>): string => {
        if (groupBy === "state") return String(item.state_id ?? "None");
        if (groupBy === "priority") return String(item.priority ?? "None");
        if (groupBy === "labels") {
          const arr = item.label_ids as string[];
          return arr.length ? arr[0] : "None";
        }
        if (groupBy === "assignees") {
          const arr = item.assignee_ids as string[];
          return arr.length ? arr[0] : "None";
        }
        if (groupBy === "created_by") return String(item.created_by ?? "None");
        return "All";
      };
      for (const item of serialized) {
        const k = keyOf(item);
        const arr = groups.get(k) ?? [];
        arr.push(item);
        groups.set(k, arr);
      }
      const mapped: Record<string, { results: unknown[]; total_results: number }> = {};
      for (const [k, v] of groups) mapped[k] = { results: v, total_results: v.length };
      results = mapped;
    }

    return {
      grouped_by: groupBy || "",
      next_cursor: hasMore ? encodeCursor(offset + perPage) : "",
      prev_cursor: "",
      next_page_results: hasMore,
      prev_page_results: offset > 0,
      total_count: total,
      count: page.length,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
      extra_stats: null,
      results,
      total_results: total,
    };
  }

  async bulkOperate(
    projectId: string,
    userId: string,
    issueIds: string[],
    properties: Record<string, unknown>,
  ): Promise<{ detail: string; updated: number }> {
    const results = await Promise.all(
      issueIds.map((id) => this.applyBulkProperties(projectId, userId, id, properties)),
    );
    const updated = results.filter(Boolean).length;
    return { detail: `${updated} issues updated.`, updated };
  }

  private async applyBulkProperties(
    projectId: string,
    userId: string,
    id: string,
    properties: Record<string, unknown>,
  ): Promise<boolean> {
    const issue = await this.prisma.issue.findFirst({ where: { id, projectId, deletedAt: null } });
    if (!issue) return false;
    const patch: Record<string, unknown> = {};
    if (properties.state_id !== undefined) {
      const sid = properties.state_id ? String(properties.state_id) : null;
      if (sid) {
        const st = await this.prisma.state.findFirst({ where: { id: sid, projectId, deletedAt: null } });
        if (!st) return false;
        patch.completedAt = st.group === "completed" ? new Date() : null;
      } else {
        patch.completedAt = null;
      }
      patch.stateId = sid;
    }
    if (properties.priority !== undefined) patch.priority = properties.priority;
    if (properties.start_date !== undefined)
      patch.startDate = properties.start_date ? new Date(String(properties.start_date)) : null;
    if (properties.target_date !== undefined)
      patch.targetDate = properties.target_date ? new Date(String(properties.target_date)) : null;
    if (properties.sort_order !== undefined) patch.sortOrder = Number(properties.sort_order);
    await this.prisma.issue.update({ where: { id: issue.id }, data: { ...patch, updatedBy: userId } as never });
    if (properties.assignee_ids !== undefined) {
      await this.prisma.issueAssignee.deleteMany({ where: { issueId: issue.id } });
      const ids = (properties.assignee_ids as string[]) ?? [];
      if (ids.length)
        await this.prisma.issueAssignee.createMany({
          data: ids.map((assigneeId) => ({ issueId: issue.id, assigneeId })),
          skipDuplicates: true,
        });
    }
    if (properties.label_ids !== undefined) {
      await this.prisma.issueLabel.deleteMany({ where: { issueId: issue.id } });
      const ids = (properties.label_ids as string[]) ?? [];
      if (ids.length)
        await this.prisma.issueLabel.createMany({
          data: ids.map((labelId) => ({ issueId: issue.id, labelId })),
          skipDuplicates: true,
        });
    }
    await this.issues.logActivity(issue.id, userId, "updated", "bulk", "", "");
    return true;
  }

  async bulkDelete(projectId: string, userId: string, issueIds: string[]): Promise<{ detail: string }> {
    const results = await Promise.all(
      issueIds.map(async (id) => {
        const issue = await this.prisma.issue.findFirst({ where: { id, projectId, deletedAt: null } });
        if (!issue) return false;
        await this.prisma.issue.update({ where: { id: issue.id }, data: { deletedAt: new Date(), updatedBy: userId } });
        await this.issues.logActivity(issue.id, userId, "deleted");
        return true;
      }),
    );
    const n = results.filter(Boolean).length;
    return { detail: `${n} issues deleted.` };
  }

  async bulkArchive(projectId: string, userId: string, issueIds: string[], archive = true): Promise<{ detail: string }> {
    const results = await Promise.all(
      issueIds.map(async (id) => {
        const issue = await this.prisma.issue.findFirst({ where: { id, projectId, deletedAt: null } });
        if (!issue) return false;
        await this.prisma.issue.update({
          where: { id: issue.id },
          data: { archivedAt: archive ? new Date() : null, updatedBy: userId },
        });
        return true;
      }),
    );
    const n = results.filter(Boolean).length;
    return { detail: `${n} issues ${archive ? "archived" : "unarchived"}.` };
  }

  async bulkSubscribe(issueIds: string[], userId: string, subscribe = true): Promise<{ detail: string }> {
    await Promise.all(
      issueIds.map((issueId) => {
        if (subscribe) {
          return this.prisma.issueSubscriber.upsert({
            where: { issueId_subscriberId: { issueId, subscriberId: userId } },
            create: { issueId, subscriberId: userId },
            update: {},
          });
        }
        return this.prisma.issueSubscriber.deleteMany({ where: { issueId, subscriberId: userId } });
      }),
    );
    return { detail: "Subscriptions updated." };
  }
}
