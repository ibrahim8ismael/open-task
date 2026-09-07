import { Module } from "@nestjs/common";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { ProjectMiscController, ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [WorkspacesModule, WebhooksModule],
  controllers: [ProjectsController, ProjectMiscController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
