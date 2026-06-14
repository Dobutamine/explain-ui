import { defineStore } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "@/stores/auth";

// Per-user saved model states, persisted server-side in MongoDB (see
// server/states.mjs). The full reloadable scenario object is assembled by
// SaveStatePanel.vue exactly as for a file snapshot; here we just ship it to /api
// and list/load/delete it. The session cookie (credentials:"include") identifies
// the owner server-side — we never send identity from the client.

export interface SavedStateSummary {
  id: string;
  name: string;
  description: string;
  updated_at: string | null;
  created_at: string | null;
}

export const useStatesStore = defineStore("states", () => {
  const savedStates = ref<SavedStateSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  // Id of the cloud state currently loaded into the engine (null for a local
  // scenario / JSON file). Only a cloud-backed state can be flagged as default.
  const currentId = ref<string | null>(null);

  function setCurrent(id: string | null): void {
    currentId.value = id;
  }

  async function fetchList(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/states/list", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `list failed (${res.status})`);
      savedStates.value = data.states ?? [];
    } catch (e) {
      error.value = String(e);
      savedStates.value = [];
    } finally {
      loading.value = false;
    }
  }

  // `file` is the full reloadable scenario object (same one the file-snapshot
  // path builds). Returns true on success.
  async function saveCurrent(payload: {
    name: string;
    description?: string;
    file: unknown;
  }): Promise<boolean> {
    error.value = null;
    try {
      const res = await fetch("/api/states/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `save failed (${res.status})`);
      // The just-saved state is now the active one (so it can be flagged default).
      if (data.state?.id) currentId.value = data.state.id;
      await fetchList();
      return true;
    } catch (e) {
      error.value = String(e);
      return false;
    }
  }

  // Returns the full reloadable file object for the given state, or null.
  async function loadState(id: string): Promise<any | null> {
    error.value = null;
    try {
      const res = await fetch(`/api/states/get?id=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `load failed (${res.status})`);
      currentId.value = id; // this cloud state is now the active one
      return data.file ?? null;
    } catch (e) {
      error.value = String(e);
      return null;
    }
  }

  async function deleteState(id: string): Promise<boolean> {
    error.value = null;
    try {
      const res = await fetch("/api/states/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `delete failed (${res.status})`);
      if (currentId.value === id) currentId.value = null;
      await fetchList();
      return true;
    } catch (e) {
      error.value = String(e);
      return false;
    }
  }

  // Flag a cloud state as the user's default (loaded on next login). Pass null to
  // clear it. Mirrors the change into the auth store so the UI updates at once.
  async function setDefault(id: string | null): Promise<boolean> {
    error.value = null;
    try {
      const res = await fetch("/api/states/set-default", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `set-default failed (${res.status})`);
      const auth = useAuthStore();
      if (auth.user) auth.user.defaultState = data.defaultState ?? null;
      return true;
    } catch (e) {
      error.value = String(e);
      return false;
    }
  }

  // Model-developers only: choose a LOCAL scenario to load at startup (takes
  // priority over the cloud default). Pass null to clear. Mirrors into auth store.
  async function setDefaultLocal(name: string | null): Promise<boolean> {
    error.value = null;
    try {
      const res = await fetch("/api/states/set-default-local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `set-default-local failed (${res.status})`);
      const auth = useAuthStore();
      if (auth.user) auth.user.defaultLocalState = data.defaultLocalState ?? null;
      return true;
    } catch (e) {
      error.value = String(e);
      return false;
    }
  }

  function has(name: string): boolean {
    return savedStates.value.some((s) => s.name === name);
  }

  return {
    savedStates,
    loading,
    error,
    currentId,
    setCurrent,
    fetchList,
    saveCurrent,
    loadState,
    deleteState,
    setDefault,
    setDefaultLocal,
    has,
  };
});
