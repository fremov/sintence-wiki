import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import PageView from './views/PageView.vue'
import { pageBySlug } from './lib/pages'

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    {
      path: '/:slug',
      component: PageView,
      beforeEnter: (to) => (pageBySlug(String(to.params.slug)) ? true : '/'),
    },
  ],
  scrollBehavior: (to, from) => (to.path !== from.path ? { top: 0 } : undefined),
})
