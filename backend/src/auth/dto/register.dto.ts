import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Matches(/^\d{6}$/)
  emailVerificationCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
