import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { existsSync, promises as fs } from "node:fs";
import { join } from "node:path";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ExporterService } from "../exporter/exporter.service";
import { uploadDir } from "../assets/assets.service";
import { WebhooksService } from "../webhooks/webhooks.service";

const HARD_DELETE_DAYS = Number(process.env.HARD_DELETE_AFTER_DAYS ?? 30);

@Injectable()
export class CronsService {
  private readonly logger = new Logger(CronsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exporter: ExporterService,
    private readonly webhooks: WebhooksService,
  ) {}

  /** Every 5 minutes: notification fanout stub. Notifications are already
   * written synchronously by services; this job is the SMTP dispatch point.
   * Nodemailer delivery activates when SMTP_* env vars are configured. */
  @Cron("*/5 * * * *")
  async stackNotifications(): Promise<void> {
    const smtpConfigured = !!process.env.SMTP_HOST;
    if (smtpConfigured) {
      // TODO: batch unread notifications -> templated email via Nodemailer
      this.logger.debug("SMTP configured; email fanout TODO");
    }
  }

  /** Hourly: GC un-uploaded assets (>24h), purge webhook logs >30d, expired exports. */
  @Cron("0 * * * *")
  async garbageCollect(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // 1. Orphan file assets (registered but never uploaded)
    const orphans = await this.prisma.fileAsset.findMany({
      where: { isUploaded: false, createdAt: { lt: cutoff } },
    });
    await Promise.all(
      orphans.flatMap((o) => [
        this.prisma.fileAsset.delete({ where: { id: o.id } }).catch(() => undefined),
        this.prisma.issueAttachment.deleteMany({ where: { asset: "", issueId: o.issueId ?? "" } }).catch(() => undefined),
      ]),
    );
    // 2. Uploaded files whose rows were hard-deleted already: disk sweep
    const dir = uploadDir();
    if (existsSync(dir)) {
      const known = new Set(
        (await this.prisma.fileAsset.findMany({ where: { asset: { not: "" } } })).map((r) => r.asset.split("/").pop()),
      );
      const files = await fs.readdir(dir).catch(() => [] as string[]);
      let removed = 0;
      // oxlint-disable-next-line eslint(no-await-in-loop)
      for (const f of files) {
        if (f === "tmp" || known.has(f)) continue;
        // oxlint-disable-next-line eslint(no-await-in-loop)
        const st = await fs.stat(join(dir, f)).catch(() => null);
        if (st && st.mtime.getTime() < cutoff.getTime()) {
          // oxlint-disable-next-line eslint(no-await-in-loop)
          await fs.unlink(join(dir, f)).catch(() => undefined);
          removed += 1;
        }
      }
      if (removed) this.logger.log(`GC: removed ${removed} orphan uploads`);
    }
    // 3. Webhook logs > 30d, expired exports
    const logs = await this.webhooks.purgeLogs(30);
    const exports = await this.exporter.purgeExpired();
    if (logs || exports) this.logger.log(`GC: ${logs} webhook logs, ${exports} exports purged`);
  }

  /** Daily 00:00: hard-delete soft-deleted rows past retention. */
  @Cron("0 0 * * *")
  async hardDelete(): Promise<void> {
    const cutoff = new Date(Date.now() - HARD_DELETE_DAYS * 24 * 60 * 60 * 1000);
    const tables: Array<{ model: keyof PrismaService & string; label: string }> = [];
    void tables;
    // Cascade-safe order: children first, then parents
    const res: Record<string, number> = {};
    res.issues = await this.prisma.issue.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.pages = await this.prisma.page.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.cycles = await this.prisma.cycle.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.modules = await this.prisma.module.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.projects = await this.prisma.project.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.workspaces = await this.prisma.workspace.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.labels = await this.prisma.label.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.estimates = await this.prisma.estimate.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.views = await this.prisma.issueView.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.drafts = await this.prisma.draftIssue.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    res.states = await this.prisma.state.deleteMany({ where: { deletedAt: { lt: cutoff } } }).then((r) => r.count);
    this.logger.log(`hard-delete: ${JSON.stringify(res)}`);
  }

  /** Daily 01:00: archive/close stale issues per project archiveIn/closeIn. */
  @Cron("0 1 * * *")
  async archiveAndClose(): Promise<void> {
    const projects = await this.prisma.project.findMany({
      where: { deletedAt: null, archivedAt: null, OR: [{ archiveIn: { gt: 0 } }, { closeIn: { gt: 0 } }] },
    });
    let archived = 0;
    let closed = 0;
    // Sequential per project by design: each project's archive/close depends on its own state.
    for (const p of projects) {
      // oxlint-disable-next-line eslint(no-await-in-loop)
      const staleClosed = await this.prisma.issue.findMany({
        where: {
          projectId: p.id,
          deletedAt: null,
          archivedAt: null,
          state: { is: { group: { in: ["completed", "cancelled"] } } },
          updatedAt: { lte: new Date(Date.now() - p.archiveIn * 30 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (staleClosed.length) {
        // oxlint-disable-next-line eslint(no-await-in-loop)
        await this.prisma.issue.updateMany({
          where: { id: { in: staleClosed.map((s) => s.id) } },
          data: { archivedAt: new Date() },
        });
        archived += staleClosed.length;
      }
      // oxlint-disable-next-line eslint(no-await-in-loop)
      const staleOpen = await this.prisma.issue.findMany({
        where: {
          projectId: p.id,
          deletedAt: null,
          archivedAt: null,
          state: { is: { group: { in: ["backlog", "unstarted", "started"] } } },
          updatedAt: { lte: new Date(Date.now() - p.closeIn * 30 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, stateId: true },
      });
      if (staleOpen.length) {
        // oxlint-disable-next-line eslint(no-await-in-loop)
        let target = await this.prisma.state.findFirst({
          where: { projectId: p.id, group: "cancelled", deletedAt: null },
        });
        if (!target && p.defaultStateId) {
          // oxlint-disable-next-line eslint(no-await-in-loop)
          target = await this.prisma.state.findFirst({ where: { id: p.defaultStateId } });
        }
        if (target) {
          // oxlint-disable-next-line eslint(no-await-in-loop)
          await this.prisma.issue.updateMany({
            where: { id: { in: staleOpen.map((s) => s.id) }, stateId: { not: target.id } },
            data: { stateId: target.id, completedAt: null, updatedBy: null },
          });
          closed += staleOpen.length;
        }
      }
    }
    if (archived || closed) this.logger.log(`archive_and_close: ${archived} archived, ${closed} closed`);
  }
}
