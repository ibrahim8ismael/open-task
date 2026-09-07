import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

const STATUSES = ["backlog", "planned", "in-progress", "paused", "completed", "cancelled"] as const;

export class CreateModuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  target_date?: string;

  @IsOptional()
  @IsIn([...STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  lead?: string;

  @IsOptional()
  @IsArray()
  members?: string[];
}

export class UpdateModuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  start_date?: string | null;

  @IsOptional()
  @IsString()
  target_date?: string | null;

  @IsOptional()
  @IsIn([...STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  lead?: string | null;

  @IsOptional()
  @IsArray()
  members?: string[];
}

export class AddModuleIssuesDto {
  @IsArray()
  issues!: string[];
}

export class IssueModulesDto {
  @IsArray()
  modules!: string[];

  @IsOptional()
  @IsArray()
  removed_modules?: string[];
}
