import { IsArray, IsDefined, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

export class CreateIssueDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  description_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  description_html?: string;

  @IsOptional()
  @IsIn([...PRIORITIES])
  priority?: string;

  @IsOptional()
  state_id?: string;

  @IsOptional()
  type_id?: string;

  @IsOptional()
  estimate_point?: string;

  @IsOptional()
  parent_id?: string;

  @IsOptional()
  @IsArray()
  assignee_ids?: string[];

  @IsOptional()
  @IsArray()
  label_ids?: string[];

  @IsOptional()
  start_date?: string;

  @IsOptional()
  target_date?: string;

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsInt()
  point?: number;

  // Accepted for forward-compat; cycles/modules land in B2
  @IsOptional()
  @IsString()
  cycle_id?: string;

  @IsOptional()
  @IsArray()
  module_ids?: string[];
}

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  description_html?: string;

  @IsOptional()
  @IsIn([...PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsString()
  state_id?: string | null;

  @IsOptional()
  @IsString()
  type_id?: string | null;

  @IsOptional()
  @IsString()
  estimate_point?: string | null;

  @IsOptional()
  @IsString()
  parent_id?: string | null;

  @IsOptional()
  @IsArray()
  assignee_ids?: string[];

  @IsOptional()
  @IsArray()
  label_ids?: string[];

  @IsOptional()
  @IsString()
  start_date?: string | null;

  @IsOptional()
  @IsString()
  target_date?: string | null;

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsInt()
  point?: number | null;
}

export class BulkOperationDto {
  @IsArray()
  issue_ids!: string[];

  @IsDefined()
  properties!: Record<string, unknown>;
}

export class BulkIdsDto {
  @IsArray()
  issue_ids!: string[];

  @IsOptional()
  archive?: boolean;

  @IsOptional()
  subscribe?: boolean;
}

export class RelationDto {
  @IsString()
  related_issue!: string;

  @IsOptional()
  @IsString()
  relation_type?: string;
}
