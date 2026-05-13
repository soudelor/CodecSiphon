<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import * as urlExtractApi from '@/api/url-extract';
import type { UrlExtractItem, UrlExtractPublicResult } from '@/types/models';

type DemoMedia =
  | { kind: 'iframe'; src: string; title: string }
  | { kind: 'video'; src: string };

function demoMediaFromEnvValue(raw: string): DemoMedia | null {
  const u = raw.trim();
  if (!u) return null;
  try {
    const url = u.includes('://') ? new URL(u) : new URL(u, window.location.origin);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (
      host === 'youtube.com' ||
      host === 'youtube-nocookie.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    ) {
      const v = url.searchParams.get('v');
      if (v) {
        return {
          kind: 'iframe',
          src: `https://www.youtube.com/embed/${encodeURIComponent(v)}`,
          title: 'YouTube',
        };
      }
      if (url.pathname.startsWith('/embed/')) {
        return { kind: 'iframe', src: url.toString(), title: 'YouTube' };
      }
    }
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (id) {
        return {
          kind: 'iframe',
          src: `https://www.youtube.com/embed/${encodeURIComponent(id)}`,
          title: 'YouTube',
        };
      }
    }
  } catch {
    /* 非绝对 URL 时走下方直链视频 */
  }
  return { kind: 'video', src: u };
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const urlInput = ref('');
const loading = ref(false);
const errorMsg = ref('');
const result = ref<UrlExtractPublicResult | null>(null);
const flashIndex = ref<number | null>(null);

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
    result.value = await urlExtractApi.previewPublicUrlExtract(u);
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

function cell(v: string | null | undefined): string {
  const s = v?.trim();
  return s ? s : t('urlExtract.emptyDash');
}

const parseOutcome = computed<'success' | 'empty' | null>(() => {
  const r = result.value;
  if (!r) return null;
  if (r.total === 0 || r.previewItems.length === 0) return 'empty';
  return 'success';
});

const demoMedia = computed(() => {
  const raw = import.meta.env.VITE_URL_EXTRACT_DEMO_VIDEO?.trim();
  if (!raw) return null;
  return demoMediaFromEnvValue(raw);
});
</script>

<template>
  <div class="page">
    <header class="head">
      <h1 class="h1">{{ t('urlExtract.publicTitle') }}</h1>
      <p class="muted">{{ t('urlExtract.subtitle') }}</p>
    </header>

    <section v-if="demoMedia" class="card demo-card">
      <p class="demo-title">{{ t('urlExtract.demoVideoTitle') }}</p>
      <div class="demo-frame">
        <iframe
          v-if="demoMedia.kind === 'iframe'"
          class="demo-iframe"
          :src="demoMedia.src"
          :title="demoMedia.title"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        />
        <video
          v-else
          class="demo-video"
          :src="demoMedia.src"
          controls
          playsinline
          preload="metadata"
        />
      </div>
    </section>

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
        <template v-if="result.hiddenCount > 0">
          · {{ t('urlExtract.hiddenHint', { count: result.hiddenCount }) }}
        </template>
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
              <th>{{ t('urlExtract.colLink') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in result.previewItems" :key="it.index">
              <td class="num">{{ it.index }}</td>
              <td class="title">{{ cell(it.title) }}</td>
              <td>{{ cell(it.durationLabel) }}</td>
              <td>{{ cell(it.resolution) }}</td>
              <td>{{ cell(it.publishedAt) }}</td>
              <td>
                <button
                  type="button"
                  class="btn ghost sm"
                  @click="copyRow(it)"
                >
                  {{
                    flashIndex === it.index
                      ? t('urlExtract.copied')
                      : t('urlExtract.copyLink')
                  }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="cta">
        <RouterLink
          class="btn primary inline"
          :to="{
            name: 'login',
            query: {
              redirect: `/url-extract?url=${encodeURIComponent(result.sourceUrl)}`,
            },
          }"
        >
          {{ t('urlExtract.loginCta') }}
        </RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.head .h1 {
  margin: 0 0 0.35rem;
  font-size: 1.35rem;
}

.muted {
  margin: 0;
  color: var(--cs-muted, #9aa0a6);
  line-height: 1.55;
  font-size: 0.9rem;
  max-width: 720px;
}

.demo-card {
  padding: 0.85rem 1rem;
}

.demo-title {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  color: var(--cs-muted, #9aa0a6);
}

.demo-frame {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #0b0d10;
  aspect-ratio: 16 / 9;
  max-height: min(220px, 38vh);
  border: 1px solid var(--cs-border, rgba(255, 255, 255, 0.08));
}

.demo-iframe,
.demo-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.demo-video {
  object-fit: contain;
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

.btn.inline {
  display: inline-block;
  text-decoration: none;
  text-align: center;
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
  max-width: 280px;
  word-break: break-word;
}

.cta {
  margin: 1rem 0 0;
}
</style>
