import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { ListQuery } from "../issues/issues-list.service";
import { CreateViewDto, UpdateViewDto } from "./dto/views.dto";
import { ViewsService } from "./views.service";

@Controller("api/workspaces/:slug/projects/:pid/views")
@Level("PROJECT")
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @Param("pid") pid: string) {
    return this.views.list(slug, pid);
  }

  @Post()
  @Roles("MEMBER")
  create(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateViewDto,
  ) {
    return this.views.create(slug, user.id, pid, dto);
  }

  @Get(":vid")
  @Roles("GUEST")
  retrieve(@Param("slug") slug: string, @Param("pid") pid: string, @Param("vid") vid: string) {
    return this.views.retrieve(slug, vid, pid);
  }

  @Patch(":vid")
  @Roles("MEMBER")
  update(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("vid") vid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateViewDto,
  ) {
    return this.views.update(slug, vid, user.id, pid, dto);
  }

  @Delete(":vid")
  @Roles("MEMBER")
  remove(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("vid") vid: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.views.remove(slug, vid, user.id, pid);
  }

  @Get(":vid/issues")
  @Roles("GUEST")
  viewIssues(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("vid") vid: string,
    @Query() q: ListQuery,
  ) {
    return this.views.viewIssues(slug, pid, vid, q);
  }
}

@Controller()
export class ViewFavoriteController {
  constructor(private readonly views: ViewsService) {}

  @Post("api/workspaces/:slug/projects/:pid/user-favorite-views")
  @Roles("GUEST")
  @Level("PROJECT")
  favorite(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { view_id: string },
  ) {
    return this.views.favorite(slug, user.id, dto.view_id);
  }

  @Delete("api/workspaces/:slug/projects/:pid/user-favorite-views/:vid")
  @Roles("GUEST")
  @Level("PROJECT")
  unfavorite(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("vid") vid: string) {
    return this.views.unfavorite(slug, user.id, vid);
  }
}

@Controller()
export class WorkspaceViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get("api/workspaces/:slug/views")
  @Roles("GUEST")
  @Level("WORKSPACE")
  list(@Param("slug") slug: string) {
    return this.views.list(slug);
  }

  @Post("api/workspaces/:slug/views")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  create(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Body() dto: CreateViewDto) {
    return this.views.create(slug, user.id, dto.project, dto);
  }

  @Patch("api/workspaces/:slug/views/:vid")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  update(
    @Param("slug") slug: string,
    @Param("vid") vid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateViewDto,
  ) {
    return this.views.update(slug, vid, user.id, undefined, dto);
  }

  @Delete("api/workspaces/:slug/views/:vid")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  remove(@Param("slug") slug: string, @Param("vid") vid: string, @CurrentUser() user: RequestUser) {
    return this.views.remove(slug, vid, user.id);
  }

  @Post("api/workspaces/:slug/workspace-views")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  createAlias(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Body() dto: CreateViewDto) {
    return this.views.create(slug, user.id, dto.project, dto);
  }

  @Get("api/workspaces/:slug/search")
  @Roles("GUEST")
  @Level("WORKSPACE")
  search(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Query("search") search: string,
    @Query("project_id") projectId?: string,
  ) {
    return this.views.search(slug, user.id, search ?? "", projectId);
  }
}
