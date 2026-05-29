/** 在用户「入库型」下载任务入队前的策略；可多策略串联，抛出即拒绝 */
export interface StorageTaskEnqueuePolicy {
  /** 运维 / 日志用标识 */
  readonly name: string;
  assertAllowed(userId: string): Promise<void>;
}
