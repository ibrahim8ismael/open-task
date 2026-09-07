import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { CreateProjectDto, UpdateProjectDto } from "../workspaces/dto/workspaces.dto";
import { ProjectsService } from "./projects.service";

@Controller("api/workspaces/:slug/projects")
@Level("WORKSPACE")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @Query("archived") archived?: string): Promise<Record<string, unknown>[]> {
    return this.projects.list(slug, archived === "true" || archived === "1");
  }

  @Post()
  @Roles("MEMBER")
  create(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateProjectDto,
  ): Promise<Record<string, unknown>> {
    return this.projects.create(slug, user.id, dto);
  }

  @Get(":id/details")
  @Roles("GUEST")
  details(@Param("slug") slug: string, @Param("id") id: string): Promise<Record<string, unknown>> {
    return this.projects.details(slug, id);
  }

  @Get(":id")
  @Roles("GUEST")
  get(@Param("slug") slug: string, @Param("id") id: string): Promise<Record<string, unknown>> {
    return this.projects.details(slug, id);
  }

  @Put(":id")
  @Roles("MEMBER")
  put(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Record<string, unknown>> {
    return this.projects.update(slug, id, dto);
  }

  @Patch(":id")
  @Roles("MEMBER")
  patch(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Record<string, unknown>> {
    return this.projects.update(slug, id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("slug") slug: string, @Param("id") id: string): Promise<{ detail: string }> {
    return this.projects.remove(slug, id);
  }

  @Post(":id/archive")
  @Roles("MEMBER")
  archive(@Param("slug") slug: string, @Param("id") id: string): Promise<Record<string, unknown>> {
    return this.projects.archive(slug, id, true);
  }

  @Post(":id/unarchive")
  @Roles("MEMBER")
  unarchive(@Param("slug") slug: string, @Param("id") id: string): Promise<Record<string, unknown>> {
    return this.projects.archive(slug, id, false);
  }

  // --- members ---

  @Get(":id/members")
  @Roles("GUEST")
  members(@Param("slug") slug: string, @Param("id") id: string): Promise<Record<string, unknown>[]> {
    return this.projects.listMembers(slug, id);
  }

  @Post(":id/members")
  @Roles("MEMBER")
  addMember(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Body() dto: { member_id?: string; email?: string; role?: unknown },
  ): Promise<Record<string, unknown>> {
    return this.projects.addMember(slug, id, dto);
  }

  @Patch(":id/members/:memberId")
  @Roles("MEMBER")
  updateMember(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() dto: { role?: unknown },
  ): Promise<Record<string, unknown>> {
    return this.projects.updateMember(slug, id, memberId, dto.role);
  }

  @Delete(":id/members/:memberId")
  @Roles("MEMBER")
  removeMember(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ): Promise<{ detail: string }> {
    return this.projects.removeMember(slug, id, memberId);
  }

  // --- invitations ---

  @Get(":id/invitations")
  @Roles("MEMBER")
  invites(@Param("slug") slug: string, @Param("id") id: string): Promise<Record<string, unknown>[]> {
    return this.projects.listInvites(slug, id);
  }

  @Post(":id/invitations")
  @Roles("MEMBER")
  invite(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Body() dto: { email: string; role?: unknown },
  ): Promise<Record<string, unknown>> {
    return this.projects.invite(slug, id, dto.email, dto.role);
  }
}

@Controller()
export class ProjectMiscController {
  constructor(private readonly projects: ProjectsService) {}

  @Get("api/workspaces/:slug/project-identifiers")
  @Roles("GUEST")
  @Level("WORKSPACE")
  identifiers(@Param("slug") slug: string): Promise<Record<string, unknown>[]> {
    return this.projects.identifiers(slug);
  }
}
