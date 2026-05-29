<script setup lang="ts">
import axios from 'axios';
import { computed, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, RouterLink } from 'vue-router';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import * as authApi from '@/api/auth';

const { t } = useI18n();
const route = useRoute();

const password = ref('');
const password2 = ref('');
const loading = ref(false);
const errorMsg = ref('');
const success = ref(false);

const rawToken = computed(() => {
  const q = route.query.token;
  return typeof q === 'string' ? q.trim() : '';
});

const tokenOk = computed(() => /^[a-fA-F0-9]{64}$/.test(rawToken.value));

const pwdMismatch = computed(
  () => password.value.length > 0 && password.value !== password2.value,
);

watch(rawToken, () => {
  errorMsg.value = '';
  success.value = false;
});

function extractApiErrorMessage(e: unknown): string | null {
  if (!axios.isAxiosError(e)) return null;
  const raw = e.response?.data as { message?: string | string[] };
  const m = raw?.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length)
    return m.filter((x) => typeof x === 'string' && x.trim()).join('；');
  return null;
}

function localizeBackendMessage(raw: string): string {
  const s = raw.trim();
  if (s === '无效或已过期的重置链接')
    return t('auth.resetLinkInvalidHint');
  return s;
}

async function submit() {
  errorMsg.value = '';
  success.value = false;
  if (!tokenOk.value) {
    errorMsg.value = t('auth.invalidResetToken');
    return;
  }
  if (pwdMismatch.value) {
    errorMsg.value = t('auth.pwdMismatchSubmit');
    return;
  }
  if (password.value.length < 8) {
    errorMsg.value = t('auth.pwdTooShort');
    return;
  }

  loading.value = true;
  try {
    await authApi.resetPassword(rawToken.value, password.value);
    success.value = true;
  } catch (e: unknown) {
    const raw = extractApiErrorMessage(e);
    errorMsg.value = raw ? localizeBackendMessage(raw) : t('errors.networkError');
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
        <div class="logo">↻</div>
        <h1>{{ t('auth.resetPasswordTitle') }}</h1>
        <p class="tag">{{ t('auth.resetPasswordTagline') }}</p>
      </div>

      <p v-if="!tokenOk" class="error block">{{ t('auth.invalidResetToken') }}</p>

      <template v-else-if="success">
        <p class="success">{{ t('auth.resetSuccessHint') }}</p>
        <div class="footer">
          <RouterLink class="primary-link" to="/login">{{
            t('auth.backToLogin')
          }}</RouterLink>
        </div>
      </template>

      <form v-else class="form" @submit.prevent="submit">
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

        <p v-if="pwdMismatch" class="hint">{{ t('auth.pwdMismatchHint') }}</p>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button
          class="btn primary"
          type="submit"
          :disabled="loading || pwdMismatch || !tokenOk"
        >
          {{
            loading ? t('auth.resetSubmitting') : t('auth.resetPasswordSubmit')
          }}
        </button>

        <div class="footer">
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

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--cs-warn, #eab308);
}

.error {
  margin: 0;
  font-size: 0.88rem;
  color: #ff8b8b;
}

.error.block {
  margin-bottom: 1rem;
  line-height: 1.5;
}

.success {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--cs-muted);
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

.footer {
  margin-top: 0.5rem;
  text-align: center;
}

.footer a {
  color: var(--cs-accent);
  font-size: 0.9rem;
}

.primary-link {
  font-weight: 600;
}
</style>
