import { Module } from "@nestjs/common";
import { IssuesModule } from "../issues/issues.module";
import { IntakeController, IntakeMiscController } from "./intake.controller";
import { IntakeService } from "./intake.service";

@Module({
  imports: [IssuesModule],
  controllers: [IntakeController, IntakeMiscController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
