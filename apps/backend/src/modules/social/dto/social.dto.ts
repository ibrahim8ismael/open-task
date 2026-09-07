import { IsArray, IsOptional, IsString } from "class-validator";

export class CreateStickyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateStickyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateDraftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  project_id?: string;

  @IsOptional()
  state_id?: string;

  @IsOptional()
  @IsArray()
  assignee_ids?: string[];

  @IsOptional()
  @IsArray()
  label_ids?: string[];
}

export class UpdateDraftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  project_id?: string;

  @IsOptional()
  @IsString()
  state_id?: string | null;

  @IsOptional()
  @IsArray()
  assignee_ids?: string[];

  @IsOptional()
  @IsArray()
  label_ids?: string[];
}

export class DraftToIssueDto {
  @IsString()
  project_id!: string;
}
