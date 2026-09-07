import { IsArray, IsInt, IsOptional, IsString } from "class-validator";

export class CreatePageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  description_html?: string;

  @IsOptional()
  @IsString()
  parent?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  access?: number;
}

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  label_ids?: string[];
}

export class UpdateDescriptionDto {
  @IsOptional()
  description_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  description_html?: string;
}

export class AccessDto {
  @IsInt()
  access!: number;
}

export class MovePageDto {
  @IsOptional()
  @IsString()
  new_project_id?: string;

  @IsOptional()
  @IsString()
  project_id?: string;
}
