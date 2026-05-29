import { Inject, Injectable } from '@nestjs/common';

import { STORAGE_TASK_ENQUEUE_POLICIES } from './storage-policy.tokens';
import type { StorageTaskEnqueuePolicy } from './storage-task-enqueue.policy';

/**
 * 资源 / 配额策略门面：可按域扩展（出站带宽、抓取并发等），由独立 Policy 注入与串联。
 */
@Injectable()
export class StoragePolicyService {
  constructor(
    @Inject(STORAGE_TASK_ENQUEUE_POLICIES)
    private readonly enqueuePolicies: StorageTaskEnqueuePolicy[],
  ) {}

  /** 可增加持久化入库字节的下载任务入队前：执行全部已注册的 storage 策略。 */
  async assertDownloadTaskEnqueueAllowed(userId: string): Promise<void> {
    for (const p of this.enqueuePolicies) {
      await p.assertAllowed(userId);
    }
  }
}
