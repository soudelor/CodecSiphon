import type { AuthResponse } from '@/types/models';
import { api } from './client';

export async function fetchLoginCaptcha() {
  const { data } = await api.get<{ captchaId: string; svg: string }>(
    '/auth/captcha',
  );
  return data;
}

export async function login(
  email: string,
  password: string,
  captchaId: string,
  captchaCode: string,
) {
  const { data } = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
    captchaId,
    captchaCode,
  });
  return data;
}

export async function sendRegistrationCode(body: {
  email: string;
  captchaId: string;
  captchaCode: string;
}) {
  const { data } = await api.post<{ ok: true }>(
    '/auth/send-registration-code',
    body,
  );
  return data;
}

export async function register(body: {
  email: string;
  password: string;
  displayName?: string;
  emailVerificationCode: string;
}) {
  const { data } = await api.post<AuthResponse>('/auth/register', body);
  return data;
}

export async function logout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}

export async function forgotPassword(body: {
  email: string;
  captchaId: string;
  captchaCode: string;
}) {
  const { data } = await api.post<{ ok: true }>(
    '/auth/forgot-password',
    body,
  );
  return data;
}

export async function resetPassword(token: string, newPassword: string) {
  await api.post('/auth/reset-password', { token, newPassword });
}
