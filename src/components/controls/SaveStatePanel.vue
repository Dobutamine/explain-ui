<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import { useExplain } from "@/composables/useExplain";
import { useModelStore } from "@/stores/model";

// Snapshot the engine state to a NAMED scenario file in public/model_definitions/
// (via the dev /api/save-snapshot endpoint), so it can be reloaded from the
// dropdown. Also loads a scenario/state JSON from disk.
const { model, savedState, saveState, loadFromObject } = useExplain();
const store = useModelStore();

const showDialog = ref(false);
const snapName = ref("");
const pendingName = ref<string | null>(null); // set while a save is in flight
const fileInput = ref<HTMLInputElement | null>(null);

function openSaveDialog() {
  snapName.value = (model as any).loadedFileData?.name || store.current || "snapshot";
  showDialog.value = true;
}

function confirmSave() {
  const name = snapName.value.trim();
  if (!name) return;
  pendingName.value = name;
  showDialog.value = false;
  saveState(); // result arrives via the state_saved event → savedState
}

function downloadFallback(name: string, file: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

watch(savedState, async (s) => {
  const name = pendingName.value;
  if (!name || !s) return;
  pendingName.value = null;

  // Wrap the raw engine state as a complete, reloadable scenario file: state
  // under model_definition, plus the diagram/animation/configuration from the
  // currently-loaded file (those don't live in the engine state).
  const base = (model as any).loadedFileData || {};
  const file = {
    name,
    user: base.user,
    description: base.description,
    diagram_definition: base.diagram_definition,
    animation_definition: base.animation_definition,
    configuration: base.configuration,
    model_definition: s,
  };

  try {
    const res = await fetch("/api/save-snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, data: file }),
    });
    if (!res.ok) throw new Error(`save endpoint returned ${res.status}`);
    await store.fetchScenarios(); // refresh the dropdown so the snapshot appears
  } catch (err) {
    // no dev endpoint (e.g. production build) — don't lose the snapshot
    console.error("snapshot save failed; falling back to download", err);
    downloadFallback(name, file);
  }
});

async function onLoad(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  try {
    loadFromObject(JSON.parse(await f.text()));
  } catch (err) {
    console.error("state load failed", err);
  }
  input.value = "";
}
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <Button
      v-tooltip.top="'Save snapshot'"
      icon="pi pi-save"
      aria-label="Save snapshot"
      severity="secondary"
      size="small"
      @click="openSaveDialog"
    />
    <Button
      v-tooltip.top="'Load JSON'"
      icon="pi pi-file-import"
      aria-label="Load JSON"
      severity="secondary"
      size="small"
      @click="fileInput?.click()"
    />
    <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="onLoad" />

    <Dialog v-model:visible="showDialog" modal header="Save snapshot" :style="{ width: '22rem' }">
      <div class="flex flex-col gap-3">
        <label class="text-sm flex flex-col gap-1">
          name
          <InputText v-model="snapName" autofocus @keyup.enter="confirmSave" />
        </label>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" severity="secondary" size="small" @click="showDialog = false" />
          <Button label="Save" size="small" :disabled="!snapName.trim()" @click="confirmSave" />
        </div>
      </div>
    </Dialog>
  </span>
</template>
