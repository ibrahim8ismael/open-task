import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Level, RequestUser, Roles } from "../../common/decorators/auth.decorators";
import { CreateWebhookDto, UpdateWebhookDto } from "./dto/webhooks.dto";
import { WebhooksService } from "./webhooks.service";

@Controller("api/workspaces/:slug/webhooks")
@Level("WORKSPACE")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @Roles("GUEST")
  list(@Param("slug") slug: string) {
    return this.webhooks.list(slug);
  }

  @Post()
  @Roles("MEMBER")
  create(@Param("slug") slug: string, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(slug, dto);
  }

  @Get(":wid")
  @Roles("GUEST")
  retrieve(
    @Param("slug") slug: string,
    @Param("wid") wid: string,
    @Query("show_secret_key") showSecret?: string,
  ) {
    return this.webhooks.retrieve(slug, wid, showSecret === "true" || showSecret === "1");
  }

  @Patch(":wid")
  @Roles("MEMBER")
  update(@Param("slug") slug: string, @Param("wid") wid: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.update(slug, wid, dto);
  }

  @Delete(":wid")
  @Roles("ADMIN")
  remove(@Param("slug") slug: string, @Param("wid") wid: string) {
    return this.webhooks.remove(slug, wid);
  }

  @Post(":wid/regenerate")
  @Roles("MEMBER")
  regenerate(@Param("slug") slug: string, @Param("wid") wid: string) {
    return this.webhooks.regenerate(slug, wid);
  }
}

@Controller()
export class WebhookMiscController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get("api/workspaces/:slug/webhook-logs/:wid")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  logs(@Param("slug") slug: string, @Param("wid") wid: string, @CurrentUser() _user: RequestUser) {
    return this.webhooks.logs(slug, wid);
  }
}
