import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { TasksModule } from '../tasks/tasks.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminMediaController } from './admin-media.controller';
import { AdminMediaService } from './admin-media.service';
import { AdminTasksController } from './admin-tasks.controller';
import { AdminTasksService } from './admin-tasks.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [AuthModule, TasksModule, MediaModule],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminTasksController,
    AdminMediaController,
  ],
  providers: [
    AdminUsersService,
    AdminTasksService,
    AdminMediaService,
    AdminAuthGuard,
  ],
})
export class AdminModule {}
