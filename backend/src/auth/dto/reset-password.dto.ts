import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** 令牌为 32-byte 十六进制字符串（64 chars） */
export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'Invalid reset token format',
  })
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
