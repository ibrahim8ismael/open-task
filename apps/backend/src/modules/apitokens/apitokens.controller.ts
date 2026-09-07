import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/decorators/auth.decorators";
import { CreateTokenDto } from "./dto/apitokens.dto";
import { ApiTokensService } from "./apitokens.service";

@Controller("api/users/api-tokens")
export class ApiTokensController {
  constructor(private readonly tokens: ApiTokensService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.tokens.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTokenDto) {
    return this.tokens.create(user.id, dto);
  }

  @Delete(":id")
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    return this.tokens.remove(user.id, id);
  }
}
