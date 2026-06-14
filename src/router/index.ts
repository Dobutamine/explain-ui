import { createRouter, createWebHistory } from "vue-router";
import MainPage from "@/pages/MainPage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import RegisterPage from "@/pages/RegisterPage.vue";
import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "main", component: MainPage, meta: { requiresAuth: true } },
    { path: "/login", name: "login", component: LoginPage },
    { path: "/register", name: "register", component: RegisterPage },
  ],
});

// Auth guard. On the first navigation we rehydrate the session from the HttpOnly
// cookie (server check). Unauthenticated users hitting a protected route are sent
// to /login with a ?redirect= back to where they were going; already-authed users
// visiting /login are bounced to the app. This is a UX gate — the cookie check on
// the server is the real security boundary.
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if ((to.name === "login" || to.name === "register") && auth.isAuthenticated) {
    return { name: "main" };
  }
  return true;
});

export default router;
