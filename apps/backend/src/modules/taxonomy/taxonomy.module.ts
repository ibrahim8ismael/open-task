import { Module } from "@nestjs/common";
import { TaxonomyController, TaxonomyMiscController } from "./taxonomy.controller";
import { TaxonomyService } from "./taxonomy.service";

@Module({
  controllers: [TaxonomyController, TaxonomyMiscController],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
