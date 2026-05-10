<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { setAppLocale, type AppLocale } from '@/locales';

const { locale, t } = useI18n();

const model = computed({
  get: () => locale.value as AppLocale,
  set: (v: string) => {
    if (v === 'zh-CN' || v === 'en-US') setAppLocale(v);
  },
});
</script>

<template>
  <div class="lang-switch">
    <label class="visually-hidden" for="locale-select">{{
      t('common.language')
    }}</label>
    <select id="locale-select" v-model="model" class="lang-select">
      <option value="zh-CN">{{ t('common.zhCN') }}</option>
      <option value="en-US">{{ t('common.enUS') }}</option>
    </select>
  </div>
</template>

<style scoped>
.lang-switch {
  display: inline-flex;
  align-items: center;
}

.lang-select {
  border-radius: 10px;
  border: 1px solid var(--cs-border, #2a3540);
  background: rgba(255, 255, 255, 0.06);
  color: var(--cs-text, #e8f0f6);
  padding: 0.35rem 0.6rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  max-width: 10rem;
}

.lang-select:focus {
  outline: none;
  border-color: rgba(62, 207, 142, 0.45);
  box-shadow: 0 0 0 2px rgba(62, 207, 142, 0.12);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
