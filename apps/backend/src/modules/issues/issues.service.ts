import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { ProjectsService } from "../projects/projects.service";

export interface IssueCounts {
  labels: Map<string, string[]>;
  assignees: Map<string, string[]>;
  children: Map<string, number>;
  attachments: Map<string, number>;
  links: Map<string, number>;
  cycles: Map<string, string>;
  modules: Map<string, string[]>;
}

const emptyCounts = (): IssueCounts => ({
  labels: new Map(),
  assignees: new Map(),
  children: new Map(),
  attachments: new Map(),
  links: new Map(),
  cycles: new Map(),
  modules: new Map(),
});

type IssueRow = {
  id: string;
  projectId: string;
  workspaceId: string;
  parentId: string | null;
  stateId: string | null;
  typeId: string | null;
  estimatePointId: string | null;
  name: string;
  descriptionHtml: string;
  priority: string;
  startDate: Date | null;
  targetDate: Date | null;
  sequenceId: number;
  sortOrder: number;
  completedAt: Date | null;
  archivedAt: Date | null;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
};

export function serializeBaseIssue(
  i: IssueRow,
  c: IssueCounts,
  stateGroups?: Map<string, string>,
): Record<string, unknown> {
  return {
    id: i.id,
    sequence_id: i.sequenceId,
    name: i.name,
    sort_order: i.sortOrder,
    state_id: i.stateId,
    state__group: i.stateId ? (stateGroups?.get(i.stateId) ?? null) : null,
    priority: i.priority,
    label_ids: c.labels.get(i.id) ?? [],
    assignee_ids: c.assignees.get(i.id) ?? [],
    estimate_point: i.estimatePointId,
    sub_issues_count: c.children.get(i.id) ?? 0,
    attachment_count: c.attachments.get(i.id) ?? 0,
    link_count: c.links.get(i.id) ?? 0,
    project_id: i.projectId,
    parent_id: i.parentId,
    cycle_id: c.cycles.get(i.id) ?? null,
    module_ids: c.modules.get(i.id) ?? [],
    type_id: i.typeId,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
    start_date: i.startDate,
    target_date: i.targetDate,
    completed_at: i.completedAt,
    archived_at: i.archivedAt,
    created_by: i.createdBy,
    updated_by: i.updatedBy,
    is_draft: i.isDraft,
  };
}

/** Default list scope: visible issues (docs/03 §3.2). */
export function visibleWhere(projectId: string): Record<string, unknown> {
  return {
    projectId,
    deletedAt: null,
    archivedAt: null,
    isDraft: false,
    OR: [{ stateId: null }, { state: { is: { isTriage: false } } }],
  };
}

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async countsFor(issueIds: string[]): Promise<IssueCounts> {
    const c = emptyCounts();
    if (issueIds.length === 0) return c;
    const [labels, assignees, children, attachments, links, cycleLinks, moduleLinks] = await Promise.all([
      this.prisma.issueLabel.findMany({ where: { issueId: { in: issueIds } } }),
      this.prisma.issueAssignee.findMany({ where: { issueId: { in: issueIds } } }),
      this.prisma.issue.groupBy({ by: ["parentId"], where: { parentId: { in: issueIds }, deletedAt: null }, _count: true }),
      this.prisma.issueAttachment.groupBy({ by: ["issueId"], where: { issueId: { in: issueIds } }, _count: true }),
      this.prisma.issueLink.groupBy({ by: ["issueId"], where: { issueId: { in: issueIds } }, _count: true }),
      this.prisma.cycleIssue.findMany({ where: { issueId: { in: issueIds } } }),
      this.prisma.moduleIssue.findMany({ where: { issueId: { in: issueIds } } }),
    ]);
    for (const r of labels) {
      const arr = c.labels.get(r.issueId) ?? [];
      arr.push(r.labelId);
      c.labels.set(r.issueId, arr);
    }
    for (const r of assignees) {
      const arr = c.assignees.get(r.issueId) ?? [];
      arr.push(r.assigneeId);
      c.assignees.set(r.issueId, arr);
    }
    for (const r of children) if (r.parentId) c.children.set(r.parentId, r._count);
    for (const r of attachments) c.attachments.set(r.issueId, r._count);
    for (const r of links) c.links.set(r.issueId, r._count);
    for (const r of cycleLinks) c.cycles.set(r.issueId, r.cycleId);
    for (const r of moduleLinks) {
      const arr = c.modules.get(r.issueId) ?? [];
      arr.push(r.moduleId);
      c.modules.set(r.issueId, arr);
    }
    return c;
  }

  async logActivity(
    issueId: string,
    actorId: string | null,
    verb: string,
    field?: string,
    oldValue?: string,
    newValue?: string,
  ): Promise<void> {
    await this.prisma.issueActivity.create({
      data: {
        issueId,
        actorId,
        verb,
        ...(field !== undefined ? { field } : {}),
        ...(oldValue !== undefined ? { oldValue } : {}),
        ...(newValue !== undefined ? { newValue } : {}),
      },
    });
  }

  /** Resolve the fallback state for new issues (default non-triage, else first non-triage). */
  async defaultStateId(projectId: string): Promise<string | null> {
    const def = await this.prisma.state.findFirst({
      where: { projectId, isDefault: true, isTriage: false, deletedAt: null },
    });
    if (def) return def.id;
    const first = await this.prisma.state.findFirst({
      where: { projectId, isTriage: false, deletedAt: null },
      orderBy: { sequence: "asc" },
    });
    return first?.id ?? null;
  }

  /** Create with per-project serialized sequence (docs/03 §3.1). Never reuses numbers. */
  async create(
    workspaceSlug: string,
    projectId: string,
    userId: string,
    dto: {
      name: string;
      description_json?: unknown;
      description_html?: string;
      priority?: string;
      state_id?: string | null;
      type_id?: string | null;
      estimate_point?: string | null;
      parent_id?: string | null;
      assignee_ids?: string[];
      label_ids?: string[];
      start_date?: string | null;
      target_date?: string | null;
      sort_order?: number;
      point?: number | null;
    },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    const project = await this.projects.projectOrThrow(ws.id, projectId);
    const name = (dto.name ?? "").trim();
    if (!name) throw new ForbiddenException({ detail: "Name is required." });

    if (dto.parent_id) {
      const parent = await this.prisma.issue.findFirst({
        where: { id: dto.parent_id, projectId: project.id, deletedAt: null },
      });
      if (!parent) throw new NotFoundException({ detail: "Parent issue not found." });
    }
    let stateId = dto.state_id ?? null;
    if (stateId) {
      const st = await this.prisma.state.findFirst({ where: { id: stateId, projectId: project.id, deletedAt: null } });
      if (!st) throw new NotFoundException({ detail: "State not found." });
    } else {
      stateId = await this.defaultStateId(project.id);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // Serialize sequence assignment per project (pg advisory xact lock)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${project.id}))`;
      const maxSeq = await tx.issue.aggregate({ _max: { sequenceId: true }, where: { projectId: project.id } });
      const sequenceId = (maxSeq._max.sequenceId ?? 0) + 1;
      let sortOrder = dto.sort_order;
      if (sortOrder === undefined) {
        const maxSort = await tx.issue.aggregate({
          _max: { sortOrder: true },
          where: { projectId: project.id, stateId },
        });
        sortOrder = (maxSort._max.sortOrder ?? 55535) + 10000;
      }
      const state = stateId ? await tx.state.findUnique({ where: { id: stateId } }) : null;
      const issue = await tx.issue.create({
        data: {
          projectId: project.id,
          workspaceId: ws.id,
          parentId: dto.parent_id ?? null,
          stateId,
          typeId: dto.type_id ?? null,
          estimatePointId: dto.estimate_point ?? null,
          name,
          descriptionJson: (dto.description_json as object) ?? {},
          descriptionHtml: dto.description_html ?? "<p></p>",
          priority: (dto.priority as "urgent" | "high" | "medium" | "low" | "none") ?? "none",
          startDate: dto.start_date ? new Date(dto.start_date) : null,
          targetDate: dto.target_date ? new Date(dto.target_date) : null,
          sequenceId,
          sortOrder,
          completedAt: state?.group === "completed" ? new Date() : null,
          point: dto.point ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      // Gap guard: sequence row survives issue deletion so numbers are never reused
      await tx.issueSequence.create({
        data: { projectId: project.id, workspaceId: ws.id, issueId: issue.id, sequence: BigInt(sequenceId) },
      });
      if (dto.assignee_ids?.length) {
        await tx.issueAssignee.createMany({
          data: dto.assignee_ids.map((assigneeId) => ({ issueId: issue.id, assigneeId })),
          skipDuplicates: true,
        });
      }
      if (dto.label_ids?.length) {
        // Validate labels belong to workspace/project
        const labels = await tx.label.findMany({
          where: { id: { in: dto.label_ids }, workspaceId: ws.id, deletedAt: null },
        });
        await tx.issueLabel.createMany({
          data: labels.map((l) => ({ issueId: issue.id, labelId: l.id })),
          skipDuplicates: true,
        });
      }
      return issue;
    });

    await this.logActivity(created.id, userId, "created");
    this.webhooks.fire(ws.id, "issue.created", {
      id: created.id,
      workspace: ws.id,
      project: project.id,
      sequence_id: created.sequenceId,
      name: created.name,
    });
    const counts = await this.countsFor([created.id]);
    return serializeBaseIssue(created as IssueRow, counts);
  }

  /** Update with completedAt sync + version snapshot + activity rows (docs/03 §3.2). */
  async update(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    userId: string,
    dto: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const patch: Record<string, unknown> = {};
    const activities: Array<{ field: string; oldV: string; newV: string }> = [];

    const track = (field: string, oldV: unknown, newV: unknown): void => {
      const o = oldV === null || oldV === undefined ? "" : String(oldV);
      const n = newV === null || newV === undefined ? "" : String(newV);
      if (o !== n) activities.push({ field, oldV: o, newV: n });
    };

    if (dto.name !== undefined) {
      const name = String(dto.name).trim();
      if (!name) throw new ForbiddenException({ detail: "Name is required." });
      track("name", issue.name, name);
      patch.name = name;
    }
    if (dto.description_json !== undefined) patch.descriptionJson = dto.description_json as object;
    if (dto.description_html !== undefined) patch.descriptionHtml = String(dto.description_html);
    if (dto.priority !== undefined) {
      track("priority", issue.priority, dto.priority);
      patch.priority = dto.priority;
    }
    if (dto.start_date !== undefined) patch.startDate = dto.start_date ? new Date(String(dto.start_date)) : null;
    if (dto.target_date !== undefined) patch.targetDate = dto.target_date ? new Date(String(dto.target_date)) : null;
    if (dto.sort_order !== undefined) patch.sortOrder = Number(dto.sort_order);
    if (dto.point !== undefined) patch.point = dto.point === null ? null : Number(dto.point);
    if (dto.parent_id !== undefined) {
      if (dto.parent_id === issueId) throw new ForbiddenException({ detail: "Issue cannot be its own parent." });
      patch.parentId = dto.parent_id ? String(dto.parent_id) : null;
    }
    if (dto.type_id !== undefined) patch.typeId = dto.type_id ? String(dto.type_id) : null;
    if (dto.estimate_point !== undefined)
      patch.estimatePointId = dto.estimate_point ? String(dto.estimate_point) : null;

    if (dto.state_id !== undefined) {
      const newStateId = dto.state_id ? String(dto.state_id) : null;
      if (newStateId !== issue.stateId) {
        let group: string | null = null;
        if (newStateId) {
          const st = await this.prisma.state.findFirst({
            where: { id: newStateId, projectId: issue.projectId, deletedAt: null },
          });
          if (!st) throw new NotFoundException({ detail: "State not found." });
          group = st.group;
        }
        track("state_id", issue.stateId, newStateId);
        patch.stateId = newStateId;
        patch.completedAt = group === "completed" ? new Date() : null;
      }
    }

    // Version snapshot before mutating
    await this.prisma.issueVersion.create({
      data: {
        projectId: issue.projectId,
        workspaceId: issue.workspaceId,
        issueId: issue.id,
        name: issue.name,
        priority: issue.priority as "urgent" | "high" | "medium" | "low" | "none",
        sequenceId: issue.sequenceId,
        sortOrder: issue.sortOrder,
        completedAt: issue.completedAt,
      },
    });

    const updated = await this.prisma.issue.update({
      where: { id: issue.id },
      data: { ...patch, updatedBy: userId } as never,
    });
    await Promise.all(
      activities.map((a) => this.logActivity(issue.id, userId, "updated", a.field, a.oldV, a.newV)),
    );
    if (activities.length === 0) await this.logActivity(issue.id, userId, "updated");
    this.webhooks.fire(issue.workspaceId, "issue.updated", {
      id: issue.id,
      workspace: issue.workspaceId,
      project: issue.projectId,
      fields: activities.map((a) => a.field),
    });

    if (dto.assignee_ids !== undefined) {
      await this.prisma.issueAssignee.deleteMany({ where: { issueId: issue.id } });
      const ids = (dto.assignee_ids as string[]) ?? [];
      if (ids.length) {
        await this.prisma.issueAssignee.createMany({
          data: ids.map((assigneeId) => ({ issueId: issue.id, assigneeId })),
          skipDuplicates: true,
        });
      }
    }
    if (dto.label_ids !== undefined) {
      await this.prisma.issueLabel.deleteMany({ where: { issueId: issue.id } });
      const ids = (dto.label_ids as string[]) ?? [];
      if (ids.length) {
        const labels = await this.prisma.label.findMany({
          where: { id: { in: ids }, workspaceId: issue.workspaceId, deletedAt: null },
        });
        await this.prisma.issueLabel.createMany({
          data: labels.map((l) => ({ issueId: issue.id, labelId: l.id })),
          skipDuplicates: true,
        });
      }
    }

    const counts = await this.countsFor([issue.id]);
    return serializeBaseIssue(updated as IssueRow, counts);
  }

  async getVisible(workspaceSlug: string, projectId: string, issueId: string): Promise<IssueRow> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId, workspaceId: ws.id, deletedAt: null },
    });
    if (!issue) throw new NotFoundException({ detail: "Issue not found." });
    return issue as IssueRow;
  }

  async retrieve(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const counts = await this.countsFor([issue.id]);
    const base = serializeBaseIssue(issue, counts);
    const [reactions, attachments, links, outgoing, incoming, parent, sub] = await Promise.all([
      this.prisma.issueReaction.findMany({ where: { issueId: issue.id } }),
      this.prisma.issueAttachment.findMany({ where: { issueId: issue.id } }),
      this.prisma.issueLink.findMany({ where: { issueId: issue.id } }),
      this.prisma.issueRelation.findMany({ where: { issueId: issue.id } }),
      this.prisma.issueRelation.findMany({ where: { relatedIssueId: issue.id } }),
      issue.parentId
        ? this.prisma.issue.findFirst({ where: { id: issue.parentId, deletedAt: null } })
        : Promise.resolve(null),
      this.prisma.issueSubscriber.findFirst({ where: { issueId: issue.id, subscriberId: userId } }),
    ]);
    const relatedIds = [...outgoing.map((r) => r.relatedIssueId), ...incoming.map((r) => r.issueId)];
    const related = relatedIds.length
      ? await this.prisma.issue.findMany({ where: { id: { in: relatedIds }, deletedAt: null } })
      : [];
    const byId = new Map(related.map((r) => [r.id, r]));
    const mini = (id: string): Record<string, unknown> | null => {
      const r = byId.get(id);
      return r ? { id: r.id, name: r.name, project_id: r.projectId, sequence_id: r.sequenceId } : null;
    };
    const full = await this.prisma.issue.findUniqueOrThrow({ where: { id: issue.id } });
    return {
      ...base,
      description_html: full.descriptionHtml,
      description_json: full.descriptionJson,
      is_subscribed: !!sub,
      parent: parent ? serializeBaseIssue(parent as IssueRow, await this.countsFor([parent.id])) : null,
      issue_reactions: reactions.map((r) => ({ actor: r.actorId, reaction: r.reaction, issue: r.issueId })),
      issue_attachments: attachments.map((a) => ({ id: a.id, asset: a.asset, attributes: a.attributes })),
      issue_link: links.map((l) => ({ id: l.id, title: l.title, url: l.url, metadata: l.metadata })),
      issue_relation: outgoing.map((r) =>
        Object.assign({ id: r.id, relation_type: r.relationType }, mini(r.relatedIssueId) ?? {}),
      ),
      issue_related: incoming.map((r) =>
        Object.assign({ id: r.id, relation_type: r.relationType }, mini(r.issueId) ?? {}),
      ),
    };
  }

  async remove(workspaceSlug: string, projectId: string, issueId: string, userId: string): Promise<{ detail: string }> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    await this.prisma.issue.update({ where: { id: issue.id }, data: { deletedAt: new Date(), updatedBy: userId } });
    await this.prisma.issueSequence.updateMany({
      where: { issueId: issue.id },
      data: { deleted: true },
    });
    await this.logActivity(issue.id, userId, "deleted");
    this.webhooks.fire(issue.workspaceId, "issue.deleted", { id: issue.id, workspace: issue.workspaceId, project: issue.projectId });
    return { detail: "Issue deleted." };
  }

  async setArchived(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    userId: string,
    archived: boolean,
  ): Promise<Record<string, unknown>> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const updated = await this.prisma.issue.update({
      where: { id: issue.id },
      data: { archivedAt: archived ? new Date() : null, updatedBy: userId },
    });
    await this.logActivity(issue.id, userId, archived ? "archived" : "unarchived");
    this.webhooks.fire(issue.workspaceId, archived ? "issue.archived" : "issue.unarchived", {
      id: issue.id,
      workspace: issue.workspaceId,
      project: issue.projectId,
    });
    const counts = await this.countsFor([issue.id]);
    return serializeBaseIssue(updated as IssueRow, counts);
  }

  async history(workspaceSlug: string, projectId: string, issueId: string): Promise<Record<string, unknown>[]> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const rows = await this.prisma.issueActivity.findMany({
      where: { issueId: issue.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      issue: r.issueId,
      actor: r.actorId,
      verb: r.verb,
      field: r.field,
      old_value: r.oldValue,
      new_value: r.newValue,
      comment: r.comment,
      created_at: r.createdAt,
    }));
  }

  async meta(workspaceSlug: string, projectId: string, issueId: string): Promise<Record<string, unknown>> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: issue.projectId } });
    const counts = await this.countsFor([issue.id]);
    return {
      project_identifier: project.identifier,
      sequence_id: issue.sequenceId,
      sub_issues_count: counts.children.get(issue.id) ?? 0,
      attachment_count: counts.attachments.get(issue.id) ?? 0,
      link_count: counts.links.get(issue.id) ?? 0,
    };
  }

  async versions(workspaceSlug: string, projectId: string, issueId: string): Promise<Record<string, unknown>[]> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const rows = await this.prisma.issueVersion.findMany({
      where: { issueId: issue.id },
      orderBy: { lastSavedAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      sequence_id: r.sequenceId,
      sort_order: r.sortOrder,
      completed_at: r.completedAt,
      last_saved_at: r.lastSavedAt,
    }));
  }

  private async relationMini(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
    const out = new Map<string, Record<string, unknown>>();
    if (!ids.length) return out;
    const rows = await this.prisma.issue.findMany({ where: { id: { in: ids }, deletedAt: null } });
    for (const r of rows) out.set(r.id, { id: r.id, name: r.name, project_id: r.projectId, sequence_id: r.sequenceId });
    return out;
  }

  async listRelations(workspaceSlug: string, projectId: string, issueId: string): Promise<Record<string, unknown>[]> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const rows = await this.prisma.issueRelation.findMany({ where: { issueId: issue.id } });
    const mini = await this.relationMini(rows.map((r) => r.relatedIssueId));
    return rows.map((r) =>
      Object.assign({ id: r.id, relation_type: r.relationType }, mini.get(r.relatedIssueId) ?? {}),
    );
  }

  async createRelation(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    userId: string,
    relatedIssueId: string,
    relationType: string,
  ): Promise<Record<string, unknown>> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    if (relatedIssueId === issue.id) throw new ForbiddenException({ detail: "Issue cannot relate to itself." });
    const related = await this.prisma.issue.findFirst({
      where: { id: relatedIssueId, workspaceId: issue.workspaceId, deletedAt: null },
    });
    if (!related) throw new NotFoundException({ detail: "Related issue not found." });
    const valid = ["duplicate", "relates_to", "blocked_by", "start_before", "finish_before", "implemented_by"];
    const type = valid.includes(relationType) ? relationType : "blocked_by";
    const existing = await this.prisma.issueRelation.findFirst({
      where: { issueId: issue.id, relatedIssueId: related.id },
    });
    if (existing) throw new ForbiddenException({ detail: "Relation already exists." });
    const row = await this.prisma.issueRelation.create({
      data: {
        projectId: issue.projectId,
        workspaceId: issue.workspaceId,
        issueId: issue.id,
        relatedIssueId: related.id,
        relationType: type as "duplicate" | "relates_to" | "blocked_by" | "start_before" | "finish_before" | "implemented_by",
      },
    });
    await this.logActivity(issue.id, userId, "updated", "relation", "", related.id);
    const mini = await this.relationMini([related.id]);
    return Object.assign({ id: row.id, relation_type: row.relationType }, mini.get(related.id) ?? {});
  }

  async deleteRelation(workspaceSlug: string, projectId: string, issueId: string, relId: string): Promise<{ detail: string }> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const row = await this.prisma.issueRelation.findFirst({ where: { id: relId, issueId: issue.id } });
    if (!row) throw new NotFoundException({ detail: "Relation not found." });
    await this.prisma.issueRelation.delete({ where: { id: row.id } });
    return { detail: "Relation deleted." };
  }

  async removeRelationPair(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    relatedIssueId: string,
    relationType?: string,
  ): Promise<{ detail: string }> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const ors: Record<string, unknown>[] = [
      { issueId: issue.id, relatedIssueId },
      { issueId: relatedIssueId, relatedIssueId: issue.id },
    ];
    if (relationType) for (const o of ors) o.relationType = relationType;
    await this.prisma.issueRelation.deleteMany({ where: { OR: ors } as never });
    return { detail: "Relation removed." };
  }

  async subscriptionStatus(issueId: string, userId: string): Promise<{ subscribed: boolean }> {
    const row = await this.prisma.issueSubscriber.findFirst({ where: { issueId, subscriberId: userId } });
    return { subscribed: !!row };
  }

  async setSubscription(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    userId: string,
    subscribe: boolean,
  ): Promise<{ subscribed: boolean }> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    if (subscribe) {
      await this.prisma.issueSubscriber.upsert({
        where: { issueId_subscriberId: { issueId: issue.id, subscriberId: userId } },
        create: { issueId: issue.id, subscriberId: userId },
        update: {},
      });
    } else {
      await this.prisma.issueSubscriber.deleteMany({ where: { issueId: issue.id, subscriberId: userId } });
    }
    return { subscribed: subscribe };
  }

  async listSubIssues(workspaceSlug: string, projectId: string, issueId: string): Promise<Record<string, unknown>[]> {
    const issue = await this.getVisible(workspaceSlug, projectId, issueId);
    const rows = await this.prisma.issue.findMany({
      where: { parentId: issue.id, projectId: issue.projectId, deletedAt: null, archivedAt: null },
      orderBy: { sortOrder: "asc" },
    });
    const counts = await this.countsFor(rows.map((r) => r.id));
    return rows.map((r) => serializeBaseIssue(r as IssueRow, counts));
  }

  async archivedList(workspaceSlug: string, projectId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    const rows = await this.prisma.issue.findMany({
      where: { projectId, workspaceId: ws.id, deletedAt: null, archivedAt: { not: null } },
      orderBy: { updatedAt: "desc" },
    });
    const counts = await this.countsFor(rows.map((r) => r.id));
    return rows.map((r) => serializeBaseIssue(r as IssueRow, counts));
  }

  async deletedList(workspaceSlug: string, projectId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    const rows = await this.prisma.issue.findMany({
      where: { projectId, workspaceId: ws.id, deletedAt: { not: null } },
      orderBy: { updatedAt: "desc" },
    });
    const counts = await this.countsFor(rows.map((r) => r.id));
    return rows.map((r) => serializeBaseIssue(r as IssueRow, counts));
  }

  async byIdentifier(workspaceSlug: string, key: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    const m = key.match(/^([A-Za-z0-9]+)-(\d+)$/);
    if (!m) throw new NotFoundException({ detail: "Issue not found." });
    const project = await this.prisma.project.findFirst({
      where: { workspaceId: ws.id, identifier: m[1].toUpperCase(), deletedAt: null },
    });
    if (!project) throw new NotFoundException({ detail: "Issue not found." });
    // Membership check (workspace member, project member checked by guard where applicable)
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: ws.id, memberId: userId, isActive: true, deletedAt: null },
    });
    if (!membership) throw new NotFoundException({ detail: "Issue not found." });
    const issue = await this.prisma.issue.findFirst({
      where: { projectId: project.id, sequenceId: Number(m[2]), deletedAt: null },
    });
    if (!issue) throw new NotFoundException({ detail: "Issue not found." });
    return this.retrieve(workspaceSlug, project.id, issue.id, userId);
  }
}
