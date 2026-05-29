<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import { adminApi } from '@/api/adminClient';
import { formatBytesStringAsMegabytesM } from '@/utils/format-bytes-megabytes-admin';

type MediaRow = {
  id: string;
  fileName: string;
  sizeBytes: string;
  relativePath?: string;
  taskId: string | null;
  createdAt: string;
  mimeType: string | null;
};

const { t } = useI18n();
const route = useRoute();
const userId = computed(() => String(route.params.userId));
const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);

const loading = ref(true);
const err = ref('');
const items = ref<MediaRow[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);

const filterFileName = ref('');
const filterTaskId = ref('');
const filterCreatedAfter = ref('');
const filterCreatedBefore = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / limit.value)),
);

async function load() {
  loading.value = true;
  err.value = '';
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      limit: limit.value,
    };
    const n = filterFileName.value.trim();
    if (n) params.fileNameContains = n;
    const tid = filterTaskId.value.trim();
    if (tid) params.taskId = tid;
    const ca = filterCreatedAfter.value.trim();
    if (ca) params.createdAfter = ca;
    const cb = filterCreatedBefore.value.trim();
    if (cb) params.createdBefore = cb;

    const { data } = await adminApi.get<{
      items: MediaRow[];
      total: number;
    }>(`/admin/users/${userId.value}/media-files`, {
      params,
    });
    items.value = data.items ?? [];
    total.value = data.total ?? 0;
  } catch (e: unknown) {
    err.value =
      axios.isAxiosError(e)
        ? (e.response?.data as { message?: string })?.message ?? e.message
        : String(e);
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  void load();
}

watch(
  () => route.query.taskId,
  (v) => {
    filterTaskId.value = typeof v === 'string' ? v : '';
    page.value = 1;
    void load();
  },
);

watch(userId, () => {
  page.value = 1;
  void load();
});

onMounted(() => {
  const q = route.query.taskId;
  if (typeof q === 'string') filterTaskId.value = q;
  void load();
});
watch(page, () => void load());
</script>

<template>
  <div class="page">
    <div class="head">
      <RouterLink class="back" :to="`${adminBase}/users/${userId}`">{{
        `← ${t('admin.back')}`
      }}</RouterLink>
      <h1>{{ t('admin.userMediaTitle') }}</h1>
    </div>

    <div class="filters">
      <h2 class="filters-title">{{ t('admin.fileFiltersTitle') }}</h2>
      <div class="grid">
        <label class="lbl">
          <span>{{ t('admin.hintFileNameContains') }}</span>
          <input v-model="filterFileName" type="text" autocomplete="off" />
        </label>
        <label class="lbl">
          <span>taskId</span>
          <input
            v-model="filterTaskId"
            type="text"
            autocomplete="off"
            :placeholder="t('admin.hintTaskFilterId')"
          />
        </label>
        <label class="lbl">
          <span>createdAfter</span>
          <input
            v-model="filterCreatedAfter"
            type="text"
            autocomplete="off"
          />
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
      <button type="button" class="btn" @click="applyFilters">
        {{ t('admin.applyFilters') }}
      </button>
    </div>

    <p v-if="loading" class="muted">{{ t('admin.loading') }}</p>
    <p v-else-if="err" class="err">{{ err }}</p>
    <template v-else>
      <div class="toolbar muted">
        {{ total }} {{ t('admin.totalRecords') }}
      </div>
      <div class="scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th>{{ t('admin.colFileName') }}</th>
              <th>{{ t('admin.colFileBytes') }}</th>
              <th>{{ t('admin.colMime') }}</th>
              <th>{{ t('admin.colRelativePath') }}</th>
              <th>{{ t('admin.colCreatedAt') }}</th>
              <th>taskId</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in items" :key="m.id">
              <td>{{ m.fileName }}</td>
              <td>{{ formatBytesStringAsMegabytesM(m.sizeBytes) }}</td>
              <td>{{ m.mimeType ?? '—' }}</td>
              <td class="path" :title="m.relativePath">
                {{ m.relativePath ?? '—' }}
              </td>
              <td>{{ m.createdAt?.slice?.(0, 19)?.replace?.('T', ' ') }}</td>
              <td>{{ m.taskId ?? '—' }}</td>
              <td>
                <RouterLink
                  class="lnk"
                  :to="`${adminBase}/media-files/${m.id}`"
                  >{{ t('admin.viewDetail') }}</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="totalPages > 1" class="pager">
        <button type="button" :disabled="page <= 1" @click="page--">
          {{ t('admin.pagePrev') }}
        </button>
        <span class="muted">{{ page }} / {{ totalPages }}</span>
        <button
          type="button"
          :disabled="page >= totalPages"
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
  margin: 0.35rem 0 1rem;
  font-size: 1.1rem;
}
.head {
  margin-bottom: 0.75rem;
}
.back {
  color: var(--cs-muted);
  text-decoration: none;
  font-size: 0.88rem;
}
.filters {
  border: 1px solid var(--cs-border);
  border-radius: 12px;
  padding: 0.75rem 1rem 1rem;
  margin-bottom: 1rem;
  background: rgba(255, 255, 255, 0.02);
}
.filters-title {
  margin: 0 0 0.55rem;
  font-size: 0.92rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.55rem;
  margin-bottom: 0.65rem;
}
.lbl {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: var(--cs-muted);
}
.lbl input {
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
.toolbar {
  margin-bottom: 0.55rem;
  font-size: 0.88rem;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.tbl th,
.tbl td {
  border-bottom: 1px solid var(--cs-border);
  padding: 0.45rem 0.3rem;
  text-align: left;
}
.path {
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lnk {
  color: var(--cs-accent);
  text-decoration: none;
}
.scroll {
  overflow-x: auto;
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
.muted {
  color: var(--cs-muted);
}
.err {
  color: #ff8b8b;
}
</style>
