import { Module } from "@nestjs/common";
import { ExporterModule } from "../exporter/exporter.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { CronsService } from "./crons.service";

@Module({
  imports: [ExporterModule, WebhooksModule],
  providers: [CronsService],
})
export class CronsModule {}
