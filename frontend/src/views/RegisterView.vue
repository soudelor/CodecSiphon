<script setup lang="ts">
import axios from 'axios';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, RouterLink } from 'vue-router';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const password2 = ref('');
const displayName = ref('');
const loading = ref(false);
const errorMsg = ref('');

const pwdMismatch = computed(
  () => password.value.length > 0 && password.value !== password2.value,
);

function extractApiErrorMessage(e: unknown): string | null {
  if (!axios.isAxiosError(e)) return null;
  const raw = e.response?.data as { message?: string | string[] };
  const m = raw?.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length)
    return m.filter((x) => typeof x === 'string' && x.trim()).join('；');
  return null;
}

async function submit() {
  errorMsg.value = '';
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
    await auth.register({
      email: email.value.trim(),
      password: password.value,
      displayName: displayName.value.trim() || undefined,
    });
    router.push('/');
  } catch (e) {
    errorMsg.value = extractApiErrorMessage(e) ?? t('auth.registerFailed');
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

        <button class="btn primary" type="submit" :disabled="loading || pwdMismatch">
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
