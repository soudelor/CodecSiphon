export default {
  welcomeBack: '欢迎回来，{name}',
  intro:
    '在左侧点「新建任务」添加下载，或到「任务管理」查看全部进度与历史。',
  newDownloadTask: '新建下载任务',
  manageTasks: '任务管理',
  systemStatus: '系统状态',
  systemStatusHint:
    '提交任务后会自动排队下载，无需您手动再点执行。服务异常时新建或继续任务可能失败，可稍后再试或联系管理员。',
  connStatus: '连接状态',
  connReady: '已就绪',
  saveLocation: '保存位置',
  saveLocationValue: '当前账号下载目录',
  cloudSync: '网盘同步',
  cloudSyncNA: '尚未开放',
  recentTasks: '最近任务',
  loadRecentFailed: '无法加载最近任务，请检查网络后重试',
  noTasksYet: '暂无任务，去新建一个吧。',
  colTitleUrl: '标题 / URL',
  colType: '类型',
  colStatus: '状态',
  colProgress: '进度',
  colActions: '操作',
  pause: '暂停',
  resume: '继续',
  retry: '重试',
  cancel: '取消',
  delete: '删除',
  deleteTaskConfirm:
    '确定删除此任务？\n「{label}」\n\n将取消未开始的下载，并删除已下载文件夹及文件库里的对应记录（不可恢复）。',
  deleteTaskConfirmDash:
    '确定删除此任务？\n「{label}」\n\n将取消排队中的下载，并删除该任务对应的文件夹及文件库记录（不可恢复）。',
} as const;
