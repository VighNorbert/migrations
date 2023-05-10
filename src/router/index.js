import {createRouter, createWebHistory} from 'vue-router'
import VisControls from "@/components/VisControls.vue";

const routes = [
    {
        path: '/',
        name: 'migrations',
        component: VisControls,
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
