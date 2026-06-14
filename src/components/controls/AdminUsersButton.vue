<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import ToggleSwitch from "primevue/toggleswitch";
import { useAuthStore, type AuthUser } from "@/stores/auth";

// Admin-only control: list users and toggle each user's model-developer flag.
// Rendered only when the logged-in user is an admin (guarded by the parent).
const auth = useAuthStore();

const show = ref(false);
const loading = ref(false);
const users = ref<AuthUser[]>([]);
const busy = ref<Record<string, boolean>>({}); // per-email in-flight guard

async function open() {
  show.value = true;
  loading.value = true;
  users.value = await auth.listUsers();
  loading.value = false;
}

async function toggle(u: AuthUser, value: boolean) {
  busy.value = { ...busy.value, [u.email]: true };
  const updated = await auth.setModelDeveloper(u.email, value);
  if (updated) {
    u.modelDeveloper = updated.modelDeveloper;
    // Reflect immediately if the admin changed their own flag.
    if (auth.user && auth.user.email === u.email) {
      auth.user.modelDeveloper = updated.modelDeveloper;
    }
  } else {
    u.modelDeveloper = !value; // revert the switch on failure
  }
  busy.value = { ...busy.value, [u.email]: false };
}
</script>

<template>
  <span class="inline-flex items-center">
    <Button
      v-tooltip.top="'Manage users'"
      icon="pi pi-users"
      aria-label="Manage users"
      severity="secondary"
      size="small"
      @click="open"
    />

    <Dialog v-model:visible="show" modal header="Users" :style="{ width: '34rem' }">
      <div class="flex flex-col gap-2">
        <div v-if="loading" class="text-sm opacity-70 py-4 text-center">loading…</div>
        <template v-else>
          <div
            class="flex items-center gap-3 px-3 pb-1 text-xs uppercase tracking-wide opacity-60"
          >
            <span class="flex-1">User</span>
            <span>Model developer</span>
          </div>
          <div
            v-for="u in users"
            :key="u.email"
            class="flex items-center gap-3 rounded border border-surface-700 px-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">
                {{ u.name || u.email }}
                <span v-if="u.admin" class="ml-1 text-xs text-primary-400">(admin)</span>
              </div>
              <div class="text-xs opacity-70 truncate">{{ u.email }}</div>
            </div>
            <ToggleSwitch
              :model-value="u.modelDeveloper"
              :disabled="busy[u.email]"
              @update:model-value="(v: boolean) => toggle(u, v)"
            />
          </div>
          <p v-if="auth.error" class="text-sm text-red-400">{{ auth.error }}</p>
        </template>
      </div>
    </Dialog>
  </span>
</template>
