import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { PatchAdminUserDto } from './dto/patch-admin-user.dto';
import { AdminUsersService } from './admin-users.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@UseGuards(AuthGuard('jwt'), AdminAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminListUsersQueryDto) {
    return this.adminUsers.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsers.detail(id);
  }

  @Patch(':id')
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchAdminUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminUsers.patch(
      actor.id,
      AdminAuditService.clientIp(req),
      id,
      dto,
    );
  }
}
