import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class EmailCheckDto {
  @IsEmail()
  email!: string;
}

export class MagicGenerateDto {
  @IsEmail()
  email!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class SetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  old_password!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  user_timezone?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  is_onboarded?: boolean;

  @IsOptional()
  is_tour_completed?: boolean;

  @IsOptional()
  onboarding_step?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  last_workspace_id?: string;

  @IsOptional()
  start_of_week?: number;
}
