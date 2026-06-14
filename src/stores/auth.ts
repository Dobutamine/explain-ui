import { defineStore } from "pinia";
import { ref, computed } from "vue";

// Authenticated session state. Credentials are verified server-side against
// MongoDB (see server/auth.mjs); the session itself is an HttpOnly cookie that
// JS cannot read, so we never hold a token here — we only mirror the public user
// fields the server hands back, and rely on `fetchMe()` to rehydrate on reload.

export interface AuthUser {
  email: string;
  name: string;
  admin: boolean;
  institution: string;
  modelDeveloper: boolean;
  defaultState: string | null;
  defaultLocalState: string | null;
}

type Status = "idle" | "loading" | "authed" | "error";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const status = ref<Status>("idle");
  const error = ref<string | null>(null);
  // Whether we've completed the initial cookie check (used by the router guard).
  const ready = ref(false);

  const isAuthenticated = computed(() => user.value !== null);

  async function login(email: string, password: string): Promise<boolean> {
    status.value = "loading";
    error.value = null;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        user.value = null;
        status.value = "error";
        error.value = data?.error ?? "login failed";
        return false;
      }
      user.value = data.user as AuthUser;
      status.value = "authed";
      ready.value = true;
      return true;
    } catch (e) {
      user.value = null;
      status.value = "error";
      error.value = `network error: ${String(e)}`;
      return false;
    }
  }

  async function register(fields: {
    name: string;
    email: string;
    institution: string;
    password: string;
  }): Promise<boolean> {
    status.value = "loading";
    error.value = null;
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        user.value = null;
        status.value = "error";
        error.value = data?.error ?? "registration failed";
        return false;
      }
      // Server signs us in on success (sets the session cookie).
      user.value = data.user as AuthUser;
      status.value = "authed";
      ready.value = true;
      return true;
    } catch (e) {
      user.value = null;
      status.value = "error";
      error.value = `network error: ${String(e)}`;
      return false;
    }
  }

  // Rehydrate the session from the HttpOnly cookie. Safe to call repeatedly;
  // the router guard calls it once before the first protected navigation.
  async function fetchMe(): Promise<boolean> {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        user.value = data.user as AuthUser;
        status.value = "authed";
      } else {
        user.value = null;
        status.value = "idle";
      }
    } catch {
      user.value = null;
      status.value = "idle";
    } finally {
      ready.value = true;
    }
    return isAuthenticated.value;
  }

  // --- Admin-only ---
  // List all users (admin). Returns the array (empty on failure).
  async function listUsers(): Promise<AuthUser[]> {
    try {
      const res = await fetch("/api/auth/users", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `list failed (${res.status})`);
      return (data.users ?? []) as AuthUser[];
    } catch (e) {
      error.value = String(e);
      return [];
    }
  }

  // Set a user's model-developer flag (admin). Returns the updated user or null.
  async function setModelDeveloper(
    email: string,
    value: boolean,
  ): Promise<AuthUser | null> {
    try {
      const res = await fetch("/api/auth/set-model-developer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, modelDeveloper: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `update failed (${res.status})`);
      return data.user as AuthUser;
    } catch (e) {
      error.value = String(e);
      return null;
    }
  }

  async function logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* clear client state regardless of network outcome */
    }
    user.value = null;
    status.value = "idle";
    error.value = null;
  }

  return {
    user,
    status,
    error,
    ready,
    isAuthenticated,
    login,
    register,
    fetchMe,
    logout,
    listUsers,
    setModelDeveloper,
  };
});
