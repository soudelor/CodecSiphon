<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref('');

async function submit() {
  errorMsg.value = '';
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    const redirect = route.query.redirect as string | undefined;
    router.push(redirect && redirect.startsWith('/') ? redirect : '/');
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? '登录未成功，请确认邮箱与密码是否正确'
        : '网络异常，请稍后再试';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="card">
      <div class="hero">
        <div class="logo">▶</div>
        <h1>CodecSiphon</h1>
        <p class="tag">登录后即可新建下载、查看进度与管理文件</p>
      </div>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span>邮箱</span>
          <input v-model="email" type="email" required autocomplete="username" />
        </label>
        <label class="field">
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            required
            minlength="1"
            autocomplete="current-password"
          />
        </label>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button class="btn primary" type="submit" :disabled="loading">
          {{ loading ? '登录中…' : '登录' }}
        </button>

        <div class="footer">
          <span>还没有账户？</span>
          <RouterLink to="/register">注册</RouterLink>
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
  background:
    radial-gradient(900px 400px at 10% 10%, rgba(62, 207, 142, 0.14), transparent),
    radial-gradient(700px 500px at 90% 30%, rgba(91, 224, 255, 0.12), transparent),
    var(--cs-bg);
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
  font-size: 1.35rem;
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
