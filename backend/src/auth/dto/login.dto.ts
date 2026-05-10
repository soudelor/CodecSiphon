import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsUUID('4')
  captchaId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(12)
  captchaCode!: string;
}
