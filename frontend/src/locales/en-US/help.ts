export default {
  title: 'Help',
  intro:
    'Use this site to queue video downloads, watch progress, then browse or delete saved files under “Files”. Deployment details live in the repo; day-to-day use follows the steps below.',
  notice:
    'This app and related resources are for personal learning and research only. Commercial use, resale, or profit is prohibited. You are responsible for any misuse.',
  quickStart: 'Quick start',
  step1: 'Open the URL from your admin and register or sign in.',
  step2:
    'Under “New task”, paste a link, click “Detect”, choose quality/format, then start the download.',
  step3:
    'Use “Tasks” to monitor queue, active, and finished work—pause, resume, retry, or delete as needed.',
  step4:
    'When finished, open “Files” to search, download to your PC, or delete entries.',
  step5:
    'Adjust default quality, proxy, referer, etc. under “Settings”; per-task overrides still win.',
  navTitle: 'Shortcuts',
  navTasks: 'Tasks',
  navTasksDesc: 'Control download progress',
  navFiles: 'Files',
  navFilesDesc: 'Browse, download locally, or delete',
  navSettings: 'Settings',
  navSettingsDesc: 'Defaults and preferences',
  faqTitle: 'FAQ',
  faqPageLoad: 'Page won’t load or spins forever',
  faqPageLoadAns:
    'Check the network; on corporate networks ask your admin about the service URL and allowlists.',
  faqDetect: 'Detection fails',
  faqDetectAns:
    'Open the same URL in a browser. If it plays, set referer/login-related fields under “Settings” and retry.',
  faqDelete: 'What happens when I delete a task?',
  faqDeleteAns:
    'Incomplete downloads stop, and the task folder plus library rows are removed permanently.',
  supportTitle: 'Support the project',
  supportBody:
    'Code can run on passion, but servers and bandwidth cost real money. Behind every free account, I’m doing my best to keep things running. If you find it useful, please scan to chip in so I can keep it going a little longer.',
  supportWechatCaption: 'WeChat Pay',
  supportAlipayCaption: 'Alipay',
  supportWechatAlt: 'WeChat Pay QR code for tips',
  supportAlipayAlt: 'Alipay QR code for tips',
} as const;
