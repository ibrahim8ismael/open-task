import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { CommentReactionController, IssueSocialController } from "./issue-social.controller";
import { IssueSocialService } from "./issue-social.service";
import { IssueExtraController, IssuesController } from "./issues.controller";
import { IssuesListService } from "./issues-list.service";
import { IssuesService } from "./issues.service";

@Module({
  imports: [ProjectsModule, WebhooksModule],
  controllers: [IssuesController, IssueExtraController, IssueSocialController, CommentReactionController],
  providers: [IssuesService, IssuesListService, IssueSocialService],
  exports: [IssuesService, IssuesListService],
})
export class IssuesModule {}
