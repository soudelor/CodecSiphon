import { IsObject, IsOptional } from 'class-validator';

export class PatchUserSettingsDto {
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  downloadDefaults?: Record<string, unknown>;
}
