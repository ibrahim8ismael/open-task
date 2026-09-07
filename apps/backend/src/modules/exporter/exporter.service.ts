import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { join } from "node:path";
import type { Response } from "express";
import ExcelJS from "exceljs";
import { PrismaService } from "../../common/prisma/prisma.service";
import { exportDir } from "./export-dir";

export const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const COLUMNS = [
  "key",
  "name",
  "state",
  "state_group",
  "priority",
  "assignees",
  "labels",
  "type",
  "estimate",
  "start_date",
  "target_date",
  "created_at",
  "updated_at",
] as const;

type Row = Record<(typeof COLUMNS)[number], string>;

function escCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

@Injectable()
export class ExporterService {
  constructor(private readonly prisma: PrismaService) {}

  apiBase(): string {
    return (process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8000}`).replace(/\/+$/, "");
  }

  async collect(workspaceId: string, projectIds: string[]): Promise<Row[]> {
    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds }, workspaceId, deletedAt: null },
    });
    const byId = new Map(projects.map((p) => [p.id, p]));
    const issues = await this.prisma.issue.findMany({
      where: { projectId: { in: [...byId.keys()] }, deletedAt: null },
      orderBy: [{ projectId: "asc" }, { sequenceId: "asc" }],
    });
    const stateIds = [...new Set(issues.map((i) => i.stateId).filter((v): v is string => !!v))];
    const [states, assignees, labels, users, allLabels, points] = await Promise.all([
      this.prisma.state.findMany({ where: { id: { in: stateIds } } }),
      this.prisma.issueAssignee.findMany({ where: { issueId: { in: issues.map((i) => i.id) } } }),
      this.prisma.issueLabel.findMany({ where: { issueId: { in: issues.map((i) => i.id) } } }),
      this.prisma.user.findMany({}),
      this.prisma.label.findMany({ where: { workspaceId } }),
      this.prisma.estimatePoint.findMany({ where: { workspaceId } }),
    ]);
    const stateById = new Map(states.map((s) => [s.id, s]));
    const emailById = new Map(users.map((u) => [u.id, u.email ?? u.displayName]));
    const labelById = new Map(allLabels.map((l) => [l.id, l.name]));
    const pointById = new Map(points.map((p) => [p.id, p.value]));
    const assigneeMap = new Map<string, string[]>();
    for (const a of assignees) {
      const arr = assigneeMap.get(a.issueId) ?? [];
      arr.push(emailById.get(a.assigneeId) ?? a.assigneeId);
      assigneeMap.set(a.issueId, arr);
    }
    const labelMap = new Map<string, string[]>();
    for (const l of labels) {
      const arr = labelMap.get(l.issueId) ?? [];
      arr.push(labelById.get(l.labelId) ?? l.labelId);
      labelMap.set(l.issueId, arr);
    }
    return issues.map((i) => {
      const st = i.stateId ? stateById.get(i.stateId) : undefined;
      const proj = byId.get(i.projectId);
      return {
        key: `${proj?.identifier ?? ""}-${i.sequenceId}`,
        name: i.name,
        state: st?.name ?? "",
        state_group: st?.group ?? "",
        priority: i.priority,
        assignees: (assigneeMap.get(i.id) ?? []).join(", "),
        labels: (labelMap.get(i.id) ?? []).join(", "),
        type: i.typeId ?? "",
        estimate: (i.estimatePointId && pointById.get(i.estimatePointId)) || "",
        start_date: i.startDate?.toISOString().slice(0, 10) ?? "",
        target_date: i.targetDate?.toISOString().slice(0, 10) ?? "",
        created_at: i.createdAt.toISOString(),
        updated_at: i.updatedAt.toISOString(),
      };
    });
  }

  private toCsv(rows: Row[]): string {
    return [[...COLUMNS].join(","), ...rows.map((r) => COLUMNS.map((c) => escCsv(r[c] ?? "")).join(","))].join("\n");
  }

  private async toXlsx(rows: Row[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("issues");
    ws.columns = COLUMNS.map((c) => ({ header: c, key: c, width: 22 }));
    for (const r of rows) ws.addRow({ ...r });
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** Build the export synchronously (internal scale) and return a 7-day token URL. */
  async export(
    workspaceSlug: string,
    userId: string,
    dto: { provider: string; project: string[] },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    if (!["csv", "xlsx", "json"].includes(dto.provider)) throw new ForbiddenException({ detail: "Unknown provider." });
    const projects = await this.prisma.project.findMany({
      where: { id: { in: dto.project ?? [] }, workspaceId: ws.id, deletedAt: null },
    });
    if (!projects.length) throw new ForbiddenException({ detail: "No valid projects selected." });
    const rows = await this.collect(ws.id, projects.map((p) => p.id));
    const token = randomUUID().replace(/-/g, "");
    const ext = dto.provider === "json" ? "json" : dto.provider;
    const dir = exportDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = join(dir, `${token}.${ext}`);
    if (dto.provider === "json") {
      await fs.writeFile(filePath, JSON.stringify(rows, null, 2));
    } else if (dto.provider === "xlsx") {
      await fs.writeFile(filePath, await this.toXlsx(rows));
    } else {
      await fs.writeFile(filePath, this.toCsv(rows));
    }
    await this.prisma.exporterHistory.create({
      data: {
        workspaceId: ws.id,
        projectIds: projects.map((p) => p.id),
        initiatedById: userId,
        provider: dto.provider,
        token,
        filePath,
      },
    });
    return {
      token,
      url: `${this.apiBase()}/api/exports/${token}/download/`,
      expires_at: new Date(Date.now() + EXPORT_TTL_MS).toISOString(),
      count: rows.length,
    };
  }

  async history(workspaceSlug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    const rows = await this.prisma.exporterHistory.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ({
      token: r.token,
      provider: r.provider,
      project_ids: r.projectIds,
      created_at: r.createdAt,
      url: `${this.apiBase()}/api/exports/${r.token}/download/`,
    }));
  }

  async download(token: string, res: Response): Promise<void> {
    const row = await this.prisma.exporterHistory.findUnique({ where: { token } });
    if (!row || !row.filePath) {
      res.status(404).json({ detail: "Export not found." });
      return;
    }
    if (row.createdAt.getTime() + EXPORT_TTL_MS <= Date.now()) {
      res.status(410).json({ detail: "Export expired." });
      return;
    }
    if (!existsSync(row.filePath)) {
      res.status(404).json({ detail: "Export file missing." });
      return;
    }
    res.download(row.filePath);
  }

  /** Delete expired export files + rows. Returns removed count. */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - EXPORT_TTL_MS);
    const rows = await this.prisma.exporterHistory.findMany({ where: { createdAt: { lt: cutoff } } });
    await Promise.all(
      rows.map(async (r) => {
        if (r.filePath && existsSync(r.filePath)) await fs.unlink(r.filePath).catch(() => undefined);
        await this.prisma.exporterHistory.delete({ where: { id: r.id } });
      }),
    );
    return rows.length;
  }
}
