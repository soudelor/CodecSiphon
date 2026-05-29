import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import { i18n } from '@/locales';
import {
  adminBasePath,
  adminLoginPath,
  isValidAdminDateSegment,
  parseAdminDateFromPath,
} from '@/utils/adminEntry';

function documentTitleForRoute(
  name: string | symbol | undefined,
): string {
  const t = i18n.global.t;
  switch (name) {
    case 'login':
      return t('auth.login');
    case 'register':
      return t('auth.register');
    case 'forgot-password':
      return t('auth.forgotPasswordTitle');
    case 'reset-password':
      return t('auth.resetPasswordTitle');
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
    case 'url-extract':
      return t('layout.titleUrlExtract');
    case 'url-extract-public':
      return t('urlExtract.publicTitle');
    case 'admin-login':
      return t('admin.loginTitle');
    case 'admin-home':
      return t('admin.homeTitle');
    case 'admin-users':
      return t('admin.navUsers');
    case 'admin-user-detail':
      return t('admin.userDetailTitle');
    case 'admin-tasks':
      return t('admin.navTasks');
    case 'admin-task-detail':
      return t('admin.taskDetailTitle');
    case 'admin-user-files':
      return t('admin.userMediaTitle');
    case 'admin-media-detail':
      return t('admin.mediaDetailTitle');
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
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: { guest: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
      meta: { guest: true },
    },
    {
      path: '/tools',
      component: () => import('@/layouts/PublicToolLayout.vue'),
      children: [
        {
          path: 'url-extract',
          name: 'url-extract-public',
          component: () => import('@/views/UrlExtractPublicView.vue'),
        },
      ],
    },
    {
      path: '/admin',
      name: 'admin-bare',
      component: () => import('@/views/admin/AdminBlankView.vue'),
    },
    {
      path: '/admin/:yyyymmdd/login',
      name: 'admin-login',
      component: () => import('@/views/admin/AdminLoginView.vue'),
      meta: { adminGuest: true },
    },
    {
      path: '/admin/:yyyymmdd',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAdminAuth: true },
      children: [
        { path: '', redirect: { name: 'admin-home' } },
        {
          path: 'home',
          name: 'admin-home',
          component: () => import('@/views/admin/AdminHomeView.vue'),
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/AdminUsersView.vue'),
        },
        {
          path: 'users/:id',
          name: 'admin-user-detail',
          component: () => import('@/views/admin/AdminUserDetailView.vue'),
        },
        {
          path: 'users/:userId/files',
          name: 'admin-user-files',
          component: () => import('@/views/admin/AdminUserMediaView.vue'),
        },
        {
          path: 'tasks',
          name: 'admin-tasks',
          component: () => import('@/views/admin/AdminTasksView.vue'),
        },
        {
          path: 'tasks/:id',
          name: 'admin-task-detail',
          component: () => import('@/views/admin/AdminTaskDetailView.vue'),
        },
        {
          path: 'media-files/:id',
          name: 'admin-media-detail',
          component: () => import('@/views/admin/AdminMediaDetailView.vue'),
        },
      ],
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
          path: 'url-extract',
          name: 'url-extract',
          component: () => import('@/views/UrlExtractView.vue'),
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
          meta: { requiresAuth: false },
          component: () => import('@/views/HelpView.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const accessToken = localStorage.getItem('accessToken');
  const adminAccessToken = localStorage.getItem('adminAccessToken');

  /** 裸 `/admin`：空白占位，不暴露真实登录 URL */
  if (to.path === '/admin' || to.path === '/admin/') {
    return true;
  }

  if (to.path.startsWith('/admin')) {
    const seg = parseAdminDateFromPath(to.path);
    if (seg === null || !isValidAdminDateSegment(seg)) {
      return { path: '/' };
    }

    if (to.name === 'admin-login') {
      if (adminAccessToken) {
        return { path: `${adminBasePath()}/home` };
      }
      return true;
    }

    if (!adminAccessToken) {
      return {
        path: adminLoginPath(),
        query: { redirect: to.fullPath },
      };
    }
    return true;
  }

  if (to.meta.requiresAuth && !accessToken) {
    const redirect =
      to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {};
    return { path: '/login', query: redirect };
  }
  if (to.meta.guest && accessToken) {
    return { path: '/' };
  }
  return true;
});

router.afterEach((to) => {
  if (to.name === 'admin-bare') {
    document.title = '';
    return;
  }
  const page = documentTitleForRoute(to.name);
  const suffix = i18n.global.t('layout.documentTitleSuffix');
  document.title = `${page} · ${suffix}`;
});

export default router;
