import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { StorageTaskEnqueuePolicy } from '../storage-task-enqueue.policy';

/** 存储已用 ≥ 配额时拒绝新建会持续占库的下载任务（硬拒绝 / Mode A）。 */
@Injectable()
export class HardRejectOverStorageQuotaPolicy implements StorageTaskEnqueuePolicy {
  readonly name = 'HardRejectOverStorageQuota';

  constructor(private readonly prisma: PrismaService) {}

  async assertAllowed(userId: string): Promise<void> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsedBytes: true, storageQuotaBytes: true },
    });
    if (!u) {
      throw new NotFoundException('User not found');
    }
    if (u.storageUsedBytes >= u.storageQuotaBytes) {
      throw new HttpException(
        { key: 'errors.storageQuotaEnqueueDenied' },
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
