<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const SIDEBAR_STORAGE_KEY = 'codec-siphon-sidebar-collapsed';

const sidebarCollapsed = ref(false);

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

const displayName = computed(
  () => auth.user?.displayName || auth.user?.email || t('common.user'),
);

const nav = computed(() => [
  { to: '/', label: t('layout.navDashboard'), icon: '◆' },
  { to: '/tasks/new', label: t('layout.navNewTask'), icon: '⬇' },
  { to: '/tasks', label: t('layout.navTasks'), icon: '☰' },
  { to: '/files', label: t('layout.navFiles'), icon: '▣' },
  { to: '/url-extract', label: t('layout.navUrlExtract'), icon: '≡' },
  { to: '/settings', label: t('layout.navSettings'), icon: '⚙' },
  { to: '/help', label: t('layout.navHelp'), icon: '?' },
]);

function navClass(path: string) {
  let active = false;
  if (path === '/') active = route.path === '/';
  else if (path === '/tasks') active = route.path === '/tasks';
  else active = route.path === path || route.path.startsWith(`${path}/`);
  return { active };
}

const titleMap = computed<Record<string, string>>(() => ({
  dashboard: t('layout.titleDashboard'),
  'task-new': t('layout.titleTaskNew'),
  tasks: t('layout.titleTasks'),
  files: t('layout.titleFiles'),
  'url-extract': t('layout.titleUrlExtract'),
  settings: t('layout.titleSettings'),
  help: t('layout.titleHelp'),
}));

const topTitle = computed(() => {
  const key = route.name?.toString();
  return (key && titleMap.value[key]) || t('common.workspace');
});

async function onLogout() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell" :class="{ 'shell--collapsed': sidebarCollapsed }">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-lockup">
          <span class="brand-mark">▶</span>
          <div v-show="!sidebarCollapsed" class="brand-text">
            <div class="brand-title">{{ t('layout.brandTitle') }}</div>
            <div class="brand-sub">{{ t('layout.brandSub') }}</div>
          </div>
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
          :to="item.to"
          class="nav-link"
          :class="navClass(item.to)"
          :title="item.label"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <p v-show="!sidebarCollapsed" class="sidebar-disclaimer">
        {{ t('layout.disclaimer') }}
      </p>

      <div v-show="!sidebarCollapsed" class="storage-hint">
        <div class="storage-label">{{ t('layout.storagePlanned') }}</div>
        <div class="storage-bar"><span style="width: 35%" /></div>
        <div class="storage-meta">{{ t('layout.storageHint') }}</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-title">{{ topTitle }}</div>
        <div class="topbar-actions">
          <LanguageSwitcher />
          <span class="who">{{ displayName }}</span>
          <button type="button" class="btn ghost" @click="onLogout">
            {{ t('layout.logout') }}
          </button>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  width: 100%;
  min-height: 100vh;
  background: var(--cs-bg);
  color: var(--cs-text);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 252px;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 1.25rem 1rem;
  background: linear-gradient(180deg, #101821 0%, #0c1218 100%);
  border-right: 1px solid var(--cs-border);
  transition:
    width 0.22s ease,
    padding 0.22s ease;
}

.shell--collapsed .sidebar {
  width: 72px;
  padding: 1.25rem 0.5rem;
  align-items: stretch;
}

.brand {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.35rem;
  padding: 0.35rem 0;
}

.brand-lockup {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.shell--collapsed .brand-lockup {
  justify-content: center;
  flex: 0;
}

.brand-text {
  min-width: 0;
}

.sidebar-toggle {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin: 4px 0 0;
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

.shell--collapsed .brand {
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
}

.shell--collapsed .sidebar-toggle {
  margin: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--cs-accent), #1fb6a6);
  color: #041016;
  font-weight: 800;
}

.brand-title {
  font-weight: 700;
  letter-spacing: 0.02em;
  font-size: 0.92rem;
  line-height: 1.35;
}

.brand-sub {
  font-size: 0.78rem;
  color: var(--cs-muted);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  color: var(--cs-muted);
  text-decoration: none;
  font-size: 0.95rem;
  transition:
    background 0.15s,
    color 0.15s;
}

.shell--collapsed .nav-link {
  justify-content: center;
  padding: 0.55rem 0.45rem;
  gap: 0;
}

.shell--collapsed .nav-label {
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

.nav-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--cs-text);
}

.nav-link.active {
  background: rgba(62, 207, 142, 0.12);
  color: var(--cs-accent);
  border: 1px solid rgba(62, 207, 142, 0.22);
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

.sidebar-disclaimer {
  margin: 0;
  padding: 0 0.5rem;
  font-size: 0.72rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.42);
}

.storage-hint {
  margin-top: auto;
  padding: 0.75rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--cs-border);
}

.storage-label {
  font-size: 0.78rem;
  color: var(--cs-muted);
  margin-bottom: 0.45rem;
}

.storage-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.storage-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--cs-accent), #5be0ff);
}

.storage-meta {
  margin-top: 0.45rem;
  font-size: 0.72rem;
  color: var(--cs-muted);
  line-height: 1.35;
}

.main {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--cs-border);
  background: rgba(12, 17, 22, 0.65);
  backdrop-filter: blur(8px);
}

.topbar-title {
  font-weight: 600;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.who {
  font-size: 0.9rem;
  color: var(--cs-muted);
}

.content {
  padding: 1.25rem 1.5rem 2rem;
  flex: 1;
}

.btn {
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 0.45rem 0.85rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn.ghost {
  background: transparent;
  border-color: var(--cs-border);
  color: var(--cs-text);
}

.btn.ghost:hover {
  border-color: rgba(62, 207, 142, 0.45);
  color: var(--cs-accent);
}
</style>
