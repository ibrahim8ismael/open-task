import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
