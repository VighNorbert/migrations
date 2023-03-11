import {createRouter, createWebHistory} from 'vue-router'
import AboutView from "@/views/AboutView.vue";
import MigrationsView from "@/views/MigrationsView.vue";

const routes = [
    {
        path: '/',
        name: 'about',
        component: AboutView
    },
    {
        path: '/migrations',
        name: 'migrations',
        component: MigrationsView
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
