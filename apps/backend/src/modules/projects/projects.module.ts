import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { ProjectMiscController, ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [ProjectsController, ProjectMiscController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
