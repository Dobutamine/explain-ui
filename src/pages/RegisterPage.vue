<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, RouterLink } from "vue-router";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";
import { useAuthStore } from "@/stores/auth";

// Open self-registration. Creates a non-admin account and (on success) the server
// signs the user in via the session cookie, so we route straight into the app.

const auth = useAuthStore();
const router = useRouter();

const name = ref("");
const email = ref("");
const institution = ref("");
const password = ref("");
const confirm = ref("");

const MIN_PASSWORD = 8;
const mismatch = computed(
  () => confirm.value.length > 0 && password.value !== confirm.value,
);
const canSubmit = computed(
  () =>
    !!name.value.trim() &&
    !!email.value.trim() &&
    password.value.length >= MIN_PASSWORD &&
    password.value === confirm.value &&
    auth.status !== "loading",
);

// Already signed in? Skip straight to the app.
onMounted(async () => {
  if (!auth.ready) await auth.fetchMe();
  if (auth.isAuthenticated) router.replace("/");
});

async function submit() {
  if (!canSubmit.value) return;
  const ok = await auth.register({
    name: name.value.trim(),
    email: email.value.trim(),
    institution: institution.value.trim(),
    password: password.value,
  });
  if (ok) router.replace("/");
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-surface-950">
    <div
      class="w-full max-w-sm flex flex-col gap-6 rounded-xl border border-surface-700 bg-surface-900 px-7 py-8 shadow-lg"
    >
      <div class="flex flex-col items-center gap-3">
        <img src="/logo/explain-labs-logo.svg" alt="Explain Labs" class="h-16 w-auto" />
        <h1 class="text-lg font-medium text-surface-100">Create your account</h1>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <label for="name" class="text-sm text-surface-300">Name</label>
          <InputText
            id="name"
            v-model="name"
            autocomplete="name"
            class="w-full"
            :disabled="auth.status === 'loading'"
            autofocus
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="email" class="text-sm text-surface-300">Email</label>
          <InputText
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            placeholder="you@example.com"
            class="w-full"
            :disabled="auth.status === 'loading'"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="institution" class="text-sm text-surface-300">Institution</label>
          <InputText
            id="institution"
            v-model="institution"
            autocomplete="organization"
            class="w-full"
            :disabled="auth.status === 'loading'"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="password" class="text-sm text-surface-300">
            Password <span class="opacity-60">(min {{ MIN_PASSWORD }} characters)</span>
          </label>
          <Password
            input-id="password"
            v-model="password"
            :feedback="false"
            toggle-mask
            input-class="w-full"
            class="w-full"
            :input-props="{ autocomplete: 'new-password' }"
            :disabled="auth.status === 'loading'"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="confirm" class="text-sm text-surface-300">Confirm password</label>
          <Password
            input-id="confirm"
            v-model="confirm"
            :feedback="false"
            toggle-mask
            input-class="w-full"
            class="w-full"
            :input-props="{ autocomplete: 'new-password' }"
            :disabled="auth.status === 'loading'"
          />
          <span v-if="mismatch" class="text-sm text-red-400">passwords do not match</span>
        </div>

        <p v-if="auth.error" class="text-sm text-red-400" role="alert">
          {{ auth.error }}
        </p>

        <Button
          type="submit"
          label="Create account"
          class="w-full"
          :loading="auth.status === 'loading'"
          :disabled="!canSubmit"
        />
      </form>

      <p class="text-center text-sm text-surface-400">
        Already have an account?
        <RouterLink to="/login" class="text-primary-400 hover:underline">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>
