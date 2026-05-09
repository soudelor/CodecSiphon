<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import * as settingsApi from '@/api/settings';

const { t } = useI18n();

const DL_FORM_KEYS = [
  'format',
  'proxy_url',
  'referer',
  'user_agent',
  'cookies_file',
  'cookies_from_browser',
] as const;

const loading = ref(true);
const saving = ref(false);
const errorMsg = ref('');
const okMsg = ref('');
const prefsText = ref('{}');
const downloadExtraText = ref('{}');
const updatedAt = ref<string | null>(null);

const format = ref('');
const proxyUrl = ref('');
const referer = ref('');
const userAgent = ref('');
const cookiesFile = ref('');
const cookiesFromBrowser = ref('');
/** 站点提示（Referer/UA 等）：默认=不写键（与后端默认一致）；开启/关闭 */
const siteHints = ref<'unset' | 'on' | 'off'>('unset');

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join('；');
    if (typeof m === 'string') return m;
  }
  return t('errors.operationFailedRetry');
}

function applyDownloadDefaults(dd: Record<string, unknown>) {
  format.value = dd.format != null ? String(dd.format) : '';
  proxyUrl.value = dd.proxy_url != null ? String(dd.proxy_url) : '';
  referer.value = dd.referer != null ? String(dd.referer) : '';
  userAgent.value = dd.user_agent != null ? String(dd.user_agent) : '';
  cookiesFile.value = dd.cookies_file != null ? String(dd.cookies_file) : '';
  cookiesFromBrowser.value =
    dd.cookies_from_browser != null ? String(dd.cookies_from_browser) : '';
  if (dd.site_hints === true) siteHints.value = 'on';
  else if (dd.site_hints === false) siteHints.value = 'off';
  else siteHints.value = 'unset';

  const extra = { ...dd };
  for (const k of DL_FORM_KEYS) delete extra[k];
  delete extra.site_hints;
  downloadExtraText.value = JSON.stringify(extra, null, 2);
}

function buildDownloadDefaultsForSave(): Record<string, unknown> | null {
  let extra: Record<string, unknown>;
  try {
    extra = JSON.parse(downloadExtraText.value || '{}') as Record<string, unknown>;
    if (
      typeof extra !== 'object' ||
      extra === null ||
      Array.isArray(extra)
    ) {
      throw new Error(t('settings.errDlExtraJson'));
    }
  } catch (e) {
    errorMsg.value =
      e instanceof Error
        ? t('settings.errDlExtraPrefix') + e.message
        : t('settings.errDlBare');
    return null;
  }

  const merge = { ...extra };

  function putStr(key: string, val: string) {
    const t = val.trim();
    if (t) merge[key] = t;
    else delete merge[key];
  }

  putStr('format', format.value);
  putStr('proxy_url', proxyUrl.value);
  putStr('referer', referer.value);
  putStr('user_agent', userAgent.value);
  putStr('cookies_file', cookiesFile.value);
  putStr('cookies_from_browser', cookiesFromBrowser.value);

  if (siteHints.value === 'on') merge.site_hints = true;
  else if (siteHints.value === 'off') merge.site_hints = false;
  else delete merge.site_hints;

  return merge;
}

async function load() {
  loading.value = true;
  errorMsg.value = '';
  okMsg.value = '';
  try {
    const data = await settingsApi.getSettings();
    prefsText.value = JSON.stringify(data.preferences ?? {}, null, 2);
    applyDownloadDefaults((data.downloadDefaults ?? {}) as Record<string, unknown>);
    updatedAt.value = data.updatedAt;
  } catch {
    errorMsg.value = t('settings.loadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function save() {
  okMsg.value = '';
  errorMsg.value = '';

  let preferences: Record<string, unknown>;
  try {
    preferences = JSON.parse(prefsText.value || '{}') as Record<string, unknown>;
    if (
      typeof preferences !== 'object' ||
      preferences === null ||
      Array.isArray(preferences)
    ) {
      throw new Error(t('settings.errPrefsJson'));
    }
  } catch (e) {
    errorMsg.value =
      e instanceof Error
        ? t('settings.errPrefsJsonPrefix') + e.message
        : t('settings.errPrefsBare');
    return;
  }

  const downloadDefaults = buildDownloadDefaultsForSave();
  if (!downloadDefaults) return;

  saving.value = true;
  try {
    const next = await settingsApi.patchSettings({
      preferences,
      downloadDefaults,
    });
    updatedAt.value = next.updatedAt;
    applyDownloadDefaults((next.downloadDefaults ?? {}) as Record<string, unknown>);
    okMsg.value = t('settings.okSaved');
  } catch (e) {
    errorMsg.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h2>{{ t('settings.title') }}</h2>
        <p class="muted">
          {{ t('settings.intro') }}
        </p>
        <p v-if="updatedAt" class="pi">
          {{ t('settings.updatedAt', { time: new Date(updatedAt).toLocaleString() }) }}
        </p>
      </div>
      <button
        type="button"
        class="btn ghost"
        :disabled="loading"
        @click="load"
      >
        {{ t('settings.reload') }}
      </button>
    </header>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <p v-if="okMsg" class="ok">{{ okMsg }}</p>

    <div v-if="!loading" class="stack">
      <div class="card">
        <h3 class="h">{{ t('settings.prefsCard') }}</h3>
        <div class="field">
          <label for="prefs">{{ t('settings.prefsLabel') }}</label>
          <textarea
            id="prefs"
            v-model="prefsText"
            rows="10"
            class="mono"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="card">
        <h3 class="h">{{ t('settings.defaultsCard') }}</h3>
        <p class="muted small">
          {{ t('settings.defaultsHint') }}
        </p>
        <div class="grid">
          <div class="field">
            <label for="fmt">{{ t('settings.formatLabel') }}</label>
            <input id="fmt" v-model="format" :placeholder="t('settings.formatPh')" />
          </div>
          <div class="field">
            <label for="proxy">{{ t('settings.proxyLabel') }}</label>
            <input id="proxy" v-model="proxyUrl" :placeholder="t('settings.proxyPh')" />
          </div>
          <div class="field">
            <label for="ref">{{ t('settings.refererLabel') }}</label>
            <input id="ref" v-model="referer" :placeholder="t('settings.refererPh')" />
          </div>
          <div class="field">
            <label for="ua">{{ t('settings.uaLabel') }}</label>
            <input id="ua" v-model="userAgent" :placeholder="t('settings.uaPh')" />
          </div>
          <div class="field">
            <label for="ck">{{ t('settings.cookiesFileLabel') }}</label>
            <input id="ck" v-model="cookiesFile" :placeholder="t('settings.cookiesFilePh')" />
          </div>
          <div class="field">
            <label for="cfb">{{ t('settings.cookiesBrowserLabel') }}</label>
            <input id="cfb" v-model="cookiesFromBrowser" :placeholder="t('settings.cookiesBrowserPh')" />
          </div>
          <div class="field wide">
            <label for="sh">{{ t('settings.siteHintsLabel') }}</label>
            <select id="sh" v-model="siteHints">
              <option value="unset">{{ t('settings.siteHintsUnset') }}</option>
              <option value="on">{{ t('settings.siteHintsOn') }}</option>
              <option value="off">{{ t('settings.siteHintsOff') }}</option>
            </select>
          </div>
        </div>

        <div class="field topgap">
          <label for="extra">{{ t('settings.extraLabel') }}</label>
          <textarea
            id="extra"
            v-model="downloadExtraText"
            rows="8"
            class="mono"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? t('settings.saving') : t('settings.saveAll') }}
        </button>
      </div>
    </div>
    <p v-else class="muted">{{ t('common.loading') }}</p>
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
  align-items: flex-start;
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

.muted.small {
  font-size: 0.82rem;
  margin-bottom: 0.75rem;
}

.muted code,
.pi code {
  font-size: 0.85em;
  padding: 0.1em 0.35em;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.pi {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  color: var(--cs-muted);
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.03);
}

.h {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field.wide {
  grid-column: 1 / -1;
  max-width: 420px;
}

.field.topgap {
  margin-top: 1rem;
}

.field label {
  font-size: 0.85rem;
  color: var(--cs-muted);
}

.field input,
.field select {
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--cs-text);
  padding: 0.55rem 0.65rem;
  font: inherit;
}

textarea.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.82rem;
  line-height: 1.45;
  border-radius: 12px;
  border: 1px solid var(--cs-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--cs-text);
  padding: 0.65rem 0.75rem;
  resize: vertical;
  min-height: 140px;
}

.actions {
  display: flex;
  gap: 0.5rem;
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

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.error {
  color: #ff8b8b;
  margin: 0;
}

.ok {
  color: var(--cs-accent, #3ecf8e);
  margin: 0;
}
</style>
