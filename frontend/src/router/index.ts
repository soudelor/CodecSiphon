import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import { i18n } from '@/locales';

function documentTitleForRoute(
  name: string | symbol | undefined,
): string {
  const t = i18n.global.t;
  switch (name) {
    case 'login':
      return t('auth.login');
    case 'register':
      return t('auth.register');
    case 'dashboard':
      return t('layout.titleDashboard');
    case 'task-new':
      return t('layout.titleTaskNew');
    case 'tasks':
      return t('layout.titleTasks');
    case 'files':
      return t('layout.titleFiles');
    case 'settings':
      return t('layout.titleSettings');
    case 'help':
      return t('layout.titleHelp');
    default:
      return t('common.workspace');
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { guest: true },
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'tasks/new',
          name: 'task-new',
          component: () => import('@/views/TaskCreateView.vue'),
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('@/views/TasksView.vue'),
        },
        {
          path: 'files',
          name: 'files',
          component: () => import('@/views/FilesView.vue'),
        },
        {
          path: 'subscriptions',
          redirect: '/',
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
        {
          path: 'help',
          name: 'help',
          component: () => import('@/views/HelpView.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('accessToken');
  if (to.meta.requiresAuth && !token) {
    const redirect =
      to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {};
    return { path: '/login', query: redirect };
  }
  if (to.meta.guest && token) {
    return { path: '/' };
  }
  return true;
});

router.afterEach((to) => {
  const page = documentTitleForRoute(to.name);
  const suffix = i18n.global.t('layout.documentTitleSuffix');
  document.title = `${page} · ${suffix}`;
});

export default router;
