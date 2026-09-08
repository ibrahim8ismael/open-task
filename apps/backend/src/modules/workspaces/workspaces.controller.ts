import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentUser, Level, Public, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";
import { serializeWorkspace } from "./workspaces.service";
import { UsersService } from "../users/users.service";
import { WorkspacesService } from "./workspaces.service";
import {
  CreateWorkspaceDto,
  InviteDto,
  UpdateMemberDto,
  UpdateUserPropertiesDto,
  UpdateWorkspaceDto,
} from "./dto/workspaces.dto";

@Controller("api/workspaces")
@Level("WORKSPACE")
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @Roles("GUEST")
  list(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.workspaces.listMine(user.id);
  }

  @Post()
  @Level("NONE")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateWorkspaceDto): Promise<Record<string, unknown>> {
    return this.workspaces.create(user.id, dto.name, dto.slug, dto.organization_size);
  }

  @Get(":slug")
  @Roles("GUEST")
  async get(@Param("slug") slug: string): Promise<Record<string, unknown>> {
    return serializeWorkspace(await this.workspaces.workspaceOrThrow(slug));
  }

  @Put(":slug")
  @Roles("MEMBER")
  put(@Param("slug") slug: string, @Body() dto: UpdateWorkspaceDto): Promise<Record<string, unknown>> {
    return this.workspaces.update(slug, dto);
  }

  @Patch(":slug")
  @Roles("MEMBER")
  patch(@Param("slug") slug: string, @Body() dto: UpdateWorkspaceDto): Promise<Record<string, unknown>> {
    return this.workspaces.update(slug, dto);
  }

  @Delete(":slug")
  @Roles("ADMIN")
  remove(@Param("slug") slug: string): Promise<{ detail: string }> {
    return this.workspaces.remove(slug);
  }

  // --- members ---

  @Get(":slug/members")
  @Roles("GUEST")
  async members(@Param("slug") slug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.listMembers(ws.id);
  }

  @Patch(":slug/members/:id")
  @Roles("ADMIN")
  async updateMember(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.updateMember(ws.id, id, dto.role);
  }

  @Delete(":slug/members/:id")
  @Roles("ADMIN")
  async removeMember(@Param("slug") slug: string, @Param("id") id: string): Promise<{ detail: string }> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.removeMember(ws.id, id);
  }

  @Post(":slug/leave")
  @Roles("GUEST")
  async leave(@Param("slug") slug: string, @CurrentUser() user: RequestUser): Promise<{ detail: string }> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.leave(ws.id, user.id);
  }

  // --- invitations ---

  @Get(":slug/invitations")
  @Roles("MEMBER")
  async invites(@Param("slug") slug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.listInvites(ws.id);
  }

  @Post(":slug/invitations")
  @Roles("MEMBER")
  async invite(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteDto,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const inviterName = me.displayName || me.email || "A teammate";
    return this.workspaces.invite(ws.id, dto.email, dto.role, inviterName);
  }

  @Post(":slug/invitations/:id/join")
  @Level("NONE")
  join(@Param("id") id: string, @CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    return this.workspaces.join(id, user.id);
  }

  // --- user properties ---

  @Get(":slug/user-properties")
  @Roles("GUEST")
  async getProps(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.getUserProperties(ws.id, user.id);
  }

  @Put(":slug/user-properties")
  @Roles("GUEST")
  async putPropsPut(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserPropertiesDto,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.updateUserProperties(ws.id, user.id, dto);
  }

  @Patch(":slug/user-properties")
  @Roles("GUEST")
  async putProps(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserPropertiesDto,
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaces.workspaceOrThrow(slug);
    return this.workspaces.updateUserProperties(ws.id, user.id, dto);
  }
}

@Controller()
export class WorkspaceMiscController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Get("api/workspace-slug-check")
  slugCheck(@Query("slug") slug: string): Promise<{ available: boolean; status: boolean }> {
    return this.workspaces.slugAvailable(slug ?? "");
  }

  @Get("api/users/last-visited-workspace")
  async lastVisited(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile?.lastWorkspaceId) return { last_visited_workspace: null };
    const ws = await this.prisma.workspace.findFirst({
      where: {
        id: profile.lastWorkspaceId,
        deletedAt: null,
        members: { some: { memberId: user.id, isActive: true, deletedAt: null } },
      },
    });
    return { last_visited_workspace: ws ? serializeWorkspace(ws) : null };
  }

  @Put("api/users/last-visited-workspace")
  async setLastVisitedPut(
    @CurrentUser() user: RequestUser,
    @Body() dto: { workspace_id?: string },
  ): Promise<Record<string, unknown>> {
    return this.setLastVisited(user, dto);
  }

  @Patch("api/users/last-visited-workspace")
  async setLastVisited(
    @CurrentUser() user: RequestUser,
    @Body() dto: { workspace_id?: string },
  ): Promise<Record<string, unknown>> {
    if (dto.workspace_id) {
      await this.prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, lastWorkspaceId: dto.workspace_id },
        update: { lastWorkspaceId: dto.workspace_id },
      });
    }
    return this.lastVisited(user);
  }
}
