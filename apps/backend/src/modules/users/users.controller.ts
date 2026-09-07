import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateMeDto, UpdateProfileDto } from "../auth/dto/auth.dto";
import { UsersService } from "./users.service";

@Controller("api/users/me")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  me(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    return this.users.me(user.id);
  }

  @Patch()
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto): Promise<Record<string, unknown>> {
    return this.users.updateMe(user.id, dto);
  }

  @Get("profile")
  profile(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    return this.users.myProfile(user.id);
  }

  @Patch("profile")
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<Record<string, unknown>> {
    return this.users.updateMyProfile(user.id, dto);
  }

  @Get("settings")
  async settings(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return { id: row.id, email: row.email, workspace: null };
  }

  @Get("instance-admin")
  async instanceAdmin(@CurrentUser() user: RequestUser): Promise<{ is_instance_admin: boolean }> {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return { is_instance_admin: row.isSuperuser };
  }
}
