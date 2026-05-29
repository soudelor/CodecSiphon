<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { adminApi } from '@/api/adminClient';
import { formatBytesStringAsMegabytesM } from '@/utils/format-bytes-megabytes-admin';

type TaskMediaSummary = {
  id: string;
  fileName: string;
  relativePath: string;
  sizeBytes: string;
  mimeType: string | null;
  createdAt: string;
};

type Detail = Record<string, unknown> & {
  id: string;
  ownerUserId: string;
  ownerEmail: string;
  title: string | null;
  status: string;
  progressPercent: number;
  sourceType: string;
  createdAt: string;
  updatedAt?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  sourceUrls?: unknown;
  mediaFiles?: TaskMediaSummary[];
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);
const taskId = computed(() => String(route.params.id));

const loading = ref(true);
const err = ref('');
const detail = ref<Detail | null>(null);
const actionMsg = ref('');
const deleting = ref(false);

async function load() {
  loading.value = true;
  err.value = '';
  try {
    const { data } = await adminApi.get<Detail>(
      `/admin/tasks/${taskId.value}`,
    );
    detail.value = data;
  } catch (e: unknown) {
    detail.value = null;
    err.value = axios.isAxiosError(e)
      ? String(
          (e.response?.data as { message?: string })?.message ?? e.message,
        )
      : String(e);
  } finally {
    loading.value = false;
  }
}

async function confirmDelete() {
  if (!window.confirm(t('admin.deleteTaskConfirm'))) return;
  deleting.value = true;
  actionMsg.value = '';
  try {
    await adminApi.delete(`/admin/tasks/${taskId.value}`);
    await router.replace(`${adminBase.value}/tasks`);
  } catch (e: unknown) {
    actionMsg.value = axios.isAxiosError(e)
      ? JSON.stringify(e.response?.data ?? e.message)
      : String(e);
  } finally {
    deleting.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <div class="head">
      <RouterLink class="back" :to="`${adminBase}/tasks`">{{
        `← ${t('admin.back')}`
      }}</RouterLink>
      <h1>{{ t('admin.taskDetailTitle') }}</h1>
    </div>

    <p v-if="loading" class="muted">{{ t('admin.loading') }}</p>
    <p v-else-if="err" class="err">{{ err }}</p>
    <template v-else-if="detail">
      <section class="section">
        <p>
          <strong>{{ t('admin.taskOwner') }}</strong>
          <RouterLink class="lnk" :to="`${adminBase}/users/${detail.ownerUserId}`">
            {{ detail.ownerEmail }}
          </RouterLink>
        </p>
        <p><strong>ID</strong> {{ detail.id }}</p>
        <p><strong>userId</strong> {{ detail.ownerUserId }}</p>
        <p><strong>{{ t('admin.colTitle') }}</strong> {{ detail.title ?? '—' }}</p>
        <p><strong>{{ t('admin.colStatus') }}</strong> {{ detail.status }}</p>
        <p>
          <strong>{{ t('admin.colProgress') }}</strong>
          {{ detail.progressPercent }}%
        </p>
        <p><strong>sourceType</strong> {{ detail.sourceType }}</p>
        <p>
          <strong>{{ t('admin.colCreatedAt') }}</strong>
          {{ detail.createdAt?.slice?.(0, 19)?.replace?.('T', ' ') }}
        </p>
        <p>
          <RouterLink
            class="sec-link"
            :to="
              `${adminBase}/users/${detail.ownerUserId}/files?taskId=${detail.id}`
            "
          >
            {{ t('admin.filterTaskInUserFiles') }} →
          </RouterLink>
        </p>
      </section>

      <section v-if="detail.errorMessage || detail.errorCode" class="warn-box">
        <p>
          <strong>errorCode</strong> {{ detail.errorCode ?? '—' }}
        </p>
        <p><strong>errorMessage</strong> {{ detail.errorMessage }}</p>
      </section>

      <section v-if="detail.mediaFiles?.length" class="media-section">
        <h2 class="sub">{{ t('admin.taskMediaSection') }}</h2>
        <div class="scroll">
          <table class="tbl">
            <thead>
              <tr>
                <th>{{ t('admin.colFileName') }}</th>
                <th>{{ t('admin.colFileBytes') }}</th>
                <th>{{ t('admin.colMime') }}</th>
                <th>{{ t('admin.colRelativePath') }}</th>
                <th>{{ t('admin.colCreatedAt') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in detail.mediaFiles" :key="m.id">
                <td>{{ m.fileName }}</td>
                <td>{{ formatBytesStringAsMegabytesM(m.sizeBytes) }}</td>
                <td>{{ m.mimeType ?? '—' }}</td>
                <td class="path">{{ m.relativePath }}</td>
                <td>{{ m.createdAt?.slice?.(0, 19)?.replace?.('T', ' ') }}</td>
                <td>
                  <RouterLink
                    class="lnk"
                    :to="`${adminBase}/media-files/${m.id}`"
                  >{{ t('admin.viewDetail') }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p
        v-else-if="
          detail.mediaFiles &&
          Array.isArray(detail.mediaFiles) &&
          detail.mediaFiles.length === 0
        "
        class="muted"
      >
        {{ t('admin.noData') }}（{{ t('admin.taskMediaSection') }}）
      </p>

      <section class="muted small">
        <p><strong>sourceUrls</strong></p>
        <pre>{{ JSON.stringify(detail.sourceUrls, null, 2) }}</pre>
      </section>

      <div class="danger">
        <button
          type="button"
          class="btn-del"
          :disabled="deleting"
          @click="confirmDelete"
        >
          {{ t('admin.deleteTask') }}
        </button>
        <span v-if="actionMsg" class="muted">{{ actionMsg }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.head {
  margin-bottom: 0.85rem;
}
.back {
  color: var(--cs-muted);
  text-decoration: none;
  font-size: 0.88rem;
}
.page h1 {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
}
.section p {
  margin: 0.35rem 0;
  font-size: 0.9rem;
}
.lnk {
  color: var(--cs-accent);
  margin-left: 0.35rem;
}
.warn-box {
  border: 1px solid rgba(240, 201, 135, 0.45);
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  margin: 1rem 0;
}
.muted {
  color: var(--cs-muted);
}
.small pre {
  font-size: 0.78rem;
  overflow-x: auto;
  max-height: 12rem;
}
.err {
  color: #ff8b8b;
}
.danger {
  margin-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}
.btn-del {
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 120, 120, 0.45);
  background: rgba(180, 40, 40, 0.2);
  color: #ffb0b0;
  cursor: pointer;
}
.btn-del:disabled {
  opacity: 0.55;
}
.sub {
  margin: 1rem 0 0.5rem;
  font-size: 0.98rem;
}
.sec-link {
  font-size: 0.88rem;
  color: var(--cs-accent);
  text-decoration: none;
}
.media-section {
  margin: 1rem 0;
}
.media-section .scroll {
  overflow-x: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.tbl th,
.tbl td {
  border-bottom: 1px solid var(--cs-border);
  padding: 0.4rem 0.3rem;
  text-align: left;
}
.path {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
