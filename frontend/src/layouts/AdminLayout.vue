<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  RouterLink,
  RouterView,
  useRoute,
  useRouter,
} from 'vue-router';
import AppVersionLabel from '@/components/AppVersionLabel.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import * as adminAuthApi from '@/api/adminAuth';
import { adminLoginPath } from '@/utils/adminEntry';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const SIDEBAR_STORAGE_KEY = 'codec-siphon-admin-sidebar-collapsed';

const sidebarCollapsed = ref(false);

const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);

const nav = computed(() => [
  { to: `${adminBase.value}/home`, label: t('admin.homeTitle'), icon: '◆' },
  { to: `${adminBase.value}/users`, label: t('admin.navUsers'), icon: '◎' },
  { to: `${adminBase.value}/tasks`, label: t('admin.navTasks'), icon: '☰' },
]);

onMounted(() => {
  try {
    sidebarCollapsed.value = localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    /* private mode / unavailable */
  }
});

watch(sidebarCollapsed, (v) => {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
});

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

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
  <div class="admin-shell" :class="{ 'admin-shell--collapsed': sidebarCollapsed }">
    <aside class="side">
      <div class="side-brand">
        <div class="brand-lockup">
          <span class="mark">▶</span>
          <span v-show="!sidebarCollapsed" class="brand-text">{{
            t('layout.brandTitle')
          }}</span>
        </div>
        <button
          type="button"
          class="sidebar-toggle"
          :aria-expanded="!sidebarCollapsed"
          :title="
            sidebarCollapsed
              ? t('layout.sidebarExpand')
              : t('layout.sidebarCollapse')
          "
          :aria-label="
            sidebarCollapsed
              ? t('layout.sidebarExpand')
              : t('layout.sidebarCollapse')
          "
          @click="toggleSidebar"
        >
          <span class="sidebar-toggle-icon" aria-hidden="true">{{
            sidebarCollapsed ? '›' : '‹'
          }}</span>
        </button>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          class="nav-item"
          :to="item.to"
          active-class="active"
          :title="item.label"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <AppVersionLabel v-show="!sidebarCollapsed" class="sidebar-version" />
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
  box-sizing: border-box;
  transition:
    width 0.22s ease,
    padding 0.22s ease;
}

.admin-shell--collapsed .side {
  width: 72px;
  padding: 1rem 0.5rem;
}

.side-brand {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.35rem;
  padding: 0 0.25rem;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  flex: 1;
}

.admin-shell--collapsed .brand-lockup {
  justify-content: center;
  flex: 0;
}

.admin-shell--collapsed .side-brand {
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
}

.mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--cs-accent), #1fb6a6);
  color: #041016;
  font-weight: 800;
  flex-shrink: 0;
}

.brand-text {
  font-size: 0.95rem;
  font-weight: 650;
  min-width: 0;
}

.sidebar-toggle {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--cs-muted);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--cs-text);
  border-color: rgba(62, 207, 142, 0.35);
}

.sidebar-toggle-icon {
  font-size: 1.1rem;
  line-height: 1;
  font-weight: 600;
}

.admin-shell--collapsed .sidebar-toggle {
  margin: 0;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  color: var(--cs-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition:
    background 0.15s,
    color 0.15s;
}

.admin-shell--collapsed .nav-item {
  justify-content: center;
  padding: 0.5rem 0.45rem;
  gap: 0;
}

.nav-icon {
  width: 1.25rem;
  text-align: center;
  opacity: 0.85;
  flex-shrink: 0;
}

.nav-label {
  min-width: 0;
}

.admin-shell--collapsed .nav-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.nav-item:hover {
  color: var(--cs-text);
  background: rgba(255, 255, 255, 0.04);
}

.nav-item.active {
  color: var(--cs-accent);
  background: rgba(62, 207, 142, 0.1);
}

.sidebar-version {
  margin-top: auto;
  padding: 0 0.5rem;
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
