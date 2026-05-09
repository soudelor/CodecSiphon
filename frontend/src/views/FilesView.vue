<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as mediaApi from '@/api/media';
import type { MediaFileRow } from '@/types/models';

const { t } = useI18n();

const items = ref<MediaFileRow[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(12);
const q = ref('');
const qDebounced = ref('');
const loading = ref(true);
const errorMsg = ref('');
const busyId = ref<string | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(q, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    qDebounced.value = v;
    page.value = 1;
  }, 320);
});

async function load() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const data = await mediaApi.listMedia(
      page.value,
      limit.value,
      qDebounced.value.trim() || undefined,
    );
    items.value = data.items;
    total.value = data.total;
  } catch {
    errorMsg.value = t('files.loadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([page, limit, qDebounced], load);

const totalPages = () => Math.max(1, Math.ceil(total.value / limit.value));

function formatBytes(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return `0 ${t('files.unitB')}`;
  const units = [
    t('files.unitB'),
    t('files.unitKB'),
    t('files.unitMB'),
    t('files.unitGB'),
    t('files.unitTB'),
  ];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
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

async function downloadToLocal(m: MediaFileRow) {
  busyId.value = m.id;
  errorMsg.value = '';
  try {
    await mediaApi.downloadMediaToDevice(m.id, mediaApi.mediaDownloadLocalName(m));
  } catch (e) {
    errorMsg.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}

async function removeFile(m: MediaFileRow) {
  if (!confirm(t('files.deleteConfirm', { name: m.fileName }))) {
    return;
  }
  busyId.value = m.id;
  errorMsg.value = '';
  try {
    await mediaApi.deleteMedia(m.id);
    await load();
  } catch (e) {
    errorMsg.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}

function taskLabel(m: MediaFileRow): string {
  if (!m.taskId) return t('files.taskDash');
  const title = m.taskTitle?.trim();
  if (title) return title;
  return t('files.taskNoTitle');
}

const searchHint = computed(() =>
  qDebounced.value.trim()
    ? t('files.searchActive', { q: qDebounced.value.trim() })
    : t('files.allFiles'),
);

const totalHint = computed(() =>
  t('files.totalCount', { n: total.value }),
);
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h2>{{ t('files.title') }}</h2>
        <p class="muted" v-html="t('files.intro')" />
      </div>
      <div class="search">
        <input
          v-model="q"
          type="search"
          :placeholder="t('files.searchPlaceholder')"
          :aria-label="t('files.searchAria')"
        />
      </div>
    </header>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div class="card">
      <div class="pager">
        <span class="pi">{{ searchHint }} · {{ totalHint }}</span>
        <span class="spacer" />
        <label>
          {{ t('common.perPage') }}
          <select v-model.number="limit">
            <option :value="8">8</option>
            <option :value="12">12</option>
            <option :value="24">24</option>
          </select>
        </label>
        <button
          type="button"
          class="btn ghost"
          :disabled="page <= 1 || loading"
          @click="page -= 1"
        >
          {{ t('common.prevPage') }}
        </button>
        <span class="pi">
          {{ page }} / {{ totalPages() }}
        </span>
        <button
          type="button"
          class="btn ghost"
          :disabled="page >= totalPages() || loading"
          @click="page += 1"
        >
          {{ t('common.nextPage') }}
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{{ t('files.colFile') }}</th>
              <th>{{ t('files.colSize') }}</th>
              <th>{{ t('files.colTaskTitle') }}</th>
              <th>{{ t('files.colAdded') }}</th>
              <th class="col-actions">{{ t('files.colActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in items" :key="m.id">
              <td class="cell-main">
                <div class="title">{{ m.fileName }}</div>
                <div class="sub mono">{{ m.relativePath }}</div>
                <div v-if="m.mimeType" class="sub">{{ m.mimeType }}</div>
              </td>
              <td>{{ formatBytes(m.sizeBytes) }}</td>
              <td class="task-cell">
                <div class="task-title-line">{{ taskLabel(m) }}</div>
              </td>
              <td>{{ new Date(m.createdAt).toLocaleString() }}</td>
              <td class="actions">
                <button
                  type="button"
                  class="btn small accent"
                  :disabled="busyId === m.id"
                  :title="t('files.downloadTitle')"
                  @click="downloadToLocal(m)"
                >
                  {{ t('files.download') }}
                </button>
                <button
                  type="button"
                  class="btn small del"
                  :disabled="busyId === m.id"
                  @click="removeFile(m)"
                >
                  {{ t('files.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!loading && items.length === 0" class="empty muted">
          {{ t('files.empty') }}
        </p>
      </div>
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

.muted code {
  font-size: 0.85em;
  padding: 0.1em 0.35em;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.search input {
  min-width: 240px;
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.45rem 0.65rem;
}

.pager {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--cs-border);
}

.spacer {
  flex: 1;
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

.col-actions {
  min-width: 160px;
  width: 22%;
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

.task-cell {
  max-width: 280px;
}

.task-title-line {
  font-weight: 500;
  line-height: 1.35;
  word-break: break-word;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.82rem;
}

.actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
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
