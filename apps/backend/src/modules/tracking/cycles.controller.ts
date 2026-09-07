import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { AddCycleIssuesDto, CreateCycleDto, DateCheckDto, TransferIssuesDto, UpdateCycleDto } from "./dto/cycles.dto";
import { CyclesService } from "./cycles.service";

@Controller("api/workspaces/:slug/projects/:pid/cycles")
@Level("PROJECT")
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @Param("pid") pid: string, @CurrentUser() user: RequestUser) {
    return this.cycles.list(slug, pid, user.id);
  }

  @Post()
  @Roles("MEMBER")
  create(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCycleDto,
  ) {
    return this.cycles.create(slug, pid, user.id, dto);
  }

  @Post("date-check")
  @Roles("GUEST")
  dateCheck(@Param("slug") slug: string, @Param("pid") pid: string, @Body() dto: DateCheckDto) {
    return this.cycles.dateCheck(slug, pid, dto);
  }

  @Get(":cid")
  @Roles("GUEST")
  retrieve(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cycles.retrieve(slug, pid, cid, user.id);
  }

  @Put(":cid")
  @Roles("MEMBER")
  put(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateCycleDto,
  ) {
    return this.cycles.update(slug, pid, cid, user.id, dto);
  }

  @Patch(":cid")
  @Roles("MEMBER")
  patch(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateCycleDto,
  ) {
    return this.cycles.update(slug, pid, cid, user.id, dto);
  }

  @Delete(":cid")
  @Roles("ADMIN")
  remove(@Param("slug") slug: string, @Param("pid") pid: string, @Param("cid") cid: string) {
    return this.cycles.remove(slug, pid, cid);
  }

  @Post(":cid/archive")
  @Roles("MEMBER")
  archive(@Param("slug") slug: string, @Param("pid") pid: string, @Param("cid") cid: string) {
    return this.cycles.setArchived(slug, pid, cid, true);
  }

  @Get(":cid/cycle-issues")
  @Roles("GUEST")
  cycleIssues(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @Query() _q: Record<string, string>,
  ) {
    return this.cycles.cycleIssues(slug, pid, cid);
  }

  @Post(":cid/cycle-issues")
  @Roles("MEMBER")
  addIssues(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @Body() dto: AddCycleIssuesDto,
  ) {
    return this.cycles.addIssues(slug, pid, cid, dto.issues ?? []);
  }

  @Delete(":cid/cycle-issues/:bridgeId")
  @Roles("MEMBER")
  removeIssue(@Param("slug") slug: string, @Param("pid") pid: string, @Param("cid") cid: string, @Param("bridgeId") bridgeId: string) {
    return this.cycles.removeIssue(slug, pid, cid, bridgeId);
  }

  @Get(":cid/progress")
  @Roles("GUEST")
  progress(@Param("slug") slug: string, @Param("pid") pid: string, @Param("cid") cid: string) {
    return this.cycles.retrieveProgress(slug, pid, cid);
  }

  @Get(":cid/cycle-progress")
  @Roles("GUEST")
  cycleProgress(@Param("slug") slug: string, @Param("pid") pid: string, @Param("cid") cid: string) {
    return this.cycles.retrieveProgress(slug, pid, cid);
  }

  @Post(":cid/transfer-issues")
  @Roles("MEMBER")
  transfer(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @Body() dto: TransferIssuesDto,
  ) {
    return this.cycles.transfer(slug, pid, cid, dto.new_cycle_id);
  }
}

@Controller()
export class CycleMiscController {
  constructor(private readonly cycles: CyclesService) {}

  @Get("api/workspaces/:slug/projects/:pid/archived-cycles")
  @Roles("GUEST")
  @Level("PROJECT")
  archived(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cycles.list(slug, pid, user.id, true);
  }

  @Post("api/workspaces/:slug/projects/:pid/archived-cycles/:cid/restore")
  @Roles("MEMBER")
  @Level("PROJECT")
  restore(@Param("slug") slug: string, @Param("pid") pid: string, @Param("cid") cid: string) {
    return this.cycles.setArchived(slug, pid, cid, false);
  }

  @Get("api/workspaces/:slug/active-cycles")
  @Roles("GUEST")
  @Level("WORKSPACE")
  active(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.cycles.workspaceCycles(slug, user.id, true);
  }

  @Post("api/workspaces/:slug/projects/:pid/user-favorite-cycles")
  @Roles("GUEST")
  @Level("PROJECT")
  favorite(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { cycle_id: string },
  ) {
    return this.cycles.favorite(slug, user.id, dto.cycle_id);
  }

  @Delete("api/workspaces/:slug/projects/:pid/user-favorite-cycles/:cid")
  @Roles("GUEST")
  @Level("PROJECT")
  unfavorite(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("cid") cid: string) {
    return this.cycles.unfavorite(slug, user.id, cid);
  }

  @Get("api/workspaces/:slug/cycles")
  @Roles("GUEST")
  @Level("WORKSPACE")
  all(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.cycles.workspaceCycles(slug, user.id, false);
  }
}
