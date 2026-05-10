<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as subsApi from '@/api/subscriptions';
import type { Subscription } from '@/types/models';

const { t } = useI18n();

const items = ref<Subscription[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(12);
const loading = ref(true);
const errorMsg = ref('');
const busyId = ref<string | null>(null);

const type = ref<'channel' | 'playlist' | 'rss'>('channel');
const sourceUrl = ref('');
const displayName = ref('');
const checkIntervalSec = ref(21600);
const submitting = ref(false);

function subscriptionTypeLabel(ty: string): string {
  if (ty === 'channel') return t('subscriptions.typeChannel');
  if (ty === 'playlist') return t('subscriptions.typePlaylist');
  if (ty === 'rss') return t('subscriptions.typeRss');
  return ty;
}

function subscriptionStatusLabel(s: string): string {
  return s === 'active'
    ? t('subscriptions.statusActive')
    : t('subscriptions.statusPaused');
}

async function load() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const data = await subsApi.listSubscriptions(page.value, limit.value);
    items.value = data.items;
    total.value = data.total;
  } catch {
    errorMsg.value = t('subscriptions.loadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([page, limit], load);

const totalPages = () => Math.max(1, Math.ceil(total.value / limit.value));

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join('；');
    if (typeof m === 'string') return m;
  }
  return t('errors.operationFailedRetry');
}

async function createSub() {
  submitting.value = true;
  errorMsg.value = '';
  try {
    await subsApi.createSubscription({
      type: type.value,
      sourceUrl: sourceUrl.value.trim(),
      displayName: displayName.value.trim() || undefined,
      checkIntervalSec: checkIntervalSec.value,
    });
    sourceUrl.value = '';
    displayName.value = '';
    await load();
  } catch (e) {
    errorMsg.value = apiErrorMessage(e);
  } finally {
    submitting.value = false;
  }
}

async function toggleStatus(s: Subscription) {
  busyId.value = s.id;
  errorMsg.value = '';
  try {
    await subsApi.updateSubscription(s.id, {
      status: s.status === 'active' ? 'paused' : 'active',
    });
    await load();
  } catch (e) {
    errorMsg.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}

async function removeSub(s: Subscription) {
  const label = s.displayName || s.sourceUrl.slice(0, 48) || s.id.slice(0, 8);
  if (!confirm(t('subscriptions.deleteConfirm', { label }))) {
    return;
  }
  busyId.value = s.id;
  errorMsg.value = '';
  try {
    await subsApi.deleteSubscription(s.id);
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
        <h2>{{ t('subscriptions.title') }}</h2>
        <p class="muted">
          {{ t('subscriptions.intro') }}
        </p>
      </div>
    </header>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="card form" @submit.prevent="createSub">
      <h3 class="form-title">{{ t('subscriptions.formTitle') }}</h3>
      <div class="row">
        <div class="field">
          <label>{{ t('subscriptions.contentType') }}</label>
          <select v-model="type">
            <option value="channel">{{ t('subscriptions.optChannel') }}</option>
            <option value="playlist">{{ t('subscriptions.optPlaylist') }}</option>
            <option value="rss">{{ t('subscriptions.optRss') }}</option>
          </select>
        </div>
        <div class="field grow">
          <label>{{ t('subscriptions.pageLink') }}</label>
          <input v-model="sourceUrl" required :placeholder="t('subscriptions.pageLinkPh')" />
        </div>
      </div>
      <div class="row">
        <div class="field grow">
          <label>{{ t('subscriptions.displayNameLabel') }}</label>
          <input v-model="displayName" maxlength="255" />
        </div>
        <div class="field">
          <label>{{ t('subscriptions.checkInterval') }}</label>
          <input
            v-model.number="checkIntervalSec"
            type="number"
            min="60"
            max="604800"
            required
          />
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" type="submit" :disabled="submitting">
          {{ submitting ? t('subscriptions.saving') : t('subscriptions.addSubmit') }}
        </button>
      </div>
    </form>

    <div class="card list-card">
      <div class="pager">
        <span class="pi">{{ t('subscriptions.totalSubs', { n: total }) }}</span>
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
        <span class="pi">{{ page }} / {{ totalPages() }}</span>
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
              <th>{{ t('subscriptions.colSub') }}</th>
              <th>{{ t('subscriptions.colType') }}</th>
              <th>{{ t('subscriptions.colStatus') }}</th>
              <th>{{ t('subscriptions.colInterval') }}</th>
              <th class="col-actions">{{ t('subscriptions.colActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in items" :key="s.id">
              <td class="cell-main">
                <div class="title">
                  {{ s.displayName || t('subscriptions.unnamed') }}
                </div>
                <div class="sub break">{{ s.sourceUrl }}</div>
                <div class="sub mono">{{ t('subscriptions.internalId', { id: s.id }) }}</div>
              </td>
              <td>{{ subscriptionTypeLabel(s.type) }}</td>
              <td>{{ subscriptionStatusLabel(s.status) }}</td>
              <td>{{ t('subscriptions.everySec', { sec: s.checkIntervalSec }) }}</td>
              <td class="actions">
                <button
                  type="button"
                  class="btn small"
                  :disabled="busyId === s.id"
                  @click="toggleStatus(s)"
                >
                  {{ s.status === 'active' ? t('subscriptions.pause') : t('subscriptions.enable') }}
                </button>
                <button
                  type="button"
                  class="btn small del"
                  :disabled="busyId === s.id"
                  @click="removeSub(s)"
                >
                  {{ t('subscriptions.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!loading && items.length === 0" class="empty muted">
          {{ t('subscriptions.empty') }}
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

.form.card {
  padding: 1.25rem;
}

.form-title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 180px;
}

.field.grow {
  flex: 1;
}

.field label {
  font-size: 0.85rem;
  color: var(--cs-muted);
}

.field input,
.field select {
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.55rem 0.65rem;
  font: inherit;
}

.actions {
  margin-top: 0.5rem;
}

.list-card {
  padding: 0;
  overflow: hidden;
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
  min-width: 140px;
}

.cell-main .title {
  font-weight: 600;
}

.cell-main .sub {
  margin-top: 0.25rem;
  color: var(--cs-muted);
  font-size: 0.82rem;
}

.sub.break {
  word-break: break-all;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.78rem;
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
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  font-size: 0.88rem;
}

.btn.primary {
  border-color: rgba(62, 207, 142, 0.45);
  color: var(--cs-accent, #3ecf8e);
}

.btn.ghost {
  padding: 0.45rem 0.75rem;
}

.btn.small {
  padding: 0.35rem 0.55rem;
  font-size: 0.82rem;
}

.btn.del {
  border-color: rgba(180, 120, 255, 0.35);
  color: #d4b4ff;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
