export default {
  sourceType: {
    single_url: '单链接',
    multi_url: '批量链接',
    playlist: '播放列表',
    subscription: '订阅',
  },
  status: {
    pending: '待处理',
    queued: '排队中',
    parsing: '解析中',
    downloading: '下载中',
    processing: '处理中',
    completed: '已完成',
    paused: '已暂停',
    cancelled: '已取消',
    failed: '失败',
  },
} as const;
