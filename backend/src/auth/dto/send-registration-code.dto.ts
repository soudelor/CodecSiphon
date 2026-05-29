import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';



/** 索取注册邮箱 OTP；见 REGISTER_EMAIL_VERIFICATION_REQUIREMENTS.md */

export class SendRegistrationCodeDto {

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


