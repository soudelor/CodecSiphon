<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import { adminApi } from '@/api/adminClient';
import {
  bytesStringFlooredMegabytesInteger,
  formatBytesStringAsMegabytesM,
  nonnegativeIntegerMbToByteString,
} from '@/utils/format-bytes-megabytes-admin';

type UserDetail = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  disabledAt: string | null;
  storageQuotaBytes: string;
  storageUsedBytes: string;
  storageOverQuota: boolean;
  monthlyDownloadQuotaBytes: string;
  mediaFileCount: number;
  mediaTotalBytes: string;
  taskTotal: number;
  taskCountsByStatus: Record<string, number>;
  createdAt: string;
};

const { t } = useI18n();
const route = useRoute();
const id = computed(() => String(route.params.id));
const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);

const loading = ref(true);
const err = ref('');
const detail = ref<UserDetail | null>(null);
const saveMsg = ref('');

const roleEdit = ref('user');
/** 表单内以整数 MiB（M）编辑，提交时换算为字节 */
const quotaEditMb = ref('');
const monthlyDlQuotaEditMb = ref('');
const activeEdit = ref(true);

async function fetchDetail() {
  loading.value = true;
  err.value = '';
  try {
    const { data } = await adminApi.get<UserDetail>(`/admin/users/${id.value}`);
    detail.value = data;
    roleEdit.value = data.role;
    quotaEditMb.value = bytesStringFlooredMegabytesInteger(
      data.storageQuotaBytes,
    );
    monthlyDlQuotaEditMb.value = bytesStringFlooredMegabytesInteger(
      data.monthlyDownloadQuotaBytes,
    );
    activeEdit.value = data.isActive !== false;
  } catch (e: unknown) {
    err.value =
      axios.isAxiosError(e)
        ? (e.response?.data as { message?: string })?.message ?? e.message
        : String(e);
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saveMsg.value = '';
  try {
    const payload: Record<string, string | boolean | undefined> = {};
    if (roleEdit.value !== detail.value?.role) {
      payload.role = roleEdit.value;
    }
    const qb = nonnegativeIntegerMbToByteString(quotaEditMb.value);
    const mbDl = nonnegativeIntegerMbToByteString(monthlyDlQuotaEditMb.value);
    if (qb === undefined || mbDl === undefined) {
      saveMsg.value = t('admin.errQuotaMbInvalid');
      return;
    }
    if (qb !== String(detail.value?.storageQuotaBytes)) {
      payload.storageQuotaBytes = qb;
    }
    if (mbDl !== String(detail.value?.monthlyDownloadQuotaBytes)) {
      payload.monthlyDownloadQuotaBytes = mbDl;
    }
    const curActive = detail.value?.isActive !== false;
    if (activeEdit.value !== curActive) {
      payload.isActive = activeEdit.value;
    }
    if (Object.keys(payload).length === 0) {
      saveMsg.value = '—';
      return;
    }
    const { data } = await adminApi.patch<UserDetail>(
      `/admin/users/${id.value}`,
      payload,
    );
    detail.value = data;
    roleEdit.value = data.role;
    quotaEditMb.value = bytesStringFlooredMegabytesInteger(
      data.storageQuotaBytes,
    );
    monthlyDlQuotaEditMb.value = bytesStringFlooredMegabytesInteger(
      data.monthlyDownloadQuotaBytes,
    );
    activeEdit.value = data.isActive !== false;
    saveMsg.value = t('admin.savedOk');
  } catch (e: unknown) {
    saveMsg.value = axios.isAxiosError(e)
      ? JSON.stringify(e.response?.data ?? e.message)
      : String(e);
  }
}

onMounted(() => void fetchDetail());
</script>

<template>
  <div class="page">
    <div class="head">
      <RouterLink class="back" :to="`${adminBase}/users`">{{
        `← ${t('admin.back')}`
      }}</RouterLink>
      <h1>{{ t('admin.userDetailTitle') }}</h1>
    </div>
    <p v-if="loading" class="muted">{{ t('admin.loading') }}</p>
    <p v-else-if="err" class="err">{{ err }}</p>
    <template v-else-if="detail">
      <p v-if="detail.storageOverQuota" class="warn">{{ t('admin.storageWarn') }}</p>
      <div class="grid">
        <div>
          <p>
            <strong>{{ t('admin.colActive') }}</strong>
            <span :class="detail.isActive ? 'ok' : 'bad'">
              {{ detail.isActive ? t('admin.badgeActive') : t('admin.badgeInactive') }}
            </span>
          </p>
          <p v-if="detail.disabledAt" class="muted small">
            <strong>{{ t('admin.colDisabledAt') }}</strong>
            {{ detail.disabledAt?.slice?.(0, 19)?.replace?.('T', ' ') }}
          </p>
          <p><strong>ID</strong> {{ detail.id }}</p>
          <p><strong>{{ t('admin.colEmail') }}</strong> {{ detail.email }}</p>
          <p><strong>{{ t('admin.colDisplayName') }}</strong> {{ detail.displayName ?? '—' }}</p>
          <p><strong>{{ t('admin.colCreatedAt') }}</strong> {{ detail.createdAt?.slice?.(0, 19)?.replace?.('T', ' ') }}</p>
        </div>
        <div>
          <p>
            <strong>{{ t('admin.colUsed') }}</strong>
            {{ formatBytesStringAsMegabytesM(detail.storageUsedBytes) }}
          </p>
          <p>
            <strong>{{ t('admin.colQuota') }}</strong>
            {{ formatBytesStringAsMegabytesM(detail.storageQuotaBytes) }}
          </p>
          <p>
            <strong>{{ t('admin.colMonthlyDlQuota') }}</strong>
            {{ formatBytesStringAsMegabytesM(detail.monthlyDownloadQuotaBytes) }}
          </p>
        </div>
        <div>
          <p><strong>{{ t('admin.colFiles') }}</strong> {{ detail.mediaFileCount }}</p>
          <p>
            <strong>{{ t('admin.colFileBytes') }}</strong>
            {{ formatBytesStringAsMegabytesM(detail.mediaTotalBytes) }}
          </p>
          <p><strong>Tasks</strong> {{ detail.taskTotal }}</p>
          <p class="muted small">{{ JSON.stringify(detail.taskCountsByStatus) }}</p>
        </div>
      </div>

      <div class="actions">
        <RouterLink class="btn" :to="`${adminBase}/tasks?userId=${detail.id}`">
          {{ t('admin.userTasks') }}
        </RouterLink>
        <RouterLink class="btn" :to="`${adminBase}/users/${detail.id}/files`">
          {{ t('admin.userMedia') }}
        </RouterLink>
      </div>

      <h2>{{ t('admin.sectionQuotas') }}</h2>
      <p class="muted small quota-hint">{{ t('admin.quotaEditHint') }}</p>
      <div class="form">
        <label>
          {{ t('admin.fieldQuotaMb') }}
          <input v-model="quotaEditMb" type="text" inputmode="numeric" autocomplete="off" />
        </label>
        <label>
          {{ t('admin.fieldMonthlyDlMb') }}
          <input
            v-model="monthlyDlQuotaEditMb"
            type="text"
            inputmode="numeric"
            autocomplete="off"
          />
        </label>
      </div>

      <h2>{{ t('admin.sectionAccount') }}</h2>
      <div class="form">
        <label>
          {{ t('admin.fieldRole') }}
          <select v-model="roleEdit">
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label class="check">
          <input v-model="activeEdit" type="checkbox" />
          {{ t('admin.fieldActive') }}
        </label>
        <button type="button" class="btn primary" @click="save()">
          {{ t('admin.save') }}
        </button>
      </div>
      <p v-if="saveMsg" class="muted">{{ saveMsg }}</p>
    </template>
  </div>
</template>

<style scoped>
.page h1 {
  margin: 0.35rem 0 1rem;
  font-size: 1.15rem;
}
.head {
  margin-bottom: 0.75rem;
}
.back {
  color: var(--cs-muted);
  text-decoration: none;
  font-size: 0.88rem;
}
.back:hover {
  color: var(--cs-accent);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 800px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.muted {
  color: var(--cs-muted);
}
.small {
  font-size: 0.82rem;
  word-break: break-all;
}
.err {
  color: #ff8b8b;
}
.warn {
  color: #f0c987;
}
.ok {
  color: #87d993;
}
.bad {
  color: #ffb0b0;
  margin-left: 0.35rem;
}
.check {
  flex-direction: row !important;
  align-items: center;
  gap: 0.45rem !important;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}
.btn {
  display: inline-block;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  color: var(--cs-accent);
  text-decoration: none;
  font-size: 0.88rem;
}
.btn.primary {
  background: rgba(62, 207, 142, 0.15);
}
.form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  margin-top: 0.75rem;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--cs-muted);
}
.form select,
.form input {
  min-width: 12rem;
  padding: 0.45rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--cs-text);
}
h2 {
  margin: 1.25rem 0 0.5rem;
  font-size: 1rem;
}
.quota-hint {
  margin: 0 0 0.75rem;
  line-height: 1.45;
}
</style>
