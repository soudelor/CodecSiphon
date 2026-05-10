import type { MediaFileRow, MediaListResponse } from '@/types/models';
import { api } from './client';

export function mediaDownloadLocalName(m: MediaFileRow): string {
  const base = m.fileName?.trim() || 'download';
  const t = m.taskTitle?.trim();
  if (!t) return base;
  const safe = sanitizeForDownloadSegment(t);
  if (!safe) return base;
  return `${safe}_${base}`;
}

function sanitizeForDownloadSegment(s: string): string {
  return s
    .replace(/[\u0000\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export async function listMedia(page = 1, limit = 20, q?: string) {
  const { data } = await api.get<MediaListResponse>('/media', {
    params: { page, limit, ...(q?.trim() ? { q: q.trim() } : {}) },
  });
  return data;
}

const apiBase = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/**
 * 使用短期令牌由服务端流式响应；通过隐藏 iframe 触发下载，不新开可见标签页。
 * `downloadAsName` 写入签发令牌，服务端用于 Content-Disposition。
 */
export async function downloadMediaToDevice(id: string, downloadAsName: string) {
  const name = downloadAsName.trim() || 'download';
  const { data } = await api.post<{
    path: string;
    token: string;
    expiresInSec: number;
  }>(`/media/${id}/download-link`, {
    fileName: name,
  });
  const url = `${apiBase()}${data.path}?dl_token=${encodeURIComponent(data.token)}`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.cssText =
    'position:fixed;width:0;height:0;border:0;clip:rect(0,0,0,0);pointer-events:none';
  iframe.src = url;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  }, 300_000);
}

export async function deleteMedia(id: string): Promise<void> {
  await api.delete(`/media/${id}`);
}
