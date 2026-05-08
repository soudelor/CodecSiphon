import { IsString, MaxLength, MinLength } from 'class-validator';

export class PreviewUrlDto {
  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  url!: string;
}
