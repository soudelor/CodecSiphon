<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const version = import.meta.env.VITE_APP_VERSION || 'dev';

withDefaults(
  defineProps<{
    variant?: 'compact' | 'labeled';
  }>(),
  { variant: 'compact' },
);
</script>

<template>
  <p
    class="app-version"
    :class="{ labeled: variant === 'labeled' }"
    :title="t('layout.appVersionTitle', { version })"
  >
    <template v-if="variant === 'labeled'">
      {{ t('layout.appVersion', { version }) }}
    </template>
    <template v-else>
      v{{ version }}
    </template>
  </p>
</template>

<style scoped>
.app-version {
  margin: 0;
  font-size: 0.68rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
}

.app-version.labeled {
  font-size: 0.78rem;
  color: var(--cs-muted);
  text-align: center;
  padding: 0.5rem 0 0.25rem;
}
</style>
