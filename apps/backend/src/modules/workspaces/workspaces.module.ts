import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { WorkspaceMiscController, WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  imports: [UsersModule],
  controllers: [WorkspacesController, WorkspaceMiscController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
