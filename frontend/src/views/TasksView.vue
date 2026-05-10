<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as tasksApi from '@/api/tasks';
import type { DownloadTask, TaskStatus } from '@/types/models';
import { useTaskLabels } from '@/composables/useTaskLabels';
import {
  canCancelTask,
  canPauseTask,
  canResumeTask,
  canRetryTask,
  taskListNeedsLivePolling,
} from '@/utils/taskActions';

const { t } = useI18n();
const { sourceTypeLabel, taskStatusLabel } = useTaskLabels();

/** 轮询时写入行对象：仅状态/错误/时间与结束相关字段（不含进度），供操作列与轮询启停判断 */
const POLL_SILENT_ROW_KEYS: (keyof DownloadTask)[] = [
  'status',
  'errorCode',
  'errorMessage',
  'scheduledAt',
  'startedAt',
  'completedAt',
  'updatedAt',
];

function tryMergePollRowMeta(
  prev: DownloadTask[],
  incoming: DownloadTask[],
): boolean {
  if (prev.length !== incoming.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== incoming[i].id) return false;
  }
  for (let i = 0; i < prev.length; i++) {
    const row = prev[i];
    const next = incoming[i];
    for (const k of POLL_SILENT_ROW_KEYS) {
      (row as Record<string, unknown>)[k as string] = next[k];
    }
  }
  return true;
}

/** 与行数据分离，只按 id 细粒度更新进度数字，避免触发行整表无效化 */
const pollProgressPercent = reactive<Record<string, number>>({});

function applySilentPollProgress(incoming: DownloadTask[]): void {
  const seen = new Set<string>();
  for (const row of incoming) {
    seen.add(row.id);
    const p = row.progressPercent;
    if (pollProgressPercent[row.id] !== p) {
      pollProgressPercent[row.id] = p;
    }
  }
  for (const key of Object.keys(pollProgressPercent)) {
    if (!seen.has(key)) {
      delete pollProgressPercent[key];
    }
  }
}

function clearPollProgressOverlay(): void {
  for (const key of Object.keys(pollProgressPercent)) {
    delete pollProgressPercent[key];
  }
}

function displayProgressPercent(task: DownloadTask): number {
  const o = pollProgressPercent[task.id];
  return o !== undefined ? o : task.progressPercent;
}

const items = ref<DownloadTask[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(12);
const loading = ref(true);
const errorMsg = ref('');
const busyId = ref<string | null>(null);

/** 当前页存在进行中任务时持续显示动感条（不只在请求往返的几十毫秒内） */
const showSyncRail = computed(
  () => !loading.value && taskListNeedsLivePolling(items.value),
);

const POLL_MS = 2500;
let loadSeq = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function load(silent = false) {
  const seq = ++loadSeq;
  if (!silent) {
    loading.value = true;
    errorMsg.value = '';
  }
  try {
    const data = await tasksApi.listTasks(page.value, limit.value);
    if (seq !== loadSeq) return;
    if (
      silent &&
      items.value.length > 0 &&
      tryMergePollRowMeta(items.value, data.items)
    ) {
      total.value = data.total;
      applySilentPollProgress(data.items);
    } else {
      items.value = data.items;
      total.value = data.total;
      clearPollProgressOverlay();
    }
    if (!silent) errorMsg.value = '';
  } catch {
    if (seq !== loadSeq) return;
    if (!silent) errorMsg.value = t('tasksPage.loadFailed');
  } finally {
    if (seq === loadSeq) {
      if (!silent) loading.value = false;
    }
  }
}

function tickPoll() {
  if (document.visibilityState !== 'visible') return;
  if (!taskListNeedsLivePolling(items.value)) return;
  void load(true);
}

function onVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  if (!taskListNeedsLivePolling(items.value)) return;
  void load(true);
}

onMounted(() => {
  void load(false);
  pollTimer = setInterval(tickPoll, POLL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});

watch([page, limit], () => void load(false));

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
  return t('errors.operationFailedRetry');
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

async function removeTask(task: DownloadTask) {
  const label =
    task.title || task.sourceUrl || task.sourceUrls[0] || task.id.slice(0, 8);
  if (!confirm(t('tasksPage.deleteConfirm', { label }))) {
    return;
  }
  busyId.value = task.id;
  errorMsg.value = '';
  try {
    await tasksApi.deleteTask(task.id);
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
        <h2>{{ t('tasksPage.title') }}</h2>
        <p class="muted" v-html="t('tasksPage.introHtml')" />
        <div
          class="sync-rail"
          :class="{ 'sync-rail--on': showSyncRail }"
          aria-live="polite"
          role="status"
          :aria-hidden="!showSyncRail"
        >
          <span class="sync-rail-sr">{{ t('common.syncListProgress') }}</span>
          <div class="sync-track">
            <div class="sync-track-shimmer" />
            <div class="sync-beam" />
          </div>
        </div>
      </div>
      <div class="pager">
        <label>
          {{ t('common.perPage') }}
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
          {{ t('common.prevPage') }}
        </button>
        <span class="pi">{{ page }} / {{ totalPages() }}</span>
        <button
          type="button"
          class="btn ghost"
          :disabled="page >= totalPages() || loading"
          @click="page++"
        >
          {{ t('common.nextPage') }}
        </button>
      </div>
    </header>

    <p v-if="loading" class="muted">{{ t('common.loading') }}</p>
    <template v-else>
      <p v-if="errorMsg" class="error error-banner">{{ errorMsg }}</p>
      <div class="table-wrap card">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t('tasksPage.colSummary') }}</th>
            <th>{{ t('tasksPage.colType') }}</th>
            <th>{{ t('tasksPage.colStatus') }}</th>
            <th>{{ t('tasksPage.colProgress') }}</th>
            <th class="col-time">{{ t('tasksPage.colCreated') }}</th>
            <th class="col-actions">{{ t('tasksPage.colActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in items" :key="task.id">
            <td
              class="cell-main"
              v-memo="[
                task.title,
                task.sourceUrl,
                task.sourceUrls[0],
                task.sourceType,
                task.createdAt,
              ]"
            >
              <div class="title">{{ task.title || t('common.none') }}</div>
              <div class="sub">
                {{ task.sourceUrl || task.sourceUrls[0] || t('common.dash') }}
              </div>
            </td>
            <td v-memo="[task.sourceType]">{{ sourceTypeLabel(task.sourceType) }}</td>
            <td v-memo="[task.status]">{{ taskStatusLabel(task.status) }}</td>
            <td
              class="cell-progress"
              v-memo="[pollProgressPercent[task.id], task.progressPercent, task.id]"
            >
              {{ displayProgressPercent(task) }}%
            </td>
            <td class="cell-time" v-memo="[task.createdAt]">
              {{ formatCreatedAt(task.createdAt) }}
            </td>
            <td
              class="actions"
              v-memo="[task.id, task.status, busyId]"
            >
              <button
                type="button"
                class="btn small"
                :disabled="busyId === task.id || !canPauseTask(task)"
                :title="t('tasksPage.pauseTitle')"
                @click="setStatus(task.id, 'paused')"
              >
                {{ t('tasksPage.pause') }}
              </button>
              <button
                type="button"
                class="btn small accent"
                :disabled="busyId === task.id || !canResumeTask(task)"
                :title="t('tasksPage.resumeTitle')"
                @click="setStatus(task.id, 'queued')"
              >
                {{ t('tasksPage.resume') }}
              </button>
              <button
                type="button"
                class="btn small warn"
                :disabled="busyId === task.id || !canRetryTask(task)"
                :title="t('tasksPage.retryTitle')"
                @click="setStatus(task.id, 'queued')"
              >
                {{ t('tasksPage.retry') }}
              </button>
              <button
                type="button"
                class="btn small danger"
                :disabled="busyId === task.id || !canCancelTask(task)"
                :title="t('tasksPage.cancelTitle')"
                @click="setStatus(task.id, 'cancelled')"
              >
                {{ t('tasksPage.cancel') }}
              </button>
              <button
                type="button"
                class="btn small del"
                :disabled="busyId === task.id"
                :title="t('tasksPage.deleteTitle')"
                @click="removeTask(task)"
              >
                {{ t('tasksPage.delete') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="items.length === 0" class="empty muted">{{ t('tasksPage.empty') }}</p>
    </div>
    </template>
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

.sync-rail {
  position: relative;
  margin: 0.35rem 0 0;
  max-width: 920px;
  height: 6px;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sync-rail--on {
  visibility: visible;
  opacity: 1;
}

.sync-rail-sr {
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

.sync-track {
  position: relative;
  height: 100%;
  border-radius: 999px;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03),
    rgba(255, 255, 255, 0.07),
    rgba(255, 255, 255, 0.03)
  );
  box-shadow:
    inset 0 0 10px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(62, 207, 142, 0.12);
}

.sync-track-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(62, 207, 142, 0.12),
    rgba(91, 224, 255, 0.18),
    rgba(62, 207, 142, 0.12),
    transparent
  );
  background-size: 45% 100%;
  background-repeat: no-repeat;
  animation: syncTrackShimmer 2.1s ease-in-out infinite;
  opacity: 0.65;
}

.sync-beam {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 32%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(62, 207, 142, 0.35) 22%,
    rgba(91, 224, 255, 1) 50%,
    rgba(62, 207, 142, 0.45) 78%,
    transparent 100%
  );
  box-shadow:
    0 0 10px rgba(91, 224, 255, 0.55),
    0 0 20px rgba(62, 207, 142, 0.35),
    0 0 1px rgba(255, 255, 255, 0.4);
  will-change: transform;
  animation: syncBeamSweep 1.45s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}

@keyframes syncTrackShimmer {
  0% {
    background-position: -50% 0;
  }
  100% {
    background-position: 150% 0;
  }
}

/* translate 百分比相对光条自身宽度，约走完整条轨道 */
@keyframes syncBeamSweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sync-track-shimmer,
  .sync-beam {
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
  }
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

.error-banner {
  margin-bottom: 0.5rem;
}
</style>
