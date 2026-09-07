import { Module } from "@nestjs/common";
import { AnalyticsStubController } from "./analytics-stub.controller";
import { TimezonesController } from "./timezones.controller";

@Module({ controllers: [TimezonesController, AnalyticsStubController] })
export class MiscModule {}
