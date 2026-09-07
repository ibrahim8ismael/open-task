import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class ExportIssuesDto {
  @IsIn(["csv", "xlsx", "json"])
  provider!: string;

  @IsArray()
  project!: string[];

  @IsOptional()
  multiple?: boolean;

  @IsOptional()
  rich_filters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  reason?: string;
}
