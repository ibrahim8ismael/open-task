import { Module } from "@nestjs/common";
import { IssuesModule } from "../issues/issues.module";
import { CycleMiscController, CyclesController } from "./cycles.controller";
import { CyclesService } from "./cycles.service";
import { ModuleMiscController, ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";

@Module({
  imports: [IssuesModule],
  controllers: [CyclesController, CycleMiscController, ModulesController, ModuleMiscController],
  providers: [CyclesService, ModulesService],
  exports: [CyclesService, ModulesService],
})
export class TrackingModule {}
