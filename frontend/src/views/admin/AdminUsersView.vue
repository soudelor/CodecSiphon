<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import { adminApi } from '@/api/adminClient';
import { formatBytesStringAsMegabytesM } from '@/utils/format-bytes-megabytes-admin';

type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  disabledAt: string | null;
  storageQuotaBytes: string;
  storageUsedBytes: string;
  monthlyDownloadQuotaBytes: string;
  mediaFileCount: number;
  mediaTotalBytes: string;
  storageOverQuota: boolean;
  createdAt: string;
};

const { t } = useI18n();
const route = useRoute();

const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);
const loading = ref(true);
const err = ref('');
const items = ref<AdminUserRow[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
/** '' | 'true' | 'false' */
const filterActive = ref('');

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
    if (filterActive.value === 'true' || filterActive.value === 'false') {
      params.isActive = filterActive.value;
    }

    const { data } = await adminApi.get<{
      items: AdminUserRow[];
      total: number;
      page: number;
      limit: number;
    }>('/admin/users', {
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

onMounted(() => void load());
watch(page, () => void load());

function onFilterActiveChange() {
  page.value = 1;
  void load();
}
</script>

<template>
  <div class="page">
    <h1>{{ t('admin.navUsers') }}</h1>
    <p class="muted intro">{{ t('admin.usersListQuotaIntro') }}</p>
    <p v-if="loading" class="muted">{{ t('admin.loading') }}</p>
    <p v-else-if="err" class="err">{{ err }}</p>
    <template v-else>
      <div class="toolbar">
        <span class="muted">{{ total }} {{ t('admin.totalRecords') }}</span>
        <select
          v-model="filterActive"
          class="sel"
          @change="onFilterActiveChange()"
        >
          <option value="">{{ t('admin.filterActiveAll') }}</option>
          <option value="true">{{ t('admin.filterActiveYes') }}</option>
          <option value="false">{{ t('admin.filterActiveNo') }}</option>
        </select>
      </div>
      <div class="scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th>{{ t('admin.colEmail') }}</th>
              <th>{{ t('admin.colActive') }}</th>
              <th>{{ t('admin.colDisplayName') }}</th>
              <th>{{ t('admin.colRole') }}</th>
              <th>{{ t('admin.colUsed') }}</th>
              <th>{{ t('admin.colQuota') }}</th>
              <th>{{ t('admin.colMonthlyDlQuota') }}</th>
              <th>{{ t('admin.colFiles') }}</th>
              <th>{{ t('admin.colFileBytes') }}</th>
              <th>{{ t('admin.colCreatedAt') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in items" :key="u.id">
              <td>
                <RouterLink class="lnk" :to="`${adminBase}/users/${u.id}`">{{
                  u.email
                }}</RouterLink>
                <span
                  v-if="u.storageOverQuota"
                  class="warn-dot"
                  :title="t('admin.storageWarn')"
                  >⚠</span
                >
              </td>
              <td>
                <span :class="u.isActive ? 'ok' : 'bad'">{{
                  u.isActive ? t('admin.badgeActive') : t('admin.badgeInactive')
                }}</span>
              </td>
              <td>{{ u.displayName ?? '—' }}</td>
              <td>{{ u.role }}</td>
              <td>{{ formatBytesStringAsMegabytesM(u.storageUsedBytes) }}</td>
              <td>{{ formatBytesStringAsMegabytesM(u.storageQuotaBytes) }}</td>
              <td>{{ formatBytesStringAsMegabytesM(u.monthlyDownloadQuotaBytes) }}</td>
              <td>{{ u.mediaFileCount }}</td>
              <td>{{ formatBytesStringAsMegabytesM(u.mediaTotalBytes) }}</td>
              <td>{{ u.createdAt?.slice?.(0, 19)?.replace?.('T', ' ') }}</td>
              <td>
                <RouterLink class="lnk" :to="`${adminBase}/users/${u.id}`">{{
                  t('admin.viewAndEditQuotas')
                }}</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="items.length === 0" class="muted">{{ t('admin.noData') }}</p>
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
  margin: 0 0 1rem;
  font-size: 1.2rem;
}
.intro {
  margin: -0.5rem 0 1rem;
  max-width: 52rem;
  line-height: 1.5;
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.sel {
  padding: 0.35rem 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--cs-text);
  font-size: 0.85rem;
}
.ok {
  color: #87d993;
}
.bad {
  color: #ffb0b0;
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
.tbl th {
  color: var(--cs-muted);
  font-weight: 600;
}
.lnk {
  color: var(--cs-accent);
  text-decoration: none;
}
.warn-dot {
  margin-left: 0.35rem;
  cursor: help;
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
