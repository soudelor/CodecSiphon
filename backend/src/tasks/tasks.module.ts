import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DownloadModule } from '../download/download.module';
import { StoragePolicyModule } from '../storage-policy/storage-policy.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [AuthModule, DownloadModule, StoragePolicyModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
