import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** 仅需邮箱与图形验证码，见 PASSWORD_RESET_REQUIREMENTS.md */
export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsUUID('4')
  captchaId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(12)
  captchaCode!: string;
}
