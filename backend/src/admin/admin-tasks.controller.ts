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
import { AdminTasksService } from './admin-tasks.service';
import { AdminListTasksQueryDto } from './dto/admin-list-tasks-query.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@UseGuards(AuthGuard('jwt'), AdminAuthGuard)
@Controller('admin/tasks')
export class AdminTasksController {
  constructor(private readonly adminTasks: AdminTasksService) {}

  @Get()
  list(@Query() query: AdminListTasksQueryDto) {
    return this.adminTasks.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTasks.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.adminTasks.remove(id, {
      actorId: actor.id,
      ip: AdminAuditService.clientIp(req),
    });
  }
}
