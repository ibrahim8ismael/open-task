import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, Level, Public, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";
import { roleToNum } from "../../common/utils/roles";

const WIDGETS = [
  { key: "quick_links", name: "Quick links" },
  { key: "recents", name: "Recents" },
  { key: "my_stickies", name: "My stickies" },
  { key: "quick_tutorial", name: "Quick tutorial" },
  { key: "new_at_plane", name: "New at Open-Task" },
] as const;

const SIDEBAR_KEYS = ["projects", "views", "cycles", "modules", "pages", "intake", "stickies"] as const;

/** Boot-surface endpoints the apps/web workspace shell calls on every load. */
@Controller()
export class WorkspaceBootController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // --- workspace-members/me (permissions bootstrap) ---

  @Get("api/workspaces/:slug/workspace-members/me")
  @Roles("GUEST")
  @Level("WORKSPACE")
  async memberMe(@Param("slug") slug: string, @CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) return { role: 5, workspace: null, member: user.id, is_active: false };
    const wm = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: ws.id, memberId: user.id, isActive: true, deletedAt: null },
    });
    if (!wm) return { role: 5, workspace: ws.id, member: user.id, is_active: false };
    return {
      id: wm.id,
      member: wm.memberId,
      workspace: wm.workspaceId,
      role: roleToNum(wm.role),
      company_role: null,
      default_props: {},
      view_props: {},
      is_active: wm.isActive,
      draft_issue_count: 0,
    };
  }

  // --- users/me/workspaces (my workspace list) ---

  @Get("api/users/me/workspaces")
  async myWorkspaces(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.workspace.findMany({
      where: { deletedAt: null, members: { some: { memberId: user.id, isActive: true, deletedAt: null } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      organization_size: w.organizationSize,
      timezone: w.timezone,
      owner: w.ownerId,
    }));
  }

  // --- users/me/workspaces/invitations (user-level pending invites) ---

  @Get("api/users/me/workspaces/invitations")
  async myWorkspaceInvites(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!me.email) return [];
    const rows = await this.prisma.workspaceMemberInvite.findMany({
      where: { email: me.email.toLowerCase(), accepted: false },
    });
    const wsIds = [...new Set(rows.map((r) => r.workspaceId))];
    const workspaces = await this.prisma.workspace.findMany({ where: { id: { in: wsIds } } });
    const wsById = new Map(workspaces.map((w) => [w.id, w]));
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: roleToNum(r.role),
      accepted: r.accepted,
      workspace: r.workspaceId,
      workspace_detail: wsById.get(r.workspaceId)
        ? { id: r.workspaceId, name: wsById.get(r.workspaceId)!.name, slug: wsById.get(r.workspaceId)!.slug }
        : null,
    }));
  }

  // --- users/me/workspaces/:slug/project-roles (permission matrix) ---

  @Get("api/users/me/workspaces/:slug/project-roles")
  @Level("WORKSPACE")
  async projectRoles(@Param("slug") slug: string, @CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) return { roles: {} };
    const rows = await this.prisma.projectMember.findMany({
      where: { workspaceId: ws.id, memberId: user.id, isActive: true, deletedAt: null },
    });
    const roles: Record<string, number> = {};
    for (const r of rows) roles[r.projectId] = roleToNum(r.role);
    return { roles };
  }

  // --- quick-links (WorkspaceUserLink) ---

  @Get("api/workspaces/:slug/quick-links")
  @Roles("GUEST")
  @Level("WORKSPACE")
  async quickLinks(@Param("slug") slug: string, @CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) return [];
    const rows = await this.prisma.workspaceUserLink.findMany({
      where: { workspaceId: ws.id, ownerId: user.id, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => ({ id: r.id, title: r.title, url: r.url, metadata: r.metadata, sort_order: r.sortOrder }));
  }

  @Post("api/workspaces/:slug/quick-links")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  async createQuickLink(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { title?: string; url: string; metadata?: unknown },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const max = await this.prisma.workspaceUserLink.aggregate({ _max: { sortOrder: true }, where: { workspaceId: ws.id, ownerId: user.id } });
    const row = await this.prisma.workspaceUserLink.create({
      data: {
        workspaceId: ws.id,
        ownerId: user.id,
        url: dto.url,
        metadata: (dto.metadata as object) ?? {},
        sortOrder: (max._max.sortOrder ?? 55535) + 10000,
        ...(dto.title !== undefined ? { title: dto.title } : {}),
      },
    });
    return { id: row.id, title: row.title, url: row.url, metadata: row.metadata, sort_order: row.sortOrder };
  }

  @Patch("api/workspaces/:slug/quick-links/:linkId")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  async updateQuickLink(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("linkId") linkId: string,
    @Body() dto: { title?: string; url?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const row = await this.prisma.workspaceUserLink.findFirst({
      where: { id: linkId, workspaceId: ws.id, ownerId: user.id, deletedAt: null },
    });
    if (!row) return { detail: "not found" };
    const updated = await this.prisma.workspaceUserLink.update({
      where: { id: row.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
      },
    });
    return { id: updated.id, title: updated.title, url: updated.url, metadata: updated.metadata, sort_order: updated.sortOrder };
  }

  @Delete("api/workspaces/:slug/quick-links/:linkId")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  async deleteQuickLink(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("linkId") linkId: string,
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    await this.prisma.workspaceUserLink.updateMany({
      where: { id: linkId, workspaceId: ws.id, ownerId: user.id },
      data: { deletedAt: new Date() },
    });
    return { detail: "deleted" };
  }

  // --- home-preferences (widgets) ---

  @Get("api/workspaces/:slug/home-preferences")
  @Roles("GUEST")
  @Level("WORKSPACE")
  async homePreferences(@Param("slug") slug: string, @CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const saved = await this.prisma.workspaceHomePreference.findMany({
      where: { workspaceId: ws.id, userId: user.id },
    });
    const byKey = new Map(saved.map((s) => [s.key, s]));
    return WIDGETS.map((w) => {
      const s = byKey.get(w.key);
      return { key: w.key, name: w.name, is_enabled: s?.isEnabled ?? true, sort_order: s?.sortOrder ?? 65535 };
    });
  }

  @Patch("api/workspaces/:slug/home-preferences/:widgetKey")
  @Roles("GUEST")
  @Level("WORKSPACE")
  async updateHomePreference(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("widgetKey") widgetKey: string,
    @Body() dto: { is_enabled?: boolean; sort_order?: number },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const widget = WIDGETS.find((w) => w.key === widgetKey) ?? { key: widgetKey, name: widgetKey };
    const row = await this.prisma.workspaceHomePreference.upsert({
      where: { workspaceId_userId_key: { workspaceId: ws.id, userId: user.id, key: widget.key } },
      create: {
        workspaceId: ws.id,
        userId: user.id,
        key: widget.key,
        isEnabled: dto.is_enabled ?? true,
        sortOrder: dto.sort_order ?? 65535,
      },
      update: {
        ...(dto.is_enabled !== undefined ? { isEnabled: dto.is_enabled } : {}),
        ...(dto.sort_order !== undefined ? { sortOrder: dto.sort_order } : {}),
      },
    });
    return { key: row.key, name: widget.name, is_enabled: row.isEnabled, sort_order: row.sortOrder };
  }

  // --- sidebar-preferences (navigation pins) ---

  @Get("api/workspaces/:slug/sidebar-preferences")
  @Roles("GUEST")
  @Level("WORKSPACE")
  async sidebarPreferences(@Param("slug") slug: string, @CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const saved = await this.prisma.workspaceUserPreference.findMany({
      where: { workspaceId: ws.id, userId: user.id },
    });
    const out: Record<string, unknown> = {};
    for (const key of SIDEBAR_KEYS) {
      const s = saved.find((r) => r.key === key);
      out[key] = { key, is_pinned: s?.isPinned ?? false, sort_order: s?.sortOrder ?? 65535 };
    }
    return out;
  }

  @Patch("api/workspaces/:slug/sidebar-preferences/:key")
  @Roles("GUEST")
  @Level("WORKSPACE")
  async updateSidebarPreference(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("key") key: string,
    @Body() dto: { is_pinned?: boolean; sort_order?: number },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    const row = await this.prisma.workspaceUserPreference.upsert({
      where: { workspaceId_userId_key: { workspaceId: ws.id, userId: user.id, key } },
      create: { workspaceId: ws.id, userId: user.id, key, isPinned: dto.is_pinned ?? false, sortOrder: dto.sort_order ?? 65535 },
      update: {
        ...(dto.is_pinned !== undefined ? { isPinned: dto.is_pinned } : {}),
        ...(dto.sort_order !== undefined ? { sortOrder: dto.sort_order } : {}),
      },
    });
    return { key: row.key, is_pinned: row.isPinned, sort_order: row.sortOrder };
  }

  @Patch("api/workspaces/:slug/sidebar-preferences")
  @Roles("GUEST")
  @Level("WORKSPACE")
  async bulkSidebarPreferences(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: Record<string, { is_pinned?: boolean; sort_order?: number }>,
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirstOrThrow({ where: { slug, deletedAt: null } });
    await Promise.all(
      Object.entries(dto ?? {}).map(([key, v]) =>
        this.prisma.workspaceUserPreference.upsert({
          where: { workspaceId_userId_key: { workspaceId: ws.id, userId: user.id, key } },
          create: { workspaceId: ws.id, userId: user.id, key, isPinned: v?.is_pinned ?? false, sortOrder: v?.sort_order ?? 65535 },
          update: {
            ...(v?.is_pinned !== undefined ? { isPinned: v.is_pinned } : {}),
            ...(v?.sort_order !== undefined ? { sortOrder: v.sort_order } : {}),
          },
        }),
      ),
    );
    return this.sidebarPreferences(slug, user);
  }

  // --- release notes (static stub) ---

  @Public()
  @Get("api/release-notes")
  releaseNotes(): Record<string, unknown>[] {
    return [];
  }

  // --- entity-search (alias of search for workspace entities) ---

  @Get("api/workspaces/:slug/entity-search")
  @Roles("GUEST")
  @Level("WORKSPACE")
  entitySearch(): Record<string, unknown> {
    return { results: { workspace: [], project: [], issue: [], cycle: [], module: [], issue_view: [], page: [] } };
  }
}
