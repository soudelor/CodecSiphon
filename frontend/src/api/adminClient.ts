import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as adminAuthApi from '@/api/adminAuth';
import { adminLoginPath } from '@/utils/adminEntry';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** 独立管理端会话：仅用 `adminAccessToken` / `adminRefreshToken`（与用户站分离）。 */
export const adminApi = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

let adminRefreshJob: Promise<string | null> | null = null;

function antiReplayHeaders(): Record<string, string> {
  return {
    'X-Client-Timestamp': String(Date.now()),
    'X-Client-Nonce': crypto.randomUUID(),
  };
}

async function refreshAdminAccessToken(): Promise<string | null> {
  const rt = localStorage.getItem('adminRefreshToken');
  if (!rt) return null;
  try {
    const data = await adminAuthApi.adminRefresh(rt);
    localStorage.setItem('adminAccessToken', data.accessToken);
    localStorage.setItem('adminRefreshToken', data.refreshToken);
    localStorage.setItem('adminUser', JSON.stringify(data.user));
    return data.accessToken;
  } catch {
    return null;
  }
}

function clearAdminSession() {
  localStorage.removeItem('adminAccessToken');
  localStorage.removeItem('adminRefreshToken');
  localStorage.removeItem('adminUser');
}

adminApi.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  Object.assign(
    config.headers as Record<string, string>,
    antiReplayHeaders(),
  );

  const url = config.url ?? '';
  const skipAuth =
    url.includes('/admin/auth/login') ||
    url.includes('/admin/auth/refresh') ||
    url.includes('/admin/auth/logout');

  if (!skipAuth) {
    const token = localStorage.getItem('adminAccessToken');
    if (token) {
      (config.headers as Record<string, string>).Authorization =
        `Bearer ${token}`;
    }
  }
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!original || original._retry) {
      return Promise.reject(error);
    }

    const url = original.url ?? '';
    if (
      error.response?.status === 401 &&
      !url.includes('/admin/auth/login') &&
      !url.includes('/admin/auth/refresh')
    ) {
      original._retry = true;
      try {
        if (!adminRefreshJob) {
          adminRefreshJob = refreshAdminAccessToken().finally(() => {
            adminRefreshJob = null;
          });
        }
        const next = await adminRefreshJob;
        if (next) {
          (original.headers as Record<string, string>).Authorization =
            `Bearer ${next}`;
          return adminApi(original);
        }
      } catch {
        /* fall through */
      }
      clearAdminSession();
      const loginPath = adminLoginPath();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login')
      ) {
        window.location.href = `${loginPath}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
    }

    return Promise.reject(error);
  },
);
