import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateStateDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(["backlog", "unstarted", "started", "completed", "cancelled", "triage"])
  group?: string;

  @IsOptional()
  sequence?: number;
}

export class UpdateStateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(["backlog", "unstarted", "started", "completed", "cancelled", "triage"])
  group?: string;

  @IsOptional()
  sequence?: number;
}

export class CreateLabelDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  parent?: string;
}

export class UpdateLabelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class BulkCreateLabelsDto {
  @IsArray()
  labels!: Array<{ name: string; color?: string }>;
}

export class CreateEstimateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(["categories", "points"])
  type?: string;
}

export class CreateEstimatePointDto {
  @IsInt()
  key!: number;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEstimatePointDto {
  @IsOptional()
  @IsInt()
  key?: number;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateIssueTypeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  is_epic?: boolean;
}
