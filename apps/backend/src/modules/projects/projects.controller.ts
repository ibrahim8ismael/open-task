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

  // NOTE: literal "details" must register before ":id" or Express matches it as an id.
  @Get("details")
  @Roles("GUEST")
  detailsList(@Param("slug") slug: string): Promise<Record<string, unknown>[]> {
    return this.projects.detailsList(slug);
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

  // NOTE: "me" must register before ":memberId".
  @Get(":id/members/me")
  @Roles("GUEST")
  myMembership(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.projects.myMembership(slug, id, user.id);
  }

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

  // --- user properties ---

  @Get(":id/user-properties")
  @Roles("GUEST")
  userProperties(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.projects.userProperties(slug, id, user.id);
  }

  @Patch(":id/user-properties")
  @Roles("GUEST")
  updateUserProperties(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.projects.updateUserProperties(slug, id, user.id, dto);
  }

  // --- project issue search ---

  @Get(":id/search-issues")
  @Roles("GUEST")
  searchIssues(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Query("search") search: string,
  ): Promise<Record<string, unknown>[]> {
    return this.projects.searchIssues(slug, id, search ?? "");
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

  @Get("api/workspaces/:slug/project-stats")
  @Roles("GUEST")
  @Level("WORKSPACE")
  stats(@Param("slug") slug: string): Promise<Record<string, unknown>[]> {
    return this.projects.stats(slug);
  }

  @Get("api/workspaces/:slug/user-favorite-projects")
  @Roles("GUEST")
  @Level("WORKSPACE")
  favoriteProjects(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>[]> {
    return this.projects.favoriteProjects(slug, user.id);
  }

  @Post("api/workspaces/:slug/user-favorite-projects")
  @Roles("GUEST")
  @Level("WORKSPACE")
  favoriteProject(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { project: string },
  ): Promise<Record<string, unknown>> {
    return this.projects.favoriteProject(slug, user.id, dto.project);
  }

  @Delete("api/workspaces/:slug/user-favorite-projects/:projectId")
  @Roles("GUEST")
  @Level("WORKSPACE")
  unfavoriteProject(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
  ): Promise<{ detail: string }> {
    return this.projects.unfavoriteProject(slug, user.id, projectId);
  }

  @Get("api/users/me/workspaces/:slug/projects/invitations")
  @Roles("GUEST")
  @Level("WORKSPACE")
  myInvites(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>[]> {
    return this.projects.myProjectInvites(slug, user.id);
  }

  @Post("api/users/me/workspaces/:slug/projects/invitations")
  @Roles("GUEST")
  @Level("WORKSPACE")
  acceptInvites(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { project_ids: string[] },
  ): Promise<{ detail: string }> {
    return this.projects.acceptProjectInvites(slug, user.id, dto.project_ids ?? []);
  }
}
