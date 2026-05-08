import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DownloadModule } from '../download/download.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [AuthModule, DownloadModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
