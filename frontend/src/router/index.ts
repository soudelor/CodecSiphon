import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';

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

export default router;
