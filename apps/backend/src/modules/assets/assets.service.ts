import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, promises as fs } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { Response } from "express";
import { PrismaService } from "../../common/prisma/prisma.service";

export function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
}

export function sanitizeFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "file";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120) || "file";
  return clean;
}

const FILE_SIZE_LIMIT = Number(process.env.FILE_SIZE_LIMIT ?? 5 * 1024 * 1024);

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  apiBase(): string {
    return (process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8000}`).replace(/\/+$/, "");
  }

  async workspaceProjectOrThrow(slug: string, pid: string): Promise<{ wsId: string }> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    const project = await this.prisma.project.findFirst({ where: { id: pid, workspaceId: ws.id, deletedAt: null } });
    if (!project) throw new NotFoundException({ detail: "Project not found." });
    return { wsId: ws.id };
  }

  /** Step 1: register metadata, return upload target (local stand-in for S3 presigned POST). */
  async registerAttachment(
    slug: string,
    pid: string,
    iid: string,
    userId: string,
    dto: { name: string; type?: string; size?: number },
  ): Promise<Record<string, unknown>> {
    const { wsId } = await this.workspaceProjectOrThrow(slug, pid);
    const issue = await this.prisma.issue.findFirst({ where: { id: iid, projectId: pid, deletedAt: null } });
    if (!issue) throw new NotFoundException({ detail: "Issue not found." });
    if (!dto.name) throw new ForbiddenException({ detail: "File name is required." });
    if (dto.size !== undefined && dto.size > FILE_SIZE_LIMIT)
      throw new ForbiddenException({ detail: `File exceeds ${FILE_SIZE_LIMIT} bytes limit.` });
    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        asset: "",
        attributes: { name: dto.name, type: dto.type ?? "", size: dto.size ?? 0 },
        size: dto.size ?? 0,
        entityType: "ISSUE_ATTACHMENT",
        entityIdentifier: issue.id,
        userId,
        workspaceId: wsId,
        projectId: pid,
        issueId: issue.id,
      },
    });
    const attachment = await this.prisma.issueAttachment.create({
      data: { issueId: issue.id, asset: "", attributes: { name: dto.name, file_asset: fileAsset.id } },
    });
    return {
      asset_id: fileAsset.id,
      attachment_id: attachment.id,
      upload_data: { url: `${this.apiBase()}/api/assets/upload/${fileAsset.id}/`, fields: {} },
    };
  }

  /** Step 2 (public, unguessable asset id): store bytes, mark uploaded. */
  async storeUpload(assetId: string, file: { path: string; size: number; originalname: string }): Promise<Record<string, unknown>> {
    const row = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!row || row.isDeleted) {
      await fs.unlink(file.path).catch(() => undefined);
      throw new NotFoundException({ detail: "Upload target not found." });
    }
    const stored = `${row.id}-${sanitizeFilename(file.originalname)}`;
    const dest = join(uploadDir(), stored);
    await fs.rename(file.path, dest).catch(async () => {
      // cross-device fallback
      await fs.copyFile(file.path, dest);
      await fs.unlink(file.path).catch(() => undefined);
    });
    const publicPath = `/uploads/${stored}`;
    await this.prisma.fileAsset.update({
      where: { id: row.id },
      data: { asset: publicPath, size: file.size, isUploaded: true, storageMetadata: { provider: "local", path: dest } },
    });
    await this.prisma.issueAttachment.updateMany({
      where: { issueId: row.issueId ?? "", asset: "" },
      data: { asset: publicPath },
    });
    return { detail: "Uploaded.", asset: publicPath };
  }

  async deleteAttachment(slug: string, pid: string, iid: string, assetId: string): Promise<{ detail: string }> {
    await this.workspaceProjectOrThrow(slug, pid);
    const issue = await this.prisma.issue.findFirst({ where: { id: iid, projectId: pid, deletedAt: null } });
    if (!issue) throw new NotFoundException({ detail: "Issue not found." });
    const row = await this.prisma.fileAsset.findFirst({ where: { id: assetId, issueId: issue.id } });
    if (row?.storageMetadata && typeof row.storageMetadata === "object") {
      const meta = row.storageMetadata as { path?: string };
      if (meta.path && existsSync(meta.path)) await fs.unlink(meta.path).catch(() => undefined);
    }
    await this.prisma.$transaction([
      this.prisma.issueAttachment.deleteMany({ where: { issueId: issue.id, asset: row?.asset ?? "__none__" } }),
      ...(row ? [this.prisma.fileAsset.update({ where: { id: row.id }, data: { isDeleted: true } })] : []),
    ]);
    return { detail: "Attachment deleted." };
  }

  async serveUpload(assetPath: string, res: Response): Promise<void> {
    const base = uploadDir();
    const file = join(base, assetPath.replace(/^\/+/, ""));
    if (!resolve(file).startsWith(resolve(base) + sep) || !existsSync(file)) {
      res.status(404).json({ detail: "Not found." });
      return;
    }
    res.sendFile(file);
  }

  // --- generic asset handling for project/workspace cover, avatars, etc. (stub for frontend) ---
  async registerGenericAsset(
    workspaceSlug: string,
    userId: string,
    dto: { name?: string; type?: string; size?: number; entity_type?: string; entity_identifier?: string },
  ): Promise<Record<string, unknown>> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug: workspaceSlug, deletedAt: null } });
    if (!ws) throw new NotFoundException({ detail: "Workspace not found." });
    // allow any entity_type, default to PROJECT_COVER
    const entityType = dto.entity_type ?? "PROJECT_COVER";
    const entityIdentifier = dto.entity_identifier ?? "";
    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        asset: "",
        attributes: { name: dto.name ?? "file", type: dto.type ?? "", size: dto.size ?? 0 },
        size: dto.size ?? 0,
        entityType,
        entityIdentifier,
        userId,
        workspaceId: ws.id,
      },
    });
    return {
      asset_id: fileAsset.id,
      upload_data: { url: `${this.apiBase()}/api/assets/upload/${fileAsset.id}/`, fields: {} },
    };
  }

  async markAssetUploaded(assetId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!row) throw new NotFoundException({ detail: "Asset not found." });
    await this.prisma.fileAsset.update({ where: { id: assetId }, data: { isUploaded: true } });
    return { detail: "Updated." };
  }

  async bulkUpdateAssets(entityId: string, assetIds: string[]): Promise<Record<string, unknown>> {
    if (assetIds.length > 0) {
      await this.prisma.fileAsset.updateMany({ where: { id: { in: assetIds } }, data: { entityIdentifier: entityId, isUploaded: true } });
    }
    return { detail: "Updated." };
  }
}
