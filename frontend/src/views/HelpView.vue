<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="page">
    <header class="head">
      <h2>帮助</h2>
      <p class="muted">
        本站用于添加视频下载、查看进度，并在「文件管理」里浏览、下载或删除已保存的文件。更细的部署与开发说明见仓库内文档，普通使用时只需按下列步骤操作即可。
      </p>
    </header>

    <div class="card">
      <h3 class="h">快速开始</h3>
      <ol class="list">
        <li>使用管理员提供的地址打开本站，注册或登录账号。</li>
        <li>在「新建任务」粘贴视频或列表链接，先点「检测链接」确认信息，再选画质与格式后开始下载。</li>
        <li>在「任务管理」查看排队、进行中和已结束的任务，可按需暂停、继续、重试或删除。</li>
        <li>任务完成后，到「文件管理」搜索文件名，可把文件下载到本机，或删除不需要的条目。</li>
        <li>在「设置」里可配置默认画质、代理、来源页等；新建任务时再改的选项会覆盖这里的默认项。</li>
      </ol>
    </div>

    <div class="card">
      <h3 class="h">站内入口</h3>
      <ul class="list flat">
        <li><RouterLink to="/tasks">任务管理</RouterLink> — 查看与控制下载进度</li>
        <li><RouterLink to="/files">文件管理</RouterLink> — 浏览已下好的文件，下载到电脑或删除</li>
        <li><RouterLink to="/settings">设置</RouterLink> — 默认下载行为与个人偏好</li>
      </ul>
    </div>

    <div class="card">
      <h3 class="h">常见问题</h3>
      <ul class="list flat">
        <li><strong>页面打不开或一直转圈</strong>：检查网络；若为公司内网，请联系管理员确认服务地址与白名单。</li>
        <li><strong>检测链接失败</strong>：把同一地址复制到浏览器里试播；能播放仍失败时，可在「设置」里填写来源页网址或登录相关选项后再试。</li>
        <li><strong>删除任务会怎样</strong>：会取消未完成的下载，并删除该任务对应的已下载文件夹及文件库中的记录，且不可恢复。</li>
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
