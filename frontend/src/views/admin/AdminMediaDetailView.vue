<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { adminApi } from '@/api/adminClient';
import { formatBytesStringAsMegabytesM } from '@/utils/format-bytes-megabytes-admin';

type MediaDetail = {
  id: string;
  userId: string;
  ownerEmail: string;
  taskId: string | null;
  folderId: string | null;
  fileName: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  metadata: unknown;
  createdAt: string;
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);
const id = computed(() => String(route.params.id));

const loading = ref(true);
const err = ref('');
const detail = ref<MediaDetail | null>(null);
const deleting = ref(false);

async function load() {
  loading.value = true;
  err.value = '';
  try {
    const { data } = await adminApi.get<MediaDetail>(
      `/admin/media-files/${id.value}`,
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
  if (!detail.value) return;
  if (!window.confirm(t('admin.deleteMediaConfirm'))) return;
  deleting.value = true;
  err.value = '';
  try {
    await adminApi.delete(`/admin/media-files/${id.value}`);
    await router.replace(
      `${adminBase.value}/users/${detail.value.userId}/files`,
    );
  } catch (e: unknown) {
    err.value = axios.isAxiosError(e)
      ? String(
          (e.response?.data as { message?: string })?.message ?? e.message,
        )
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
      <RouterLink
        class="back"
        :to="
          detail
            ? `${adminBase}/users/${detail.userId}/files`
            : `${adminBase}/users`
        "
      >
        {{ `← ${t('admin.back')}` }}
      </RouterLink>
      <h1>{{ t('admin.mediaDetailTitle') }}</h1>
    </div>

    <p v-if="loading" class="muted">{{ t('admin.loading') }}</p>
    <p v-else-if="err" class="err">{{ err }}</p>
    <template v-else-if="detail">
      <p>
        <strong>{{ t('admin.colEmail') }}</strong>
        <RouterLink class="lnk" :to="`${adminBase}/users/${detail.userId}`">
          {{ detail.ownerEmail }}
        </RouterLink>
      </p>
      <p><RouterLink class="lnk small" :to="`${adminBase}/users/${detail.userId}/files`">{{ t('admin.userMedia') }}</RouterLink></p>
      <p v-if="detail.taskId">
        <RouterLink class="lnk" :to="`${adminBase}/tasks/${detail.taskId}`">
          task {{ detail.taskId }}
        </RouterLink>
      </p>
      <p><strong>ID</strong> {{ detail.id }}</p>
      <p><strong>userId</strong> {{ detail.userId }}</p>
      <p><strong>{{ t('admin.colFileName') }}</strong> {{ detail.fileName }}</p>
      <p><strong>{{ t('admin.colMime') }}</strong> {{ detail.mimeType ?? '—' }}</p>
      <p><strong>{{ t('admin.colFileBytes') }}</strong> {{ formatBytesStringAsMegabytesM(detail.sizeBytes) }}</p>
      <p>
        <strong>{{ t('admin.colRelativePath') }}</strong>
        <span class="path">{{ detail.relativePath }}</span>
      </p>
      <p>
        <strong>{{ t('admin.colChecksum') }}</strong>
        <span class="mono">{{ detail.checksumSha256 ?? '—' }}</span>
      </p>
      <p v-if="detail.width != null || detail.height != null">
        <strong>resolution</strong> {{ detail.width }}×{{ detail.height }}
      </p>
      <p v-if="detail.durationSec != null">
        <strong>duration</strong> {{ detail.durationSec }}s
      </p>
      <p>
        <strong>{{ t('admin.colCreatedAt') }}</strong>
        {{ detail.createdAt?.slice?.(0, 19)?.replace?.('T', ' ') }}
      </p>

      <p class="muted small"><strong>metadata</strong></p>
      <pre class="muted small pre">{{ JSON.stringify(detail.metadata, null, 2) }}</pre>

      <div class="danger">
        <button
          type="button"
          class="btn-del"
          :disabled="deleting"
          @click="confirmDelete"
        >
          {{ t('admin.deleteMedia') }}
        </button>
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
  display: inline-block;
}
.page h1 {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
}
.page p {
  margin: 0.4rem 0;
  font-size: 0.9rem;
}
.lnk {
  color: var(--cs-accent);
  text-decoration: none;
  margin-left: 0.35rem;
}
.lnk.small {
  margin-left: 0;
}
.path {
  word-break: break-all;
}
.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.82rem;
}
.muted {
  color: var(--cs-muted);
}
.pre {
  overflow-x: auto;
  max-height: 14rem;
}
.small {
  font-size: 0.82rem;
}
.err {
  color: #ff8b8b;
}
.danger {
  margin-top: 1.25rem;
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
</style>
