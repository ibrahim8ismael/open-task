import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { RolesGuard } from "./common/guards/roles.guard";
import { SessionAuthGuard } from "./common/guards/session-auth.guard";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ApiTokensModule } from "./modules/apitokens/apitokens.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { CronsModule } from "./modules/crons/crons.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ExporterModule } from "./modules/exporter/exporter.module";
import { IntakeModule } from "./modules/intake/intake.module";
import { HealthModule } from "./modules/health/health.module";
import { InstancesModule } from "./modules/instances/instances.module";
import { MailerModule } from "./modules/mailer/mailer.module";
import { MiscModule } from "./modules/misc/misc.module";
import { IssuesModule } from "./modules/issues/issues.module";
import { PagesModule } from "./modules/pages/pages.module";
import { SocialModule } from "./modules/social/social.module";
import { TaxonomyModule } from "./modules/taxonomy/taxonomy.module";
import { TrackingModule } from "./modules/tracking/tracking.module";
import { ViewsModule } from "./modules/views/views.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { UsersModule } from "./modules/users/users.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailerModule,
    HealthModule,
    InstancesModule,
    MiscModule,
    AuthModule,
    ApiTokensModule,
    ExporterModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    IssuesModule,
    IntakeModule,
    PagesModule,
    SocialModule,
    TaxonomyModule,
    TrackingModule,
    ViewsModule,
    AssetsModule,
    CronsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
