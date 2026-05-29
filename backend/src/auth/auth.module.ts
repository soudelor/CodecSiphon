import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { ForgotPasswordLimiterService } from './forgot-password-limiter.service';
import { MailService } from './mail.service';
import { resolveJwtSecret } from './jwt-secret.util';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RegistrationCodeLimiterService } from './registration-code-limiter.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config),
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES') ??
            '15m') as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    CaptchaService,
    MailService,
    ForgotPasswordLimiterService,
    RegistrationCodeLimiterService,
  ],
  exports: [AuthService, JwtModule, JwtStrategy],
})
export class AuthModule {}
