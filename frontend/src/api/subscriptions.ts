import type { Subscription, SubscriptionListResponse } from '@/types/models';
import { api } from './client';

export async function listSubscriptions(
  page = 1,
  limit = 20,
  status?: 'active' | 'paused',
) {
  const { data } = await api.get<SubscriptionListResponse>('/subscriptions', {
    params: { page, limit, ...(status ? { status } : {}) },
  });
  return data;
}

export async function createSubscription(body: {
  type: 'channel' | 'playlist' | 'rss';
  sourceUrl: string;
  displayName?: string;
  checkIntervalSec?: number;
  downloadOptions?: Record<string, unknown>;
  filterRules?: Record<string, unknown>;
  notifyEmail?: boolean;
  notifyDesktop?: boolean;
}) {
  const { data } = await api.post<Subscription>('/subscriptions', body);
  return data;
}

export async function updateSubscription(
  id: string,
  body: Partial<{
    type: 'channel' | 'playlist' | 'rss';
    sourceUrl: string;
    displayName: string;
    status: 'active' | 'paused';
    checkIntervalSec: number;
    downloadOptions: Record<string, unknown>;
    filterRules: Record<string, unknown>;
    notifyEmail: boolean;
    notifyDesktop: boolean;
  }>,
) {
  const { data } = await api.patch<Subscription>(
    `/subscriptions/${id}`,
    body,
  );
  return data;
}

export async function deleteSubscription(id: string): Promise<void> {
  await api.delete(`/subscriptions/${id}`);
}
