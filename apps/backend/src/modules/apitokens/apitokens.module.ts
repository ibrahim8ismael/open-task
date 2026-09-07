import { Module } from "@nestjs/common";
import { ApiTokensController } from "./apitokens.controller";
import { ApiTokensService } from "./apitokens.service";

@Module({ controllers: [ApiTokensController], providers: [ApiTokensService], exports: [ApiTokensService] })
export class ApiTokensModule {}
