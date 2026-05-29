<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const adminBase = computed(() => `/admin/${String(route.params.yyyymmdd)}`);
</script>

<template>
  <div class="card">
    <h2>{{ t('admin.homeTitle') }}</h2>
    <p class="muted">{{ t('admin.homeIntro') }}</p>
    <nav class="shortcuts">
      <RouterLink class="pill" :to="`${adminBase}/users`">{{
        t('admin.navUsers')
      }}</RouterLink>
      <RouterLink class="pill" :to="`${adminBase}/tasks`">{{
        t('admin.navTasks')
      }}</RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  background: rgba(255, 255, 255, 0.03);
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
}

.muted {
  margin: 0 0 1rem;
  color: var(--cs-muted);
  line-height: 1.55;
  font-size: 0.95rem;
}

.shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.pill {
  display: inline-block;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--cs-border);
  color: var(--cs-accent);
  text-decoration: none;
  font-size: 0.88rem;
}
.pill:hover {
  border-color: rgba(62, 207, 142, 0.45);
}
</style>
