import type { AuthResponse } from '@/types/models';
import { api } from './client';

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return data;
}

export async function register(body: {
  email: string;
  password: string;
  displayName?: string;
}) {
  const { data } = await api.post<AuthResponse>('/auth/register', body);
  return data;
}

export async function logout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}
