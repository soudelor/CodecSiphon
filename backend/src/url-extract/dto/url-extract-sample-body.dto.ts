import { IsString, MaxLength, MinLength } from 'class-validator';

export class UrlExtractSampleBodyDto {
  @IsString()
  @MinLength(4)
  @MaxLength(4096)
  videoUrl!: string;
}
