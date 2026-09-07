import { Module } from "@nestjs/common";
import { WebhookMiscController, WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  controllers: [WebhooksController, WebhookMiscController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
