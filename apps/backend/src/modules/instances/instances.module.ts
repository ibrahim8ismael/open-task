import { Module } from "@nestjs/common";
import { InstancesController } from "./instances.controller";

@Module({ controllers: [InstancesController] })
export class InstancesModule {}
