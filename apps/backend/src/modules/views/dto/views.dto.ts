import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateViewDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  query?: Record<string, unknown>;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  display_filters?: Record<string, unknown>;

  @IsOptional()
  display_properties?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  access?: number;

  @IsOptional()
  @IsString()
  project?: string;
}

export class UpdateViewDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  query?: Record<string, unknown>;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  display_filters?: Record<string, unknown>;

  @IsOptional()
  display_properties?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  access?: number;
}
