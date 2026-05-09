<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

const { t } = useI18n();
</script>

<template>
  <div class="page">
    <header class="head">
      <h2>{{ t('help.title') }}</h2>
      <p class="muted">
        {{ t('help.intro') }}
      </p>
    </header>

    <div class="card notice">
      <p class="notice-text">
        {{ t('help.notice') }}
      </p>
    </div>

    <div class="card">
      <h3 class="h">{{ t('help.quickStart') }}</h3>
      <ol class="list">
        <li>{{ t('help.step1') }}</li>
        <li>{{ t('help.step2') }}</li>
        <li>{{ t('help.step3') }}</li>
        <li>{{ t('help.step4') }}</li>
        <li>{{ t('help.step5') }}</li>
      </ol>
    </div>

    <div class="card">
      <h3 class="h">{{ t('help.navTitle') }}</h3>
      <ul class="list flat">
        <li>
          <RouterLink to="/tasks">{{ t('help.navTasks') }}</RouterLink> —
          {{ t('help.navTasksDesc') }}
        </li>
        <li>
          <RouterLink to="/files">{{ t('help.navFiles') }}</RouterLink> —
          {{ t('help.navFilesDesc') }}
        </li>
        <li>
          <RouterLink to="/settings">{{ t('help.navSettings') }}</RouterLink> —
          {{ t('help.navSettingsDesc') }}
        </li>
      </ul>
    </div>

    <div class="card">
      <h3 class="h">{{ t('help.faqTitle') }}</h3>
      <ul class="list flat">
        <li>
          <strong>{{ t('help.faqPageLoad') }}</strong
          >：{{ t('help.faqPageLoadAns') }}
        </li>
        <li>
          <strong>{{ t('help.faqDetect') }}</strong
          >：{{ t('help.faqDetectAns') }}
        </li>
        <li>
          <strong>{{ t('help.faqDelete') }}</strong
          >：{{ t('help.faqDeleteAns') }}
        </li>
      </ul>
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
  line-height: 1.55;
  font-size: 0.9rem;
}

.notice {
  border-color: rgba(196, 154, 74, 0.35);
  background: rgba(196, 154, 74, 0.08);
}

.notice-text {
  margin: 0;
  line-height: 1.55;
  font-size: 0.88rem;
  color: var(--cs-text);
}

.card {
  border: 1px solid var(--cs-border);
  border-radius: 16px;
  padding: 1.1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
}

.h {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
}

.list {
  margin: 0;
  padding-left: 1.25rem;
  line-height: 1.6;
  color: var(--cs-text);
  font-size: 0.9rem;
}

.list.flat {
  list-style: none;
  padding-left: 0;
}

.list li {
  margin-bottom: 0.4rem;
}

.list a {
  color: var(--cs-accent, #3ecf8e);
  text-decoration: none;
}

.list a:hover {
  text-decoration: underline;
}

.list strong {
  font-weight: 600;
}
</style>
