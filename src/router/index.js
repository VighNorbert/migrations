import {createRouter, createWebHistory} from 'vue-router'
import AboutView from "@/views/AboutView.vue";
import MigrationsView from "@/views/MigrationsView.vue";
import HybridView from "@/views/HybridView.vue";

const routes = [
    {
        path: '/',
        name: 'about',
        component: AboutView,
        meta: {
          title: 'About'
        },
    },
    {
        path: '/migrations',
        name: 'migrations',
        component: MigrationsView
    },
    {
        path: '/hybrid',
        name: 'hybrid',
        component: HybridView,
        meta: {
          title: 'Hybrid'
        },
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from, next) => {
    const title = to.meta.title;
    if (title) {
        document.title = 'MigVis - ' + title;
    } else {
        document.title = 'MigVis';
    }
    next();
})

export default router
