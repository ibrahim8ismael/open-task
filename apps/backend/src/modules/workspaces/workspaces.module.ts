import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { FavoritesController } from "./favorites.controller";
import { WorkspaceBootController } from "./workspace-boot.controller";
import { WorkspaceMiscController, WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  imports: [UsersModule],
  controllers: [WorkspacesController, WorkspaceMiscController, WorkspaceBootController, FavoritesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
