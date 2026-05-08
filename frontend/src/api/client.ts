import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

let refreshJob: Promise<string | null> | null = null;

function antiReplayHeaders(): Record<string, string> {
  return {
    'X-Client-Timestamp': String(Date.now()),
    'X-Client-Nonce': crypto.randomUUID(),
  };
}

async function refreshAccessToken(): Promise<string | null> {
  const rt = localStorage.getItem('refreshToken');
  if (!rt) return null;

  const { data } = await axios.post<{
    accessToken: string;
    refreshToken: string;
    user: unknown;
  }>(`${baseURL}/auth/refresh`, { refreshToken: rt }, { headers: antiReplayHeaders() });

  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data.accessToken;
}

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

api.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  Object.assign(
    config.headers as Record<string, string>,
    antiReplayHeaders(),
  );

  const url = config.url ?? '';
  const skipAuth =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh');

  if (!skipAuth) {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization =
        `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
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
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !url.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        if (!refreshJob) {
          refreshJob = refreshAccessToken().finally(() => {
            refreshJob = null;
          });
        }
        const next = await refreshJob;
        if (next) {
          (original.headers as Record<string, string>).Authorization =
            `Bearer ${next}`;
          return api(original);
        }
      } catch {
        /* fall through */
      }
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }

    return Promise.reject(error);
  },
);
