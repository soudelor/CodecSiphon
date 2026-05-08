import type { TaskSourceType, TaskStatus } from '@/types/models';

export function sourceTypeLabel(t: TaskSourceType): string {
  switch (t) {
    case 'single_url':
      return '单链接';
    case 'multi_url':
      return '批量链接';
    case 'playlist':
      return '播放列表';
    case 'subscription':
      return '订阅';
    default:
      return t;
  }
}

export function taskStatusLabel(s: TaskStatus): string {
  switch (s) {
    case 'pending':
      return '待处理';
    case 'queued':
      return '排队中';
    case 'parsing':
      return '解析中';
    case 'downloading':
      return '下载中';
    case 'processing':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'paused':
      return '已暂停';
    case 'cancelled':
      return '已取消';
    case 'failed':
      return '失败';
    default:
      return s;
  }
}
