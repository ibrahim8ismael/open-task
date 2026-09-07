import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { IssueSocialService } from "./issue-social.service";
import { IssuesService } from "./issues.service";

@Controller("api/workspaces/:slug/projects/:pid/issues/:iid")
@Level("PROJECT")
export class IssueSocialController {
  constructor(
    private readonly social: IssueSocialService,
    private readonly issues: IssuesService,
  ) {}

  // --- comments ---

  @Get("comments")
  @Roles("GUEST")
  comments(@Param("slug") slug: string, @Param("pid") pid: string, @Param("iid") iid: string) {
    return this.social.listComments(slug, pid, iid);
  }

  @Post("comments")
  @Roles("MEMBER")
  createComment(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { comment_json?: unknown; comment_html?: string; comment_stripped?: string; access?: string },
  ) {
    return this.social.createComment(slug, pid, iid, user.id, dto);
  }

  @Patch("comments/:cid")
  @Roles("MEMBER")
  updateComment(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Param("cid") cid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { comment_json?: unknown; comment_html?: string; comment_stripped?: string },
  ) {
    return this.social.updateComment(slug, pid, iid, cid, user.id, dto);
  }

  @Delete("comments/:cid")
  @Roles("MEMBER")
  async deleteComment(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Param("cid") cid: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.social.deleteComment(slug, pid, iid, cid, user.id);
  }

  // --- issue reactions ---

  @Get("reactions")
  @Roles("GUEST")
  reactions(@Param("slug") slug: string, @Param("pid") pid: string, @Param("iid") iid: string) {
    return this.social.listIssueReactions(slug, pid, iid);
  }

  @Post("reactions")
  @Roles("GUEST")
  addReaction(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { reaction: string },
  ) {
    return this.social.addIssueReaction(slug, pid, iid, user.id, dto.reaction);
  }

  @Delete("reactions/:reaction")
  @Roles("GUEST")
  async removeReaction(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Param("reaction") reaction: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.social.removeIssueReaction(slug, pid, iid, user.id, reaction);
  }

  // --- links ---

  @Get("issue-links")
  @Roles("GUEST")
  links(@Param("slug") slug: string, @Param("pid") pid: string, @Param("iid") iid: string) {
    return this.social.listLinks(slug, pid, iid);
  }

  @Post("issue-links")
  @Roles("MEMBER")
  createLink(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Body() dto: { title?: string; url: string; metadata?: unknown },
  ) {
    return this.social.createLink(slug, pid, iid, dto);
  }

  @Patch("issue-links/:lid")
  @Roles("MEMBER")
  updateLink(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Param("lid") lid: string,
    @Body() dto: { title?: string; url?: string },
  ) {
    return this.social.updateLink(slug, pid, iid, lid, dto);
  }

  @Delete("issue-links/:lid")
  @Roles("MEMBER")
  async deleteLink(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Param("lid") lid: string,
  ): Promise<void> {
    return this.social.deleteLink(slug, pid, iid, lid);
  }

  // --- remove-relation (pair delete by related issue + type) ---

  @Post("remove-relation")
  @Roles("MEMBER")
  removeRelation(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Body() dto: { related_issue: string; relation_type?: string },
  ): Promise<{ detail: string }> {
    return this.socialRemoveRelation(slug, pid, iid, dto);
  }

  private socialRemoveRelation(
    slug: string,
    pid: string,
    iid: string,
    dto: { related_issue: string; relation_type?: string },
  ): Promise<{ detail: string }> {
    return this.issues.removeRelationPair(slug, pid, iid, dto.related_issue, dto.relation_type);
  }
}

@Controller()
export class CommentReactionController {
  constructor(private readonly social: IssueSocialService) {}

  @Get("api/workspaces/:slug/projects/:pid/comments/:cid/reactions")
  @Roles("GUEST")
  @Level("PROJECT")
  list(@Param("pid") pid: string, @Param("cid") cid: string) {
    return this.social.listCommentReactions(pid, cid);
  }

  @Post("api/workspaces/:slug/projects/:pid/comments/:cid/reactions")
  @Roles("GUEST")
  @Level("PROJECT")
  add(
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { reaction: string },
  ) {
    return this.social.addCommentReaction(pid, cid, user.id, dto.reaction);
  }

  @Delete("api/workspaces/:slug/projects/:pid/comments/:cid/reactions/:reaction")
  @Roles("GUEST")
  @Level("PROJECT")
  async remove(
    @Param("pid") pid: string,
    @Param("cid") cid: string,
    @Param("reaction") reaction: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.social.removeCommentReaction(pid, cid, user.id, reaction);
  }
}
