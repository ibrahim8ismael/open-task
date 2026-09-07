import { Module } from "@nestjs/common";
import { IssuesModule } from "../issues/issues.module";
import { DraftsController, NotificationsController, SocialMiscController, StickiesController } from "./social.controller";
import { SocialService } from "./social.service";

@Module({
  imports: [IssuesModule],
  controllers: [NotificationsController, StickiesController, DraftsController, SocialMiscController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
