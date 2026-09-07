import { Controller, Get } from "@nestjs/common";

@Controller("api/workspaces")
export class WorkspacesController {
  @Get()
  list(): { results: unknown[]; count: number } {
    // TODO B0.6: Prisma-backed list (docs/04 §4.2)
    return { results: [], count: 0 };
  }

  @Get("/")
  listSlash(): { results: unknown[]; count: number } {
    return this.list();
  }
}
