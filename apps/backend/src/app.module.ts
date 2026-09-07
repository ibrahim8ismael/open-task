import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { RolesGuard } from "./common/guards/roles.guard";
import { SessionAuthGuard } from "./common/guards/session-auth.guard";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { InstancesModule } from "./modules/instances/instances.module";
import { IssuesModule } from "./modules/issues/issues.module";
import { TaxonomyModule } from "./modules/taxonomy/taxonomy.module";
import { ViewsModule } from "./modules/views/views.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { UsersModule } from "./modules/users/users.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    InstancesModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    IssuesModule,
    TaxonomyModule,
    ViewsModule,
    AssetsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
