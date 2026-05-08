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

/** `downloadAsName` 为浏览器「另存为」使用的完整文件名（通常已含扩展名） */
export async function downloadMediaToDevice(id: string, downloadAsName: string) {
  const res = await api.get(`/media/${id}/download`, {
    responseType: 'blob',
    timeout: 0,
  });

  const blob = res.data as Blob;
  const name = downloadAsName.trim() || 'download';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deleteMedia(id: string): Promise<void> {
  await api.delete(`/media/${id}`);
}
