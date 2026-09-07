import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { CreateIssueDto, RelationDto, UpdateIssueDto } from "./dto/issues.dto";
import { IssuesListService, ListQuery } from "./issues-list.service";
import { IssuesService } from "./issues.service";

@Controller("api/workspaces/:slug/projects/:pid/issues")
@Level("PROJECT")
export class IssuesController {
  constructor(
    private readonly issues: IssuesService,
    private readonly list: IssuesListService,
  ) {}

  @Get()
  @Roles("GUEST")
  index(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Query() q: ListQuery,
  ): Promise<Record<string, unknown>> {
    return this.list.list(slug, pid, q);
  }

  @Post()
  @Roles("MEMBER")
  create(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateIssueDto,
  ): Promise<Record<string, unknown>> {
    return this.issues.create(slug, pid, user.id, dto);
  }

  @Get(":id")
  @Roles("GUEST")
  retrieve(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.issues.retrieve(slug, pid, id, user.id);
  }

  @Put(":id")
  @Roles("MEMBER")
  put(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateIssueDto,
  ): Promise<Record<string, unknown>> {
    return this.issues.update(slug, pid, id, user.id, dto as Record<string, unknown>);
  }

  @Patch(":id")
  @Roles("MEMBER")
  patch(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateIssueDto,
  ): Promise<Record<string, unknown>> {
    return this.issues.update(slug, pid, id, user.id, dto as Record<string, unknown>);
  }

  @Delete(":id")
  @Roles("MEMBER")
  remove(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ detail: string }> {
    return this.issues.remove(slug, pid, id, user.id);
  }

  @Post(":id/archive")
  @Roles("MEMBER")
  archive(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.issues.setArchived(slug, pid, id, user.id, true);
  }

  @Post(":id/unarchive")
  @Roles("MEMBER")
  unarchive(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.issues.setArchived(slug, pid, id, user.id, false);
  }

  // --- sub-issues ---

  @Get(":id/sub-issues")
  @Roles("GUEST")
  subIssues(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>[]> {
    return this.issues.listSubIssues(slug, pid, id);
  }

  @Post(":id/sub-issues")
  @Roles("MEMBER")
  createSubIssue(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateIssueDto,
  ): Promise<Record<string, unknown>> {
    return this.issues.create(slug, pid, user.id, { ...dto, parent_id: id });
  }

  // --- relations ---

  @Get(":id/issue-relation")
  @Roles("GUEST")
  relations(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>[]> {
    return this.issues.listRelations(slug, pid, id);
  }

  @Post(":id/issue-relation")
  @Roles("MEMBER")
  createRelation(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RelationDto,
  ): Promise<Record<string, unknown>> {
    return this.issues.createRelation(slug, pid, id, user.id, dto.related_issue, dto.relation_type ?? "blocked_by");
  }

  @Delete(":id/issue-relation/:relId")
  @Roles("MEMBER")
  deleteRelation(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @Param("relId") relId: string,
  ): Promise<{ detail: string }> {
    return this.issues.deleteRelation(slug, pid, id, relId);
  }

  // --- subscriptions ---

  @Get(":id/subscribe")
  @Roles("GUEST")
  subStatus(
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ subscribed: boolean }> {
    void pid;
    return this.issues.subscriptionStatus(id, user.id);
  }

  @Post(":id/subscribe")
  @Roles("GUEST")
  subscribe(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ subscribed: boolean }> {
    return this.issues.setSubscription(slug, pid, id, user.id, true);
  }

  @Delete(":id/subscribe")
  @Roles("GUEST")
  unsubscribe(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ subscribed: boolean }> {
    return this.issues.setSubscription(slug, pid, id, user.id, false);
  }

  // --- history / meta / versions ---

  @Get(":id/history")
  @Roles("GUEST")
  history(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>[]> {
    return this.issues.history(slug, pid, id);
  }

  @Get(":id/meta")
  @Roles("GUEST")
  meta(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>> {
    return this.issues.meta(slug, pid, id);
  }

  @Get(":id/versions")
  @Roles("GUEST")
  versions(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>[]> {
    return this.issues.versions(slug, pid, id);
  }
}

@Controller()
export class IssueExtraController {
  constructor(
    private readonly issues: IssuesService,
    private readonly list: IssuesListService,
  ) {}

  @Post("api/workspaces/:slug/projects/:pid/issues/list")
  @Roles("GUEST")
  @Level("PROJECT")
  filteredList(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Query() q: ListQuery,
    @Body() body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.list.list(slug, pid, q, body);
  }

  @Get("api/workspaces/:slug/projects/:pid/issues-detail")
  @Roles("GUEST")
  @Level("PROJECT")
  detailList(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Query() q: ListQuery,
  ): Promise<Record<string, unknown>> {
    return this.list.list(slug, pid, q);
  }

  @Get("api/workspaces/:slug/projects/:pid/v2/issues")
  @Roles("GUEST")
  @Level("PROJECT")
  v2List(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Query() q: ListQuery,
  ): Promise<Record<string, unknown>> {
    return this.list.list(slug, pid, q);
  }

  @Get("api/workspaces/:slug/projects/:pid/deleted-issues")
  @Roles("MEMBER")
  @Level("PROJECT")
  deleted(@Param("slug") slug: string, @Param("pid") pid: string): Promise<Record<string, unknown>[]> {
    return this.issues.deletedList(slug, pid);
  }

  @Get("api/workspaces/:slug/projects/:pid/archived-issues")
  @Roles("GUEST")
  @Level("PROJECT")
  archived(@Param("slug") slug: string, @Param("pid") pid: string): Promise<Record<string, unknown>[]> {
    return this.issues.archivedList(slug, pid);
  }

  @Post("api/workspaces/:slug/projects/:pid/bulk-operation-issues")
  @Roles("MEMBER")
  @Level("PROJECT")
  bulkOp(
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { issue_ids: string[]; properties: Record<string, unknown> },
  ): Promise<{ detail: string; updated: number }> {
    return this.list.bulkOperate(pid, user.id, dto.issue_ids ?? [], dto.properties ?? {});
  }

  @Delete("api/workspaces/:slug/projects/:pid/bulk-delete-issues")
  @Roles("MEMBER")
  @Level("PROJECT")
  bulkDelete(
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { issue_ids: string[] },
  ): Promise<{ detail: string }> {
    return this.list.bulkDelete(pid, user.id, dto?.issue_ids ?? []);
  }

  @Post("api/workspaces/:slug/projects/:pid/bulk-archive-issues")
  @Roles("MEMBER")
  @Level("PROJECT")
  bulkArchive(
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { issue_ids: string[]; archive?: boolean },
  ): Promise<{ detail: string }> {
    return this.list.bulkArchive(pid, user.id, dto?.issue_ids ?? [], dto?.archive !== false);
  }

  @Post("api/workspaces/:slug/projects/:pid/bulk-subscribe-issues")
  @Roles("GUEST")
  @Level("PROJECT")
  bulkSubscribe(
    @CurrentUser() user: RequestUser,
    @Body() dto: { issue_ids: string[]; subscribe?: boolean },
  ): Promise<{ detail: string }> {
    return this.list.bulkSubscribe(dto?.issue_ids ?? [], user.id, dto?.subscribe !== false);
  }

  @Get("api/workspaces/:slug/work-items/:key")
  @Roles("GUEST")
  @Level("WORKSPACE")
  byIdentifier(
    @Param("slug") slug: string,
    @Param("key") key: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.issues.byIdentifier(slug, key, user.id);
  }
}
