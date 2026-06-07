<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from "vue";
import ToggleButton from "primevue/togglebutton";
import ColorPicker from "primevue/colorpicker";
import InputNumber from "primevue/inputnumber";
import Button from "primevue/button";
import Select from "primevue/select";
import { useRealtimeBus } from "@/composables/useRealtimeBus";
import { useExplain } from "@/composables/useExplain";
// type-only import is erased at build; the renderer (and PixiJS) is loaded
// lazily below so Pixi lands in its own async chunk, not the main bundle.
import type { DiagramRenderer as DiagramRendererT } from "@/render/DiagramRenderer";

const el = ref<HTMLDivElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const { addRenderer, removeRenderer } = useRealtimeBus();
const { model, modelState } = useExplain();
let adapter: DiagramRendererT | null = null;

const editMode = ref(false);
const connectMode = ref(false);
const gridOn = ref(false);
const gridSize = ref(20);
const addModel = ref<string | null>(null);
const selectedName = ref<string | null>(null);
const selColor = ref("ffffff");
const selAlpha = ref(1);
const selZ = ref(0);
const selScaleX = ref(1);
const selScaleY = ref(1);
const selRotation = ref(0);

const modelNames = computed(() => {
  const m = (modelState.value as any)?.models;
  return m ? Object.keys(m).sort() : [];
});

async function mountRenderer(diagram: any) {
  if (!diagram || !el.value) return;
  const { DiagramRenderer } = await import("@/render/DiagramRenderer");
  adapter = new DiagramRenderer(el.value, diagram);
  await adapter.init();
  adapter.setSelectCallback((name, comp) => {
    selectedName.value = name;
    if (comp) {
      selColor.value = String(comp.layout.sprite.color || "#ffffff").replace("#", "");
      selAlpha.value = comp.layout.general.alpha ?? 1;
      selZ.value = comp.layout.general.z_index ?? 0;
      selScaleX.value = comp.layout.sprite.scale.x ?? 1;
      selScaleY.value = comp.layout.sprite.scale.y ?? 1;
      selRotation.value = comp.layout.sprite.rotation ?? 0;
    }
  });
  if (editMode.value) adapter.setEditMode(true);
  // reflect the diagram's own grid settings in the toolbar
  gridOn.value = diagram?.settings?.grid === true;
  if (diagram?.settings?.gridSize > 0) gridSize.value = diagram.settings.gridSize;
  addRenderer(adapter);
}

function teardown() {
  if (adapter) {
    removeRenderer(adapter);
    adapter.dispose();
    adapter = null;
  }
}

onMounted(() => mountRenderer((model as any).loadedFileData?.diagram_definition));
onBeforeUnmount(teardown);

function toggleEdit(on: boolean) {
  adapter?.setEditMode(on);
}
function patch(p: any) {
  if (adapter && selectedName.value) adapter.applyLayoutPatch(selectedName.value, p);
}
function deleteSelected() {
  adapter?.deleteSelected();
  selectedName.value = null;
}
async function addCompartment() {
  if (adapter && addModel.value) await adapter.addCompartment(addModel.value);
}
function toggleConnect(on: boolean) {
  adapter?.setConnectMode(on);
}
function toggleGrid(on: boolean) {
  adapter?.setGrid(on);
}
function changeGridSize(size: number | null) {
  if (size && size > 0) adapter?.setGridSize(size);
}
function exportJson() {
  if (!adapter) return;
  download(JSON.stringify(adapter.getDiagram(), null, 2), "diagram_definition.json");
}
async function onImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  try {
    const parsed = JSON.parse(await f.text());
    const dd = parsed.diagram_definition || parsed; // accept diagram or scenario JSON
    teardown();
    await mountRenderer(dd);
  } catch (err) {
    console.error("diagram import failed", err);
  }
  input.value = "";
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 flex-wrap">
      <ToggleButton
        v-model="editMode"
        on-label="Editing"
        off-label="Edit"
        size="small"
        @update:model-value="toggleEdit"
      />
      <template v-if="editMode">
        <span v-if="selectedName" class="text-sm opacity-80">
          selected: <b>{{ selectedName }}</b>
        </span>
        <Button
          v-if="selectedName"
          label="Delete"
          size="small"
          severity="danger"
          @click="deleteSelected"
        />
        <Button label="Export JSON" size="small" severity="secondary" @click="exportJson" />
        <Button label="Import JSON" size="small" severity="secondary" @click="fileInput?.click()" />
        <input
          ref="fileInput"
          type="file"
          accept="application/json"
          class="hidden"
          @change="onImport"
        />
        <span class="mx-1 opacity-40">|</span>
        <Select
          v-model="addModel"
          :options="modelNames"
          filter
          placeholder="model"
          class="w-40"
        />
        <Button label="Add" size="small" :disabled="!addModel" @click="addCompartment" />
        <ToggleButton
          v-model="connectMode"
          on-label="Connecting"
          off-label="Connect"
          size="small"
          @update:model-value="toggleConnect"
        />
        <span class="mx-1 opacity-40">|</span>
        <ToggleButton
          v-model="gridOn"
          on-label="Grid on"
          off-label="Grid"
          size="small"
          @update:model-value="toggleGrid"
        />
        <InputNumber
          v-if="gridOn"
          v-model="gridSize"
          :step="5"
          :min="2"
          suffix=" px"
          size="small"
          class="w-24"
          @update:model-value="changeGridSize"
        />
      </template>
    </div>

    <div
      v-if="editMode && selectedName"
      class="flex items-center gap-3 flex-wrap text-sm border border-surface-700 rounded p-2"
    >
      <label
        v-tooltip.top="'Sprite colour — the fixed tint used when oxygenation tinting is off'"
        class="flex items-center gap-1"
      >
        color
        <ColorPicker
          v-model="selColor"
          @update:model-value="patch({ sprite: { color: '#' + selColor } })"
        />
      </label>
      <label
        v-tooltip.top="'Opacity — 0 is fully transparent, 1 is fully opaque'"
        class="flex items-center gap-1"
      >
        alpha
        <InputNumber
          v-model="selAlpha"
          :step="0.1"
          :min="0"
          :max="1"
          :max-fraction-digits="2"
          size="small"
          class="w-20"
          @update:model-value="patch({ general: { alpha: selAlpha } })"
        />
      </label>
      <label
        v-tooltip.top="'Z-index — stacking order; higher values are drawn on top of lower ones'"
        class="flex items-center gap-1"
      >
        z
        <InputNumber
          v-model="selZ"
          :step="1"
          size="small"
          class="w-16"
          @update:model-value="patch({ general: { z_index: selZ } })"
        />
      </label>
      <label
        v-tooltip.top="'Horizontal size multiplier of the sprite (1 = native width)'"
        class="flex items-center gap-1"
      >
        scale x
        <InputNumber
          v-model="selScaleX"
          :step="0.1"
          :max-fraction-digits="2"
          size="small"
          class="w-20"
          @update:model-value="patch({ sprite: { scale: { x: selScaleX, y: selScaleY } } })"
        />
      </label>
      <label
        v-tooltip.top="'Vertical size multiplier of the sprite (1 = native height)'"
        class="flex items-center gap-1"
      >
        scale y
        <InputNumber
          v-model="selScaleY"
          :step="0.1"
          :max-fraction-digits="2"
          size="small"
          class="w-20"
          @update:model-value="patch({ sprite: { scale: { x: selScaleX, y: selScaleY } } })"
        />
      </label>
      <label
        v-tooltip.top="'Rotation of the sprite, in radians'"
        class="flex items-center gap-1"
      >
        rot
        <InputNumber
          v-model="selRotation"
          :step="0.1"
          :max-fraction-digits="2"
          size="small"
          class="w-20"
          @update:model-value="patch({ sprite: { rotation: selRotation } })"
        />
      </label>
    </div>

    <div
      ref="el"
      class="diagram"
      style="width: 100%; height: 65vh; min-height: 480px; position: relative"
    ></div>
  </div>
</template>
