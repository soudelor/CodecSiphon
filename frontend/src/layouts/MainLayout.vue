<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const displayName = computed(
  () => auth.user?.displayName || auth.user?.email || '用户',
);

const nav = [
  { to: '/', label: '仪表盘', icon: '◆' },
  { to: '/tasks/new', label: '新建任务', icon: '⬇' },
  { to: '/tasks', label: '任务管理', icon: '☰' },
  { to: '/files', label: '文件管理', icon: '▣' },
  { to: '/settings', label: '设置', icon: '⚙' },
  { to: '/help', label: '帮助', icon: '?' },
];

function navClass(path: string) {
  let active = false;
  if (path === '/') active = route.path === '/';
  else if (path === '/tasks') active = route.path === '/tasks';
  else active = route.path === path || route.path.startsWith(`${path}/`);
  return { active };
}

const titleMap: Record<string, string> = {
  dashboard: '仪表盘',
  'task-new': '新建任务',
  tasks: '任务管理',
  files: '文件管理',
  settings: '设置',
  help: '帮助',
};

const topTitle = computed(() => {
  const key = route.name?.toString();
  return (key && titleMap[key]) || '工作台';
});

async function onLogout() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">▶</span>
        <div>
          <div class="brand-title">CodecSiphon</div>
          <div class="brand-sub">视频下载控制台</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="navClass(item.to)"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="storage-hint">
        <div class="storage-label">存储（规划中）</div>
        <div class="storage-bar"><span style="width: 35%" /></div>
        <div class="storage-meta">此处将显示您的存储空间使用情况（即将推出）</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-title">{{ topTitle }}</div>
        <div class="topbar-actions">
          <span class="who">{{ displayName }}</span>
          <button type="button" class="btn ghost" @click="onLogout">登出</button>
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
  display: grid;
  grid-template-columns: 252px 1fr;
  min-height: 100vh;
  background: var(--cs-bg);
  color: var(--cs-text);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem 1rem;
  background: linear-gradient(180deg, #101821 0%, #0c1218 100%);
  border-right: 1px solid var(--cs-border);
}

.brand {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.35rem 0.5rem;
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
