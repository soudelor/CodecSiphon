<script setup lang="ts">
import AppVersionLabel from '@/components/AppVersionLabel.vue';
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

    <div class="card support">
      <h3 class="h">{{ t('help.supportTitle') }}</h3>
      <p class="support-body">{{ t('help.supportBody') }}</p>
      <div class="qr-grid" role="group" :aria-label="t('help.supportTitle')">
        <figure class="qr-item">
          <img
            class="qr-img"
            src="/support-wechat-pay.png"
            :alt="t('help.supportWechatAlt')"
            loading="lazy"
            decoding="async"
          />
          <figcaption class="qr-cap">
            {{ t('help.supportWechatCaption') }}
          </figcaption>
        </figure>
        <figure class="qr-item">
          <img
            class="qr-img"
            src="/support-alipay.png"
            :alt="t('help.supportAlipayAlt')"
            loading="lazy"
            decoding="async"
          />
          <figcaption class="qr-cap">
            {{ t('help.supportAlipayCaption') }}
          </figcaption>
        </figure>
      </div>
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

    <AppVersionLabel variant="labeled" />
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

.support-body {
  margin: 0 0 1rem;
  max-width: 52rem;
  line-height: 1.65;
  font-size: 0.9rem;
  color: var(--cs-text);
}

.qr-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem 2rem;
  justify-content: center;
  align-items: flex-start;
}

.qr-item {
  margin: 0;
  text-align: center;
  max-width: min(168px, 100%);
}

.qr-img {
  display: block;
  width: auto;
  max-width: min(144px, 100%);
  height: 156px;
  margin: 0 auto;
  object-fit: contain;
  object-position: center;
  border-radius: 12px;
  border: 1px solid var(--cs-border);
  background: #fff;
  box-sizing: border-box;
}

.qr-cap {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--cs-muted);
}
</style>
