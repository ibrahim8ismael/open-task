import { Controller, Get } from "@nestjs/common";

@Controller("api/instances")
export class InstancesController {
  @Get()
  getInstance(): Record<string, unknown> {
    return { version: "0.1.0-internal", web_base_url: process.env.WEB_BASE_URL ?? "http://localhost:3000" };
  }

  @Get("/")
  getInstanceSlash(): Record<string, unknown> {
    return this.getInstance();
  }
}
