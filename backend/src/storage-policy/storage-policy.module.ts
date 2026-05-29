import { Module } from '@nestjs/common';

import { HardRejectOverStorageQuotaPolicy } from './policies/hard-reject-over-storage-quota.policy';
import { STORAGE_TASK_ENQUEUE_POLICIES } from './storage-policy.tokens';
import { StoragePolicyService } from './storage-policy.service';

/**
 * 存储与资源侧「策略」集中注册点，便于后续增加：
 * - 出站带宽 / 月下载用量（与 `monthly_download_quota_bytes` 联动）
 * - 软拒绝、宽限期、按套餐覆盖等
 */
@Module({
  providers: [
    HardRejectOverStorageQuotaPolicy,
    {
      provide: STORAGE_TASK_ENQUEUE_POLICIES,
      useFactory: (hard: HardRejectOverStorageQuotaPolicy) => [hard],
      inject: [HardRejectOverStorageQuotaPolicy],
    },
    StoragePolicyService,
  ],
  exports: [StoragePolicyService],
})
export class StoragePolicyModule {}
