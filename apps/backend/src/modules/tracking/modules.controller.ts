import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { AddModuleIssuesDto, CreateModuleDto, IssueModulesDto, UpdateModuleDto } from "./dto/modules.dto";
import { ModulesService } from "./modules.service";

@Controller("api/workspaces/:slug/projects/:pid/modules")
@Level("PROJECT")
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @Param("pid") pid: string, @CurrentUser() user: RequestUser) {
    return this.modules.list(slug, pid, user.id);
  }

  @Post()
  @Roles("MEMBER")
  create(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateModuleDto,
  ) {
    return this.modules.create(slug, pid, user.id, dto);
  }

  @Get(":mid")
  @Roles("GUEST")
  retrieve(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("mid") mid: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.modules.retrieve(slug, pid, mid, user.id);
  }

  @Put(":mid")
  @Roles("MEMBER")
  put(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("mid") mid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.modules.update(slug, pid, mid, user.id, dto);
  }

  @Patch(":mid")
  @Roles("MEMBER")
  patch(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("mid") mid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.modules.update(slug, pid, mid, user.id, dto);
  }

  @Delete(":mid")
  @Roles("ADMIN")
  remove(@Param("slug") slug: string, @Param("pid") pid: string, @Param("mid") mid: string) {
    return this.modules.remove(slug, pid, mid);
  }

  @Post(":mid/archive")
  @Roles("MEMBER")
  archive(@Param("slug") slug: string, @Param("pid") pid: string, @Param("mid") mid: string) {
    return this.modules.setArchived(slug, pid, mid, true);
  }

  @Get(":mid/issues")
  @Roles("GUEST")
  moduleIssues(@Param("slug") slug: string, @Param("pid") pid: string, @Param("mid") mid: string) {
    return this.modules.moduleIssues(slug, pid, mid);
  }

  @Post(":mid/issues")
  @Roles("MEMBER")
  addIssues(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("mid") mid: string,
    @Body() dto: AddModuleIssuesDto,
  ) {
    return this.modules.addIssues(slug, pid, mid, dto.issues ?? []);
  }

  @Delete(":mid/issues/:iid")
  @Roles("MEMBER")
  removeIssue(@Param("slug") slug: string, @Param("pid") pid: string, @Param("mid") mid: string, @Param("iid") iid: string) {
    return this.modules.removeIssue(slug, pid, mid, iid);
  }

  @Get(":mid/module-links")
  @Roles("GUEST")
  links(@Param("slug") slug: string, @Param("pid") pid: string, @Param("mid") mid: string) {
    return this.modules.listLinks(slug, pid, mid);
  }

  @Post(":mid/module-links")
  @Roles("MEMBER")
  createLink(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("mid") mid: string,
    @Body() dto: { title?: string; url: string },
  ) {
    return this.modules.createLink(slug, pid, mid, dto);
  }

  @Delete(":mid/module-links/:lid")
  @Roles("MEMBER")
  deleteLink(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("mid") mid: string,
    @Param("lid") lid: string,
  ) {
    return this.modules.deleteLink(slug, pid, mid, lid);
  }
}

@Controller()
export class ModuleMiscController {
  constructor(private readonly modules: ModulesService) {}

  @Get("api/workspaces/:slug/projects/:pid/archived-modules")
  @Roles("GUEST")
  @Level("PROJECT")
  archived(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.modules.list(slug, pid, user.id, true);
  }

  @Post("api/workspaces/:slug/projects/:pid/archived-modules/:mid/restore")
  @Roles("MEMBER")
  @Level("PROJECT")
  restore(@Param("slug") slug: string, @Param("pid") pid: string, @Param("mid") mid: string) {
    return this.modules.setArchived(slug, pid, mid, false);
  }

  @Get("api/workspaces/:slug/projects/:pid/issues/:iid/modules")
  @Roles("GUEST")
  @Level("PROJECT")
  issueModules(@Param("slug") slug: string, @Param("pid") pid: string, @Param("iid") iid: string) {
    return this.modules.issueModules(slug, pid, iid);
  }

  @Post("api/workspaces/:slug/projects/:pid/issues/:iid/modules")
  @Roles("MEMBER")
  @Level("PROJECT")
  setIssueModules(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Body() dto: IssueModulesDto,
  ) {
    return this.modules.setIssueModules(slug, pid, iid, dto.modules ?? [], dto.removed_modules ?? []);
  }

  @Post("api/workspaces/:slug/projects/:pid/user-favorite-modules")
  @Roles("GUEST")
  @Level("PROJECT")
  favorite(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { module_id: string },
  ) {
    return this.modules.favorite(slug, user.id, dto.module_id);
  }

  @Delete("api/workspaces/:slug/projects/:pid/user-favorite-modules/:mid")
  @Roles("GUEST")
  @Level("PROJECT")
  unfavorite(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("mid") mid: string) {
    return this.modules.unfavorite(slug, user.id, mid);
  }

  @Get("api/workspaces/:slug/modules")
  @Roles("GUEST")
  @Level("WORKSPACE")
  all(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.modules.workspaceModules(slug, user.id);
  }
}
