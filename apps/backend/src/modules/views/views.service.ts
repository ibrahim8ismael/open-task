import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IssuesListService, ListQuery } from "../issues/issues-list.service";

function serializeView(v: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  ownedById: string;
  name: string;
  description: string;
  query: unknown;
  filters: unknown;
  displayFilters: unknown;
  displayProperties: unknown;
  access: number;
  sortOrder: number;
  isLocked: boolean;
}): Record<string, unknown> {
  return {
    id: v.id,
    workspace: v.workspaceId,
    project: v.projectId,
    owned_by: v.ownedById,
    name: v.name,
    description: v.description,
    query: v.query,
    filters: v.filters,
    display_filters: v.displayFilters,
    display_properties: v.displayProperties,
    access: v.access,
    sort_order: v.sortOrder,
    is_locked: v.isLocked,
  };
}

@Injectable()
export class ViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuesList: IssuesListService,
  ) {}

  async workspaceOrThrow(slug: string): Promise<{ id: string }> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    return ws;
  }

  async list(slug: string, pid?: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const rows = await this.prisma.issueView.findMany({
      where: { workspaceId: ws.id, deletedAt: null, ...(pid ? { projectId: pid } : {}) },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(serializeView);
  }

  async create(
    slug: string,
    userId: string,
    pid: string | undefined,
    dto: {
      name: string;
      description?: string;
      query?: unknown;
      filters?: unknown;
      display_filters?: unknown;
      display_properties?: unknown;
      access?: number;
    },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    if (!dto.name?.trim()) throw new ForbiddenException({ detail: "Name is required." });
    const row = await this.prisma.issueView.create({
      data: {
        workspaceId: ws.id,
        projectId: pid ?? null,
        ownedById: userId,
        name: dto.name.trim(),
        description: dto.description ?? "",
        query: (dto.query as object) ?? {},
        filters: (dto.filters as object) ?? {},
        displayFilters: (dto.display_filters as object) ?? {},
        displayProperties: (dto.display_properties as object) ?? {},
        access: dto.access ?? 1,
      },
    });
    return serializeView(row);
  }

  async retrieve(slug: string, vid: string, pid?: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.issueView.findFirst({
      where: { id: vid, workspaceId: ws.id, deletedAt: null, ...(pid ? { projectId: pid } : {}) },
    });
    if (!row) throw new NotFoundException({ detail: "View not found." });
    return serializeView(row);
  }

  async update(
    slug: string,
    vid: string,
    userId: string,
    pid: string | undefined,
    dto: {
      name?: string;
      description?: string;
      query?: unknown;
      filters?: unknown;
      display_filters?: unknown;
      display_properties?: unknown;
      access?: number;
    },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.issueView.findFirst({
      where: { id: vid, workspaceId: ws.id, deletedAt: null, ...(pid ? { projectId: pid } : {}) },
    });
    if (!row) throw new NotFoundException({ detail: "View not found." });
    if (row.isLocked && row.ownedById !== userId) throw new ForbiddenException({ detail: "View is locked." });
    const updated = await this.prisma.issueView.update({
      where: { id: row.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.query !== undefined ? { query: dto.query as object } : {}),
        ...(dto.filters !== undefined ? { filters: dto.filters as object } : {}),
        ...(dto.display_filters !== undefined ? { displayFilters: dto.display_filters as object } : {}),
        ...(dto.display_properties !== undefined ? { displayProperties: dto.display_properties as object } : {}),
        ...(dto.access !== undefined ? { access: dto.access } : {}),
      },
    });
    return serializeView(updated);
  }

  async remove(slug: string, vid: string, userId: string, pid?: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.issueView.findFirst({
      where: { id: vid, workspaceId: ws.id, deletedAt: null, ...(pid ? { projectId: pid } : {}) },
    });
    if (!row) throw new NotFoundException({ detail: "View not found." });
    if (row.isLocked && row.ownedById !== userId) throw new ForbiddenException({ detail: "View is locked." });
    await this.prisma.issueView.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
    return { detail: "View deleted." };
  }

  /** Run a saved view's filters through the issue list pipeline. */
  async viewIssues(
    slug: string,
    pid: string,
    vid: string,
    q: ListQuery,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.issueView.findFirst({
      where: { id: vid, workspaceId: ws.id, projectId: pid, deletedAt: null },
    });
    if (!row) throw new NotFoundException({ detail: "View not found." });
    const saved = (row.filters as Record<string, unknown>) ?? {};
    const merged: ListQuery = { ...q };
    for (const [k, v] of Object.entries(saved)) {
      if (merged[k] === undefined && v !== null && v !== undefined) {
        merged[k] = Array.isArray(v) ? v.map(String).join(",") : String(v);
      }
    }
    return this.issuesList.list(slug, pid, merged);
  }

  async favorite(slug: string, userId: string, viewId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const view = await this.prisma.issueView.findFirst({ where: { id: viewId, workspaceId: ws.id, deletedAt: null } });
    if (!view) throw new NotFoundException({ detail: "View not found." });
    const row = await this.prisma.userFavorite.upsert({
      where: { entityType_entityIdentifier_userId: { entityType: "view", entityIdentifier: view.id, userId } },
      create: { workspaceId: ws.id, userId, entityType: "view", entityIdentifier: view.id, name: view.name },
      update: { name: view.name },
    });
    return { id: row.id, entity_type: row.entityType, entity_identifier: row.entityIdentifier };
  }

  async unfavorite(slug: string, userId: string, viewId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.prisma.userFavorite.deleteMany({
      where: { workspaceId: ws.id, userId, entityType: "view", entityIdentifier: viewId },
    });
    return { detail: "Removed from favorites." };
  }

  // --- search ---

  async search(
    slug: string,
    userId: string,
    search: string,
    projectId?: string,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { memberId: userId, isActive: true, deletedAt: null },
    });
    const wsIds = memberships.map((m) => m.workspaceId);
    if (!wsIds.includes(ws.id)) throw new NotFoundException({ detail: "Workspace not found." });
    const term = (search ?? "").trim();
    if (!term) {
      return { results: { workspace: [], project: [], issue: [], cycle: [], module: [], issue_view: [], page: [] } };
    }
    const projectScope = projectId
      ? await this.prisma.project.findFirst({ where: { id: projectId, workspaceId: ws.id, deletedAt: null } })
      : null;
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId: ws.id,
        deletedAt: null,
        archivedAt: null,
        ...(projectScope ? { id: projectScope.id } : {}),
        name: { contains: term, mode: "insensitive" },
      },
      take: 10,
    });
    const inProjects = await this.prisma.project.findMany({
      where: { workspaceId: ws.id, deletedAt: null, ...(projectScope ? { id: projectScope.id } : {}) },
      select: { id: true, identifier: true },
    });
    const pmap = new Map(inProjects.map((p) => [p.id, p.identifier]));
    const issues = await this.prisma.issue.findMany({
      where: {
        workspaceId: ws.id,
        projectId: { in: inProjects.map((p) => p.id) },
        deletedAt: null,
        archivedAt: null,
        name: { contains: term, mode: "insensitive" },
      },
      take: 20,
    });
    return {
      results: {
        workspace: [],
        project: projects.map((p) => ({ id: p.id, identifier: p.identifier, name: p.name, workspace__slug: slug })),
        issue: issues.map((i) => ({
          id: i.id,
          name: i.name,
          project__identifier: pmap.get(i.projectId) ?? "",
          project_id: i.projectId,
          sequence_id: i.sequenceId,
          workspace__slug: slug,
          type_id: i.typeId,
        })),
        cycle: [],
        module: [],
        issue_view: [],
        page: [],
      },
    };
  }
}
