import { IsArray, IsBoolean, IsOptional, IsUrl } from "class-validator";

export class CreateWebhookDto {
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  url!: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  events?: string[];
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  url?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  events?: string[];
}
