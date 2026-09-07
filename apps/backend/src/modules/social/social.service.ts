import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IssuesService } from "../issues/issues.service";

function serializeNotification(n: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  receiverId: string;
  triggeredById: string | null;
  entityName: string;
  entityIdentifier: string | null;
  title: string;
  data: unknown;
  readAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    id: n.id,
    workspace: n.workspaceId,
    project: n.projectId,
    receiver: n.receiverId,
    triggered_by: n.triggeredById,
    entity_name: n.entityName,
    entity_identifier: n.entityIdentifier,
    title: n.title,
    data: n.data,
    read_at: n.readAt,
    archived_at: n.archivedAt,
    created_at: n.createdAt,
  };
}

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
  ) {}

  async workspaceOrThrow(slug: string): Promise<{ id: string }> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    return ws;
  }

  async memberOrThrow(workspaceId: string, userId: string): Promise<void> {
    const m = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, memberId: userId, isActive: true, deletedAt: null },
    });
    if (!m) throw new ForbiddenException({ detail: "Not a workspace member." });
  }

  // --- notifications ---

  async notify(input: {
    workspaceId: string;
    projectId?: string;
    receiverId: string;
    triggeredById?: string;
    entityName: string;
    entityIdentifier?: string;
    title: string;
    data?: unknown;
  }): Promise<void> {
    if (input.receiverId === input.triggeredById) return; // no self-notify
    await this.prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        receiverId: input.receiverId,
        title: input.title,
        data: (input.data as object) ?? {},
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.triggeredById !== undefined ? { triggeredById: input.triggeredById } : {}),
        ...(input.entityIdentifier !== undefined ? { entityIdentifier: input.entityIdentifier } : {}),
        entityName: input.entityName,
      },
    });
  }

  async notifications(slug: string, userId: string, unreadOnly = false): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.memberOrThrow(ws.id, userId);
    const rows = await this.prisma.notification.findMany({
      where: {
        workspaceId: ws.id,
        receiverId: userId,
        archivedAt: null,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map(serializeNotification);
  }

  async unreadCount(slug: string, userId: string): Promise<{ count: number }> {
    const ws = await this.workspaceOrThrow(slug);
    const count = await this.prisma.notification.count({
      where: { workspaceId: ws.id, receiverId: userId, readAt: null, archivedAt: null },
    });
    return { count };
  }

  async markRead(slug: string, userId: string, nid: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.notification.findFirst({ where: { id: nid, workspaceId: ws.id, receiverId: userId } });
    if (!row) throw new NotFoundException({ detail: "Notification not found." });
    const updated = await this.prisma.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
    return serializeNotification(updated);
  }

  async archive(slug: string, userId: string, nid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.notification.findFirst({ where: { id: nid, workspaceId: ws.id, receiverId: userId } });
    if (!row) throw new NotFoundException({ detail: "Notification not found." });
    await this.prisma.notification.update({ where: { id: row.id }, data: { archivedAt: new Date() } });
    return { detail: "Archived." };
  }

  async markAllRead(slug: string, userId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.prisma.notification.updateMany({
      where: { workspaceId: ws.id, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { detail: "All marked as read." };
  }

  // --- stickies ---

  async stickies(slug: string, userId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.memberOrThrow(ws.id, userId);
    const rows = await this.prisma.sticky.findMany({
      where: { workspaceId: ws.id, ownerId: userId },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      sort_order: r.sortOrder,
    }));
  }

  async createSticky(
    slug: string,
    userId: string,
    dto: { name?: string; description?: unknown; color?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.memberOrThrow(ws.id, userId);
    const max = await this.prisma.sticky.aggregate({ _max: { sortOrder: true }, where: { workspaceId: ws.id, ownerId: userId } });
    const row = await this.prisma.sticky.create({
      data: {
        workspaceId: ws.id,
        ownerId: userId,
        description: (dto.description as object) ?? {},
        sortOrder: (max._max.sortOrder ?? 55535) + 10000,
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
    return { id: row.id, name: row.name, description: row.description, color: row.color, sort_order: row.sortOrder };
  }

  async updateSticky(
    slug: string,
    userId: string,
    sid: string,
    dto: { name?: string; description?: unknown; color?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.sticky.findFirst({ where: { id: sid, workspaceId: ws.id, ownerId: userId } });
    if (!row) throw new NotFoundException({ detail: "Sticky not found." });
    const updated = await this.prisma.sticky.update({
      where: { id: row.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description as object } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
    return { id: updated.id, name: updated.name, description: updated.description, color: updated.color };
  }

  async deleteSticky(slug: string, userId: string, sid: string): Promise<void> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.sticky.findFirst({ where: { id: sid, workspaceId: ws.id, ownerId: userId } });
    if (!row) throw new NotFoundException({ detail: "Sticky not found." });
    await this.prisma.sticky.delete({ where: { id: row.id } });
  }

  // --- drafts ---

  private serializeDraft(
    d: { id: string; name: string | null; descriptionJson: unknown; priority: string; projectId: string | null; stateId: string | null; sortOrder: number },
    assignees: string[],
    labels: string[],
  ): Record<string, unknown> {
    return {
      id: d.id,
      name: d.name,
      description_json: d.descriptionJson,
      priority: d.priority,
      project_id: d.projectId,
      state_id: d.stateId,
      assignee_ids: assignees,
      label_ids: labels,
      sort_order: d.sortOrder,
    };
  }

  async drafts(slug: string, userId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.memberOrThrow(ws.id, userId);
    const rows = await this.prisma.draftIssue.findMany({
      where: { workspaceId: ws.id, createdBy: userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    return Promise.all(
      rows.map(async (r) => {
        const [a, l] = await Promise.all([
          this.prisma.draftIssueAssignee.findMany({ where: { draftIssueId: r.id } }),
          this.prisma.draftIssueLabel.findMany({ where: { draftIssueId: r.id } }),
        ]);
        return this.serializeDraft(r, a.map((x) => x.assigneeId), l.map((x) => x.labelId));
      }),
    );
  }

  async createDraft(
    slug: string,
    userId: string,
    dto: { name?: string; description_json?: unknown; priority?: string; project_id?: string; state_id?: string; assignee_ids?: string[]; label_ids?: string[] },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.memberOrThrow(ws.id, userId);
    const row = await this.prisma.draftIssue.create({
      data: {
        workspaceId: ws.id,
        projectId: dto.project_id ?? null,
        stateId: dto.state_id ?? null,
        descriptionJson: (dto.description_json as object) ?? {},
        priority: (dto.priority as "urgent" | "high" | "medium" | "low" | "none") ?? "none",
        createdBy: userId,
        updatedBy: userId,
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
    });
    if (dto.assignee_ids?.length) {
      await this.prisma.draftIssueAssignee.createMany({
        data: dto.assignee_ids.map((assigneeId) => ({ draftIssueId: row.id, assigneeId })),
        skipDuplicates: true,
      });
    }
    if (dto.label_ids?.length) {
      await this.prisma.draftIssueLabel.createMany({
        data: dto.label_ids.map((labelId) => ({ draftIssueId: row.id, labelId })),
        skipDuplicates: true,
      });
    }
    return this.serializeDraft(row, dto.assignee_ids ?? [], dto.label_ids ?? []);
  }

  async updateDraft(
    slug: string,
    userId: string,
    did: string,
    dto: { name?: string; description_json?: unknown; priority?: string; project_id?: string; state_id?: string | null; assignee_ids?: string[]; label_ids?: string[] },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.draftIssue.findFirst({ where: { id: did, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Draft not found." });
    if (row.createdBy && row.createdBy !== userId) throw new ForbiddenException({ detail: "Cannot edit this draft." });
    const updated = await this.prisma.draftIssue.update({
      where: { id: row.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description_json !== undefined ? { descriptionJson: dto.description_json as object } : {}),
        ...(dto.priority !== undefined
          ? { priority: dto.priority as "urgent" | "high" | "medium" | "low" | "none" }
          : {}),
        ...(dto.project_id !== undefined ? { projectId: dto.project_id } : {}),
        ...(dto.state_id !== undefined ? { stateId: dto.state_id } : {}),
        updatedBy: userId,
      },
    });
    if (dto.assignee_ids !== undefined) {
      await this.prisma.draftIssueAssignee.deleteMany({ where: { draftIssueId: row.id } });
      if (dto.assignee_ids.length) {
        await this.prisma.draftIssueAssignee.createMany({
          data: dto.assignee_ids.map((assigneeId) => ({ draftIssueId: row.id, assigneeId })),
          skipDuplicates: true,
        });
      }
    }
    if (dto.label_ids !== undefined) {
      await this.prisma.draftIssueLabel.deleteMany({ where: { draftIssueId: row.id } });
      if (dto.label_ids.length) {
        await this.prisma.draftIssueLabel.createMany({
          data: dto.label_ids.map((labelId) => ({ draftIssueId: row.id, labelId })),
          skipDuplicates: true,
        });
      }
    }
    const [a, l] = await Promise.all([
      this.prisma.draftIssueAssignee.findMany({ where: { draftIssueId: row.id } }),
      this.prisma.draftIssueLabel.findMany({ where: { draftIssueId: row.id } }),
    ]);
    return this.serializeDraft(updated, a.map((x) => x.assigneeId), l.map((x) => x.labelId));
  }

  async deleteDraft(slug: string, userId: string, did: string): Promise<void> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.draftIssue.findFirst({ where: { id: did, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Draft not found." });
    if (row.createdBy && row.createdBy !== userId) throw new ForbiddenException({ detail: "Cannot delete this draft." });
    await this.prisma.$transaction([
      this.prisma.draftIssueAssignee.deleteMany({ where: { draftIssueId: row.id } }),
      this.prisma.draftIssueLabel.deleteMany({ where: { draftIssueId: row.id } }),
      this.prisma.draftIssue.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ]);
  }

  /** Promote a draft into a real issue in the given project. */
  async draftToIssue(slug: string, userId: string, did: string, projectId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.draftIssue.findFirst({ where: { id: did, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Draft not found." });
    if (row.createdBy && row.createdBy !== userId) throw new ForbiddenException({ detail: "Cannot move this draft." });
    const project = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId: ws.id, deletedAt: null } });
    if (!project) throw new NotFoundException({ detail: "Project not found." });
    const [a, l] = await Promise.all([
      this.prisma.draftIssueAssignee.findMany({ where: { draftIssueId: row.id } }),
      this.prisma.draftIssueLabel.findMany({ where: { draftIssueId: row.id } }),
    ]);
    const created = await this.issues.create(slug, project.id, userId, {
      name: row.name ?? "Untitled",
      description_json: (row.descriptionJson as Record<string, unknown>) ?? {},
      priority: row.priority,
      state_id: row.stateId,
      assignee_ids: a.map((x) => x.assigneeId),
      label_ids: l.map((x) => x.labelId),
    });
    await this.prisma.$transaction([
      this.prisma.draftIssueAssignee.deleteMany({ where: { draftIssueId: row.id } }),
      this.prisma.draftIssueLabel.deleteMany({ where: { draftIssueId: row.id } }),
      this.prisma.draftIssue.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ]);
    return created;
  }

  // --- recent visits ---

  async recentVisits(slug: string, userId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const rows = await this.prisma.recentVisit.findMany({
      where: { workspaceId: ws.id, userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      entity_type: r.entityType,
      entity_identifier: r.entityIdentifier,
      entity_name: r.entityName,
    }));
  }

  async trackVisit(
    slug: string,
    userId: string,
    dto: { entity_type: string; entity_identifier?: string; entity_name?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const ident = dto.entity_identifier && /^[0-9a-f-]{36}$/i.test(dto.entity_identifier) ? dto.entity_identifier : null;
    let row: { id: string };
    if (ident) {
      row = await this.prisma.recentVisit.upsert({
        where: {
          workspaceId_userId_entityType_entityIdentifier: {
            workspaceId: ws.id,
            userId,
            entityType: dto.entity_type,
            entityIdentifier: ident,
          },
        },
        create: {
          workspaceId: ws.id,
          userId,
          entityType: dto.entity_type,
          entityIdentifier: ident,
          entityName: dto.entity_name ?? null,
        },
        update: {
          ...(dto.entity_name !== undefined ? { entityName: dto.entity_name } : {}),
          updatedAt: new Date(),
        },
      });
    } else {
      row = await this.prisma.recentVisit.create({
        data: {
          workspaceId: ws.id,
          userId,
          entityType: dto.entity_type,
          entityIdentifier: null,
          entityName: dto.entity_name ?? null,
        },
      });
    }
    // Retention: keep latest 50 per user+workspace
    const olds = await this.prisma.recentVisit.findMany({
      where: { workspaceId: ws.id, userId },
      orderBy: { updatedAt: "desc" },
      skip: 50,
      select: { id: true },
    });
    if (olds.length) await this.prisma.recentVisit.deleteMany({ where: { id: { in: olds.map((o) => o.id) } } });
    return { id: row.id };
  }
}
