import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as authApi from '@/api/auth';
import type { AuthUser } from '@/types/models';

function readUser(): AuthUser | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<AuthUser | null>(readUser());

  const isAuthenticated = computed(() => Boolean(accessToken.value));

  function persistSession(payload: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }) {
    accessToken.value = payload.accessToken;
    refreshToken.value = payload.refreshToken;
    user.value = payload.user;
    localStorage.setItem('accessToken', payload.accessToken);
    localStorage.setItem('refreshToken', payload.refreshToken);
    localStorage.setItem('user', JSON.stringify(payload.user));
  }

  function clearSession() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  async function login(
    email: string,
    password: string,
    captchaId: string,
    captchaCode: string,
  ) {
    const data = await authApi.login(email, password, captchaId, captchaCode);
    persistSession(data);
  }

  async function register(body: {
    email: string;
    password: string;
    displayName?: string;
    emailVerificationCode: string;
  }) {
    const data = await authApi.register(body);
    persistSession(data);
  }

  async function logout() {
    const rt = refreshToken.value;
    try {
      if (rt) await authApi.logout(rt);
    } catch {
      /* ignore network errors on logout */
    }
    clearSession();
  }

  /** 与登录/refresh 同源字段；用于补齐旧版 localStorage 中的 user */
  function mergeUserProfile(patch: Partial<AuthUser>): void {
    if (!user.value) {
      return;
    }
    user.value = { ...user.value, ...patch };
    localStorage.setItem('user', JSON.stringify(user.value));
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    login,
    register,
    logout,
    persistSession,
    clearSession,
    mergeUserProfile,
  };
});
