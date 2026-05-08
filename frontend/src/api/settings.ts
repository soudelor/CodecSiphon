import type { UserSettingsPayload } from '@/types/models';
import { api } from './client';

export async function getSettings() {
  const { data } = await api.get<UserSettingsPayload>('/settings');
  return data;
}

export async function patchSettings(body: {
  preferences?: Record<string, unknown>;
  downloadDefaults?: Record<string, unknown>;
}) {
  const { data } = await api.patch<UserSettingsPayload>('/settings', body);
  return data;
}
