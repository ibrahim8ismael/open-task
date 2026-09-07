import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

const VERSION_CAP = 20;

type PageRow = {
  id: string;
  workspaceId: string;
  ownedById: string;
  parentId: string | null;
  name: string;
  descriptionJson: unknown;
  descriptionHtml: string;
  access: number;
  color: string;
  archivedAt: Date | null;
  isLocked: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
};

@Injectable()
export class PagesService {
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

  async pageInProjectOrThrow(workspaceId: string, projectId: string, pageId: string): Promise<PageRow> {
    const link = await this.prisma.projectPage.findFirst({ where: { projectId, pageId } });
    if (!link) throw new NotFoundException({ detail: "Page not found." });
    const page = await this.prisma.page.findFirst({ where: { id: pageId, workspaceId, deletedAt: null } });
    if (!page) throw new NotFoundException({ detail: "Page not found." });
    return page as PageRow;
  }

  async serialize(page: PageRow, userId?: string): Promise<Record<string, unknown>> {
    const [labels, projects, fav] = await Promise.all([
      this.prisma.pageLabel.findMany({ where: { pageId: page.id } }),
      this.prisma.projectPage.findMany({ where: { pageId: page.id } }),
      userId
        ? this.prisma.userFavorite.findFirst({ where: { userId, entityType: "page", entityIdentifier: page.id } })
        : Promise.resolve(null),
    ]);
    return {
      id: page.id,
      access: page.access,
      archived_at: page.archivedAt,
      color: page.color,
      created_at: page.createdAt,
      created_by: page.createdBy,
      description_json: page.descriptionJson,
      description_html: page.descriptionHtml,
      is_favorite: !!fav,
      is_locked: page.isLocked,
      label_ids: labels.map((l) => l.labelId),
      name: page.name,
      owned_by: page.ownedById,
      project_ids: projects.map((p) => p.projectId),
      updated_at: page.updatedAt,
      updated_by: page.updatedBy,
      workspace: page.workspaceId,
      logo_props: {},
    };
  }

  private async snapshot(pageId: string, workspaceId: string, userId: string): Promise<void> {
    const page = await this.prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await this.prisma.pageVersion.create({
      data: {
        workspaceId,
        pageId,
        ownedById: userId,
        descriptionJson: (page.descriptionJson as object) ?? {},
        descriptionHtml: page.descriptionHtml,
      },
    });
    // Retention: keep latest 20 versions
    const olds = await this.prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { lastSavedAt: "desc" },
      skip: VERSION_CAP,
      select: { id: true },
    });
    if (olds.length) {
      await this.prisma.pageVersion.deleteMany({ where: { id: { in: olds.map((o) => o.id) } } });
    }
  }

  private ensureEditable(page: PageRow, userId: string): void {
    if (page.isLocked && page.ownedById !== userId)
      throw new ForbiddenException({ detail: "Page is locked." });
  }

  // --- CRUD ---

  async list(slug: string, pid: string, userId: string, archived = false): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const links = await this.prisma.projectPage.findMany({ where: { projectId: pid } });
    const rows = await this.prisma.page.findMany({
      where: {
        id: { in: links.map((l) => l.pageId) },
        workspaceId: ws.id,
        deletedAt: null,
        archivedAt: archived ? { not: null } : null,
      },
      orderBy: { sortOrder: "asc" },
    });
    return Promise.all(rows.map((r) => this.serialize(r as PageRow, userId)));
  }

  async create(
    slug: string,
    pid: string,
    userId: string,
    dto: { name?: string; description_json?: unknown; description_html?: string; parent?: string; color?: string; access?: number },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    if (dto.parent) {
      const parent = await this.prisma.page.findFirst({ where: { id: dto.parent, workspaceId: ws.id, deletedAt: null } });
      if (!parent) throw new NotFoundException({ detail: "Parent page not found." });
    }
    const max = await this.prisma.page.aggregate({ _max: { sortOrder: true }, where: { workspaceId: ws.id } });
    const row = await this.prisma.page.create({
      data: {
        workspaceId: ws.id,
        ownedById: userId,
        parentId: dto.parent ?? null,
        name: dto.name ?? "",
        descriptionJson: (dto.description_json as object) ?? {},
        descriptionHtml: dto.description_html ?? "<p></p>",
        color: dto.color ?? "",
        access: dto.access ?? 0,
        sortOrder: (max._max.sortOrder ?? 55535) + 10000,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    await this.prisma.projectPage.create({ data: { projectId: pid, pageId: row.id, workspaceId: ws.id } });
    return this.serialize(row as PageRow, userId);
  }

  async retrieve(slug: string, pid: string, pageId: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    return this.serialize(await this.pageInProjectOrThrow(ws.id, pid, pageId), userId);
  }

  async update(
    slug: string,
    pid: string,
    pageId: string,
    userId: string,
    dto: { name?: string; color?: string; label_ids?: string[] },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    this.ensureEditable(page, userId);
    const updated = await this.prisma.page.update({
      where: { id: page.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        updatedBy: userId,
      },
    });
    if (dto.label_ids !== undefined) {
      await this.prisma.pageLabel.deleteMany({ where: { pageId: page.id } });
      if (dto.label_ids.length) {
        const labels = await this.prisma.label.findMany({
          where: { id: { in: dto.label_ids }, workspaceId: ws.id, deletedAt: null },
        });
        await this.prisma.pageLabel.createMany({
          data: labels.map((l) => ({ labelId: l.id, pageId: page.id, workspaceId: ws.id })),
          skipDuplicates: true,
        });
      }
    }
    return this.serialize(updated as PageRow, userId);
  }

  async remove(slug: string, pid: string, pageId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    await this.prisma.$transaction([
      this.prisma.projectPage.deleteMany({ where: { pageId: page.id } }),
      this.prisma.page.update({ where: { id: page.id }, data: { deletedAt: new Date() } }),
    ]);
    return { detail: "Page deleted." };
  }

  // --- description (TipTap body) ---

  async description(slug: string, pid: string, pageId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    return { description_json: page.descriptionJson, description_html: page.descriptionHtml };
  }

  async updateDescription(
    slug: string,
    pid: string,
    pageId: string,
    userId: string,
    dto: { description_json?: unknown; description_html?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    this.ensureEditable(page, userId);
    await this.snapshot(page.id, ws.id, userId);
    const updated = await this.prisma.page.update({
      where: { id: page.id },
      data: {
        ...(dto.description_json !== undefined ? { descriptionJson: dto.description_json as object } : {}),
        ...(dto.description_html !== undefined ? { descriptionHtml: dto.description_html } : {}),
        updatedBy: userId,
      },
    });
    return { description_json: updated.descriptionJson, description_html: updated.descriptionHtml };
  }

  // --- versions ---

  async versions(slug: string, pid: string, pageId: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.pageInProjectOrThrow(ws.id, pid, pageId);
    const rows = await this.prisma.pageVersion.findMany({
      where: { pageId, workspaceId: ws.id },
      orderBy: { lastSavedAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      description_json: r.descriptionJson,
      description_html: r.descriptionHtml,
      last_saved_at: r.lastSavedAt,
    }));
  }

  async version(slug: string, pid: string, pageId: string, versionId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.pageInProjectOrThrow(ws.id, pid, pageId);
    const row = await this.prisma.pageVersion.findFirst({ where: { id: versionId, pageId } });
    if (!row) throw new NotFoundException({ detail: "Version not found." });
    return { id: row.id, description_json: row.descriptionJson, description_html: row.descriptionHtml, last_saved_at: row.lastSavedAt };
  }

  async restoreVersion(slug: string, pid: string, pageId: string, userId: string, versionId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    this.ensureEditable(page, userId);
    const row = await this.prisma.pageVersion.findFirst({ where: { id: versionId, pageId } });
    if (!row) throw new NotFoundException({ detail: "Version not found." });
    await this.snapshot(page.id, ws.id, userId);
    const updated = await this.prisma.page.update({
      where: { id: page.id },
      data: {
        descriptionJson: (row.descriptionJson as object) ?? {},
        descriptionHtml: row.descriptionHtml,
        updatedBy: userId,
      },
    });
    return this.serialize(updated as PageRow, userId);
  }

  // --- access / lock / archive / duplicate / move ---

  async setAccess(slug: string, pid: string, pageId: string, access: number): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    const updated = await this.prisma.page.update({ where: { id: page.id }, data: { access } });
    return this.serialize(updated as PageRow);
  }

  async setLocked(slug: string, pid: string, pageId: string, locked: boolean): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    await this.prisma.page.update({ where: { id: page.id }, data: { isLocked: locked } });
    return { detail: locked ? "Page locked." : "Page unlocked." };
  }

  async setArchived(slug: string, pid: string, pageId: string, archived: boolean): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    const updated = await this.prisma.page.update({
      where: { id: page.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    return { archived_at: updated.archivedAt };
  }

  async duplicate(slug: string, pid: string, pageId: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    const full = await this.prisma.page.findUniqueOrThrow({ where: { id: page.id } });
    const max = await this.prisma.page.aggregate({ _max: { sortOrder: true }, where: { workspaceId: ws.id } });
    const copy = await this.prisma.page.create({
      data: {
        workspaceId: ws.id,
        ownedById: userId,
        parentId: full.parentId,
        name: `${full.name} (copy)`,
        descriptionJson: (full.descriptionJson as object) ?? {},
        descriptionHtml: full.descriptionHtml,
        color: full.color,
        access: full.access,
        sortOrder: (max._max.sortOrder ?? 55535) + 10000,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    await this.prisma.projectPage.create({ data: { projectId: pid, pageId: copy.id, workspaceId: ws.id } });
    return this.serialize(copy as PageRow, userId);
  }

  async move(slug: string, pid: string, pageId: string, newProjectId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.projectOrThrow(ws.id, newProjectId);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    await this.prisma.projectPage.deleteMany({ where: { projectId: pid, pageId: page.id } });
    await this.prisma.projectPage.upsert({
      where: { projectId_pageId: { projectId: newProjectId, pageId: page.id } },
      create: { projectId: newProjectId, pageId: page.id, workspaceId: ws.id },
      update: {},
    });
    return this.serialize(page, undefined);
  }

  // --- favorites ---

  async favorite(slug: string, pid: string, pageId: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const page = await this.pageInProjectOrThrow(ws.id, pid, pageId);
    const full = await this.prisma.page.findUniqueOrThrow({ where: { id: page.id } });
    const row = await this.prisma.userFavorite.upsert({
      where: { entityType_entityIdentifier_userId: { entityType: "page", entityIdentifier: page.id, userId } },
      create: { workspaceId: ws.id, userId, entityType: "page", entityIdentifier: page.id, name: full.name },
      update: { name: full.name },
    });
    return { id: row.id, entity_type: row.entityType, entity_identifier: row.entityIdentifier };
  }

  async unfavorite(slug: string, pid: string, pageId: string, userId: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    await this.prisma.userFavorite.deleteMany({
      where: { workspaceId: ws.id, userId, entityType: "page", entityIdentifier: pageId },
    });
    return { detail: "Removed from favorites." };
  }
}
