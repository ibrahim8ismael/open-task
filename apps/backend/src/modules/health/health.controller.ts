import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/auth.decorators";

@Public()
@Controller()
export class HealthController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }
}
