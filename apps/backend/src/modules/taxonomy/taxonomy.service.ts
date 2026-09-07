import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

function serializeState(s: {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  group: string;
  sequence: number;
  isDefault: boolean;
  isTriage: boolean;
}): Record<string, unknown> {
  return {
    id: s.id,
    project: s.projectId,
    workspace: s.workspaceId,
    name: s.name,
    description: s.description,
    color: s.color,
    group: s.group,
    sequence: s.sequence,
    default: s.isDefault,
    is_triage: s.isTriage,
  };
}

function serializeLabel(l: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  parentId: string | null;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
}): Record<string, unknown> {
  return {
    id: l.id,
    workspace: l.workspaceId,
    project: l.projectId,
    parent: l.parentId,
    name: l.name,
    description: l.description,
    color: l.color,
    sort_order: l.sortOrder,
  };
}

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

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

  // --- states ---

  async listStates(slug: string, pid: string, includeTriage = false): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const rows = await this.prisma.state.findMany({
      where: { projectId: pid, deletedAt: null, ...(includeTriage ? {} : { isTriage: false }) },
      orderBy: { sequence: "asc" },
    });
    return rows.map(serializeState);
  }

  async createState(
    slug: string,
    pid: string,
    dto: { name: string; description?: string; color?: string; group?: string; sequence?: number },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const dup = await this.prisma.state.findFirst({ where: { projectId: pid, name: dto.name.trim(), deletedAt: null } });
    if (dup) throw new ForbiddenException({ detail: "State name already exists." });
    const max = await this.prisma.state.aggregate({ _max: { sequence: true }, where: { projectId: pid } });
    const row = await this.prisma.state.create({
      data: {
        projectId: pid,
        workspaceId: ws.id,
        name: dto.name.trim(),
        description: dto.description ?? "",
        color: dto.color ?? "#808080",
        group: (dto.group as "backlog" | "unstarted" | "started" | "completed" | "cancelled" | "triage") ?? "backlog",
        sequence: dto.sequence ?? (max._max.sequence ?? 55535) + 10000,
      },
    });
    return serializeState(row);
  }

  async updateState(
    slug: string,
    pid: string,
    sid: string,
    dto: { name?: string; description?: string; color?: string; group?: string; sequence?: number },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.state.findFirst({ where: { id: sid, projectId: pid, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "State not found." });
    if (dto.name && dto.name.trim() !== row.name) {
      const dup = await this.prisma.state.findFirst({
        where: { projectId: pid, name: dto.name.trim(), deletedAt: null, id: { not: row.id } },
      });
      if (dup) throw new ForbiddenException({ detail: "State name already exists." });
    }
    const updated = await this.prisma.state.update({
      where: { id: row.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.group !== undefined
          ? { group: dto.group as "backlog" | "unstarted" | "started" | "completed" | "cancelled" | "triage" }
          : {}),
        ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
      },
    });
    return serializeState(updated);
  }

  async deleteState(slug: string, pid: string, sid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.state.findFirst({ where: { id: sid, projectId: pid, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "State not found." });
    if (row.isDefault) throw new ForbiddenException({ detail: "Cannot delete the default state." });
    const used = await this.prisma.issue.count({ where: { stateId: row.id, deletedAt: null } });
    if (used > 0) throw new ForbiddenException({ detail: "State is used by issues. Move them first." });
    await this.prisma.state.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
    return { detail: "State deleted." };
  }

  async markDefault(slug: string, pid: string, sid: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const project = await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.state.findFirst({ where: { id: sid, projectId: pid, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "State not found." });
    if (row.isTriage) throw new ForbiddenException({ detail: "Triage state cannot be default." });
    await this.prisma.$transaction([
      this.prisma.state.updateMany({ where: { projectId: pid, isDefault: true }, data: { isDefault: false } }),
      this.prisma.state.update({ where: { id: row.id }, data: { isDefault: true } }),
      this.prisma.project.update({ where: { id: project.id }, data: { defaultStateId: row.id } }),
    ]);
    const updated = await this.prisma.state.findUniqueOrThrow({ where: { id: row.id } });
    return serializeState(updated);
  }

  async workspaceStates(slug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const projects = await this.prisma.project.findMany({ where: { workspaceId: ws.id, deletedAt: null } });
    const rows = await this.prisma.state.findMany({
      where: { projectId: { in: projects.map((p) => p.id) }, deletedAt: null, isTriage: false },
      orderBy: { sequence: "asc" },
    });
    return rows.map(serializeState);
  }

  async intakeStates(slug: string, pid: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const rows = await this.prisma.state.findMany({
      where: { projectId: pid, deletedAt: null, isTriage: true },
      orderBy: { sequence: "asc" },
    });
    return rows.map(serializeState);
  }

  // --- labels ---

  async listLabels(slug: string, pid?: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const rows = await this.prisma.label.findMany({
      where: {
        workspaceId: ws.id,
        deletedAt: null,
        ...(pid ? { OR: [{ projectId: pid }, { projectId: null }] } : {}),
      },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(serializeLabel);
  }

  async createLabel(
    slug: string,
    pid: string | undefined,
    dto: { name: string; description?: string; color?: string; parent?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    if (pid) await this.projectOrThrow(ws.id, pid);
    const name = dto.name.trim();
    if (!name) throw new ForbiddenException({ detail: "Name is required." });
    const row = await this.prisma.label.create({
      data: {
        workspaceId: ws.id,
        projectId: pid ?? null,
        parentId: dto.parent ?? null,
        name,
        description: dto.description ?? "",
        color: dto.color ?? "",
      },
    }).catch(() => {
      throw new ForbiddenException({ detail: "Label name already exists." });
    });
    return serializeLabel(row);
  }

  async updateLabel(
    slug: string,
    pid: string,
    lid: string,
    dto: { name?: string; description?: string; color?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.label.findFirst({ where: { id: lid, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Label not found." });
    const updated = await this.prisma.label
      .update({
        where: { id: row.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
      })
      .catch(() => {
        throw new ForbiddenException({ detail: "Label name already exists." });
      });
    return serializeLabel(updated);
  }

  async deleteLabel(slug: string, pid: string, lid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.label.findFirst({ where: { id: lid, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Label not found." });
    await this.prisma.$transaction([
      this.prisma.issueLabel.deleteMany({ where: { labelId: row.id } }),
      this.prisma.label.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ]);
    return { detail: "Label deleted." };
  }

  async bulkCreateLabels(
    slug: string,
    pid: string,
    labels: Array<{ name: string; color?: string }>,
  ): Promise<Record<string, unknown>[]> {
    const settled = await Promise.allSettled(
      labels
        .filter((l) => l.name?.trim())
        .slice(0, 100)
        .map((l) =>
          this.createLabel(slug, pid, { name: l.name, ...(l.color !== undefined ? { color: l.color } : {}) }),
        ),
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  // --- estimates ---

  async listEstimates(slug: string, pid?: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const rows = await this.prisma.estimate.findMany({
      where: { workspaceId: ws.id, deletedAt: null, ...(pid ? { projectId: pid } : {}) },
      include: { points: { orderBy: { key: "asc" } } },
    });
    return rows.map((e) => ({
      id: e.id,
      project: e.projectId,
      workspace: e.workspaceId,
      name: e.name,
      description: e.description,
      type: e.type,
      last_used: e.lastUsed,
      points: e.points.map((p) => ({ id: p.id, key: p.key, value: p.value, description: p.description })),
    }));
  }

  async createEstimate(
    slug: string,
    pid: string,
    dto: { name: string; description?: string; type?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.estimate
      .create({
        data: {
          projectId: pid,
          workspaceId: ws.id,
          name: dto.name.trim(),
          description: dto.description ?? "",
          type: (dto.type as "categories" | "points") ?? "categories",
        },
        include: { points: true },
      })
      .catch(() => {
        throw new ForbiddenException({ detail: "Estimate name already exists." });
      });
    return { id: row.id, name: row.name, type: row.type, points: row.points };
  }

  async deleteEstimate(slug: string, pid: string, eid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.estimate.findFirst({ where: { id: eid, projectId: pid, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Estimate not found." });
    await this.prisma.$transaction([
      this.prisma.estimatePoint.deleteMany({ where: { estimateId: row.id } }),
      this.prisma.estimate.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ]);
    return { detail: "Estimate deleted." };
  }

  async listPoints(slug: string, pid: string, eid: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const rows = await this.prisma.estimatePoint.findMany({ where: { estimateId: eid }, orderBy: { key: "asc" } });
    return rows.map((p) => ({ id: p.id, key: p.key, value: p.value, description: p.description }));
  }

  async createPoint(
    slug: string,
    pid: string,
    eid: string,
    dto: { key: number; value: string; description?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const est = await this.prisma.estimate.findFirst({ where: { id: eid, projectId: pid, deletedAt: null } });
    if (!est) throw new NotFoundException({ detail: "Estimate not found." });
    const row = await this.prisma.estimatePoint.create({
      data: { projectId: pid, workspaceId: ws.id, estimateId: est.id, key: dto.key, value: dto.value, description: dto.description ?? "" },
    });
    return { id: row.id, key: row.key, value: row.value, description: row.description };
  }

  async updatePoint(
    slug: string,
    pid: string,
    eid: string,
    pointId: string,
    dto: { key?: number; value?: string; description?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.estimatePoint.findFirst({ where: { id: pointId, estimateId: eid } });
    if (!row) throw new NotFoundException({ detail: "Estimate point not found." });
    const updated = await this.prisma.estimatePoint.update({
      where: { id: row.id },
      data: {
        ...(dto.key !== undefined ? { key: dto.key } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
    return { id: updated.id, key: updated.key, value: updated.value, description: updated.description };
  }

  async deletePoint(slug: string, pid: string, eid: string, pointId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.estimatePoint.findFirst({ where: { id: pointId, estimateId: eid } });
    if (!row) throw new NotFoundException({ detail: "Estimate point not found." });
    await this.prisma.estimatePoint.delete({ where: { id: row.id } });
    return { detail: "Estimate point deleted." };
  }

  // --- issue types ---

  async listIssueTypes(slug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const rows = await this.prisma.issueType.findMany({ where: { workspaceId: ws.id, isActive: true } });
    return rows.map((t) => ({ id: t.id, name: t.name, description: t.description, is_epic: t.isEpic, is_default: t.isDefault }));
  }

  async createIssueType(slug: string, dto: { name: string; description?: string; is_epic?: boolean }): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.issueType.create({
      data: { workspaceId: ws.id, name: dto.name.trim(), description: dto.description ?? "", isEpic: dto.is_epic ?? false },
    });
    return { id: row.id, name: row.name, is_epic: row.isEpic };
  }

  async listProjectIssueTypes(slug: string, pid: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const rows = await this.prisma.projectIssueType.findMany({ where: { projectId: pid } });
    return rows.map((r) => ({ id: r.id, issue_type: r.issueTypeId, level: r.level, is_default: r.isDefault }));
  }

  async attachIssueType(slug: string, pid: string, issueTypeId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const t = await this.prisma.issueType.findFirst({ where: { id: issueTypeId, workspaceId: ws.id } });
    if (!t) throw new NotFoundException({ detail: "Issue type not found." });
    const row = await this.prisma.projectIssueType.upsert({
      where: { projectId_issueTypeId: { projectId: pid, issueTypeId: t.id } },
      create: { projectId: pid, workspaceId: ws.id, issueTypeId: t.id },
      update: {},
    });
    return { id: row.id, issue_type: row.issueTypeId };
  }

  async detachIssueType(slug: string, pid: string, linkId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.prisma.projectIssueType.deleteMany({ where: { id: linkId, projectId: pid } });
    return { detail: "Issue type detached." };
  }
}
