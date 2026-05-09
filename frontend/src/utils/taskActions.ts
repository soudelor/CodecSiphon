import type { DownloadTask, TaskStatus } from '@/types/models';

const ACTIVE: TaskStatus[] = [
  'pending',
  'queued',
  'parsing',
  'downloading',
  'processing',
];

/** 这些状态下的任务进度可能在后台持续变化，列表宜轮询刷新。 */
export function taskNeedsLiveProgress(t: DownloadTask): boolean {
  return ACTIVE.includes(t.status);
}

export function taskListNeedsLivePolling(items: DownloadTask[]): boolean {
  return items.some(taskNeedsLiveProgress);
}

export function canPauseTask(t: DownloadTask): boolean {
  return ACTIVE.includes(t.status);
}

/** 未完成且未取消即可尝试取消（含失败、暂停、进行中） */
export function canCancelTask(t: DownloadTask): boolean {
  return t.status !== 'completed' && t.status !== 'cancelled';
}

export function canResumeTask(t: DownloadTask): boolean {
  return t.status === 'paused';
}

export function canRetryTask(t: DownloadTask): boolean {
  return t.status === 'failed';
}
