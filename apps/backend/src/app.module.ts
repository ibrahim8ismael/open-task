import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { InstancesModule } from "./modules/instances/instances.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    InstancesModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
  ],
})
export class AppModule {}
