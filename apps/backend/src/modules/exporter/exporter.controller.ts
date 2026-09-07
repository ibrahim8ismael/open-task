import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser, Level, Public, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { ExportIssuesDto } from "./dto/exporter.dto";
import { ExporterService } from "./exporter.service";

@Controller()
export class ExporterController {
  constructor(private readonly exporter: ExporterService) {}

  @Post("api/workspaces/:slug/export-issues")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  export(
    @Param("slug") slug: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ExportIssuesDto,
  ) {
    return this.exporter.export(slug, user.id, dto);
  }

  @Get("api/workspaces/:slug/export-issues")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  history(@Param("slug") slug: string) {
    return this.exporter.history(slug);
  }

  @Public()
  @Get("api/exports/:token/download")
  download(@Param("token") token: string, @Res() res: Response) {
    return this.exporter.download(token, res);
  }
}
