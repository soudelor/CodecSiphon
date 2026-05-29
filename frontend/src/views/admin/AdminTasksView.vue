<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import { adminApi } from '@/api/adminClient';

const TASK_STATUSES = [
  '',
  'pending',
  'queued',
  'parsing',
  'downloading',
  'processing',
  'completed',
  'paused',
  'cancelled',
  'failed',
] as const;

const TASK_SOURCE_TYPES = [
  '',
  'single_url',
  'multi_url',
  'playlist',
  'subscription',
] as const;

type AdminTaskRow = {
  id: string;
  userId: string;
  ownerEmail: string;
  title: string | null;
  status: string;
  progressPercent: number;
  sourceType: string;
  createdAt: string;
};

const { t } = useI18n();
const route = useRoute();
const adminBase = () =>
  `/admin/${String(route.params.yyyymmdd)}`;

const loading = ref(true);
const err = ref('');
const items = ref<AdminTaskRow[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);

const filterUserId = ref('');
const filterUserEmail = ref('');
const filterStatus = ref('');
const filterSourceType = ref('');
const filterQ = ref('');
const filterCreatedAfter = ref('');
const filterCreatedBefore = ref('');

function totalPages() {
  return Math.max(1, Math.ceil(total.value / limit.value));
}

function hydrateFromRoute() {
  filterUserId.value =
    typeof route.query.userId === 'string' ? route.query.userId : '';
}

async function load() {
  loading.value = true;
  err.value = '';
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      limit: limit.value,
    };
    if (filterUserId.value.trim()) params.userId = filterUserId.value.trim();
    if (filterUserEmail.value.trim()) {
      params.userEmail = filterUserEmail.value.trim();
    }
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterSourceType.value) params.sourceType = filterSourceType.value;
    if (filterQ.value.trim()) params.q = filterQ.value.trim();
    if (filterCreatedAfter.value.trim()) {
      params.createdAfter = filterCreatedAfter.value.trim();
    }
    if (filterCreatedBefore.value.trim()) {
      params.createdBefore = filterCreatedBefore.value.trim();
    }

    const { data } = await adminApi.get<{
      items: AdminTaskRow[];
      total: number;
    }>('/admin/tasks', { params });

    items.value = data.items ?? [];
    total.value = data.total ?? 0;
  } catch (e: unknown) {
    err.value = axios.isAxiosError(e)
      ? String(
          (e.response?.data as { message?: string })?.message ?? e.message,
        )
      : String(e);
  } finally {
    loading.value = false;
  }
}

function applyManualFilters() {
  page.value = 1;
  void load();
}

watch(
  () => route.query,
  () => {
    hydrateFromRoute();
    page.value = 1;
    void load();
  },
  { deep: true },
);

watch(page, () => void load());

onMounted(() => {
  hydrateFromRoute();
  void load();
});
</script>

<template>
  <div class="page">
    <h1>{{ t('admin.navTasks') }}</h1>

    <div class="filters">
      <h2 class="sub">{{ t('admin.filtersTitle') }}</h2>
      <div class="grid">
        <label class="lbl">
          <span>userId</span>
          <input v-model="filterUserId" type="text" autocomplete="off" />
        </label>
        <label class="lbl">
          <span>{{ t('admin.colEmail') }}</span>
          <input
            v-model="filterUserEmail"
            type="text"
            autocomplete="off"
            :placeholder="t('admin.hintUserEmail')"
          />
        </label>
        <label class="lbl">
          <span>{{ t('admin.colStatus') }}</span>
          <select v-model="filterStatus">
            <option v-for="s in TASK_STATUSES" :key="s || 'any'" :value="s">
              {{ s || '—' }}
            </option>
          </select>
        </label>
        <label class="lbl">
          <span>sourceType</span>
          <select v-model="filterSourceType">
            <option v-for="s in TASK_SOURCE_TYPES" :key="s || 'any'" :value="s">
              {{ s || '—' }}
            </option>
          </select>
        </label>
        <label class="lbl wide">
          <span>{{ t('admin.colTitle') }}</span>
          <input v-model="filterQ" type="text" autocomplete="off" />
        </label>
        <label class="lbl">
          <span>createdAfter</span>
          <input v-model="filterCreatedAfter" type="text" autocomplete="off" />
        </label>
        <label class="lbl">
          <span>createdBefore</span>
          <input
            v-model="filterCreatedBefore"
            type="text"
            autocomplete="off"
          />
        </label>
      </div>
      <button type="button" class="btn" @click="applyManualFilters">
        {{ t('admin.applyFilters') }}
      </button>
    </div>

    <p v-if="loading" class="muted">{{ t('admin.loading') }}</p>
    <p v-else-if="err" class="err">{{ err }}</p>
    <template v-else>
      <div class="toolbar">
        <span class="muted"
          >{{ total }} {{ t('admin.totalRecords') }}</span
        >
      </div>
      <div class="scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th>{{ t('admin.colTitle') }}</th>
              <th>{{ t('admin.colStatus') }}</th>
              <th>{{ t('admin.colProgress') }}</th>
              <th>{{ t('admin.colEmail') }}</th>
              <th>userId</th>
              <th>{{ t('admin.colCreatedAt') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.id">
              <td>{{ row.title ?? '—' }}</td>
              <td>{{ row.status }}</td>
              <td>{{ row.progressPercent }}%</td>
              <td>{{ row.ownerEmail }}</td>
              <td>{{ row.userId }}</td>
              <td>{{ row.createdAt?.slice?.(0, 19)?.replace?.('T', ' ') }}</td>
              <td>
                <RouterLink class="lnk" :to="`${adminBase()}/tasks/${row.id}`">
                  {{ t('admin.viewDetail') }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="items.length === 0" class="muted">{{ t('admin.noData') }}</p>
      </div>
      <div v-if="totalPages() > 1" class="pager">
        <button type="button" :disabled="page <= 1" @click="page--">
          {{ t('admin.pagePrev') }}
        </button>
        <span class="muted">{{ page }} / {{ totalPages() }}</span>
        <button
          type="button"
          :disabled="page >= totalPages()"
          @click="page++"
        >
          {{ t('admin.pageNext') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page h1 {
  margin: 0 0 1rem;
  font-size: 1.2rem;
}
.filters {
  border: 1px solid var(--cs-border);
  border-radius: 12px;
  padding: 0.85rem 1rem 1rem;
  margin-bottom: 1rem;
  background: rgba(255, 255, 255, 0.02);
}
.filters .sub {
  margin: 0 0 0.65rem;
  font-size: 0.95rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}
.lbl {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--cs-muted);
}
.lbl.wide {
  grid-column: 1 / -1;
}
.lbl input,
.lbl select {
  padding: 0.4rem 0.45rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--cs-text);
}
.btn {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: rgba(62, 207, 142, 0.12);
  color: var(--cs-accent);
  cursor: pointer;
}
.muted {
  color: var(--cs-muted);
  font-size: 0.9rem;
}
.err {
  color: #ff8b8b;
}
.toolbar {
  margin-bottom: 0.65rem;
}
.scroll {
  overflow-x: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.tbl th,
.tbl td {
  border-bottom: 1px solid var(--cs-border);
  padding: 0.5rem 0.35rem;
  text-align: left;
}
.lnk {
  color: var(--cs-accent);
  text-decoration: none;
}
.pager {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}
.pager button {
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--cs-text);
  cursor: pointer;
}
.pager button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
