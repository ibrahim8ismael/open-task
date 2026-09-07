import { Module } from "@nestjs/common";
import { TimezonesController } from "./timezones.controller";

@Module({ controllers: [TimezonesController] })
export class MiscModule {}
