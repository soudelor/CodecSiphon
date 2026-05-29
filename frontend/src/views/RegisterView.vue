<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, RouterLink } from 'vue-router';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const emailCode = ref('');
const password = ref('');
const password2 = ref('');
const displayName = ref('');
const loading = ref(false);
const sendingCode = ref(false);
const errorMsg = ref('');
const okHint = ref('');
const cooldownSec = ref(0);
const codeSentOnce = ref(false);
/** 再次发码前须先换一张图形验证码并重新输入 */
const pendingResendCaptcha = ref(false);

const captchaId = ref<string | null>(null);
const captchaCode = ref('');
const captchaSvg = ref('');
const captchaLoading = ref(false);

let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const pwdMismatch = computed(
  () => password.value.length > 0 && password.value !== password2.value,
);

const captchaImgSrc = computed(() =>
  captchaSvg.value
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg.value)}`
    : '',
);

const sendCodeDisabled = computed(
  () =>
    sendingCode.value ||
    cooldownSec.value > 0 ||
    captchaLoading.value ||
    !email.value.trim() ||
    !captchaId.value ||
    !captchaCode.value.trim(),
);

function apiErr(e: unknown): string {
  const data =
    e &&
    typeof e === 'object' &&
    'response' in e &&
    (e as { response?: { data?: unknown } }).response?.data &&
    typeof (e as { response: { data: unknown } }).response.data === 'object'
      ? ((e as { response: { data: Record<string, unknown> } }).response.data as Record<
          string,
          unknown
        >)
      : null;

  if (data && typeof data.key === 'string' && data.key) {
    return t(data.key);
  }
  const nested = data?.message;
  if (
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested) &&
    typeof (nested as Record<string, unknown>).key === 'string'
  ) {
    return t((nested as { key: string }).key);
  }

  if (!axios.isAxiosError(e)) {
    return t('auth.registerFailed');
  }

  const raw = e.response?.data as {
    message?: string | string[];
    statusCode?: number;
  };
  const m = raw?.message;
  if (typeof m === 'string' && m.trim()) {
    const trimmed = m.trim();
    if (
      e.response?.status === 500 &&
      trimmed === 'Internal server error'
    ) {
      return t('errors.operationFailedRetry');
    }
    return trimmed;
  }
  if (Array.isArray(m) && m.length)
    return m.filter((x) => typeof x === 'string').join('；');
  if (e.response?.status === 429) {
    return t('errors.registrationTooManyRequests');
  }
  return t('auth.registerFailed');
}

function clearCooldown() {
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
}

function startCooldown() {
  clearCooldown();
  cooldownSec.value = 60;
  cooldownTimer = setInterval(() => {
    cooldownSec.value -= 1;
    if (cooldownSec.value <= 0 && cooldownTimer) {
      clearCooldown();
      cooldownSec.value = 0;
    }
  }, 1000);
}

function shouldRefreshCaptchaAfterSendError(e: unknown): boolean {
  if (!axios.isAxiosError(e)) {
    return true;
  }
  const status = e.response?.status;
  const data = e.response?.data as { key?: string } | undefined;
  // SMTP 未配置时在核销图形验证码之前就会失败，不必刷新/清空输入框
  if (
    status === 503 &&
    data?.key === 'errors.registrationMailDisabled'
  ) {
    return false;
  }
  return true;
}

async function loadCaptcha() {
  captchaLoading.value = true;
  captchaCode.value = '';
  try {
    const data = await authApi.fetchLoginCaptcha();
    captchaId.value = data.captchaId;
    captchaSvg.value = data.svg;
  } catch (e: unknown) {
    captchaId.value = null;
    captchaSvg.value = '';
    if (axios.isAxiosError(e)) {
      const m = (e.response?.data as { message?: string })?.message;
      errorMsg.value =
        typeof m === 'string' && m.trim()
          ? m.trim()
          : t('auth.captchaLoadFallback');
    } else {
      errorMsg.value = t('auth.captchaLoadFallback');
    }
  } finally {
    captchaLoading.value = false;
  }
}

onMounted(() => {
  void loadCaptcha();
});

onUnmounted(() => {
  clearCooldown();
});

async function sendRegistrationCodeClick() {
  errorMsg.value = '';
  okHint.value = '';
  if (!email.value.trim()) {
    errorMsg.value = t('auth.registerNeedEmail');
    return;
  }
  if (!captchaId.value) {
    errorMsg.value = t('auth.needCaptchaFirst');
    void loadCaptcha();
    return;
  }

  if (pendingResendCaptcha.value) {
    if (!captchaCode.value.trim()) {
      errorMsg.value = t('auth.registerCaptchaResendHint');
      return;
    }
    pendingResendCaptcha.value = false;
  } else if (codeSentOnce.value) {
    await loadCaptcha();
    pendingResendCaptcha.value = true;
    errorMsg.value = t('auth.registerCaptchaResendHint');
    return;
  }

  sendingCode.value = true;
  try {
    await authApi.sendRegistrationCode({
      email: email.value.trim(),
      captchaId: captchaId.value,
      captchaCode: captchaCode.value.trim(),
    });
    okHint.value = t('auth.registerCodeSentHint');
    emailCode.value = '';
    codeSentOnce.value = true;
    startCooldown();
  } catch (e: unknown) {
    errorMsg.value = apiErr(e);
    if (shouldRefreshCaptchaAfterSendError(e)) {
      await loadCaptcha();
    }
  } finally {
    sendingCode.value = false;
  }
}

async function submit() {
  errorMsg.value = '';
  okHint.value = '';
  if (pwdMismatch.value) {
    errorMsg.value = t('auth.pwdMismatchSubmit');
    return;
  }
  if (password.value.length < 8) {
    errorMsg.value = t('auth.pwdTooShort');
    return;
  }
  if (!/^\d{6}$/.test(emailCode.value.trim())) {
    errorMsg.value = t('auth.registerCodeFormat');
    return;
  }

  loading.value = true;
  try {
    await auth.register({
      email: email.value.trim(),
      password: password.value,
      displayName: displayName.value.trim() || undefined,
      emailVerificationCode: emailCode.value.trim(),
    });
    router.push('/');
  } catch (e: unknown) {
    errorMsg.value = apiErr(e);
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
        <div class="logo">📝</div>
        <p class="product-brand">{{ t('layout.brandTitle') }}</p>
        <h1>{{ t('auth.createAccount') }}</h1>
        <p class="tag">{{ t('auth.registerTagline') }}</p>
      </div>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span>{{ t('auth.nicknameLabel') }}</span>
          <input v-model="displayName" maxlength="100" />
        </label>
        <label class="field">
          <span>{{ t('auth.email') }}</span>
          <input v-model="email" type="email" required autocomplete="username" />
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

        <div class="otp-row">
          <label class="field otp-field">
            <span>{{ t('auth.registerEmailCodeLabel') }}</span>
            <input
              v-model="emailCode"
              type="text"
              maxlength="6"
              inputmode="numeric"
              pattern="[0-9]{6}"
              autocomplete="one-time-code"
              :placeholder="t('auth.registerEmailCodePlaceholder')"
            />
          </label>
          <button
            type="button"
            class="btn send-code"
            :disabled="sendCodeDisabled"
            @click="sendRegistrationCodeClick()"
          >
            {{
              cooldownSec > 0
                ? t('auth.registerResendCooldown', { sec: cooldownSec })
                : sendingCode
                  ? t('auth.registerSendingCode')
                  : t('auth.registerSendCode')
            }}
          </button>
        </div>
        <p class="muted small">{{ t('auth.registerCaptchaBeforeCodeHint') }}</p>

        <label class="field">
          <span>{{ t('auth.passwordHint') }}</span>
          <input
            v-model="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </label>
        <label class="field">
          <span>{{ t('auth.confirmPassword') }}</span>
          <input
            v-model="password2"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </label>

        <p v-if="okHint" class="ok">{{ okHint }}</p>
        <p v-if="pwdMismatch" class="hint">{{ t('auth.pwdMismatchHint') }}</p>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button
          class="btn primary"
          type="submit"
          :disabled="loading || pwdMismatch || captchaLoading"
        >
          {{ loading ? t('auth.submitting') : t('auth.register') }}
        </button>

        <div class="footer">
          <span>{{ t('auth.hasAccount') }}</span>
          <RouterLink to="/login">{{ t('auth.backToLogin') }}</RouterLink>
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
  width: min(440px, 100%);
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
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--cs-border);
  font-size: 1.35rem;
}

.product-brand {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--cs-text);
}

h1 {
  margin: 0;
  font-size: 1.2rem;
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

.otp-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.65rem;
}

.otp-field {
  flex: 1 1 10rem;
  min-width: 0;
}

.btn.send-code {
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--cs-text);
  padding: 0.55rem 0.75rem;
  font-size: 0.82rem;
  cursor: pointer;
  margin-bottom: 0.05rem;
}

.btn.send-code:hover:not(:disabled) {
  border-color: rgba(62, 207, 142, 0.45);
  color: var(--cs-accent);
}

.btn.send-code:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.muted {
  margin: -0.35rem 0 0;
  color: var(--cs-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.muted.small {
  font-size: 0.78rem;
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

.hint {
  margin: 0;
  font-size: 0.88rem;
  color: #ffd28a;
}

.ok {
  margin: 0;
  font-size: 0.88rem;
  color: var(--cs-accent);
}

.error {
  margin: 0;
  font-size: 0.88rem;
  color: #ff8b8b;
}

.footer {
  margin-top: 0.5rem;
  text-align: center;
  font-size: 0.9rem;
  color: var(--cs-muted);
}

.footer a {
  color: var(--cs-accent);
  margin-left: 0.35rem;
}
</style>
