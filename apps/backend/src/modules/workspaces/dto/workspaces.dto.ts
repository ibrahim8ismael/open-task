import { IsDefined, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  slug?: string;

  @IsOptional()
  @IsString()
  organization_size?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  organization_size?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class InviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  role?: number | string;
}

export class UpdateMemberDto {
  @IsDefined()
  role!: unknown;
}

export class UpdateUserPropertiesDto {
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  display_filters?: Record<string, unknown>;

  @IsOptional()
  display_properties?: Record<string, unknown>;
}

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsString()
  @MaxLength(12)
  identifier!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn([0, 2, "Secret", "Public"])
  network?: number | string;

  @IsOptional()
  @IsString()
  emoji?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsInt()
  archive_in?: number;

  @IsOptional()
  @IsInt()
  close_in?: number;
}
