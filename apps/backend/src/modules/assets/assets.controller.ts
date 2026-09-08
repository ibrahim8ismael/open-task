import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import type { Response } from "express";
import { existsSync, mkdirSync } from "node:fs";
import { CurrentUser, Level, Public, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { AssetsService, sanitizeFilename, uploadDir } from "./assets.service";

const FILE_SIZE_LIMIT = Number(process.env.FILE_SIZE_LIMIT ?? 5 * 1024 * 1024);

@Controller()
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post("api/assets/v2/workspaces/:slug/projects/:pid/issues/:iid/attachments")
  @Roles("MEMBER")
  @Level("PROJECT")
  register(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { name: string; type?: string; size?: number },
  ) {
    return this.assets.registerAttachment(slug, pid, iid, user.id, dto);
  }

  // --- generic workspace/project assets (cover images, etc.) — stubs for frontend ---
  @Post("api/assets/v2/workspaces/:slug/")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  registerWorkspaceAsset(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.assets.registerGenericAsset(slug, user.id, dto as never);
  }

  @Patch("api/assets/v2/workspaces/:slug/:assetId/")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  markWorkspaceAsset(@Param("assetId") assetId: string) {
    return this.assets.markAssetUploaded(assetId);
  }

  @Post("api/assets/v2/workspaces/:slug/:entityId/bulk/")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  bulkWorkspace(
    @Param("entityId") entityId: string,
    @Body() dto: { asset_ids: string[] },
  ) {
    return this.assets.bulkUpdateAssets(entityId, dto.asset_ids ?? []);
  }

  @Post("api/assets/v2/workspaces/:slug/projects/:pid/")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  registerProjectAsset(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.assets.registerGenericAsset(slug, user.id, dto as never);
  }

  @Patch("api/assets/v2/workspaces/:slug/projects/:pid/:assetId/")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  markProjectAsset(@Param("assetId") assetId: string) {
    return this.assets.markAssetUploaded(assetId);
  }

  @Post("api/assets/v2/workspaces/:slug/projects/:pid/:entityId/bulk/")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  bulkProject(
    @Param("entityId") entityId: string,
    @Body() dto: { asset_ids: string[] },
  ) {
    return this.assets.bulkUpdateAssets(entityId, dto.asset_ids ?? []);
  }

  @Public()
  @Post("api/assets/upload/:assetId")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = `${uploadDir()}/tmp`;
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`),
      }),
      limits: { fileSize: FILE_SIZE_LIMIT },
    }),
  )
  upload(
    @Param("assetId") assetId: string,
    @UploadedFile() file: { path: string; size: number; originalname: string },
  ) {
    return this.assets.storeUpload(assetId, file);
  }

  @Delete("api/assets/v2/workspaces/:slug/projects/:pid/issues/:iid/attachments/:assetId")
  @Roles("MEMBER")
  @Level("PROJECT")
  remove(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("iid") iid: string,
    @Param("assetId") assetId: string,
  ) {
    return this.assets.deleteAttachment(slug, pid, iid, assetId);
  }

  @Public()
  @Get("uploads/:path")
  serve(@Param("path") path: string, @Res() res: Response) {
    return this.assets.serveUpload(path, res);
  }
}
