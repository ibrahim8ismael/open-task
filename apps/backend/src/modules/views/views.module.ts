import { Module } from "@nestjs/common";
import { IssuesModule } from "../issues/issues.module";
import { ViewFavoriteController, ViewsController, WorkspaceViewsController } from "./views.controller";
import { ViewsService } from "./views.service";

@Module({
  imports: [IssuesModule],
  controllers: [ViewsController, ViewFavoriteController, WorkspaceViewsController],
  providers: [ViewsService],
  exports: [ViewsService],
})
export class ViewsModule {}
