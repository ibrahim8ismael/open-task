import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateTokenDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsOptional()
  @IsInt()
  expires_in_days?: number;
}
