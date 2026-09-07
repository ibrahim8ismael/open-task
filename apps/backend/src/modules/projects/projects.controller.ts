import { Controller, Get, Param } from "@nestjs/common";

@Controller("api/workspaces/:slug/projects")
export class ProjectsController {
  @Get()
  list(@Param("slug") _slug: string): { results: unknown[]; count: number } {
    // TODO B0.6: Prisma-backed list (docs/04 §4.3)
    return { results: [], count: 0 };
  }

  @Get("/")
  listSlash(@Param("slug") slug: string): { results: unknown[]; count: number } {
    return this.list(slug);
  }
}
