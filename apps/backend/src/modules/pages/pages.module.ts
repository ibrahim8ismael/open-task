import { Module } from "@nestjs/common";
import { PageMiscController, PagesController } from "./pages.controller";
import { PagesService } from "./pages.service";

@Module({
  controllers: [PagesController, PageMiscController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
