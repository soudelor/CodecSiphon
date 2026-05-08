<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref, watch } from 'vue';
import * as tasksApi from '@/api/tasks';
import type { DownloadTask, TaskStatus } from '@/types/models';
import {
  canCancelTask,
  canPauseTask,
  canResumeTask,
  canRetryTask,
} from '@/utils/taskActions';
import { sourceTypeLabel, taskStatusLabel } from '@/views/taskLabels';

const items = ref<DownloadTask[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(12);
const loading = ref(true);
const errorMsg = ref('');
const busyId = ref<string | null>(null);

async function load() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const data = await tasksApi.listTasks(page.value, limit.value);
    items.value = data.items;
    total.value = data.total;
  } catch {
    errorMsg.value = '加载任务失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

watch([page, limit], load);

const totalPages = () => Math.max(1, Math.ceil(total.value / limit.value));

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join('；');
    if (typeof m === 'string') return m;
  }
  return '操作失败，请稍后重试';
}

async function setStatus(id: string, status: TaskStatus) {
  if (status !== 'paused' && status !== 'cancelled' && status !== 'queued') {
    return;
  }
  busyId.value = id;
  errorMsg.value = '';
  try {
    await tasksApi.updateTaskStatus(id, status);
    await load();
  } catch (e) {
    errorMsg.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}

async function removeTask(t: DownloadTask) {
  const label = t.title || t.sourceUrl || t.sourceUrls[0] || t.id.slice(0, 8);
  if (
    !confirm(
      `确定删除此任务？\n「${label}」\n\n将取消排队中的下载，并删除该任务对应的文件夹及文件库记录（不可恢复）。`,
    )
  ) {
    return;
  }
  busyId.value = t.id;
  errorMsg.value = '';
  try {
    await tasksApi.deleteTask(t.id);
    await load();
  } catch (e) {
    errorMsg.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h2>任务管理</h2>
        <p class="muted">
          <strong>暂停</strong>：已排队的会停掉，当前正在下的一段会等它走完再停。
          <strong>继续</strong>：从暂停恢复，接着排队下载。
          <strong>取消</strong>：不再继续该任务（已成功的不能撤成取消）。
          <strong>重试</strong>：只对失败的任务有效，会重新排队尝试。
          <strong>删除</strong>：任务记录、未完成的排队、已下载文件夹及文件库对应项都会删掉。
        </p>
      </div>
      <div class="pager">
        <label>
          每页
          <select v-model.number="limit">
            <option :value="10">10</option>
            <option :value="12">12</option>
            <option :value="20">20</option>
          </select>
        </label>
        <button
          type="button"
          class="btn ghost"
          :disabled="page <= 1 || loading"
          @click="page--"
        >
          上一页
        </button>
        <span class="pi">{{ page }} / {{ totalPages() }}</span>
        <button
          type="button"
          class="btn ghost"
          :disabled="page >= totalPages() || loading"
          @click="page++"
        >
          下一页
        </button>
      </div>
    </header>

    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div v-else class="table-wrap card">
      <table class="table">
        <thead>
          <tr>
            <th>摘要</th>
            <th>类型</th>
            <th>状态</th>
            <th>进度</th>
            <th class="col-time">创建时间</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in items" :key="t.id">
            <td class="cell-main">
              <div class="title">{{ t.title || '（无标题）' }}</div>
              <div class="sub">
                {{ t.sourceUrl || t.sourceUrls[0] || '—' }}
              </div>
            </td>
            <td>{{ sourceTypeLabel(t.sourceType) }}</td>
            <td>{{ taskStatusLabel(t.status) }}</td>
            <td>{{ t.progressPercent }}%</td>
            <td class="cell-time">{{ formatCreatedAt(t.createdAt) }}</td>
            <td class="actions">
              <button
                type="button"
                class="btn small"
                :disabled="busyId === t.id || !canPauseTask(t)"
                title="暂停下载"
                @click="setStatus(t.id, 'paused')"
              >
                暂停
              </button>
              <button
                type="button"
                class="btn small accent"
                :disabled="busyId === t.id || !canResumeTask(t)"
                title="继续下载"
                @click="setStatus(t.id, 'queued')"
              >
                继续
              </button>
              <button
                type="button"
                class="btn small warn"
                :disabled="busyId === t.id || !canRetryTask(t)"
                title="失败后重新入队"
                @click="setStatus(t.id, 'queued')"
              >
                重试
              </button>
              <button
                type="button"
                class="btn small danger"
                :disabled="busyId === t.id || !canCancelTask(t)"
                title="取消任务"
                @click="setStatus(t.id, 'cancelled')"
              >
                取消
              </button>
              <button
                type="button"
                class="btn small del"
                :disabled="busyId === t.id"
                title="永久删除任务及本地文件"
                @click="removeTask(t)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="items.length === 0" class="empty muted">暂无任务。</p>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.head h2 {
  margin: 0 0 0.35rem;
}

.muted {
  margin: 0;
  color: var(--cs-muted);
  max-width: 920px;
  line-height: 1.5;
  font-size: 0.88rem;
}

.pager {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pager select {
  margin-left: 0.35rem;
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.35rem 0.5rem;
}

.pi {
  font-size: 0.9rem;
  color: var(--cs-muted);
}

.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.table-wrap {
  padding: 0;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.table th,
.table td {
  text-align: left;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--cs-border);
  vertical-align: top;
}

.table th {
  color: var(--cs-muted);
  font-weight: 500;
  background: rgba(255, 255, 255, 0.02);
}

.col-time {
  min-width: 10rem;
  white-space: nowrap;
}

.cell-time {
  color: var(--cs-muted);
  font-size: 0.86rem;
  white-space: nowrap;
}

.col-actions {
  min-width: 220px;
  width: 28%;
}

.cell-main .title {
  font-weight: 600;
}

.cell-main .sub {
  margin-top: 0.25rem;
  color: var(--cs-muted);
  font-size: 0.82rem;
  word-break: break-all;
}

.actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  align-items: center;
}

.btn {
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.35rem 0.55rem;
  cursor: pointer;
  font-size: 0.82rem;
}

.btn.ghost {
  padding: 0.45rem 0.75rem;
}

.btn.small:disabled,
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn.accent {
  border-color: rgba(62, 207, 142, 0.45);
  color: var(--cs-accent, #3ecf8e);
}

.btn.warn {
  border-color: rgba(255, 200, 120, 0.45);
  color: #ffd28a;
}

.btn.danger {
  border-color: rgba(255, 120, 120, 0.35);
  color: #ffb4b4;
}

.btn.del {
  border-color: rgba(180, 120, 255, 0.35);
  color: #d4b4ff;
}

.empty {
  padding: 1rem 1rem 1.25rem;
  margin: 0;
}

.error {
  color: #ff8b8b;
  margin: 0;
}
</style>
