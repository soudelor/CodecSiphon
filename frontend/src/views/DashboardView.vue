<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import * as tasksApi from '@/api/tasks';
import type { DownloadTask, TaskStatus } from '@/types/models';
import { useTaskLabels } from '@/composables/useTaskLabels';
import {
  canCancelTask,
  canPauseTask,
  canResumeTask,
  canRetryTask,
} from '@/utils/taskActions';

const { t } = useI18n();
const { sourceTypeLabel, taskStatusLabel } = useTaskLabels();
const auth = useAuthStore();
const recent = ref<DownloadTask[]>([]);
const loading = ref(true);
const loadError = ref('');
const busyId = ref<string | null>(null);
const actionError = ref('');

const welcomeName = computed(
  () => auth.user?.displayName || auth.user?.email || t('common.user'),
);

async function loadRecent() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await tasksApi.listTasks(1, 6);
    recent.value = data.items;
  } catch {
    loadError.value = t('dashboard.loadRecentFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadRecent);

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join('；');
    if (typeof m === 'string') return m;
  }
  return t('errors.operationFailed');
}

async function setStatus(id: string, status: TaskStatus) {
  if (status !== 'paused' && status !== 'cancelled' && status !== 'queued') return;
  busyId.value = id;
  actionError.value = '';
  try {
    await tasksApi.updateTaskStatus(id, status);
    await loadRecent();
  } catch (e) {
    actionError.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}

async function removeTask(tTask: DownloadTask) {
  const label =
    tTask.title ||
    tTask.sourceUrl ||
    tTask.sourceUrls[0] ||
    tTask.id.slice(0, 8);
  if (
    !confirm(
      t('dashboard.deleteTaskConfirmDash', {
        label,
      }),
    )
  ) {
    return;
  }
  busyId.value = tTask.id;
  actionError.value = '';
  try {
    await tasksApi.deleteTask(tTask.id);
    await loadRecent();
  } catch (e) {
    actionError.value = apiErrorMessage(e);
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div class="dashboard">
    <section class="welcome card">
      <div>
        <h2>
          {{ t('dashboard.welcomeBack', { name: welcomeName }) }}
        </h2>
        <p class="muted">
          {{ t('dashboard.intro') }}
        </p>
      </div>
      <div class="quick">
        <RouterLink class="btn primary" to="/tasks/new">{{
          t('dashboard.newDownloadTask')
        }}</RouterLink>
        <RouterLink class="btn ghost" to="/tasks">{{
          t('dashboard.manageTasks')
        }}</RouterLink>
      </div>
    </section>

    <section class="grid">
      <div class="card">
        <h3>{{ t('dashboard.systemStatus') }}</h3>
        <p class="muted small">
          {{ t('dashboard.systemStatusHint') }}
        </p>
        <ul class="stats">
          <li>
            <span>{{ t('dashboard.connStatus') }}</span
            ><strong>{{ t('dashboard.connReady') }}</strong>
          </li>
          <li>
            <span>{{ t('dashboard.saveLocation') }}</span
            ><strong>{{ t('dashboard.saveLocationValue') }}</strong>
          </li>
          <li>
            <span>{{ t('dashboard.cloudSync') }}</span
            ><strong>{{ t('dashboard.cloudSyncNA') }}</strong>
          </li>
        </ul>
      </div>

      <div class="card stretch">
        <div class="card-head">
          <h3>{{ t('dashboard.recentTasks') }}</h3>
          <RouterLink to="/tasks" class="link">{{ t('common.viewAll') }}</RouterLink>
        </div>

        <p v-if="loading" class="muted">{{ t('common.loading') }}</p>
        <p v-else-if="loadError" class="error">{{ loadError }}</p>
        <template v-else>
          <p v-if="actionError" class="error small">{{ actionError }}</p>
          <div v-if="recent.length === 0" class="muted">
            {{ t('dashboard.noTasksYet') }}
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>{{ t('dashboard.colTitleUrl') }}</th>
                <th>{{ t('dashboard.colType') }}</th>
                <th>{{ t('dashboard.colStatus') }}</th>
                <th>{{ t('dashboard.colProgress') }}</th>
                <th class="col-mini">{{ t('dashboard.colActions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trow in recent" :key="trow.id">
                <td class="ellipsis">
                  {{ trow.title || trow.sourceUrl || (trow.sourceUrls[0] ?? t('common.dash')) }}
                </td>
                <td>{{ sourceTypeLabel(trow.sourceType) }}</td>
                <td>{{ taskStatusLabel(trow.status) }}</td>
                <td>{{ trow.progressPercent }}%</td>
                <td class="dash-actions">
                  <button
                    type="button"
                    class="link-btn"
                    :disabled="busyId === trow.id || !canPauseTask(trow)"
                    @click="setStatus(trow.id, 'paused')"
                  >
                    {{ t('dashboard.pause') }}
                  </button>
                  <button
                    type="button"
                    class="link-btn"
                    :disabled="busyId === trow.id || !canResumeTask(trow)"
                    @click="setStatus(trow.id, 'queued')"
                  >
                    {{ t('dashboard.resume') }}
                  </button>
                  <button
                    type="button"
                    class="link-btn"
                    :disabled="busyId === trow.id || !canRetryTask(trow)"
                    @click="setStatus(trow.id, 'queued')"
                  >
                    {{ t('dashboard.retry') }}
                  </button>
                  <button
                    type="button"
                    class="link-btn danger"
                    :disabled="busyId === trow.id || !canCancelTask(trow)"
                    @click="setStatus(trow.id, 'cancelled')"
                  >
                    {{ t('dashboard.cancel') }}
                  </button>
                  <button
                    type="button"
                    class="link-btn del"
                    :disabled="busyId === trow.id"
                    @click="removeTask(trow)"
                  >
                    {{ t('dashboard.delete') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
}

.welcome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.welcome h2 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}

.muted {
  margin: 0;
  color: var(--cs-muted);
}

.small {
  font-size: 0.9rem;
  line-height: 1.45;
}

.quick {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.95rem;
  border-radius: 12px;
  text-decoration: none;
  font-size: 0.92rem;
  border: 1px solid transparent;
}

.btn.primary {
  background: linear-gradient(135deg, var(--cs-accent), #25c9b5);
  color: #041016;
  font-weight: 600;
}

.btn.ghost {
  border-color: var(--cs-border);
  color: var(--cs-text);
}

.grid {
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;
  gap: 1rem;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.stretch {
  min-width: 0;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
}

.card-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.link {
  color: var(--cs-accent);
  font-size: 0.9rem;
  text-decoration: none;
}

.stats {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.stats li {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: var(--cs-muted);
}

.stats strong {
  color: var(--cs-text);
  font-weight: 600;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.table th,
.table td {
  text-align: left;
  padding: 0.45rem 0.35rem;
  border-bottom: 1px solid var(--cs-border);
}

.table th {
  color: var(--cs-muted);
  font-weight: 500;
}

.ellipsis {
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error {
  color: #ff8b8b;
  margin: 0;
}

code {
  font-size: 0.85em;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.error.small {
  font-size: 0.88rem;
  margin: 0 0 0.5rem;
}

.col-mini {
  width: 1%;
  white-space: nowrap;
}

.dash-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: center;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--cs-accent, #3ecf8e);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-size: 0.82rem;
}

.link-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  text-decoration: none;
}

.link-btn.danger {
  color: #ff9b9b;
}

.link-btn.del {
  color: #c9a8ff;
}
</style>
