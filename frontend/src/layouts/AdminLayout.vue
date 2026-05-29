<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  RouterLink,
  RouterView,
  useRoute,
  useRouter,
} from 'vue-router';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import * as adminAuthApi from '@/api/adminAuth';
import { adminLoginPath } from '@/utils/adminEntry';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);

async function onLogout() {
  const rt = localStorage.getItem('adminRefreshToken');
  try {
    if (rt) await adminAuthApi.adminLogout(rt);
  } catch {
    /* ignore */
  }
  localStorage.removeItem('adminAccessToken');
  localStorage.removeItem('adminRefreshToken');
  localStorage.removeItem('adminUser');
  await router.push({ path: adminLoginPath() });
}
</script>

<template>
  <div class="admin-shell">
    <aside class="side">
      <div class="side-brand">
        <span class="mark">▶</span>
        <span class="brand-text">{{ t('layout.brandTitle') }}</span>
      </div>
      <nav class="nav">
        <RouterLink
          class="nav-item"
          :to="`${adminBase}/home`"
          active-class="active"
          >{{ t('admin.homeTitle') }}</RouterLink
        >
        <RouterLink
          class="nav-item"
          :to="`${adminBase}/users`"
          active-class="active"
          >{{ t('admin.navUsers') }}</RouterLink
        >
        <RouterLink
          class="nav-item"
          :to="`${adminBase}/tasks`"
          active-class="active"
          >{{ t('admin.navTasks') }}</RouterLink
        >
      </nav>
    </aside>
    <div class="content-wrap">
      <header class="top">
        <div class="brand">
          <span class="tag">{{ t('admin.brand') }}</span>
        </div>
        <div class="actions">
          <LanguageSwitcher />
          <button type="button" class="btn-out" @click="onLogout">
            {{ t('admin.logout') }}
          </button>
        </div>
      </header>
      <main class="main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  display: flex;
  background: var(--cs-bg);
  color: var(--cs-text);
}

.side {
  width: 210px;
  flex-shrink: 0;
  border-right: 1px solid var(--cs-border);
  background: rgba(0, 0, 0, 0.25);
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.side-brand {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.5rem;
  font-weight: 650;
}

.mark {
  color: var(--cs-accent);
}

.brand-text {
  font-size: 0.95rem;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: block;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  color: var(--cs-muted);
  text-decoration: none;
  font-size: 0.9rem;
}

.nav-item:hover {
  color: var(--cs-text);
  background: rgba(255, 255, 255, 0.04);
}

.nav-item.active {
  color: var(--cs-accent);
  background: rgba(62, 207, 142, 0.1);
}

.content-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--cs-border);
  background: rgba(0, 0, 0, 0.2);
}

.tag {
  font-size: 0.85rem;
  color: var(--cs-muted);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.btn-out {
  font-size: 0.88rem;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: transparent;
  color: var(--cs-text);
  cursor: pointer;
}

.btn-out:hover {
  border-color: rgba(62, 207, 142, 0.35);
  color: var(--cs-accent);
}

.main {
  flex: 1;
  padding: 1.25rem 1.5rem 2rem;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  box-sizing: border-box;
}
</style>
