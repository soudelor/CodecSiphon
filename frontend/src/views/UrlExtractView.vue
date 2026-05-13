<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import * as urlExtractApi from '@/api/url-extract';
import type { UrlExtractFullResult, UrlExtractItem } from '@/types/models';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const urlInput = ref('');
const loading = ref(false);
const errorMsg = ref('');
const result = ref<UrlExtractFullResult | null>(null);
const flashIndex = ref<number | null>(null);
const samplingIndex = ref<number | null>(null);

function apiErr(e: unknown): string {
  const data =
    e &&
    typeof e === 'object' &&
    'response' in e &&
    (e as { response?: { data?: unknown } }).response?.data &&
    typeof (e as { response: { data: unknown } }).response.data === 'object'
      ? ((e as { response: { data: Record<string, unknown> } }).response
          .data as Record<string, unknown>)
      : null;
  if (data && typeof data.key === 'string' && data.key) {
    const args = data.args;
    if (args && typeof args === 'object' && !Array.isArray(args)) {
      return t(data.key, args as Record<string, unknown>);
    }
    return t(data.key);
  }
  const nested = data?.message;
  if (
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested) &&
    typeof (nested as Record<string, unknown>).key === 'string'
  ) {
    const k = (nested as { key: string }).key;
    return t(k);
  }
  const m = data?.message;
  if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join('；');
  if (typeof m === 'string') return m;
  return t('errors.operationFailedRetry');
}

function applyQueryUrl() {
  const q = route.query.url;
  if (typeof q === 'string' && q.trim()) {
    urlInput.value = q.trim();
  }
}

onMounted(() => {
  applyQueryUrl();
});

watch(
  () => route.query.url,
  () => applyQueryUrl(),
);

async function runParse() {
  errorMsg.value = '';
  result.value = null;
  const u = urlInput.value.trim();
  if (!u) {
    errorMsg.value = t('errors.previewUrlRequired');
    return;
  }
  loading.value = true;
  try {
    result.value = await urlExtractApi.parseUrlExtract(u);
    try {
      await router.replace({
        query: { ...route.query, url: u },
      });
    } catch {
      /* ignore */
    }
  } catch (e) {
    errorMsg.value = apiErr(e);
  } finally {
    loading.value = false;
  }
}

async function copyRow(it: UrlExtractItem) {
  const text = it.copyUrl?.trim();
  if (!text) {
    errorMsg.value = t('urlExtract.copyFailed');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    flashIndex.value = it.index;
    setTimeout(() => {
      flashIndex.value = null;
    }, 1200);
  } catch {
    errorMsg.value = t('urlExtract.copyFailed');
  }
}

async function sampleRow(it: UrlExtractItem) {
  const text = it.copyUrl?.trim();
  if (!text) {
    errorMsg.value = t('urlExtract.copyFailed');
    return;
  }
  errorMsg.value = '';
  samplingIndex.value = it.index;
  try {
    await urlExtractApi.downloadUrlExtractSampleClip(text);
  } catch (e) {
    errorMsg.value = apiErr(e);
  } finally {
    samplingIndex.value = null;
  }
}

function cell(v: string | null | undefined): string {
  const s = v?.trim();
  return s ? s : t('urlExtract.emptyDash');
}

const parseOutcome = computed<'success' | 'empty' | null>(() => {
  const r = result.value;
  if (!r) return null;
  if (r.total === 0 || r.items.length === 0) return 'empty';
  return 'success';
});
</script>

<template>
  <div class="page">
    <header class="head">
      <h2 class="h2">{{ t('urlExtract.title') }}</h2>
      <p class="muted">
        {{ t('urlExtract.subtitle') }}
        <RouterLink to="/tools/url-extract" class="sub-link">{{
          t('urlExtract.publicTitle')
        }}</RouterLink>
      </p>
    </header>

    <div class="card form-card" :class="{ 'form-card--loading': loading }">
      <label class="label">{{ t('urlExtract.urlLabel') }}</label>
      <div class="row">
        <input
          v-model="urlInput"
          class="input"
          type="url"
          autocomplete="off"
          :placeholder="t('urlExtract.urlPlaceholder')"
          :disabled="loading"
          @keydown.enter.prevent="runParse"
        />
        <button
          type="button"
          class="btn primary"
          :disabled="loading"
          :aria-busy="loading"
          @click="runParse"
        >
          <span v-if="loading" class="spinner" aria-hidden="true" />
          <span>{{ loading ? t('urlExtract.parsing') : t('urlExtract.parse') }}</span>
        </button>
      </div>
      <p v-if="errorMsg" class="error error--row">
        <span class="icon-wrap icon-wrap--error" aria-hidden="true">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" />
          </svg>
        </span>
        {{ errorMsg }}
      </p>
    </div>

    <div v-if="result" class="card result-card">
      <div
        v-if="parseOutcome"
        class="result-banner"
        :class="
          parseOutcome === 'success' ? 'result-banner--ok' : 'result-banner--empty'
        "
        role="status"
      >
        <span
          class="icon-wrap"
          :class="
            parseOutcome === 'success' ? 'icon-wrap--ok' : 'icon-wrap--warn'
          "
          aria-hidden="true"
        >
          <svg
            v-if="parseOutcome === 'success'"
            class="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path
              d="M8 12l2.5 2.5L16 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else class="icon-svg" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path
              d="M12 8v5M12 16h.01"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <div class="result-banner__text">
          <strong class="result-banner__title">
            {{
              parseOutcome === 'success'
                ? t('urlExtract.outcomeSuccess')
                : t('urlExtract.outcomeEmpty')
            }}
          </strong>
          <span
            v-if="parseOutcome === 'success' && result.listTruncated"
            class="tag tag--muted"
          >
            {{ t('urlExtract.outcomeTruncatedTag') }}
          </span>
        </div>
      </div>
      <p class="summary">
        {{ t('urlExtract.totalLabel', { count: result.total }) }}
      </p>
      <p v-if="result.listTruncated" class="hint">
        {{ t('urlExtract.listTruncatedHint') }}
      </p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{{ t('urlExtract.colIndex') }}</th>
              <th>{{ t('urlExtract.colTitle') }}</th>
              <th>{{ t('urlExtract.colDuration') }}</th>
              <th>{{ t('urlExtract.colResolution') }}</th>
              <th>{{ t('urlExtract.colPublished') }}</th>
              <th>{{ t('urlExtract.colActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in result.items" :key="it.index">
              <td class="num">{{ it.index }}</td>
              <td class="title">{{ cell(it.title) }}</td>
              <td>{{ cell(it.durationLabel) }}</td>
              <td>{{ cell(it.resolution) }}</td>
              <td>{{ cell(it.publishedAt) }}</td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="btn ghost sm"
                    :disabled="loading || samplingIndex !== null"
                    @click="copyRow(it)"
                  >
                    {{
                      flashIndex === it.index
                        ? t('urlExtract.copied')
                        : t('urlExtract.copyLink')
                    }}
                  </button>
                  <button
                    type="button"
                    class="btn ghost sm"
                    :disabled="
                      loading ||
                      samplingIndex !== null ||
                      !it.copyUrl?.trim()
                    "
                    :aria-busy="samplingIndex === it.index"
                    @click="sampleRow(it)"
                  >
                    <span
                      v-if="samplingIndex === it.index"
                      class="spinner sm"
                      aria-hidden="true"
                    />
                    {{
                      samplingIndex === it.index
                        ? t('urlExtract.sampling')
                        : t('urlExtract.sampleClip')
                    }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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

.head .h2 {
  margin: 0 0 0.35rem;
}

.muted {
  margin: 0;
  color: var(--cs-muted, #9aa0a6);
  line-height: 1.55;
  font-size: 0.9rem;
  max-width: 920px;
}

.sub-link {
  color: var(--cs-accent, #6ee7b7);
  margin-left: 0.35rem;
}

.card {
  background: var(--cs-surface, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--cs-border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 1rem 1.1rem;
}

.form-card .label {
  display: block;
  font-size: 0.82rem;
  color: var(--cs-muted, #9aa0a6);
  margin-bottom: 0.4rem;
}

.row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.input {
  flex: 1;
  min-width: 220px;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border, rgba(255, 255, 255, 0.12));
  background: var(--cs-bg-elevated, #161a20);
  color: inherit;
  font-size: 0.9rem;
}

.btn {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.5rem 0.85rem;
  font-size: 0.88rem;
  cursor: pointer;
  background: transparent;
  color: inherit;
}

.btn.primary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: var(--cs-accent-muted, rgba(110, 231, 183, 0.2));
  border-color: var(--cs-accent, #6ee7b7);
  color: var(--cs-accent, #6ee7b7);
}

.spinner {
  width: 0.95em;
  height: 0.95em;
  flex-shrink: 0;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ue-spin 0.7s linear infinite;
}

@keyframes ue-spin {
  to {
    transform: rotate(360deg);
  }
}

.form-card--loading {
  border-color: rgba(110, 231, 183, 0.35);
  animation: ue-form-pulse 1.25s ease-in-out infinite;
}

@keyframes ue-form-pulse {
  50% {
    border-color: rgba(110, 231, 183, 0.55);
    box-shadow: 0 0 0 1px rgba(110, 231, 183, 0.12);
  }
}

.btn.primary:disabled {
  opacity: 0.55;
  cursor: default;
}

.btn.ghost {
  border-color: var(--cs-border, rgba(255, 255, 255, 0.14));
}

.btn.sm {
  padding: 0.28rem 0.5rem;
  font-size: 0.78rem;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.row-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.spinner.sm {
  width: 0.82em;
  height: 0.82em;
}

.error {
  margin: 0.6rem 0 0;
  color: #f87171;
  font-size: 0.86rem;
}

.error--row {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.icon-wrap {
  display: inline-flex;
  flex-shrink: 0;
  margin-top: 0.06rem;
}

.icon-wrap--ok {
  color: #6ee7b7;
}

.icon-wrap--warn {
  color: #fbbf24;
}

.icon-wrap--error {
  color: #f87171;
}

.icon-svg {
  width: 1.15rem;
  height: 1.15rem;
  display: block;
}

.result-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  border: 1px solid transparent;
}

.result-banner--ok {
  background: rgba(110, 231, 183, 0.08);
  border-color: rgba(110, 231, 183, 0.22);
}

.result-banner--empty {
  background: rgba(251, 191, 36, 0.08);
  border-color: rgba(251, 191, 36, 0.22);
}

.result-banner__text {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.result-banner__title {
  font-size: 0.9rem;
  font-weight: 650;
}

.tag {
  font-size: 0.72rem;
  font-weight: 550;
  padding: 0.12rem 0.4rem;
  border-radius: 4px;
}

.tag--muted {
  background: rgba(255, 255, 255, 0.06);
  color: var(--cs-muted, #9aa0a6);
  border: 1px solid var(--cs-border, rgba(255, 255, 255, 0.1));
}

.summary {
  margin: 0 0 0.5rem;
  font-size: 0.92rem;
}

.hint {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  color: var(--cs-muted, #9aa0a6);
}

.table-wrap {
  overflow: auto;
  margin-top: 0.5rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.table th,
.table td {
  padding: 0.45rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--cs-border, rgba(255, 255, 255, 0.08));
  vertical-align: top;
}

.table th {
  color: var(--cs-muted, #9aa0a6);
  font-weight: 550;
}

.num {
  white-space: nowrap;
  width: 3rem;
}

.title {
  max-width: 320px;
  word-break: break-word;
}
</style>
