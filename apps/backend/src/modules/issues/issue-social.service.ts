import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { IssuesService } from "./issues.service";

function serializeComment(c: {
  id: string;
  issueId: string;
  projectId: string;
  workspaceId: string;
  actorId: string | null;
  commentJson: unknown;
  commentHtml: string;
  commentStripped: string;
  access: string;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: c.id,
    issue: c.issueId,
    project: c.projectId,
    workspace: c.workspaceId,
    actor: c.actorId,
    comment_json: c.commentJson,
    comment_html: c.commentHtml,
    comment_stripped: c.commentStripped,
    access: c.access,
    edited_at: c.editedAt,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

@Injectable()
export class IssueSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
    private readonly webhooks: WebhooksService,
  ) {}

  // --- comments ---

  async listComments(slug: string, pid: string, iid: string): Promise<Record<string, unknown>[]> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const rows = await this.prisma.issueComment.findMany({
      where: { issueId: issue.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serializeComment);
  }

  async createComment(
    slug: string,
    pid: string,
    iid: string,
    userId: string,
    dto: { comment_json?: unknown; comment_html?: string; comment_stripped?: string; access?: string },
  ): Promise<Record<string, unknown>> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const row = await this.prisma.issueComment.create({
      data: {
        projectId: issue.projectId,
        workspaceId: issue.workspaceId,
        issueId: issue.id,
        actorId: userId,
        commentJson: (dto.comment_json as object) ?? {},
        commentHtml: dto.comment_html ?? "<p></p>",
        commentStripped: dto.comment_stripped ?? "",
        access: dto.access ?? "INTERNAL",
      },
    });
    await this.issues.logActivity(issue.id, userId, "commented");
    this.webhooks.fire(issue.workspaceId, "issue.commented", { id: issue.id, workspace: issue.workspaceId, project: issue.projectId, comment: row.id });
    return serializeComment(row);
  }

  async updateComment(
    slug: string,
    pid: string,
    iid: string,
    cid: string,
    userId: string,
    dto: { comment_json?: unknown; comment_html?: string; comment_stripped?: string },
  ): Promise<Record<string, unknown>> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const row = await this.prisma.issueComment.findFirst({ where: { id: cid, issueId: issue.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Comment not found." });
    if (row.actorId && row.actorId !== userId) throw new ForbiddenException({ detail: "Cannot edit this comment." });
    const updated = await this.prisma.issueComment.update({
      where: { id: row.id },
      data: {
        ...(dto.comment_json !== undefined ? { commentJson: dto.comment_json as object } : {}),
        ...(dto.comment_html !== undefined ? { commentHtml: dto.comment_html } : {}),
        ...(dto.comment_stripped !== undefined ? { commentStripped: dto.comment_stripped } : {}),
        editedAt: new Date(),
      },
    });
    return serializeComment(updated);
  }

  async deleteComment(slug: string, pid: string, iid: string, cid: string, userId: string): Promise<void> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const row = await this.prisma.issueComment.findFirst({ where: { id: cid, issueId: issue.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Comment not found." });
    if (row.actorId && row.actorId !== userId) throw new ForbiddenException({ detail: "Cannot delete this comment." });
    await this.prisma.issueComment.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
  }

  // --- issue reactions ---

  async listIssueReactions(slug: string, pid: string, iid: string): Promise<Record<string, unknown>[]> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const rows = await this.prisma.issueReaction.findMany({ where: { issueId: issue.id } });
    return rows.map((r) => ({ actor: r.actorId, reaction: r.reaction, issue: r.issueId }));
  }

  async addIssueReaction(slug: string, pid: string, iid: string, userId: string, reaction: string): Promise<Record<string, unknown>> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    await this.prisma.issueReaction.upsert({
      where: { issueId_actorId_reaction: { issueId: issue.id, actorId: userId, reaction } },
      create: { issueId: issue.id, actorId: userId, reaction },
      update: {},
    });
    return { actor: userId, reaction, issue: issue.id };
  }

  async removeIssueReaction(slug: string, pid: string, iid: string, userId: string, reaction: string): Promise<void> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    await this.prisma.issueReaction.deleteMany({ where: { issueId: issue.id, actorId: userId, reaction } });
  }

  // --- comment reactions (project-level paths) ---

  private async commentOrThrow(projectId: string, cid: string): Promise<{ id: string }> {
    const row = await this.prisma.issueComment.findFirst({ where: { id: cid, projectId, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Comment not found." });
    return row;
  }

  async listCommentReactions(pid: string, cid: string): Promise<Record<string, unknown>[]> {
    const row = await this.commentOrThrow(pid, cid);
    const rows = await this.prisma.commentReaction.findMany({ where: { commentId: row.id } });
    return rows.map((r) => ({ actor: r.actorId, reaction: r.reaction, comment: r.commentId }));
  }

  async addCommentReaction(pid: string, cid: string, userId: string, reaction: string): Promise<Record<string, unknown>> {
    const row = await this.commentOrThrow(pid, cid);
    await this.prisma.commentReaction.upsert({
      where: { commentId_actorId_reaction: { commentId: row.id, actorId: userId, reaction } },
      create: { commentId: row.id, actorId: userId, reaction },
      update: {},
    });
    return { actor: userId, reaction, comment: row.id };
  }

  async removeCommentReaction(pid: string, cid: string, userId: string, reaction: string): Promise<void> {
    const row = await this.commentOrThrow(pid, cid);
    await this.prisma.commentReaction.deleteMany({ where: { commentId: row.id, actorId: userId, reaction } });
  }

  // --- links ---

  async listLinks(slug: string, pid: string, iid: string): Promise<Record<string, unknown>[]> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const rows = await this.prisma.issueLink.findMany({ where: { issueId: issue.id } });
    return rows.map((l) => ({ id: l.id, title: l.title, url: l.url, metadata: l.metadata }));
  }

  async createLink(
    slug: string,
    pid: string,
    iid: string,
    dto: { title?: string; url: string; metadata?: unknown },
  ): Promise<Record<string, unknown>> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    if (!dto.url) throw new ForbiddenException({ detail: "URL is required." });
    const row = await this.prisma.issueLink.create({
      data: {
        issueId: issue.id,
        url: dto.url,
        metadata: (dto.metadata as object) ?? {},
        ...(dto.title !== undefined ? { title: dto.title } : {}),
      },
    });
    return { id: row.id, title: row.title, url: row.url, metadata: row.metadata };
  }

  async updateLink(
    slug: string,
    pid: string,
    iid: string,
    lid: string,
    dto: { title?: string; url?: string },
  ): Promise<Record<string, unknown>> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const row = await this.prisma.issueLink.findFirst({ where: { id: lid, issueId: issue.id } });
    if (!row) throw new NotFoundException({ detail: "Link not found." });
    const updated = await this.prisma.issueLink.update({
      where: { id: row.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
      },
    });
    return { id: updated.id, title: updated.title, url: updated.url, metadata: updated.metadata };
  }

  async deleteLink(slug: string, pid: string, iid: string, lid: string): Promise<void> {
    const issue = await this.issues.getVisible(slug, pid, iid);
    const row = await this.prisma.issueLink.findFirst({ where: { id: lid, issueId: issue.id } });
    if (!row) throw new NotFoundException({ detail: "Link not found." });
    await this.prisma.issueLink.delete({ where: { id: row.id } });
  }
}
