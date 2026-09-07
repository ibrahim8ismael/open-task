import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { AccessDto, CreatePageDto, MovePageDto, UpdateDescriptionDto, UpdatePageDto } from "./dto/pages.dto";
import { PagesService } from "./pages.service";

@Controller("api/workspaces/:slug/projects/:pid/pages")
@Level("PROJECT")
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @Param("pid") pid: string, @CurrentUser() user: RequestUser) {
    return this.pages.list(slug, pid, user.id);
  }

  @Post()
  @Roles("MEMBER")
  create(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePageDto,
  ) {
    return this.pages.create(slug, pid, user.id, dto);
  }

  @Get(":pageId")
  @Roles("GUEST")
  retrieve(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.pages.retrieve(slug, pid, pageId, user.id);
  }

  @Patch(":pageId")
  @Roles("MEMBER")
  update(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pages.update(slug, pid, pageId, user.id, dto);
  }

  @Delete(":pageId")
  @Roles("MEMBER")
  remove(@Param("slug") slug: string, @Param("pid") pid: string, @Param("pageId") pageId: string) {
    return this.pages.remove(slug, pid, pageId);
  }

  @Get(":pageId/description")
  @Roles("GUEST")
  description(@Param("slug") slug: string, @Param("pid") pid: string, @Param("pageId") pageId: string) {
    return this.pages.description(slug, pid, pageId);
  }

  @Patch(":pageId/description")
  @Roles("MEMBER")
  updateDescription(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateDescriptionDto,
  ) {
    return this.pages.updateDescription(slug, pid, pageId, user.id, dto);
  }

  @Get(":pageId/versions")
  @Roles("GUEST")
  versions(@Param("slug") slug: string, @Param("pid") pid: string, @Param("pageId") pageId: string) {
    return this.pages.versions(slug, pid, pageId);
  }

  @Get(":pageId/versions/:versionId")
  @Roles("GUEST")
  version(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.pages.version(slug, pid, pageId, versionId);
  }

  @Post(":pageId/versions/:versionId/restore")
  @Roles("MEMBER")
  restoreVersion(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.pages.restoreVersion(slug, pid, pageId, user.id, versionId);
  }

  @Post(":pageId/access")
  @Roles("MEMBER")
  access(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @Body() dto: AccessDto,
  ) {
    return this.pages.setAccess(slug, pid, pageId, dto.access);
  }

  @Post(":pageId/lock")
  @Roles("MEMBER")
  lock(@Param("slug") slug: string, @Param("pid") pid: string, @Param("pageId") pageId: string) {
    return this.pages.setLocked(slug, pid, pageId, true);
  }

  @Delete(":pageId/lock")
  @Roles("MEMBER")
  unlock(@Param("slug") slug: string, @Param("pid") pid: string, @Param("pageId") pageId: string) {
    return this.pages.setLocked(slug, pid, pageId, false);
  }

  @Post(":pageId/archive")
  @Roles("MEMBER")
  archive(@Param("slug") slug: string, @Param("pid") pid: string, @Param("pageId") pageId: string) {
    return this.pages.setArchived(slug, pid, pageId, true);
  }

  @Delete(":pageId/archive")
  @Roles("MEMBER")
  restore(@Param("slug") slug: string, @Param("pid") pid: string, @Param("pageId") pageId: string) {
    return this.pages.setArchived(slug, pid, pageId, false);
  }

  @Post(":pageId/duplicate")
  @Roles("MEMBER")
  duplicate(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.pages.duplicate(slug, pid, pageId, user.id);
  }

  @Post(":pageId/move")
  @Roles("MEMBER")
  move(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @Body() dto: MovePageDto,
  ) {
    return this.pages.move(slug, pid, pageId, dto.new_project_id ?? dto.project_id ?? pid);
  }
}

@Controller()
export class PageMiscController {
  constructor(private readonly pages: PagesService) {}

  @Get("api/workspaces/:slug/projects/:pid/archived-pages")
  @Roles("GUEST")
  @Level("PROJECT")
  archived(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.pages.list(slug, pid, user.id, true);
  }

  @Post("api/workspaces/:slug/projects/:pid/favorite-pages")
  @Roles("GUEST")
  @Level("PROJECT")
  favorite(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { page_id: string },
  ) {
    return this.pages.favorite(slug, pid, dto.page_id, user.id);
  }

  @Delete("api/workspaces/:slug/projects/:pid/favorite-pages/:pageId")
  @Roles("GUEST")
  @Level("PROJECT")
  unfavorite(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("pageId") pageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.pages.unfavorite(slug, pid, pageId, user.id);
  }
}
