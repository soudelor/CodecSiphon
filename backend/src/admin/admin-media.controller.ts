import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AdminMediaService } from './admin-media.service';
import { AdminListMediaFilesQueryDto } from './dto/admin-list-media-files-query.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@UseGuards(AuthGuard('jwt'), AdminAuthGuard)
@Controller('admin')
export class AdminMediaController {
  constructor(private readonly adminMedia: AdminMediaService) {}

  @Get('users/:userId/media-files')
  listByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AdminListMediaFilesQueryDto,
  ) {
    return this.adminMedia.listForUser(userId, query);
  }

  @Get('media-files/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminMedia.findOne(id);
  }

  @Delete('media-files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.adminMedia.deleteFile(id, {
      actorId: actor.id,
      ip: AdminAuditService.clientIp(req),
    });
  }
}
