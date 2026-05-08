import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DownloadProcessor } from './download.processor';
import { QUEUE_DOWNLOAD } from './download.constants';

/** Re-use the same dynamic module so queue providers are exported to importers (e.g. TasksModule). */
const downloadQueueRegistration = BullModule.registerQueue({
  name: QUEUE_DOWNLOAD,
});

@Module({
  imports: [downloadQueueRegistration],
  providers: [DownloadProcessor],
  exports: [downloadQueueRegistration],
})
export class DownloadModule {}
