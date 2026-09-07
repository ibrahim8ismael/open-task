import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";

/** Hydrate UserFavorite rows into the IFavorite shape the web store expects:
 * entity_data is fetched per entity type (project/issue/view/cycle/module/page). */
@Controller("api/workspaces/:slug/user-favorites")
@Level("WORKSPACE")
export class FavoritesController {
  constructor(private readonly prisma: PrismaService) {}

  private async hydrate(
    workspaceId: string,
    rows: Array<{ id: string; entityType: string; entityIdentifier: string | null; name: string | null; sequence: number }>,
  ) {
    const projectIds = rows.filter((r) => r.entityType === "project").map((r) => r.entityIdentifier ?? "");
    const issueIds = rows.filter((r) => r.entityType === "issue").map((r) => r.entityIdentifier ?? "");
    const viewIds = rows.filter((r) => r.entityType === "view").map((r) => r.entityIdentifier ?? "");
    const cycleIds = rows.filter((r) => r.entityType === "cycle").map((r) => r.entityIdentifier ?? "");
    const moduleIds = rows.filter((r) => r.entityType === "module").map((r) => r.entityIdentifier ?? "");
    const pageIds = rows.filter((r) => r.entityType === "page").map((r) => r.entityIdentifier ?? "");
    const [projects, issues, views, cycles, modules, pages] = await Promise.all([
      projectIds.length ? this.prisma.project.findMany({ where: { id: { in: projectIds } } }) : Promise.resolve([]),
      issueIds.length ? this.prisma.issue.findMany({ where: { id: { in: issueIds } } }) : Promise.resolve([]),
      viewIds.length ? this.prisma.issueView.findMany({ where: { id: { in: viewIds } } }) : Promise.resolve([]),
      cycleIds.length ? this.prisma.cycle.findMany({ where: { id: { in: cycleIds } } }) : Promise.resolve([]),
      moduleIds.length ? this.prisma.module.findMany({ where: { id: { in: moduleIds } } }) : Promise.resolve([]),
      pageIds.length ? this.prisma.page.findMany({ where: { id: { in: pageIds } } }) : Promise.resolve([]),
    ]);
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const issueById = new Map(issues.map((i) => [i.id, i]));
    const viewById = new Map(views.map((v) => [v.id, v]));
    const cycleById = new Map(cycles.map((c) => [c.id, c]));
    const moduleById = new Map(modules.map((m) => [m.id, m]));
    const pageById = new Map(pages.map((p) => [p.id, p]));
    return rows.map((r) => {
      let name = r.name ?? "";
      let projectId: string | null = null;
      if (r.entityType === "project" && projectById.has(r.entityIdentifier ?? "")) {
        const p = projectById.get(r.entityIdentifier ?? "")!;
        name = p.name;
      } else if (r.entityType === "issue" && issueById.has(r.entityIdentifier ?? "")) {
        const i = issueById.get(r.entityIdentifier ?? "")!;
        name = i.name;
        projectId = i.projectId;
      } else if (r.entityType === "view" && viewById.has(r.entityIdentifier ?? "")) {
        name = viewById.get(r.entityIdentifier ?? "")!.name;
      } else if (r.entityType === "cycle" && cycleById.has(r.entityIdentifier ?? "")) {
        name = cycleById.get(r.entityIdentifier ?? "")!.name;
      } else if (r.entityType === "module" && moduleById.has(r.entityIdentifier ?? "")) {
        name = moduleById.get(r.entityIdentifier ?? "")!.name;
      } else if (r.entityType === "page" && pageById.has(r.entityIdentifier ?? "")) {
        name = pageById.get(r.entityIdentifier ?? "")!.name;
      }
      return {
        id: r.id,
        name,
        entity_type: r.entityType,
        entity_identifier: r.entityIdentifier,
        entity_data: { id: r.entityIdentifier ?? undefined, name, logo_props: {} },
        is_folder: false,
        sort_order: r.sequence,
        parent: null,
        children: [],
        project_id: projectId,
      };
    });
  }

  @Get()
  @Roles("GUEST")
  async list(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Query("all") _all?: string,
  ): Promise<Record<string, unknown>[]> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const rows = await this.prisma.userFavorite.findMany({
      where: { workspaceId: ws.id, userId: user.id },
      orderBy: { sequence: "asc" },
    });
    return this.hydrate(ws.id, rows);
  }

  @Post()
  @Roles("GUEST")
  async add(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { entity_type?: string; entity_identifier?: string; name?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const identifier = dto.entity_identifier ?? "";
    const createData = {
      workspaceId: ws.id,
      userId: user.id,
      entityType: dto.entity_type ?? "project",
      entityIdentifier: identifier,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
    };
    const updateData: { name?: string } = dto.name !== undefined ? { name: dto.name } : {};
    const row = await this.prisma.userFavorite.upsert({
      where: {
        entityType_entityIdentifier_userId: {
          entityType: createData.entityType,
          entityIdentifier: identifier,
          userId: user.id,
        },
      },
      create: createData,
      update: updateData,
    });
    return (await this.hydrate(ws.id, [row]))[0];
  }

  @Patch(":favoriteId")
  @Roles("GUEST")
  async update(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("favoriteId") favoriteId: string,
    @Body() dto: { sort_order?: number },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const row = await this.prisma.userFavorite.findFirst({ where: { id: favoriteId, workspaceId: ws.id, userId: user.id } });
    if (!row) return { detail: "not found" };
    const updated = await this.prisma.userFavorite.update({
      where: { id: row.id },
      data: dto.sort_order !== undefined ? { sequence: dto.sort_order } : {},
    });
    return (await this.hydrate(ws.id, [updated]))[0];
  }

  @Delete(":favoriteId")
  @Roles("GUEST")
  async remove(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("favoriteId") favoriteId: string,
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    await this.prisma.userFavorite.deleteMany({ where: { id: favoriteId, workspaceId: ws.id, userId: user.id } });
    return { detail: "removed" };
  }
}
