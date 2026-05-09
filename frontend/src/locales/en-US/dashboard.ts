export default {
  welcomeBack: 'Welcome back, {name}',
  intro:
    'Use “New task” in the sidebar to add downloads, or open “Tasks” for full history and progress.',
  newDownloadTask: 'New download',
  manageTasks: 'Manage tasks',
  systemStatus: 'System status',
  systemStatusHint:
    'Tasks queue automatically after you submit them—no extra “run” click. If the service is having issues, creating or resuming tasks may fail; try again later or contact an admin.',
  connStatus: 'Connection',
  connReady: 'Ready',
  saveLocation: 'Save location',
  saveLocationValue: 'This account’s download folder',
  cloudSync: 'Cloud sync',
  cloudSyncNA: 'Not available yet',
  recentTasks: 'Recent tasks',
  loadRecentFailed: 'Could not load recent tasks. Check your network.',
  noTasksYet: 'No tasks yet. Create one to get started.',
  colTitleUrl: 'Title / URL',
  colType: 'Type',
  colStatus: 'Status',
  colProgress: 'Progress',
  colActions: 'Actions',
  pause: 'Pause',
  resume: 'Resume',
  retry: 'Retry',
  cancel: 'Cancel',
  delete: 'Delete',
  deleteTaskConfirm:
    'Delete this task?\n“{label}”\n\nQueued downloads will be stopped, and the downloaded folder plus media records will be removed (cannot be undone).',
  deleteTaskConfirmDash:
    'Delete this task?\n“{label}”\n\nQueued work will be cancelled along with the task folder and library records (cannot be undone).',
} as const;
