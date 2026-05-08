<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { TaskPreviewResult } from '@/types/models';
import * as settingsApi from '@/api/settings';
import * as tasksApi from '@/api/tasks';

const router = useRouter();

/** 主流程：单视频分步向导 | 批量/播放列表（对齐 function&UI.md §2.3） */
const mainTab = ref<'single' | 'batch'>('single');
const singleStep = ref<1 | 2 | 3>(1);

const singleUrl = ref('');
const preview = ref<TaskPreviewResult | null>(null);
const previewLoading = ref(false);
const previewError = ref('');

const batchMode = ref<'playlist' | 'multi'>('playlist');
const playlistUrl = ref('');
const playlistRange = ref<'all' | 'firstN' | 'range' | 'custom'>('all');
const playlistFirstN = ref(10);
const playlistFrom = ref(1);
const playlistTo = ref(20);
const playlistPreview = ref<TaskPreviewResult | null>(null);
const playlistPreviewLoading = ref(false);
/** 自定义勾选：条目 index（从 1 起） */
const selectedIndices = ref<number[]>([]);

const multiText = ref('');
/** 「多条链接」上限，与后端 MULTI_URL_MAX_LINKS 一致，打开页面时拉取 */
const multiUrlMax = ref(5);

const taskTitle = ref('');
const platform = ref('');

/** 视频质量：对应 yt-dlp -f */
const qualityPreset = ref<'auto' | '2160' | '1080' | '720' | '480' | 'audio'>(
  'auto',
);
/** 容器：merge-output-format；audio 时忽略 */
const outputFormat = ref<'default' | 'mp4' | 'mkv' | 'webm'>('default');
const optSubs = ref(true);
const subLangsInput = ref('zh-Hans,zh,en');
const optMeta = ref(true);
const optThumb = ref(false);

const submitting = ref(false);
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  try {
    const s = await settingsApi.getSettings();
    const n = s.multiUrlMaxLinks;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 1) {
      multiUrlMax.value = Math.floor(n);
    }
  } catch {
    /* 保留默认 5 */
  }
});

watch(mainTab, () => {
  errorMsg.value = '';
  if (mainTab.value === 'single') {
    singleStep.value = 1;
  }
});

const multiUrls = computed(() =>
  multiText.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean),
);

function buildDownloadOptions(): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const q = qualityPreset.value;
  const fmtMap: Record<string, string> = {
    auto: 'bv*+ba/b',
    '2160': 'bestvideo[height<=2160]+bestaudio/best',
    '1080': 'bestvideo[height<=1080]+bestaudio/best',
    '720': 'bestvideo[height<=720]+bestaudio/best',
    '480': 'bestvideo[height<=480]+bestaudio/best',
    audio: 'bestaudio/best',
  };
  o.format = fmtMap[q] ?? fmtMap.auto;
  const fo = outputFormat.value;
  if (fo !== 'default' && q !== 'audio') {
    o.merge_output_format = fo;
  }
  if (optSubs.value) {
    o.write_subs = true;
    o.embed_subs = true;
    o.sub_langs = subLangsInput.value.trim() || 'zh-Hans,zh,en';
  }
  if (optMeta.value) o.embed_metadata = true;
  if (optThumb.value) o.embed_thumbnail = true;
  return o;
}

function indicesToPlaylistSpec(indices: number[]): string {
  if (indices.length === 0) return '';
  const sorted = [...new Set(indices)]
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = prev = sorted[i];
  }
  parts.push(start === prev ? String(start) : `${start}-${prev}`);
  return parts.join(',');
}

function buildPlaylistItemsOption(): string | undefined {
  if (playlistRange.value === 'firstN') {
    const n = Math.max(1, Math.floor(playlistFirstN.value) || 10);
    return `1-${n}`;
  }
  if (playlistRange.value === 'range') {
    const a = Math.max(1, Math.floor(playlistFrom.value));
    const b = Math.max(a, Math.floor(playlistTo.value));
    return `${a}-${b}`;
  }
  if (playlistRange.value === 'custom') {
    const spec = indicesToPlaylistSpec(selectedIndices.value);
    return spec || undefined;
  }
  return undefined;
}

function apiErr(e: unknown): string {
  const r =
    e &&
    typeof e === 'object' &&
    'response' in e &&
    (e as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message;
  const m = r;
  if (Array.isArray(m)) return m.join('；');
  if (typeof m === 'string') return m;
  return '操作失败';
}

async function runDetectSingle() {
  previewError.value = '';
  const u = singleUrl.value.trim();
  if (!u) {
    previewError.value = '请先填写链接';
    return;
  }
  previewLoading.value = true;
  preview.value = null;
  try {
    preview.value = await tasksApi.previewTaskUrl(u);
    if (preview.value.kind === 'video') {
      taskTitle.value = taskTitle.value || preview.value.title || '';
    } else {
      taskTitle.value = taskTitle.value || preview.value.title || '';
    }
    singleStep.value = 2;
  } catch (e) {
    previewError.value = apiErr(e);
  } finally {
    previewLoading.value = false;
  }
}

async function pasteFromClipboard() {
  previewError.value = '';
  try {
    const t = await navigator.clipboard.readText();
    if (t?.trim()) singleUrl.value = t.trim();
  } catch {
    previewError.value = '无法读取剪贴板（需页面焦点与浏览器权限）';
  }
}

function triggerImportFile() {
  fileInputRef.value?.click();
}

function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? '');
    const line = text.split(/\r?\n/).find((s) => s.trim());
    if (line?.trim()) singleUrl.value = line.trim();
  };
  reader.readAsText(f, 'utf-8');
}

async function loadPlaylistEntries() {
  const u = playlistUrl.value.trim();
  if (!u) {
    previewError.value = '请填写播放列表 URL';
    return;
  }
  playlistPreviewLoading.value = true;
  playlistPreview.value = null;
  previewError.value = '';
  try {
    const p = await tasksApi.previewTaskUrl(u);
    playlistPreview.value = p;
    if (p.kind === 'playlist') {
      selectedIndices.value = p.entries.map((e) => e.index);
    } else {
      selectedIndices.value = [];
    }
  } catch (e) {
    previewError.value = apiErr(e);
  } finally {
    playlistPreviewLoading.value = false;
  }
}

function toggleEntryIndex(idx: number) {
  const set = new Set(selectedIndices.value);
  if (set.has(idx)) set.delete(idx);
  else set.add(idx);
  selectedIndices.value = [...set].sort((a, b) => a - b);
}

function playlistSelectAll() {
  if (playlistPreview.value?.kind !== 'playlist') return;
  selectedIndices.value = playlistPreview.value.entries.map((e) => e.index);
}

function playlistSelectNone() {
  selectedIndices.value = [];
}

function playlistInvert() {
  if (playlistPreview.value?.kind !== 'playlist') return;
  const all = new Set(playlistPreview.value.entries.map((e) => e.index));
  const cur = new Set(selectedIndices.value);
  selectedIndices.value = [...all].filter((i) => !cur.has(i)).sort((a, b) => a - b);
}

const batchPlaylistSummary = computed(() => {
  if (playlistPreview.value?.kind !== 'playlist') return '';
  const n = selectedIndices.value.length;
  return `已选 ${n} / ${playlistPreview.value.entries.length} 条`;
});

async function submit() {
  errorMsg.value = '';
  const titleTrimmed = taskTitle.value.trim();
  if (!titleTrimmed) {
    errorMsg.value = '请填写任务标题';
    if (mainTab.value === 'single' && singleStep.value !== 3) {
      singleStep.value = 3;
    }
    return;
  }
  submitting.value = true;
  try {
    const opts = buildDownloadOptions();
    if (mainTab.value === 'single') {
      const url = singleUrl.value.trim();
      if (!url) throw new Error('请填写视频链接');
      if (preview.value?.kind === 'playlist') {
        await tasksApi.createTask({
          sourceType: 'playlist',
          sourceUrl: url,
          title: titleTrimmed,
          platform: platform.value.trim() || undefined,
          options: opts,
        });
      } else {
        await tasksApi.createTask({
          sourceType: 'single_url',
          sourceUrl: url,
          title: titleTrimmed,
          platform: platform.value.trim() || undefined,
          options: opts,
        });
      }
    } else {
      if (batchMode.value === 'multi') {
        if (multiUrls.value.length === 0) throw new Error('请填写至少一行 URL');
        if (multiUrls.value.length > multiUrlMax.value) {
          throw new Error(
            `批量链接最多 ${multiUrlMax.value} 条，请删去多余行后再提交`,
          );
        }
        await tasksApi.createTask({
          sourceType: 'multi_url',
          sourceUrls: multiUrls.value,
          title: titleTrimmed,
          platform: platform.value.trim() || undefined,
          options: opts,
        });
      } else if (batchMode.value === 'playlist') {
        const pu = playlistUrl.value.trim();
        if (!pu) throw new Error('请填写播放列表链接');
        const o = { ...opts } as Record<string, unknown>;
        const pi = buildPlaylistItemsOption();
        if (pi) o.playlist_items = pi;
        await tasksApi.createTask({
          sourceType: 'playlist',
          sourceUrl: pu,
          title: titleTrimmed,
          platform: platform.value.trim() || undefined,
          options: o,
        });
      }
    }
    router.push({ name: 'tasks' });
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : apiErr(e);
  } finally {
    submitting.value = false;
  }
}

function formatEntryDur(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h2>新建下载任务</h2>
        <p class="muted">
          填写任务标题（必填）；可先粘贴链接并检测信息，再选画质与格式后提交；也可切换到「批量」处理列表或多条链接。若识别失败，请确认该地址在浏览器中能正常打开。
        </p>
      </div>
    </header>

    <div class="tabs">
      <button
        type="button"
        :class="['tab', mainTab === 'single' && 'active']"
        @click="mainTab = 'single'"
      >
        单视频（分步）
      </button>
      <button
        type="button"
        :class="['tab', mainTab === 'batch' && 'active']"
        @click="mainTab = 'batch'"
      >
        批量 / 播放列表
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden-file"
      accept=".txt,text/plain"
      @change="onImportFile"
    />

    <!-- ——— 单视频向导 ——— -->
    <div v-if="mainTab === 'single'" class="card">
      <div class="steps">
        <span :class="['dot', singleStep >= 1 && 'on']">1 链接</span>
        <span class="sep">→</span>
        <span :class="['dot', singleStep >= 2 && 'on']">2 信息</span>
        <span class="sep">→</span>
        <span :class="['dot', singleStep >= 3 && 'on']">3 下载设置</span>
      </div>

      <template v-if="singleStep === 1">
        <h3 class="h3">步骤 1：输入视频链接</h3>
        <div class="field">
          <label for="su">视频 / 播放列表 URL</label>
          <input
            id="su"
            v-model="singleUrl"
            type="url"
            placeholder="https://..."
            autocomplete="off"
          />
        </div>
        <div class="btn-row">
          <button
            type="button"
            class="btn"
            :disabled="previewLoading"
            @click="runDetectSingle"
          >
            {{ previewLoading ? '检测中…' : '🔍 检测链接' }}
          </button>
          <button type="button" class="btn ghost" @click="pasteFromClipboard">
            📋 从剪贴板粘贴
          </button>
          <button type="button" class="btn ghost" @click="triggerImportFile">
            📁 导入文本文件
          </button>
        </div>
        <p v-if="previewError" class="error">{{ previewError }}</p>
        <p class="hint">请先点击「检测链接」，确认信息无误后再进入第 2 步。</p>
      </template>

      <template v-else-if="singleStep === 2">
        <h3 class="h3">步骤 2：确认视频信息</h3>
        <template v-if="preview?.kind === 'video'">
          <div class="info-card">
            <img
              v-if="preview.thumbnail"
              :src="preview.thumbnail"
              alt=""
              class="thumb"
            />
            <div class="info-main">
              <p class="info-title">
                {{ preview.title || '（无标题）' }}
              </p>
              <p class="info-meta">
                <span v-if="preview.durationLabel">时长：{{ preview.durationLabel }}</span>
                <span v-if="preview.uploader"> · 作者：{{ preview.uploader }}</span>
              </p>
              <p v-if="preview.webpageUrl" class="info-sub mono">
                {{ preview.webpageUrl }}
              </p>
            </div>
          </div>
        </template>
        <template v-else-if="preview?.kind === 'playlist'">
          <div class="info-card plain">
            <p class="info-title">检测到播放列表</p>
            <p class="info-meta">
              列表中约有 {{ preview.entryCount }} 条视频 · 将按整表创建下载任务；若只想要其中一部分，请用顶部的「批量 / 播放列表」并选择范围。
            </p>
          </div>
        </template>
        <div class="nav-row">
          <button
            type="button"
            class="btn ghost"
            @click="singleStep = 1"
          >
            ⬅ 上一步
          </button>
          <button
            type="button"
            class="btn primary"
            :disabled="!preview"
            @click="singleStep = 3"
          >
            下一步 ➡
          </button>
        </div>
      </template>

      <template v-else>
        <h3 class="h3">步骤 3：下载设置</h3>
        <div class="two-col">
          <fieldset class="fieldset">
            <legend>视频质量</legend>
            <label><input v-model="qualityPreset" type="radio" value="auto" /> 自动（推荐）</label>
            <label><input v-model="qualityPreset" type="radio" value="2160" /> 2160p (4K)</label>
            <label><input v-model="qualityPreset" type="radio" value="1080" /> 1080p</label>
            <label><input v-model="qualityPreset" type="radio" value="720" /> 720p</label>
            <label><input v-model="qualityPreset" type="radio" value="480" /> 480p</label>
            <label><input v-model="qualityPreset" type="radio" value="audio" /> 仅音频</label>
          </fieldset>
          <fieldset class="fieldset">
            <legend>输出格式</legend>
            <label><input v-model="outputFormat" type="radio" value="default" /> 默认（自动）</label>
            <label><input v-model="outputFormat" type="radio" value="mp4" :disabled="qualityPreset === 'audio'" /> MP4</label>
            <label><input v-model="outputFormat" type="radio" value="mkv" :disabled="qualityPreset === 'audio'" /> MKV</label>
            <label><input v-model="outputFormat" type="radio" value="webm" :disabled="qualityPreset === 'audio'" /> WebM</label>
          </fieldset>
        </div>
        <fieldset class="fieldset adv">
          <legend>高级选项</legend>
          <label>
            <input v-model="optSubs" type="checkbox" />
            下载字幕并写入视频
          </label>
          <div v-if="optSubs" class="field inline">
            <label for="sl">字幕语言（多项用英文逗号隔开，如：简体、繁体、英语）</label>
            <input id="sl" v-model="subLangsInput" placeholder="例如：中文与英语" />
          </div>
          <label>
            <input v-model="optMeta" type="checkbox" />
            把标题、作者等信息写入文件
          </label>
          <label>
            <input v-model="optThumb" type="checkbox" />
            把封面图写入文件
          </label>
        </fieldset>
        <div class="row">
          <div class="field grow">
            <label for="task-title-single">任务标题（必填）</label>
            <input
              id="task-title-single"
              v-model="taskTitle"
              required
              maxlength="500"
              placeholder="将显示在任务与文件列表中，可先沿用检测到的名称再修改"
            />
          </div>
          <div class="field grow">
            <label>平台（可选）</label>
            <input v-model="platform" maxlength="64" placeholder="如 YouTube、B 站（选填）" />
          </div>
        </div>
        <div class="nav-row">
          <button type="button" class="btn ghost" @click="singleStep = 2">
            ⬅ 上一步
          </button>
          <button
            type="button"
            class="btn primary"
            :disabled="submitting"
            @click="submit"
          >
            {{ submitting ? '提交中…' : '开始下载 ➡' }}
          </button>
        </div>
      </template>
    </div>

    <!-- ——— 批量 / 播放列表 ——— -->
    <div v-else class="card">
      <h3 class="h3">批量下载任务</h3>
      <div class="field batch-title-field">
        <label for="batch-title">任务标题（必填）</label>
        <input
          id="batch-title"
          v-model="taskTitle"
          required
          maxlength="500"
          placeholder="将显示在任务与文件列表中"
        />
      </div>
      <div class="modes-row">
        <label><input v-model="batchMode" type="radio" value="playlist" /> 播放列表</label>
        <label><input v-model="batchMode" type="radio" value="multi" /> 多链接</label>
      </div>

      <template v-if="batchMode === 'playlist'">
        <div class="field">
          <label>播放列表 URL</label>
          <input v-model="playlistUrl" type="url" placeholder="https://...playlist..." />
        </div>
        <div class="btn-row">
          <button
            type="button"
            class="btn"
            :disabled="playlistPreviewLoading"
            @click="loadPlaylistEntries"
          >
            {{ playlistPreviewLoading ? '加载中…' : '加载列表条目' }}
          </button>
        </div>
        <div class="two-col range">
          <fieldset class="fieldset">
            <legend>下载范围</legend>
            <label><input v-model="playlistRange" type="radio" value="all" /> 全部</label>
            <label>
              <input v-model="playlistRange" type="radio" value="firstN" />
              前 N 个：
              <input
                v-model.number="playlistFirstN"
                class="num"
                type="number"
                min="1"
              />
            </label>
            <label>
              <input v-model="playlistRange" type="radio" value="range" />
              索引从
              <input v-model.number="playlistFrom" class="num" type="number" min="1" />
              到
              <input v-model.number="playlistTo" class="num" type="number" min="1" />
            </label>
            <label>
              <input v-model="playlistRange" type="radio" value="custom" />
              自定义（勾选下方条目）
            </label>
          </fieldset>
          <fieldset class="fieldset">
            <legend>说明</legend>
            <p class="hint">
              「自定义」须先点「加载列表条目」才能勾选；「前 N 个」与「从几到几」可直接按序号限制范围。
            </p>
            <p v-if="batchPlaylistSummary" class="hint ok">{{ batchPlaylistSummary }}</p>
          </fieldset>
        </div>
        <div
          v-if="playlistPreview?.kind === 'playlist' && playlistRange === 'custom'"
          class="entry-list"
        >
          <div class="entry-toolbar">
            <button type="button" class="btn tiny" @click="playlistSelectAll">全选</button>
            <button type="button" class="btn tiny" @click="playlistInvert">反选</button>
            <button type="button" class="btn tiny" @click="playlistSelectNone">清除</button>
          </div>
          <div
            v-for="e in playlistPreview.entries"
            :key="e.index"
            class="entry-line"
          >
            <label>
              <input
                type="checkbox"
                :checked="selectedIndices.includes(e.index)"
                @change="toggleEntryIndex(e.index)"
              />
              <span class="entry-title">{{ e.title }}</span>
              <span class="entry-dur">{{ formatEntryDur(e.duration) }}</span>
            </label>
          </div>
        </div>
      </template>

      <template v-else-if="batchMode === 'multi'">
        <div class="field">
          <label>每行一个 URL</label>
          <textarea
            v-model="multiText"
            rows="8"
            placeholder="https://..."
          />
          <p class="hint">
            已输入 {{ multiUrls.length }} 条，最多 {{ multiUrlMax }} 条有效链接（空行不计）。
          </p>
        </div>
      </template>

      <!-- 批量模式共用：下载选项 -->
      <div>
        <h4 class="h4">下载选项</h4>
        <div class="two-col">
          <fieldset class="fieldset">
            <legend>视频质量</legend>
            <label><input v-model="qualityPreset" type="radio" value="auto" /> 自动</label>
            <label><input v-model="qualityPreset" type="radio" value="1080" /> 1080p</label>
            <label><input v-model="qualityPreset" type="radio" value="720" /> 720p</label>
            <label><input v-model="qualityPreset" type="radio" value="audio" /> 仅音频</label>
          </fieldset>
          <fieldset class="fieldset">
            <legend>输出格式</legend>
            <label><input v-model="outputFormat" type="radio" value="default" /> 默认</label>
            <label><input v-model="outputFormat" type="radio" value="mp4" /> MP4</label>
          </fieldset>
        </div>
        <fieldset class="fieldset adv">
          <legend>高级</legend>
          <label><input v-model="optSubs" type="checkbox" /> 下载字幕并写入视频</label>
          <label><input v-model="optMeta" type="checkbox" /> 把标题、作者等写入文件</label>
        </fieldset>
        <div class="row">
          <div class="field grow">
            <label>平台（可选）</label>
            <input v-model="platform" maxlength="64" />
          </div>
        </div>
      </div>

      <p v-if="previewError && mainTab === 'batch'" class="error">{{ previewError }}</p>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <div class="nav-row nav-row-end">
        <button
          type="button"
          class="btn primary"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '开始批量下载 ➡' }}
        </button>
      </div>
    </div>

    <p v-if="errorMsg && mainTab === 'single' && singleStep === 3" class="error flat">
      {{ errorMsg }}
    </p>
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
  max-width: 860px;
  line-height: 1.45;
  font-size: 0.9rem;
}

.muted code {
  font-size: 0.85em;
  padding: 0.08em 0.35em;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tab {
  border-radius: 12px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.5rem 1rem;
  cursor: pointer;
  font: inherit;
}

.tab.active {
  border-color: rgba(62, 207, 142, 0.5);
  color: var(--cs-accent, #3ecf8e);
}

.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.03);
}

.steps {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 1rem;
  font-size: 0.88rem;
  color: var(--cs-muted);
}

.dot {
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
}

.dot.on {
  color: var(--cs-accent, #3ecf8e);
  background: rgba(62, 207, 142, 0.12);
}

.sep {
  opacity: 0.5;
}

.h3 {
  margin: 0 0 0.85rem;
  font-size: 1.05rem;
}

.h4 {
  margin: 1.25rem 0 0.65rem;
  font-size: 0.95rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.field label,
.sub {
  font-size: 0.85rem;
  color: var(--cs-muted);
}

.field input,
.field textarea,
.field select {
  border-radius: 12px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.65rem 0.75rem;
  outline: none;
  font: inherit;
}

.field textarea {
  min-height: 140px;
  resize: vertical;
}

.btn-row,
.nav-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.nav-row {
  margin-top: 1.25rem;
  justify-content: space-between;
}

.nav-row-end {
  justify-content: flex-end;
}

.btn {
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--cs-text);
  padding: 0.5rem 0.85rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
}

.btn.ghost {
  background: transparent;
}

.btn.primary {
  border: none;
  font-weight: 600;
  background: linear-gradient(135deg, var(--cs-accent), #25c9b5);
  color: #041016;
}

.btn.tiny {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn.link {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.hidden-file {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.hint {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: var(--cs-muted);
}

.hint.ok {
  color: var(--cs-accent, #3ecf8e);
}

.hint.warn {
  color: #ffb4a0;
}

.error {
  margin: 0.35rem 0 0;
  color: #ff8b8b;
  font-size: 0.9rem;
}

.error.flat {
  margin-top: 0;
}

.info-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--cs-border);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.15);
  margin-bottom: 1rem;
}

.info-card.plain {
  display: block;
}

.thumb {
  width: 160px;
  height: 90px;
  object-fit: cover;
  border-radius: 10px;
  flex-shrink: 0;
}

.info-main {
  min-width: 0;
}

.info-title {
  margin: 0 0 0.35rem;
  font-weight: 600;
  line-height: 1.35;
}

.info-meta,
.info-sub {
  margin: 0;
  font-size: 0.85rem;
  color: var(--cs-muted);
}

.mono {
  font-family: ui-monospace, monospace;
  word-break: break-all;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.two-col.range {
  margin: 0.75rem 0;
}

.fieldset {
  border: 1px dashed var(--cs-border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin: 0;
}

.fieldset legend {
  padding: 0 0.35rem;
  font-size: 0.82rem;
  color: var(--cs-muted);
}

.fieldset label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.45rem;
  font-size: 0.88rem;
  cursor: pointer;
}

.fieldset.adv label {
  margin-bottom: 0.5rem;
}

.field.inline {
  margin-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.num {
  width: 4rem;
  margin: 0 0.25rem;
  border-radius: 8px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--cs-text);
  padding: 0.2rem 0.35rem;
}

.row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.grow {
  flex: 1;
  min-width: 200px;
}

.modes-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.modes-row label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}

.entry-list {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--cs-border);
  border-radius: 12px;
  padding: 0.5rem;
  margin-top: 0.75rem;
}

.entry-toolbar {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.entry-line label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.35rem 0.25rem;
  cursor: pointer;
  font-size: 0.86rem;
}

.entry-title {
  flex: 1;
  word-break: break-all;
}

.entry-dur {
  color: var(--cs-muted);
  font-size: 0.82rem;
  flex-shrink: 0;
}
</style>
