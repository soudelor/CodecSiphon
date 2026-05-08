<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref } from 'vue';
import * as settingsApi from '@/api/settings';

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
  return '操作失败，请稍后重试';
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
      throw new Error('请填写花括号 { } 包住的一组设置');
    }
  } catch (e) {
    errorMsg.value =
      e instanceof Error
        ? `「其他下载选项」格式有误：${e.message}`
        : '「其他下载选项」格式有误';
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
    errorMsg.value = '无法加载设置，请确认已登录；若仍失败，请检查网络或稍后再试';
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
      throw new Error('请使用花括号 { } 包住的一组设置');
    }
  } catch (e) {
    errorMsg.value =
      e instanceof Error ? `「个人偏好」格式有误：${e.message}` : '「个人偏好」格式有误';
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
    okMsg.value = '已保存。新建任务时，您在任务页里单独勾选的选项会覆盖这里的默认设置。';
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
        <h2>设置</h2>
        <p class="muted">
          「个人偏好」里可写个人习惯等扩展内容（多数用户不用改）。「默认下载选项」会用在之后新建的每一个任务上；若在新建任务时又改了选项，以任务里为准。
        </p>
        <p v-if="updatedAt" class="pi">
          最近更新：{{ new Date(updatedAt).toLocaleString() }}
        </p>
      </div>
      <button
        type="button"
        class="btn ghost"
        :disabled="loading"
        @click="load"
      >
        重新加载
      </button>
    </header>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <p v-if="okMsg" class="ok">{{ okMsg }}</p>

    <div v-if="!loading" class="stack">
      <div class="card">
        <h3 class="h">个人偏好（高级）</h3>
        <div class="field">
          <label for="prefs">内容（可留空；不熟悉请保持原样）</label>
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
        <h3 class="h">默认下载选项</h3>
        <p class="muted small">
          下列项留空表示「不强制默认」。若关闭「自动补充站点访问信息」，某些网站下载可能失败，届时可再打开试试。
        </p>
        <div class="grid">
          <div class="field">
            <label for="fmt">画质 / 清晰度偏好</label>
            <input id="fmt" v-model="format" placeholder="一般可留空，由系统自动选择" />
          </div>
          <div class="field">
            <label for="proxy">网络代理地址</label>
            <input id="proxy" v-model="proxyUrl" placeholder="若需翻墙再填，示例：http://127.0.0.1:7890" />
          </div>
          <div class="field">
            <label for="ref">来源页网址（部分网站校验需要）</label>
            <input id="ref" v-model="referer" placeholder="填视频所在页面的完整网址" />
          </div>
          <div class="field">
            <label for="ua">浏览器标识（极少数情况需要）</label>
            <input id="ua" v-model="userAgent" placeholder="通常留空" />
          </div>
          <div class="field">
            <label for="ck">Cookie 文件路径（本机上的文件）</label>
            <input id="ck" v-model="cookiesFile" placeholder="需要登录态时，可填导出后的 Cookie 文件路径" />
          </div>
          <div class="field">
            <label for="cfb">从本机浏览器读取 Cookie</label>
            <input id="cfb" v-model="cookiesFromBrowser" placeholder="例如填：chrome（视环境支持情况）" />
          </div>
          <div class="field wide">
            <label for="sh">自动补充站点访问信息（如来源页、浏览器标识）</label>
            <select id="sh" v-model="siteHints">
              <option value="unset">跟随系统默认</option>
              <option value="on">开启（多数情况推荐）</option>
              <option value="off">关闭</option>
            </select>
          </div>
        </div>

        <div class="field topgap">
          <label for="extra">其他高级参数（会与上表合并；不熟悉请保持默认不写）</label>
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
          {{ saving ? '保存中…' : '保存全部' }}
        </button>
      </div>
    </div>
    <p v-else class="muted">加载中…</p>
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
