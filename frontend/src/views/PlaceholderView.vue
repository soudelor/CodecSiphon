<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  title: string;
  description: string;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="placeholder card">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <p class="hint">{{ t('common.placeholderHint') }}</p>
  </div>
</template>

<style scoped>
.placeholder {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.03);
  max-width: 720px;
}

h2 {
  margin: 0 0 0.75rem;
}

p {
  margin: 0 0 0.65rem;
  color: var(--cs-muted);
  line-height: 1.55;
}

.hint {
  font-size: 0.88rem;
  color: var(--cs-muted);
  opacity: 0.9;
}
</style>
