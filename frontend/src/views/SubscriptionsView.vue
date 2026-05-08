<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref, watch } from 'vue';
import * as subsApi from '@/api/subscriptions';
import type { Subscription } from '@/types/models';

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

function typeLabel(t: string): string {
  if (t === 'channel') return '频道';
  if (t === 'playlist') return '播放列表';
  if (t === 'rss') return 'RSS';
  return t;
}

function statusLabel(s: string): string {
  return s === 'active' ? '进行中' : '已暂停';
}

async function load() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const data = await subsApi.listSubscriptions(page.value, limit.value);
    items.value = data.items;
    total.value = data.total;
  } catch {
    errorMsg.value = '订阅列表加载失败，请检查网络或稍后再试';
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
  return '操作失败，请稍后重试';
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
  if (
    !confirm(
      `确定删除「${label}」这条订阅？\n\n删除后无法再选它来新建任务；以前已经创建的任务不受影响。`,
    )
  ) {
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
        <h2>订阅管理</h2>
        <p class="muted">
          在此添加常看的频道、视频列表或订阅地址，便于以后统一下载与更新。（当前主界面已暂时收起该入口；若您仍能打开本页，说明功能保留在系统中。）
        </p>
      </div>
    </header>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="card form" @submit.prevent="createSub">
      <h3 class="form-title">添加一条订阅</h3>
      <div class="row">
        <div class="field">
          <label>内容类型</label>
          <select v-model="type">
            <option value="channel">频道（某位作者的全部更新）</option>
            <option value="playlist">播放列表（固定的一组视频）</option>
            <option value="rss">订阅摘要（RSS 地址）</option>
          </select>
        </div>
        <div class="field grow">
          <label>页面链接</label>
          <input v-model="sourceUrl" required placeholder="粘贴浏览器地址栏里的完整链接" />
        </div>
      </div>
      <div class="row">
        <div class="field grow">
          <label>显示名称（可选，便于在列表里辨认）</label>
          <input v-model="displayName" maxlength="255" />
        </div>
        <div class="field">
          <label>自动检查间隔（秒，数字越大检查越不频繁）</label>
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
          {{ submitting ? '保存中…' : '添加订阅' }}
        </button>
      </div>
    </form>

    <div class="card list-card">
      <div class="pager">
        <span class="pi">共 {{ total }} 条订阅</span>
        <span class="spacer" />
        <label>
          每页
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
          上一页
        </button>
        <span class="pi">{{ page }} / {{ totalPages() }}</span>
        <button
          type="button"
          class="btn ghost"
          :disabled="page >= totalPages() || loading"
          @click="page += 1"
        >
          下一页
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>订阅</th>
              <th>类型</th>
              <th>状态</th>
              <th>检查间隔（秒）</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in items" :key="s.id">
              <td class="cell-main">
                <div class="title">
                  {{ s.displayName || '（未命名）' }}
                </div>
                <div class="sub break">{{ s.sourceUrl }}</div>
                <div class="sub mono">内部编号：{{ s.id }}</div>
              </td>
              <td>{{ typeLabel(s.type) }}</td>
              <td>{{ statusLabel(s.status) }}</td>
              <td>每 {{ s.checkIntervalSec }} 秒</td>
              <td class="actions">
                <button
                  type="button"
                  class="btn small"
                  :disabled="busyId === s.id"
                  @click="toggleStatus(s)"
                >
                  {{ s.status === 'active' ? '暂停' : '启用' }}
                </button>
                <button
                  type="button"
                  class="btn small del"
                  :disabled="busyId === s.id"
                  @click="removeSub(s)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!loading && items.length === 0" class="empty muted">
          暂无订阅，请使用上方表单添加。
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

.form-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.03);
}

.list-card {
  padding: 0;
  overflow: hidden;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 140px;
}

.field.grow {
  flex: 1;
  min-width: 200px;
}

.field label {
  font-size: 0.82rem;
  color: var(--cs-muted);
}

.field input,
.field select {
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--cs-text);
  padding: 0.45rem 0.55rem;
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

.table-wrap {
  padding: 0;
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
  min-width: 160px;
  width: 18%;
}

.cell-main .title {
  font-weight: 600;
}

.cell-main .sub {
  margin-top: 0.25rem;
  color: var(--cs-muted);
  font-size: 0.82rem;
}

.break {
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
  padding: 0.35rem 0.55rem;
  cursor: pointer;
  font-size: 0.82rem;
}

.btn.primary {
  align-self: flex-start;
  border-color: rgba(62, 207, 142, 0.45);
  color: var(--cs-accent, #3ecf8e);
}

.btn.ghost {
  padding: 0.45rem 0.75rem;
}

.btn.small:disabled,
.btn:disabled,
.btn.primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn.del {
  border-color: rgba(180, 120, 255, 0.35);
  color: #d4b4ff;
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
