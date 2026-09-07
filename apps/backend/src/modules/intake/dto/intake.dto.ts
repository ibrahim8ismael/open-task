import { IsDefined, IsInt, IsOptional, IsString } from "class-validator";

export class CreateIntakeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateInboxIssueDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsDefined()
  issue!: Record<string, unknown>;
}

export class UpdateInboxIssueDto {
  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  snoozed_till?: string | null;

  @IsOptional()
  duplicate_to?: string | null;

  @IsOptional()
  issue?: Record<string, unknown>;
}
