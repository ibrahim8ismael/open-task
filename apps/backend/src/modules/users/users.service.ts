import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateMeDto, UpdateProfileDto } from "../auth/dto/auth.dto";

/** snake_case serializers matching Django /api/users/me/* shapes (subset of fields we store). */
function serializeUser(u: {
  id: string;
  avatar: string;
  email: string | null;
  displayName: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isBot: boolean;
  userTimezone: string;
  username: string;
}): Record<string, unknown> {
  return {
    id: u.id,
    avatar: u.avatar,
    cover_image: null,
    avatar_url: u.avatar || null,
    cover_image_url: null,
    date_joined: null,
    display_name: u.displayName,
    email: u.email,
    first_name: u.firstName,
    last_name: u.lastName,
    is_active: u.isActive,
    is_bot: u.isBot,
    is_email_verified: false,
    user_timezone: u.userTimezone,
    username: u.username,
    is_password_autoset: false,
    last_login_medium: "email",
    last_login_time: null,
  };
}

function serializeProfile(p: {
  id?: string;
  userId?: string;
  language: string;
  isOnboarded: boolean;
  isTourCompleted?: boolean;
  onboardingStep?: unknown;
  lastWorkspaceId: string | null;
  startOfWeek: number;
  theme?: unknown;
}): Record<string, unknown> {
  const onboardingStep =
    (p.onboardingStep as Record<string, unknown> | null) ??
    ({
      workspace_join: false,
      profile_complete: false,
      workspace_create: false,
      workspace_invite: false,
    } as Record<string, unknown>);
  return {
    id: (p as { id?: string }).id,
    user: (p as { userId?: string }).userId,
    language: p.language,
    is_onboarded: p.isOnboarded,
    is_tour_completed: (p as { isTourCompleted?: boolean }).isTourCompleted ?? false,
    onboarding_step: onboardingStep,
    last_workspace_id: p.lastWorkspaceId,
    start_of_week: p.startOfWeek,
    theme: (p as { theme?: unknown }).theme ?? {},
    // stub remaining TUserProfile fields so frontend doesn't see undefined
    role: undefined,
    use_case: undefined,
    billing_address_country: undefined,
    billing_address: undefined,
    has_billing_address: false,
    has_marketing_email_consent: false,
    created_at: "",
    updated_at: "",
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string): Promise<Record<string, unknown>> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return serializeUser(u);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<Record<string, unknown>> {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.first_name !== undefined ? { firstName: dto.first_name } : {}),
        ...(dto.last_name !== undefined ? { lastName: dto.last_name } : {}),
        ...(dto.display_name !== undefined ? { displayName: dto.display_name } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
        ...(dto.user_timezone !== undefined ? { userTimezone: dto.user_timezone } : {}),
      },
    });
    return serializeUser(u);
  }

  async myProfile(userId: string): Promise<Record<string, unknown>> {
    const p = await this.prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return serializeProfile(p);
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto): Promise<Record<string, unknown>> {
    const p = await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.is_onboarded !== undefined ? { isOnboarded: dto.is_onboarded } : {}),
        ...(dto.is_tour_completed !== undefined ? { isTourCompleted: dto.is_tour_completed } : {}),
        ...(dto.onboarding_step !== undefined ? { onboardingStep: dto.onboarding_step as object } : {}),
        ...(dto.last_workspace_id !== undefined ? { lastWorkspaceId: dto.last_workspace_id } : {}),
        ...(dto.start_of_week !== undefined ? { startOfWeek: dto.start_of_week } : {}),
      },
      update: {
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.is_onboarded !== undefined ? { isOnboarded: dto.is_onboarded } : {}),
        ...(dto.is_tour_completed !== undefined ? { isTourCompleted: dto.is_tour_completed } : {}),
        ...(dto.onboarding_step !== undefined ? { onboardingStep: dto.onboarding_step as object } : {}),
        ...(dto.last_workspace_id !== undefined ? { lastWorkspaceId: dto.last_workspace_id } : {}),
        ...(dto.start_of_week !== undefined ? { startOfWeek: dto.start_of_week } : {}),
      },
    });
    return serializeProfile(p);
  }
}
