<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView } from 'vue-router';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const auth = useAuthStore();
const { isAuthenticated } = storeToRefs(auth);
</script>

<template>
  <div class="public-tool">
    <header class="top">
      <RouterLink to="/tools/url-extract" class="brand">
        <span class="mark" aria-hidden="true">▶</span>
        <span class="name">{{ t('layout.brandTitle') }}</span>
        <span class="tag">{{ t('urlExtract.publicTitle') }}</span>
      </RouterLink>
      <div class="actions">
        <LanguageSwitcher />
        <RouterLink v-if="isAuthenticated" class="link" to="/">{{
          t('urlExtract.backHome')
        }}</RouterLink>
        <RouterLink
          v-else
          class="link"
          :to="{
            name: 'login',
            query: { redirect: '/url-extract' },
          }"
          >{{ t('urlExtract.loginCta') }}</RouterLink
        >
        <RouterLink class="link register" :to="{ name: 'register' }">{{
          t('urlExtract.registerCta')
        }}</RouterLink>
      </div>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.public-tool {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--cs-bg, #0f1115);
  color: var(--cs-text, #e8eaed);
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--cs-border, rgba(255, 255, 255, 0.08));
  background: rgba(0, 0, 0, 0.2);
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  text-decoration: none;
  color: inherit;
  flex-wrap: wrap;
}

.mark {
  color: var(--cs-accent, #6ee7b7);
  font-size: 1rem;
}

.name {
  font-weight: 650;
  letter-spacing: 0.02em;
}

.tag {
  font-size: 0.78rem;
  color: var(--cs-muted, #9aa0a6);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.link {
  font-size: 0.88rem;
  color: var(--cs-muted, #9aa0a6);
  text-decoration: none;
}

.link:hover {
  color: var(--cs-text, #e8eaed);
}

.register {
  padding: 0.28rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--cs-border, rgba(255, 255, 255, 0.14));
  color: var(--cs-text, #e8eaed);
}

.main {
  flex: 1;
  padding: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
</style>
