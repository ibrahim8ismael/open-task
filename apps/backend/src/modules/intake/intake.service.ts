import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IssuesService } from "../issues/issues.service";

/** Web EInboxIssueStatus values. */
export const INBOX_PENDING = -2;
export const INBOX_DECLINED = -1;
export const INBOX_SNOOZED = 0;
export const INBOX_ACCEPTED = 1;
export const INBOX_DUPLICATE = 2;

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
  ) {}

  async workspaceOrThrow(slug: string): Promise<{ id: string }> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    return ws;
  }

  async projectOrThrow(workspaceId: string, projectId: string): Promise<{ id: string }> {
    const p = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } });
    if (!p) throw new NotFoundException({ detail: "Project not found." });
    return p;
  }

  /** Default intake container per project (auto-created). */
  async defaultIntake(workspaceId: string, projectId: string): Promise<{ id: string }> {
    const existing = await this.prisma.intake.findFirst({ where: { projectId, deletedAt: null } });
    if (existing) return existing;
    return this.prisma.intake.create({ data: { projectId, workspaceId, name: "Incoming", isDefault: true } });
  }

  async triageStateId(projectId: string): Promise<string | null> {
    const st = await this.prisma.state.findFirst({ where: { projectId, isTriage: true, deletedAt: null } });
    return st?.id ?? null;
  }

  async serialize(row: {
    id: string;
    status: number;
    snoozedTill: Date | null;
    duplicateToId: string | null;
    source: string | null;
    issueId: string;
    projectId: string;
    workspaceId: string;
  }, userId: string): Promise<Record<string, unknown>> {
    const issue = await this.issues.retrieve(
      (await this.prisma.workspace.findUniqueOrThrow({ where: { id: row.workspaceId } })).slug,
      row.projectId,
      row.issueId,
      userId,
    ).catch(() => null);
    const creator = await this.prisma.issue.findFirst({ where: { id: row.issueId } });
    return {
      id: row.id,
      status: row.status,
      snoozed_till: row.snoozedTill,
      duplicate_to: row.duplicateToId,
      source: row.source,
      issue,
      created_by: creator?.createdBy ?? null,
      duplicate_issue_detail: undefined,
    };
  }

  // --- intake containers ---

  async listIntakes(slug: string, pid: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const rows = await this.prisma.intake.findMany({ where: { projectId: pid, deletedAt: null } });
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, is_default: r.isDefault }));
  }

  async createIntake(slug: string, pid: string, name: string, description?: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    if (!name?.trim()) throw new ForbiddenException({ detail: "Name is required." });
    const row = await this.prisma.intake
      .create({ data: { projectId: pid, workspaceId: ws.id, name: name.trim(), description: description ?? "" } })
      .catch(() => {
        throw new ForbiddenException({ detail: "Intake name already exists." });
      });
    return { id: row.id, name: row.name, description: row.description, is_default: row.isDefault };
  }

  // --- inbox issues (triage queue) ---

  async list(slug: string, pid: string, userId: string, q: Record<string, string | undefined>): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const where: Record<string, unknown> = { projectId: pid, workspaceId: ws.id };
    if (q.status !== undefined) {
      const statuses = String(q.status)
        .split(",")
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      if (statuses.length) where.status = { in: statuses };
    } else {
      // Default triage view: pending + snoozed-due (snoozed hidden until due)
      where.OR = [{ status: INBOX_PENDING }, { status: INBOX_SNOOZED, snoozedTill: { lte: new Date() } }];
    }
    const perPage = Math.min(Math.max(Number(q.per_page ?? 50) || 50, 1), 200);
    const total = await this.prisma.intakeIssue.count({ where: where as never });
    const rows = await this.prisma.intakeIssue.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: perPage,
    });
    const results = await Promise.all(rows.map((r) => this.serialize(r, userId)));
    return { results, count: results.length, total_results: total, next_cursor: "", prev_cursor: "" };
  }

  async retrieve(slug: string, pid: string, iid: string, userId: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.intakeIssue.findFirst({ where: { id: iid, projectId: pid } });
    if (!row) throw new NotFoundException({ detail: "Inbox issue not found." });
    return this.serialize(row, userId);
  }

  async create(
    slug: string,
    pid: string,
    userId: string,
    dto: { source?: string; issue: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const payload = dto.issue ?? {};
    if (!payload.name) throw new ForbiddenException({ detail: "Issue name is required." });
    const triage = await this.triageStateId(pid);
    const created = await this.issues.create(slug, pid, userId, {
      ...(payload as { name: string }),
      ...(triage ? { state_id: triage } : {}),
    });
    const intake = await this.defaultIntake(ws.id, pid);
    const row = await this.prisma.intakeIssue.create({
      data: {
        projectId: pid,
        workspaceId: ws.id,
        intakeId: intake.id,
        issueId: String((created as { id: string }).id),
        status: INBOX_PENDING,
        source: dto.source ?? "IN_APP",
      },
    });
    return this.serialize(row, userId);
  }

  async update(
    slug: string,
    pid: string,
    iid: string,
    userId: string,
    dto: { status?: number; snoozed_till?: string | null; duplicate_to?: string | null; issue?: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.intakeIssue.findFirst({ where: { id: iid, projectId: pid } });
    if (!row) throw new NotFoundException({ detail: "Inbox issue not found." });

    if (dto.issue) {
      await this.issues.update(slug, pid, row.issueId, userId, dto.issue);
    }
    if (dto.status !== undefined) {
      const status = Number(dto.status);
      if (![INBOX_PENDING, INBOX_DECLINED, INBOX_SNOOZED, INBOX_ACCEPTED, INBOX_DUPLICATE].includes(status))
        throw new ForbiddenException({ detail: "Invalid status." });
      if (status === INBOX_ACCEPTED) {
        // Accept: move underlying issue out of triage into the default state
        const def = await this.issues.defaultStateId(pid);
        await this.issues.update(slug, pid, row.issueId, userId, { state_id: def });
      }
      await this.prisma.intakeIssue.update({
        where: { id: row.id },
        data: {
          status,
          ...(dto.snoozed_till !== undefined
            ? { snoozedTill: dto.snoozed_till ? new Date(dto.snoozed_till) : null }
            : {}),
          ...(dto.duplicate_to !== undefined ? { duplicateToId: dto.duplicate_to } : {}),
        },
      });
    } else {
      const data: Record<string, unknown> = {};
      if (dto.snoozed_till !== undefined) data.snoozedTill = dto.snoozed_till ? new Date(dto.snoozed_till) : null;
      if (dto.duplicate_to !== undefined) data.duplicateToId = dto.duplicate_to;
      if (Object.keys(data).length) await this.prisma.intakeIssue.update({ where: { id: row.id }, data: data as never });
    }
    const updated = await this.prisma.intakeIssue.findUniqueOrThrow({ where: { id: row.id } });
    return this.serialize(updated, userId);
  }

  async remove(slug: string, pid: string, iid: string, userId: string): Promise<void> {
    const ws = await this.workspaceOrThrow(slug);
    await this.projectOrThrow(ws.id, pid);
    const row = await this.prisma.intakeIssue.findFirst({ where: { id: iid, projectId: pid } });
    if (!row) throw new NotFoundException({ detail: "Inbox issue not found." });
    await this.prisma.$transaction([
      this.prisma.intakeIssue.delete({ where: { id: row.id } }),
      this.prisma.issue.updateMany({
        where: { id: row.issueId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: userId },
      }),
    ]);
  }
}
