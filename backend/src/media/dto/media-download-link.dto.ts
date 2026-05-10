import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MediaDownloadLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  fileName?: string;
}
