import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { RefreshAudience, User, UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  AdminAuditActions,
  AdminAuditService,
} from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessPayload } from './strategies/jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendRegistrationCodeDto } from './dto/send-registration-code.dto';
import { CaptchaService } from './captcha.service';
import { ForgotPasswordLimiterService } from './forgot-password-limiter.service';
import { RegistrationCodeLimiterService } from './registration-code-limiter.service';
import { MailService } from './mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { defaultUserQuotasFromEnv } from '../config/default-user-quota.util';
import { hashRegistrationOtp } from './registration-otp-hash.util';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_BYTES = 32;

function hashPasswordResetPlain(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

function hashRefreshToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly captcha: CaptchaService,
    private readonly audit: AdminAuditService,
    private readonly mail: MailService,
    private readonly forgotLimiter: ForgotPasswordLimiterService,
    private readonly registrationLimiter: RegistrationCodeLimiterService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 注册前索取邮箱 OTP。未配置 SMTP 直接拒绝（S-REG-04）。
   * 防枚举：已注册邮箱与未注册返回值一致 `{ ok: true }`，但不发信不发码。
   */
  async sendRegistrationCode(
    dto: SendRegistrationCodeDto,
    meta?: { ip?: string | null },
  ): Promise<{ ok: true }> {
    if (!this.mail.smtpConfigured()) {
      throw new HttpException(
        { key: 'errors.registrationMailDisabled' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const captchaOk = await this.captcha.verifyAndConsume(
      dto.captchaId,
      dto.captchaCode,
    );
    if (!captchaOk) {
      throw new BadRequestException('验证码错误或已过期，请重试');
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    this.logger.log(
      `sendRegistrationCode request to=${normalizedEmail} ip=${(meta?.ip ?? 'unknown').trim().slice(0, 128) || 'unknown'}`,
    );
    await this.registrationLimiter.assertWithinLimits(
      (meta?.ip ?? 'unknown').trim().slice(0, 128) || 'unknown',
      normalizedEmail,
    );

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 20 + Math.floor(Math.random() * 31)),
    );

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      this.logger.log(
        `sendRegistrationCode skip mail: email already registered to=${normalizedEmail} (response ok=true, anti-enumeration)`,
      );
      return { ok: true };
    }

    try {
      await this.prisma.registrationEmailCode.deleteMany({
        where: { email: normalizedEmail, usedAt: null },
      });

      const otpPlain = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = hashRegistrationOtp(normalizedEmail, otpPlain);

      const expiresMinutes = Math.max(
        5,
        Number(
          this.config.get<string>('REGISTRATION_OTP_EXPIRES_MINUTES') ?? 15,
        ) || 15,
      );
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresMinutes);

      const row = await this.prisma.registrationEmailCode.create({
        data: {
          email: normalizedEmail,
          codeHash,
          expiresAt,
        },
      });

      const sentOk = await this.mail.sendRegistrationOtpEmail(
        normalizedEmail,
        otpPlain,
        expiresMinutes,
      );
      if (!sentOk) {
        await this.prisma.registrationEmailCode
          .delete({ where: { id: row.id } })
          .catch(() => {});
        this.logger.warn(
          `sendRegistrationCode mail failed to=${normalizedEmail} otpRowId=${row.id}`,
        );
        throw new HttpException(
          { key: 'errors.registrationMailSendFailed' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.log(
        `sendRegistrationCode mail queued ok to=${normalizedEmail} otpRowId=${row.id} expiresMin=${expiresMinutes}`,
      );
    } catch (e: unknown) {
      if (
        e instanceof PrismaClientKnownRequestError &&
        e.code === 'P2021'
      ) {
        throw new HttpException(
          { key: 'errors.registrationServiceUnavailable' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (e instanceof HttpException) {
        throw e;
      }
      throw e;
    }

    return { ok: true };
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const maxAttempts = Math.max(
      3,
      Number(this.config.get<string>('REGISTRATION_OTP_VERIFY_MAX_ATTEMPTS') ?? 10) ||
        10,
    );

    const otp = dto.emailVerificationCode.trim();

    const quotas = defaultUserQuotasFromEnv(this.config);

    const row = await this.prisma.registrationEmailCode.findFirst({
      where: {
        email: normalizedEmail,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!row || row.verifyAttempts >= maxAttempts) {
      throw new HttpException(
        { key: 'errors.registrationCodeInvalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (hashRegistrationOtp(normalizedEmail, otp) !== row.codeHash) {
      await this.prisma.registrationEmailCode.update({
        where: { id: row.id },
        data: { verifyAttempts: { increment: 1 } },
      });
      throw new HttpException(
        { key: 'errors.registrationCodeInvalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const dup = await tx.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (dup) {
          throw new HttpException(
            { key: 'errors.emailTaken' },
            HttpStatus.CONFLICT,
          );
        }

        const mark = await tx.registrationEmailCode.updateMany({
          where: {
            id: row.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });
        if (mark.count !== 1) {
          throw new HttpException(
            { key: 'errors.registrationCodeInvalid' },
            HttpStatus.BAD_REQUEST,
          );
        }

        return tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            displayName: dto.displayName,
            storageQuotaBytes: quotas.storageQuotaBytes,
            monthlyDownloadQuotaBytes: quotas.monthlyDownloadQuotaBytes,
            emailVerifiedAt: new Date(),
            userSettings: { create: {} },
          },
        });
      });
    } catch (e: unknown) {
      if (e instanceof HttpException) {
        throw e;
      }
      if (
        e instanceof PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new HttpException(
          { key: 'errors.emailTaken' },
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }

    return this.buildAuthResponse(user, RefreshAudience.user);
  }

  async login(dto: LoginDto) {
    const captchaOk = await this.captcha.verifyAndConsume(
      dto.captchaId,
      dto.captchaCode,
    );
    if (!captchaOk) {
      throw new BadRequestException('验证码错误或已过期，请重试');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    /** 用户站登录始终签发 `aud: user`（即便账号为 admin，见 ADMIN_MODULE）。 */
    return this.buildAuthResponse(user, RefreshAudience.user);
  }

  /**
   * 管理端独立登录：同 `login` 校验 + 必须 `role === admin`，签发 `aud: admin` 与 admin refresh。
   */
  async loginAsAdmin(dto: LoginDto, meta?: { ip?: string | null }) {
    const captchaOk = await this.captcha.verifyAndConsume(
      dto.captchaId,
      dto.captchaCode,
    );
    if (!captchaOk) {
      throw new BadRequestException('验证码错误或已过期，请重试');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.role !== UserRole.admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const session = await this.buildAuthResponse(user, RefreshAudience.admin);
    await this.audit.appendSafe({
      actorId: user.id,
      action: AdminAuditActions.LOGIN_OK,
      targetType: 'admin_auth',
      targetId: user.id,
      ip: meta?.ip ?? null,
    });
    return session;
  }

  /**
   * 忘记密码：防枚举——始终 `{ ok: true }`（429、验证码错误等非枚举语义除外）。
   */
  async requestPasswordReset(
    dto: ForgotPasswordDto,
    meta?: { ip?: string | null },
  ): Promise<{ ok: true }> {
    const captchaOk = await this.captcha.verifyAndConsume(
      dto.captchaId,
      dto.captchaCode,
    );
    if (!captchaOk) {
      throw new BadRequestException('验证码错误或已过期，请重试');
    }

    const normalizedEmail = dto.email.toLowerCase();
    await this.forgotLimiter.assertWithinLimits(
      (meta?.ip ?? 'unknown').trim().slice(0, 128) || 'unknown',
      normalizedEmail,
    );

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 20 + Math.floor(Math.random() * 31)),
    );

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      this.logger.log(
        `requestPasswordReset skip mail: user missing or inactive email=${normalizedEmail}`,
      );
      return { ok: true };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    const plainToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashPasswordResetPlain(plainToken);
    const minutes = Math.max(
      5,
      Number(this.config.get<string>('PASSWORD_RESET_EXPIRES_MINUTES') ?? 30),
    );
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const base = this.passwordResetFrontendBaseUrl();
    const resetLink = `${base}/reset-password?token=${plainToken}`;
    this.logger.log(
      `requestPasswordReset sending mail to=${user.email} userId=${user.id}`,
    );
    void this.mail.sendPasswordResetEmail(user.email, resetLink).then((ok) => {
      if (ok) {
        this.logger.log(
          `requestPasswordReset mail ok to=${user.email} userId=${user.id}`,
        );
      } else {
        this.logger.warn(
          `requestPasswordReset mail failed to=${user.email} userId=${user.id}`,
        );
      }
    });

    return { ok: true };
  }

  async completePasswordReset(dto: ResetPasswordDto): Promise<void> {
    const normalizedToken = dto.token.trim().toLowerCase();
    const tokenHash = hashPasswordResetPlain(normalizedToken);
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      const row = await tx.passwordResetToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!row) {
        throw new BadRequestException('无效或已过期的重置链接');
      }

      const user = await tx.user.findUnique({
        where: { id: row.userId },
      });

      if (!user?.isActive) {
        throw new BadRequestException('无效或已过期的重置链接');
      }

      await tx.refreshToken.deleteMany({
        where: { userId: row.userId, audience: RefreshAudience.user },
      });

      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      });

      const marked = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (marked.count !== 1) {
        throw new BadRequestException('无效或已过期的重置链接');
      }
    });
  }

  private passwordResetFrontendBaseUrl(): string {
    const explicit =
      this.config.get<string>('PASSWORD_RESET_FRONTEND_URL')?.trim() ?? '';
    if (explicit) {
      return explicit.replace(/\/+$/, '');
    }
    const originsRaw =
      this.config.get<string>('FRONTEND_ORIGIN')?.trim() ?? '';
    if (originsRaw) {
      const first = originsRaw
        .split(',')
        .map((o) => o.trim())
        .find(Boolean);
      if (first) {
        return first.replace(/\/+$/, '');
      }
    }
    return 'http://localhost:5173';
  }

  async refresh(refreshTokenPlain: string) {
    return this.refreshWithAudience(refreshTokenPlain, RefreshAudience.user);
  }

  async refreshAsAdmin(refreshTokenPlain: string) {
    return this.refreshWithAudience(refreshTokenPlain, RefreshAudience.admin);
  }

  private async refreshWithAudience(
    refreshTokenPlain: string,
    audience: RefreshAudience,
  ) {
    const tokenHash = hashRefreshToken(refreshTokenPlain);
    const row = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, audience },
    });

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!user.isActive) {
      await this.prisma.refreshToken.delete({ where: { id: row.id } }).catch(() => {});
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: row.id } });

    return this.buildAuthResponse(user, audience);
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    await this.logoutWithAudience(refreshTokenPlain, RefreshAudience.user);
  }

  async logoutAsAdmin(refreshTokenPlain: string): Promise<void> {
    await this.logoutWithAudience(refreshTokenPlain, RefreshAudience.admin);
  }

  private async logoutWithAudience(
    refreshTokenPlain: string,
    audience: RefreshAudience,
  ): Promise<void> {
    const tokenHash = hashRefreshToken(refreshTokenPlain);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash, audience } });
  }

  private async buildAuthResponse(user: User, sessionAudience: RefreshAudience) {
    const aud: JwtAccessPayload['aud'] =
      sessionAudience === RefreshAudience.admin ? 'admin' : 'user';
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      aud,
    };

    const accessToken = await this.jwt.signAsync(payload);

    const refreshPlain = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshHash = hashRefreshToken(refreshPlain);
    const refreshDays = Number(process.env.JWT_REFRESH_DAYS ?? 7);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshDays);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        audience: sessionAudience,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshPlain,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        storageQuotaBytes: user.storageQuotaBytes.toString(),
        storageUsedBytes: user.storageUsedBytes.toString(),
        monthlyDownloadQuotaBytes: user.monthlyDownloadQuotaBytes.toString(),
      },
    };
  }
}
