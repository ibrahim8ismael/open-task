import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { CreateInboxIssueDto, CreateIntakeDto, UpdateInboxIssueDto } from "./dto/intake.dto";
import { IntakeService } from "./intake.service";

@Controller("api/workspaces/:slug/projects/:pid/inbox-issues")
@Level("PROJECT")
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Get()
  @Roles("GUEST")
  list(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Query() q: Record<string, string>,
  ) {
    return this.intake.list(slug, pid, user.id, q);
  }

  @Post()
  @Roles("MEMBER")
  create(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInboxIssueDto,
  ) {
    return this.intake.create(slug, pid, user.id, dto);
  }

  @Get(":iid")
  @Roles("GUEST")
  retrieve(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.intake.retrieve(slug, pid, iid, user.id);
  }

  @Patch(":iid")
  @Roles("MEMBER")
  update(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateInboxIssueDto,
  ) {
    return this.intake.update(slug, pid, iid, user.id, dto);
  }

  @Delete(":iid")
  @Roles("MEMBER")
  async remove(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.intake.remove(slug, pid, iid, user.id);
  }
}

@Controller()
export class IntakeMiscController {
  constructor(private readonly intake: IntakeService) {}

  @Get("api/workspaces/:slug/projects/:pid/intakes")
  @Roles("GUEST")
  @Level("PROJECT")
  list(@Param("slug") slug: string, @Param("pid") pid: string) {
    return this.intake.listIntakes(slug, pid);
  }

  @Post("api/workspaces/:slug/projects/:pid/intakes")
  @Roles("MEMBER")
  @Level("PROJECT")
  create(@Param("slug") slug: string, @Param("pid") pid: string, @Body() dto: CreateIntakeDto) {
    return this.intake.createIntake(slug, pid, dto.name, dto.description);
  }
}
