import type {
  DownloadTask,
  TaskListResponse,
  TaskPreviewResult,
  TaskSourceType,
} from '@/types/models';
import { api } from './client';

export async function listTasks(page = 1, limit = 20) {
  const { data } = await api.get<TaskListResponse>('/tasks', {
    params: { page, limit },
  });
  return data;
}

export async function createTask(body: {
  sourceType: TaskSourceType;
  sourceUrl?: string;
  sourceUrls?: string[];
  subscriptionId?: string;
  title: string;
  platform?: string;
  options?: Record<string, unknown>;
}) {
  const { data } = await api.post<DownloadTask>('/tasks', body);
  return data;
}

export async function previewTaskUrl(url: string) {
  const { data } = await api.post<TaskPreviewResult>('/tasks/preview', {
    url,
  });
  return data;
}

export async function getTask(id: string) {
  const { data } = await api.get<DownloadTask>(`/tasks/${id}`);
  return data;
}

export async function updateTaskStatus(
  id: string,
  status: 'paused' | 'cancelled' | 'queued',
) {
  const { data } = await api.patch<DownloadTask>(`/tasks/${id}`, { status });
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
