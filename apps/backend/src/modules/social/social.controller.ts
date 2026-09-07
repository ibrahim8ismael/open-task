import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { CreateDraftDto, CreateStickyDto, DraftToIssueDto, UpdateDraftDto, UpdateStickyDto } from "./dto/social.dto";
import { SocialService } from "./social.service";

@Controller("api/workspaces/:slug/users/notifications")
@Level("WORKSPACE")
export class NotificationsController {
  constructor(private readonly social: SocialService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.social.notifications(slug, user.id);
  }

  @Get("unread")
  @Roles("GUEST")
  unread(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.social.unreadCount(slug, user.id);
  }

  @Post("mark-all-read")
  @Roles("GUEST")
  markAllRead(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.social.markAllRead(slug, user.id);
  }

  @Post(":nid/read")
  @Roles("GUEST")
  read(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("nid") nid: string) {
    return this.social.markRead(slug, user.id, nid);
  }

  @Post(":nid/archive")
  @Roles("GUEST")
  archive(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("nid") nid: string) {
    return this.social.archive(slug, user.id, nid);
  }

  @Delete(":nid")
  @Roles("GUEST")
  async remove(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("nid") nid: string): Promise<void> {
    await this.social.archive(slug, user.id, nid);
  }
}

@Controller("api/workspaces/:slug/stickies")
@Level("WORKSPACE")
export class StickiesController {
  constructor(private readonly social: SocialService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.social.stickies(slug, user.id);
  }

  @Post()
  @Roles("MEMBER")
  create(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Body() dto: CreateStickyDto) {
    return this.social.createSticky(slug, user.id, dto);
  }

  @Patch(":sid")
  @Roles("MEMBER")
  update(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("sid") sid: string,
    @Body() dto: UpdateStickyDto,
  ) {
    return this.social.updateSticky(slug, user.id, sid, dto);
  }

  @Delete(":sid")
  @Roles("MEMBER")
  async remove(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("sid") sid: string): Promise<void> {
    return this.social.deleteSticky(slug, user.id, sid);
  }
}

@Controller("api/workspaces/:slug/draft-issues")
@Level("WORKSPACE")
export class DraftsController {
  constructor(private readonly social: SocialService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.social.drafts(slug, user.id);
  }

  @Post()
  @Roles("MEMBER")
  create(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Body() dto: CreateDraftDto) {
    return this.social.createDraft(slug, user.id, dto);
  }

  @Patch(":did")
  @Roles("MEMBER")
  update(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("did") did: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.social.updateDraft(slug, user.id, did, dto);
  }

  @Delete(":did")
  @Roles("MEMBER")
  async remove(@Param("slug") slug: string, @CurrentUser() user: RequestUser, @Param("did") did: string): Promise<void> {
    return this.social.deleteDraft(slug, user.id, did);
  }
}

@Controller()
export class SocialMiscController {
  constructor(private readonly social: SocialService) {}

  @Post("api/workspaces/:slug/draft-to-issue/:did")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  draftToIssue(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Param("did") did: string,
    @Body() dto: DraftToIssueDto,
  ) {
    return this.social.draftToIssue(slug, user.id, did, dto.project_id);
  }

  @Get("api/workspaces/:slug/recent-visits")
  @Roles("GUEST")
  @Level("WORKSPACE")
  recent(@Param("slug") slug: string, @CurrentUser() user: RequestUser) {
    return this.social.recentVisits(slug, user.id);
  }

  @Post("api/workspaces/:slug/recent-visits")
  @Roles("GUEST")
  @Level("WORKSPACE")
  track(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { entity_type: string; entity_identifier?: string; entity_name?: string },
  ) {
    return this.social.trackVisit(slug, user.id, dto);
  }
}
