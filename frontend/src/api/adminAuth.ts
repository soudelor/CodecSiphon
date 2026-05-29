import axios from 'axios';
import type { AuthResponse } from '@/types/models';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function antiReplayHeaders(): Record<string, string> {
  return {
    'X-Client-Timestamp': String(Date.now()),
    'X-Client-Nonce': crypto.randomUUID(),
  };
}

export async function adminLogin(body: {
  email: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(
    `${baseURL}/admin/auth/login`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        ...antiReplayHeaders(),
      },
    },
  );
  return data;
}

export async function adminRefresh(refreshToken: string): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(
    `${baseURL}/admin/auth/refresh`,
    { refreshToken },
    {
      headers: {
        'Content-Type': 'application/json',
        ...antiReplayHeaders(),
      },
    },
  );
  return data;
}

export async function adminLogout(refreshToken: string): Promise<void> {
  await axios.post(
    `${baseURL}/admin/auth/logout`,
    { refreshToken },
    {
      headers: {
        'Content-Type': 'application/json',
        ...antiReplayHeaders(),
      },
    },
  );
}
