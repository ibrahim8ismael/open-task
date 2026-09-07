import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";

const REQUEST_TIMEOUT_MS = 5000;

function secretKey(): string {
  return `plane_wh_${randomBytes(16).toString("hex")}`;
}

function hostBlocked(url: string): boolean {
  // Dev/test escape hatch for local delivery verification (never enable in prod)
  if (process.env.WEBHOOK_ALLOW_PRIVATE === "1") return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  if (host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.")) return true;
  const m172 = /^172\.(1[6-9]|2\d|3[01])\./.exec(host);
  if (m172) return true;
  return false;
}

function eventAllowed(events: unknown, event: string): boolean {
  if (!Array.isArray(events)) return true;
  return events.some((e) => {
    if (typeof e !== "string") return false;
    if (e === "*") return true;
    if (e.endsWith(".*")) return event.startsWith(e.slice(0, -1));
    return e === event;
  });
}

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async workspaceOrThrow(slug: string): Promise<{ id: string }> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    return ws;
  }

  serialize(row: { id: string; url: string; isActive: boolean; events: unknown; createdAt: Date }, showSecret: boolean, secret?: string): Record<string, unknown> {
    return {
      id: row.id,
      url: row.url,
      is_active: row.isActive,
      events: row.events,
      created_at: row.createdAt,
      ...(showSecret && secret ? { secret_key: secret } : {}),
    };
  }

  async list(slug: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const rows = await this.prisma.webhook.findMany({ where: { workspaceId: ws.id, deletedAt: null } });
    return rows.map((r) => this.serialize(r, false));
  }

  async retrieve(slug: string, wid: string, showSecret: boolean): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.webhook.findFirst({ where: { id: wid, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Webhook not found." });
    return this.serialize(row, showSecret, showSecret ? row.secretKey : undefined);
  }

  async create(slug: string, dto: { url: string; is_active?: boolean; events?: string[] }): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    if (hostBlocked(dto.url)) throw new ForbiddenException({ detail: "URL host is not allowed." });
    const row = await this.prisma.webhook
      .create({
        data: {
          workspaceId: ws.id,
          url: dto.url,
          secretKey: secretKey(),
          isActive: dto.is_active ?? true,
          events: dto.events ?? ["*"],
        },
      })
      .catch((e: unknown) => {
        if ((e as { code?: string })?.code === "P2002") throw new ForbiddenException({ detail: "Webhook URL already exists." });
        throw e;
      });
    return this.serialize(row, true, row.secretKey);
  }

  async update(
    slug: string,
    wid: string,
    dto: { url?: string; is_active?: boolean; events?: string[] },
  ): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.webhook.findFirst({ where: { id: wid, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Webhook not found." });
    if (dto.url !== undefined && hostBlocked(dto.url)) throw new ForbiddenException({ detail: "URL host is not allowed." });
    const updated = await this.prisma.webhook
      .update({
        where: { id: row.id },
        data: {
          ...(dto.url !== undefined ? { url: dto.url } : {}),
          ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
          ...(dto.events !== undefined ? { events: dto.events } : {}),
        },
      })
      .catch((e: unknown) => {
        if ((e as { code?: string })?.code === "P2002") throw new ForbiddenException({ detail: "Webhook URL already exists." });
        throw e;
      });
    return this.serialize(updated, false);
  }

  async remove(slug: string, wid: string): Promise<{ detail: string }> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.webhook.findFirst({ where: { id: wid, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Webhook not found." });
    await this.prisma.$transaction([
      this.prisma.webhookLog.deleteMany({ where: { webhookId: row.id } }),
      this.prisma.webhook.update({ where: { id: row.id }, data: { deletedAt: new Date(), isActive: false } }),
    ]);
    return { detail: "Webhook deleted." };
  }

  async regenerate(slug: string, wid: string): Promise<Record<string, unknown>> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.webhook.findFirst({ where: { id: wid, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Webhook not found." });
    const updated = await this.prisma.webhook.update({ where: { id: row.id }, data: { secretKey: secretKey() } });
    return this.serialize(updated, true, updated.secretKey);
  }

  async logs(slug: string, wid: string): Promise<Record<string, unknown>[]> {
    const ws = await this.workspaceOrThrow(slug);
    const row = await this.prisma.webhook.findFirst({ where: { id: wid, workspaceId: ws.id, deletedAt: null } });
    if (!row) throw new NotFoundException({ detail: "Webhook not found." });
    const rows = await this.prisma.webhookLog.findMany({
      where: { webhookId: row.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((l) => ({
      id: l.id,
      event_type: l.eventType,
      response_code: l.responseCode,
      retry_count: l.retryCount,
      created_at: l.createdAt,
    }));
  }

  /** Fire-and-forget HMAC event fanout (never throws into request path). */
  fire(workspaceId: string, event: string, payload: Record<string, unknown>): void {
    void this.dispatch(workspaceId, event, payload).catch(() => undefined);
  }

  private async dispatch(workspaceId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const hooks = await this.prisma.webhook.findMany({
      where: { workspaceId, isActive: true, deletedAt: null },
    });
    const targets = hooks.filter((h) => eventAllowed(h.events, event));
    await Promise.all(targets.map((h) => this.deliver(h, event, payload)));
  }

  private async deliver(
    hook: { id: string; workspaceId: string; url: string; secretKey: string },
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({ event, data: payload, sent_at: new Date().toISOString() });
    const signature = createHmac("sha256", hook.secretKey).update(body).digest("hex");
    let code: number | undefined;
    let responseBody = "";
    let retries = 0;
    // Sequential on purpose: second attempt only runs if the first fails.
    // oxlint-disable-next-line eslint(no-await-in-loop)
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // oxlint-disable-next-line eslint(no-await-in-loop)
        const res = await fetch(hook.url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-plane-signature": signature, "x-plane-event": event },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        code = res.status;
        // oxlint-disable-next-line eslint(no-await-in-loop)
        responseBody = (await res.text()).slice(0, 2000);
        break;
      } catch (err) {
        retries += 1;
        responseBody = err instanceof Error ? err.message.slice(0, 500) : "request failed";
      }
    }
    await this.prisma.webhookLog
      .create({
        data: {
          workspaceId: hook.workspaceId,
          webhookId: hook.id,
          eventType: event,
          requestBody: body.slice(0, 4000),
          responseBody,
          retryCount: retries,
          ...(code !== undefined ? { responseCode: code } : {}),
        },
      })
      .catch(() => undefined);
  }

  /** Delete logs older than the retention window. Returns removed count. */
  async purgeLogs(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const res = await this.prisma.webhookLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return res.count;
  }
}
