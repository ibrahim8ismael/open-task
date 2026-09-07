import { IsArray, IsOptional, IsString } from "class-validator";

export class CreateCycleDto {
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
  end_date?: string;

  @IsOptional()
  @IsString()
  owned_by?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateCycleDto {
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
  end_date?: string | null;

  @IsOptional()
  @IsString()
  owned_by?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class AddCycleIssuesDto {
  @IsArray()
  issues!: string[];
}

export class TransferIssuesDto {
  @IsString()
  new_cycle_id!: string;
}

export class DateCheckDto {
  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  cycle_id?: string;
}
