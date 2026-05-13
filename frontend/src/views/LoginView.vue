<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const { t, locale } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const captchaId = ref<string | null>(null);
const captchaCode = ref('');
const captchaSvg = ref('');
const captchaLoading = ref(false);
const loading = ref(false);
const errorMsg = ref('');

const captchaImgSrc = computed(() =>
  captchaSvg.value
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg.value)}`
    : '',
);

/** Normalize known backend zh messages to current UI language */
function localizeAuthMessage(raw: string): string {
  const s = raw.trim();
  if (s === '用户名或密码错误') return t('auth.invalidLoginFallback');
  if (s === '验证码错误或已过期，请重试')
    return locale.value === 'en-US'
      ? 'Incorrect or expired verification code. Please try again.'
      : s;
  if (s === '验证码服务不可用，请确认 Redis')
    return locale.value === 'en-US'
      ? 'Captcha service unavailable. Check Redis.'
      : s;
  return s;
}

function extractApiErrorMessage(e: unknown): string | null {
  if (!axios.isAxiosError(e)) return null;
  const raw = e.response?.data as { message?: string | string[] };
  const m = raw?.message;
  if (typeof m === 'string' && m.trim())
    return localizeAuthMessage(m.trim());
  if (Array.isArray(m) && m.length)
    return m
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => localizeAuthMessage(x))
      .join(locale.value === 'en-US' ? '; ' : '；');
  return null;
}

async function loadCaptcha() {
  captchaLoading.value = true;
  captchaCode.value = '';
  try {
    const data = await authApi.fetchLoginCaptcha();
    captchaId.value = data.captchaId;
    captchaSvg.value = data.svg;
  } catch (e) {
    captchaId.value = null;
    captchaSvg.value = '';
    errorMsg.value = extractApiErrorMessage(e) ?? t('auth.captchaLoadFallback');
  } finally {
    captchaLoading.value = false;
  }
}

onMounted(() => {
  void loadCaptcha();
});

async function submit() {
  errorMsg.value = '';
  if (!captchaId.value) {
    errorMsg.value = t('auth.needCaptchaFirst');
    void loadCaptcha();
    return;
  }
  loading.value = true;
  try {
    await auth.login(
      email.value.trim(),
      password.value,
      captchaId.value,
      captchaCode.value.trim(),
    );
    const redirect = route.query.redirect as string | undefined;
    router.push(redirect && redirect.startsWith('/') ? redirect : '/');
  } catch (e: unknown) {
    void loadCaptcha();
    if (axios.isAxiosError(e)) {
      const m = extractApiErrorMessage(e);
      if (m) {
        errorMsg.value = m;
      } else if (e.response?.status === 401) {
        errorMsg.value = t('auth.invalidLoginFallback');
      } else {
        errorMsg.value = t('errors.networkError');
      }
    } else {
      errorMsg.value = t('errors.networkError');
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-bar">
      <LanguageSwitcher />
    </div>
    <div class="card">
      <div class="hero">
        <div class="logo">▶</div>
        <h1>{{ t('layout.brandTitle') }}</h1>
        <p class="tag">{{ t('auth.loginTagline') }}</p>
      </div>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span>{{ t('auth.email') }}</span>
          <input v-model="email" type="email" required autocomplete="username" />
        </label>
        <label class="field">
          <span>{{ t('auth.password') }}</span>
          <input
            v-model="password"
            type="password"
            required
            minlength="1"
            autocomplete="current-password"
          />
        </label>

        <div class="field captcha-row">
          <span>{{ t('auth.captcha') }}</span>
          <div class="captcha-line">
            <input
              v-model="captchaCode"
              type="text"
              class="captcha-input"
              required
              autocomplete="off"
              maxlength="12"
              :placeholder="t('auth.captchaPlaceholder')"
              :disabled="captchaLoading || !captchaId"
            />
            <div class="captcha-img-wrap">
              <img
                v-if="captchaImgSrc"
                :src="captchaImgSrc"
                :alt="t('auth.captchaAlt')"
                class="captcha-img"
                width="140"
                height="44"
              />
              <span v-else class="captcha-placeholder">{{
                captchaLoading ? t('auth.captchaLoading') : t('auth.captchaNotLoaded')
              }}</span>
            </div>
            <button
              type="button"
              class="btn-refresh"
              :disabled="captchaLoading"
              :title="t('auth.refreshCaptchaTitle')"
              @click="loadCaptcha"
            >
              {{ t('auth.refreshCaptcha') }}
            </button>
          </div>
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button class="btn primary" type="submit" :disabled="loading">
          {{ loading ? t('auth.loggingIn') : t('auth.login') }}
        </button>

        <div class="footer">
          <div class="footer-left">
            <span>{{ t('auth.noAccount') }}</span>
            <RouterLink to="/register">{{ t('auth.registerLink') }}</RouterLink>
          </div>
          <RouterLink class="tool-link" to="/tools/url-extract">{{
            t('auth.urlExtractPublicLink')
          }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
  position: relative;
  background:
    radial-gradient(900px 400px at 10% 10%, rgba(62, 207, 142, 0.14), transparent),
    radial-gradient(700px 500px at 90% 30%, rgba(91, 224, 255, 0.12), transparent),
    var(--cs-bg);
}

.auth-bar {
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.card {
  width: min(420px, 100%);
  padding: 1.75rem;
  border-radius: 18px;
  border: 1px solid var(--cs-border);
  background: rgba(16, 22, 30, 0.92);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
}

.hero {
  text-align: center;
  margin-bottom: 1.25rem;
}

.logo {
  width: 52px;
  height: 52px;
  margin: 0 auto 0.75rem;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--cs-accent), #1fb6a6);
  color: #041016;
  font-weight: 900;
  font-size: 1.25rem;
}

h1 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.4;
  font-weight: 700;
}

.tag {
  margin: 0.35rem 0 0;
  color: var(--cs-muted);
  font-size: 0.92rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--cs-muted);
}

.field input {
  border-radius: 12px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.65rem 0.75rem;
  outline: none;
}

.field input:focus {
  border-color: rgba(62, 207, 142, 0.55);
  box-shadow: 0 0 0 3px rgba(62, 207, 142, 0.12);
}

.captcha-row .captcha-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.captcha-input {
  flex: 1;
  min-width: 7rem;
  border-radius: 12px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.65rem 0.75rem;
  outline: none;
}

.captcha-input:focus {
  border-color: rgba(62, 207, 142, 0.55);
  box-shadow: 0 0 0 3px rgba(62, 207, 142, 0.12);
}

.captcha-img-wrap {
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--cs-border);
  background: #0d141c;
}

.captcha-img {
  display: block;
  vertical-align: middle;
}

.captcha-placeholder {
  display: grid;
  place-items: center;
  width: 140px;
  height: 44px;
  font-size: 0.75rem;
  color: var(--cs-muted);
}

.btn-refresh {
  flex-shrink: 0;
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--cs-muted);
  padding: 0.45rem 0.65rem;
  font-size: 0.82rem;
  cursor: pointer;
}

.btn-refresh:hover:not(:disabled) {
  border-color: rgba(62, 207, 142, 0.45);
  color: var(--cs-accent);
}

.btn-refresh:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn.primary {
  margin-top: 0.25rem;
  border: none;
  border-radius: 12px;
  padding: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, var(--cs-accent), #25c9b5);
  color: #041016;
}

.btn.primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.error {
  margin: 0;
  font-size: 0.88rem;
  color: #ff8b8b;
}

.footer {
  margin-top: 0.5rem;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: var(--cs-muted);
}

.footer-left {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
}

.footer-left a {
  color: var(--cs-accent);
  margin-left: 0.35rem;
}

.tool-link {
  flex-shrink: 0;
  font-size: 0.9rem;
  color: var(--cs-muted);
  text-decoration: none;
  white-space: nowrap;
}

.tool-link:hover {
  color: var(--cs-accent);
  text-decoration: underline;
}
</style>
