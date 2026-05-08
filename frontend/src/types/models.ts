export type TaskSourceType =
  | 'single_url'
  | 'multi_url'
  | 'playlist'
  | 'subscription';

export type TaskPreviewPlaylistEntry = {
  index: number;
  id: string | null;
  title: string;
  duration: number | null;
};

export type TaskPreviewVideo = {
  kind: 'video';
  title: string | null;
  duration: number | null;
  durationLabel: string | null;
  uploader: string | null;
  thumbnail: string | null;
  id: string | null;
  webpageUrl: string | null;
};

export type TaskPreviewPlaylist = {
  kind: 'playlist';
  title: string | null;
  playlistId: string | null;
  entryCount: number;
  entries: TaskPreviewPlaylistEntry[];
};

export type TaskPreviewResult = TaskPreviewVideo | TaskPreviewPlaylist;

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'parsing'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'failed';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type DownloadTask = {
  id: string;
  userId: string;
  subscriptionId: string | null;
  sourceType: TaskSourceType;
  status: TaskStatus;
  sourceUrl: string | null;
  sourceUrls: string[];
  title: string | null;
  platform: string | null;
  options: Record<string, unknown>;
  progressPercent: number;
  bytesDownloaded: string;
  bytesTotal: string | null;
  speedBytesPerSec: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListResponse = {
  items: DownloadTask[];
  total: number;
  page: number;
  limit: number;
};

export type MediaFileRow = {
  id: string;
  userId: string;
  taskId: string | null;
  /** 关联下载任务的标题（无任务或未设标题时为 null） */
  taskTitle: string | null;
  folderId: string | null;
  fileName: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type MediaListResponse = {
  items: MediaFileRow[];
  total: number;
  page: number;
  limit: number;
};

export type SubscriptionType = 'channel' | 'playlist' | 'rss';
export type SubscriptionStatus = 'active' | 'paused';

export type Subscription = {
  id: string;
  userId: string;
  type: SubscriptionType;
  sourceUrl: string;
  displayName: string | null;
  status: SubscriptionStatus;
  checkIntervalSec: number;
  downloadOptions: Record<string, unknown>;
  filterRules: Record<string, unknown>;
  notifyEmail: boolean;
  notifyDesktop: boolean;
  lastCheckedAt: string | null;
  lastItemPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionListResponse = {
  items: Subscription[];
  total: number;
  page: number;
  limit: number;
};

export type UserSettingsPayload = {
  preferences: Record<string, unknown>;
  downloadDefaults: Record<string, unknown>;
  updatedAt: string | null;
  /** 多条链接任务允许的 URL 数量上限（来自服务器配置） */
  multiUrlMaxLinks: number;
};
