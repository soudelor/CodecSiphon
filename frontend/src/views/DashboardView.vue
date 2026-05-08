<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import * as tasksApi from '@/api/tasks';
import type { DownloadTask, TaskStatus } from '@/types/models';
import {
  canCancelTask,
  canPauseTask,
  canResumeTask,
  canRetryTask,
} from '@/utils/taskActions';
import { taskStatusLabel, sourceTypeLabel } from '@/views/taskLabels';

const auth = useAuthStore();
const recent = ref<DownloadTask[]>([]);
const loading = ref(true);
const loadError = ref('');
const busyId = ref<string | null>(null);
const actionError = ref('');

async function loadRecent() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await tasksApi.listTasks(1, 6);
    recent.value = data.items;
  } catch {
    loadError.value = '无法加载最近任务，请检查网络后重试';
  } finally {
    loading.value = false;
  }
}

onMounted(loadRecent);

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join('；');
    if (typeof m === 'string') return m;
  }
  return '操作失败';
}

async function setStatus(id: string, status: TaskStatus) {
  if (status !== 'paused' && status !== 'cancelled' && status !== 'queued') return;
  busyId.value = id;
  actionError.value = '';
  try {
    await tasksApi.updateTaskStatus(id, status);
    await loadRecent();
  } catch (e) {
    actionError.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}

async function removeTask(t: DownloadTask) {
  const label = t.title || t.sourceUrl || t.sourceUrls[0] || t.id.slice(0, 8);
  if (
    !confirm(
      `确定删除此任务？\n「${label}」\n\n将取消未开始的下载，并删除已下载文件夹及文件库里的对应记录（不可恢复）。`,
    )
  ) {
    return;
  }
  busyId.value = t.id;
  actionError.value = '';
  try {
    await tasksApi.deleteTask(t.id);
    await loadRecent();
  } catch (e) {
    actionError.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div class="dashboard">
    <section class="welcome card">
      <div>
        <h2>
          欢迎回来，{{ auth.user?.displayName || auth.user?.email || '用户' }}
        </h2>
        <p class="muted">
          在左侧点「新建任务」添加下载，或到「任务管理」查看全部进度与历史。
        </p>
      </div>
      <div class="quick">
        <RouterLink class="btn primary" to="/tasks/new">新建下载任务</RouterLink>
        <RouterLink class="btn ghost" to="/tasks">任务管理</RouterLink>
      </div>
    </section>

    <section class="grid">
      <div class="card">
        <h3>系统状态</h3>
        <p class="muted small">
          提交任务后会自动排队下载，无需您手动再点执行。服务异常时新建或继续任务可能失败，可稍后再试或联系管理员。
        </p>
        <ul class="stats">
          <li><span>连接状态</span><strong>已就绪</strong></li>
          <li><span>保存位置</span><strong>当前账号下载目录</strong></li>
          <li><span>网盘同步</span><strong>尚未开放</strong></li>
        </ul>
      </div>

      <div class="card stretch">
        <div class="card-head">
          <h3>最近任务</h3>
          <RouterLink to="/tasks" class="link">查看全部</RouterLink>
        </div>

        <p v-if="loading" class="muted">加载中…</p>
        <p v-else-if="loadError" class="error">{{ loadError }}</p>
        <template v-else>
          <p v-if="actionError" class="error small">{{ actionError }}</p>
          <div v-if="recent.length === 0" class="muted">暂无任务，去新建一个吧。</div>
          <table v-else class="table">
          <thead>
            <tr>
              <th>标题 / URL</th>
              <th>类型</th>
              <th>状态</th>
              <th>进度</th>
              <th class="col-mini">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in recent" :key="t.id">
              <td class="ellipsis">
                {{ t.title || t.sourceUrl || (t.sourceUrls[0] ?? '—') }}
              </td>
              <td>{{ sourceTypeLabel(t.sourceType) }}</td>
              <td>{{ taskStatusLabel(t.status) }}</td>
              <td>{{ t.progressPercent }}%</td>
              <td class="dash-actions">
                <button
                  type="button"
                  class="link-btn"
                  :disabled="busyId === t.id || !canPauseTask(t)"
                  @click="setStatus(t.id, 'paused')"
                >
                  暂停
                </button>
                <button
                  type="button"
                  class="link-btn"
                  :disabled="busyId === t.id || !canResumeTask(t)"
                  @click="setStatus(t.id, 'queued')"
                >
                  继续
                </button>
                <button
                  type="button"
                  class="link-btn"
                  :disabled="busyId === t.id || !canRetryTask(t)"
                  @click="setStatus(t.id, 'queued')"
                >
                  重试
                </button>
                <button
                  type="button"
                  class="link-btn danger"
                  :disabled="busyId === t.id || !canCancelTask(t)"
                  @click="setStatus(t.id, 'cancelled')"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="link-btn del"
                  :disabled="busyId === t.id"
                  @click="removeTask(t)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
}

.welcome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.welcome h2 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}

.muted {
  margin: 0;
  color: var(--cs-muted);
}

.small {
  font-size: 0.9rem;
  line-height: 1.45;
}

.quick {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.95rem;
  border-radius: 12px;
  text-decoration: none;
  font-size: 0.92rem;
  border: 1px solid transparent;
}

.btn.primary {
  background: linear-gradient(135deg, var(--cs-accent), #25c9b5);
  color: #041016;
  font-weight: 600;
}

.btn.ghost {
  border-color: var(--cs-border);
  color: var(--cs-text);
}

.grid {
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;
  gap: 1rem;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.stretch {
  min-width: 0;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
}

.card-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.link {
  color: var(--cs-accent);
  font-size: 0.9rem;
  text-decoration: none;
}

.stats {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.stats li {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: var(--cs-muted);
}

.stats strong {
  color: var(--cs-text);
  font-weight: 600;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.table th,
.table td {
  text-align: left;
  padding: 0.45rem 0.35rem;
  border-bottom: 1px solid var(--cs-border);
}

.table th {
  color: var(--cs-muted);
  font-weight: 500;
}

.ellipsis {
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error {
  color: #ff8b8b;
  margin: 0;
}

code {
  font-size: 0.85em;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.error.small {
  font-size: 0.88rem;
  margin: 0 0 0.5rem;
}

.col-mini {
  width: 1%;
  white-space: nowrap;
}

.dash-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: center;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--cs-accent, #3ecf8e);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-size: 0.82rem;
}

.link-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  text-decoration: none;
}

.link-btn.danger {
  color: #ff9b9b;
}

.link-btn.del {
  color: #c9a8ff;
}
</style>
