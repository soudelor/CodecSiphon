import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { LoginDto } from '../auth/dto/login.dto';
import { RefreshDto } from '../auth/dto/refresh.dto';

/** 管理端独立认证（ADMIN_MODULE §9）；access 为 `aud: admin` + refresh `audience: admin`。 */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.loginAsAdmin(dto, {
      ip: AdminAuditService.clientIp(req),
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshAsAdmin(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logoutAsAdmin(dto.refreshToken);
  }
}
