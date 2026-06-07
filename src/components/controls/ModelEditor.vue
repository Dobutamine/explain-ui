<script setup lang="ts">
import { ref, computed, watch, reactive } from "vue";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import ToggleSwitch from "primevue/toggleswitch";
import Slider from "primevue/slider";
import Button from "primevue/button";
import Panel from "primevue/panel";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import { useExplain } from "@/composables/useExplain";
import {
  useModelInterface,
  groupByEditMode,
  type InterfaceField,
} from "@/composables/useModelInterface";

// Fully generic, model_interface-driven editor. Pick any model instance and the
// component renders the right control for every field its engine class declares
// in `static model_interface`, grouped by edit_mode. Edits are pushed to the
// engine via setPropValue / callModelFunction and take effect live.
//
// Value freshness: we snapshot the model's current values into a local editable
// copy when the selection changes or a fresh state snapshot arrives (model
// rebuild, or the "Refresh values" button → refreshState()). This avoids wiring
// a per-property async read path; mid-edit values are not overwritten unless one
// of those events fires.
const { modelState, setProp, call, refreshState } = useExplain();
const { getInterface } = useModelInterface();

const selected = ref<string | null>(null);
const local = ref<Record<string, any>>({});
// per-function argument buffers, keyed by function target → { argTarget: uiValue }
const fnArgs = reactive<Record<string, Record<string, any>>>({});

const modelNames = computed(() => {
  const m = (modelState.value as any)?.models;
  return m ? Object.keys(m).sort() : [];
});

// the raw engine state for the selected model (source of truth for values)
function instance(name: string | null): any {
  if (!name) return null;
  return (modelState.value as any)?.models?.[name] ?? null;
}

const fields = computed<InterfaceField[]>(() =>
  selected.value ? getInterface(selected.value) : [],
);
const groups = computed(() => groupByEditMode(fields.value));
// open the Basic section by default
const openSections = ref<string[]>(["basic"]);

const numFactor = (f: InterfaceField) => f.factor ?? 1;
const toDisplay = (f: InterfaceField, raw: number) =>
  typeof raw === "number" ? raw * numFactor(f) : raw;
const toRaw = (f: InterfaceField, ui: number) => ui / numFactor(f);

// (re)load the editable snapshot + seed function-argument buffers
function syncLocal(name: string | null) {
  local.value = {};
  for (const k of Object.keys(fnArgs)) delete fnArgs[k];
  const m = instance(name);
  if (!m) return;
  for (const f of getInterface(name!)) {
    if (f.type === "function") {
      const buf: Record<string, any> = {};
      for (const a of f.args ?? []) {
        const d = a.default ?? (a.type === "boolean" ? false : a.type === "number" ? 0 : "");
        buf[a.target] = a.type === "number" ? toDisplay(a, d as number) : d;
      }
      fnArgs[f.target] = buf;
      continue;
    }
    if (f.target in m) {
      local.value[f.target] =
        f.type === "number" || f.type === "factor"
          ? toDisplay(f, m[f.target])
          : m[f.target];
    }
  }
}

watch(selected, (name) => syncLocal(name));
// a new state snapshot (rebuild / refresh) → re-sync the currently selected model
watch(modelState, () => selected.value && syncLocal(selected.value));

function path(target: string) {
  return `${selected.value}.${target}`;
}

function onNumber(f: InterfaceField, v: number | null) {
  if (v == null) return;
  local.value[f.target] = v;
  setProp(path(f.target), toRaw(f, v), 0);
}
function onBool(f: InterfaceField, v: boolean) {
  local.value[f.target] = v;
  setProp(path(f.target), v, 0);
}
function onList(f: InterfaceField, v: string) {
  local.value[f.target] = v;
  setProp(path(f.target), v, 0);
}
function onMultiList(f: InterfaceField, v: string[]) {
  local.value[f.target] = v;
  setProp(path(f.target), v, 0);
}
function onPropList(f: InterfaceField) {
  // write both the model-name prop and the property-name prop
  if (f.target_model) setProp(path(f.target_model), local.value[f.target_model], 0);
  if (f.target_prop) setProp(path(f.target_prop), local.value[f.target_prop], 0);
}

// list options: literal choices override model-type options when custom_options
function listOptions(f: InterfaceField): string[] {
  return (f.custom_options ? f.choices : f.options) ?? f.choices ?? f.options ?? [];
}
// instances whose model_type is one of the field's allowed types
function instancesOfTypes(types: string[] | undefined): string[] {
  const m = (modelState.value as any)?.models ?? {};
  if (!types?.length) return Object.keys(m).sort();
  return Object.keys(m)
    .filter((n) => types.includes(m[n]?.model_type))
    .sort();
}
// property names available on a chosen model (for prop-list), excluding internals
function propsOf(modelName: string | undefined): string[] {
  const m = modelName ? instance(modelName) : null;
  if (!m) return [];
  return Object.keys(m)
    .filter((k) => !k.startsWith("_") && k !== "model_interface")
    .sort();
}

function callFunction(f: InterfaceField) {
  const args = (f.args ?? []).map((a) => {
    const v = fnArgs[f.target]?.[a.target];
    return a.type === "number" ? toRaw(a, v as number) : v;
  });
  call(path(f.target), args, 0);
}

function refresh() {
  refreshState();
}
</script>

<template>
  <Panel header="Model editor" toggleable>
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Select
          v-model="selected"
          :options="modelNames"
          filter
          placeholder="Select a model"
          class="flex-1"
        />
        <Button
          v-tooltip.top="'Refresh values from engine'"
          icon="pi pi-refresh"
          severity="secondary"
          size="small"
          :disabled="!selected"
          @click="refresh"
        />
      </div>

      <div v-if="selected && groups.length" class="max-h-[32rem] overflow-auto pr-1">
        <Accordion :value="openSections" multiple>
          <AccordionPanel v-for="g in groups" :key="g.mode" :value="g.mode">
            <AccordionHeader>{{ g.label }}</AccordionHeader>
            <AccordionContent>
              <div class="flex flex-col gap-3 pt-1">
                <div
                  v-for="f in g.fields"
                  :key="f.target"
                  class="flex items-start justify-between gap-2"
                >
                  <label class="text-sm opacity-80 pt-1 flex-1">
                    {{ f.caption || f.target }}
                  </label>

                  <!-- number / factor: slider or spinner, with factor scaling -->
                  <div
                    v-if="f.type === 'number' || f.type === 'factor'"
                    class="flex items-center gap-2 w-24"
                  >
                    <template v-if="f.slider">
                      <Slider
                        :model-value="local[f.target]"
                        :disabled="f.readonly"
                        :min="f.ll"
                        :max="f.ul"
                        :step="f.delta || 1"
                        class="flex-1"
                        @update:model-value="(v: number | number[]) => onNumber(f, v as number)"
                      />
                      <span class="text-xs opacity-70 w-10 text-right">
                        {{ Number(local[f.target] ?? 0).toFixed(f.rounding ?? 0) }}
                      </span>
                    </template>
                    <InputNumber
                      v-else
                      :model-value="local[f.target]"
                      :disabled="f.readonly"
                      :min="f.ll"
                      :max="f.ul"
                      :step="f.delta || 1"
                      :max-fraction-digits="f.rounding ?? 4"
                      size="small"
                      class="w-24"
                      :input-class="'w-full'"
                      @update:model-value="(v: number) => onNumber(f, v)"
                    />
                  </div>

                  <!-- boolean -->
                  <ToggleSwitch
                    v-else-if="f.type === 'boolean'"
                    :model-value="local[f.target]"
                    :disabled="f.readonly"
                    @update:model-value="(v: boolean) => onBool(f, v)"
                  />

                  <!-- list / enum -->
                  <Select
                    v-else-if="f.type === 'list'"
                    :model-value="local[f.target]"
                    :options="listOptions(f)"
                    :disabled="f.readonly"
                    class="w-44"
                    @update:model-value="(v: string) => onList(f, v)"
                  />

                  <!-- multiple-list: structural wiring (takes effect on rebuild) -->
                  <MultiSelect
                    v-else-if="f.type === 'multiple-list'"
                    :model-value="local[f.target] || []"
                    :options="instancesOfTypes(f.options)"
                    :disabled="f.readonly"
                    filter
                    display="chip"
                    class="w-44"
                    @update:model-value="(v: string[]) => onMultiList(f, v)"
                  />

                  <!-- function: render an input per arg, then a Call button -->
                  <div
                    v-else-if="f.type === 'function'"
                    class="flex flex-col items-end gap-1 w-44"
                  >
                    <template v-for="a in f.args || []" :key="a.target">
                      <InputNumber
                        v-if="a.type === 'number'"
                        :model-value="fnArgs[f.target]?.[a.target]"
                        :min="a.ll"
                        :max="a.ul"
                        :step="a.delta || 1"
                        :max-fraction-digits="a.rounding ?? 4"
                        :placeholder="a.caption || a.target"
                        size="small"
                        class="w-full"
                        @update:model-value="(v: number) => (fnArgs[f.target][a.target] = v)"
                      />
                      <ToggleSwitch
                        v-else-if="a.type === 'boolean'"
                        :model-value="fnArgs[f.target]?.[a.target]"
                        @update:model-value="(v: boolean) => (fnArgs[f.target][a.target] = v)"
                      />
                      <Select
                        v-else-if="a.type === 'list'"
                        :model-value="fnArgs[f.target]?.[a.target]"
                        :options="listOptions(a)"
                        :placeholder="a.caption || a.target"
                        class="w-full"
                        @update:model-value="(v: string) => (fnArgs[f.target][a.target] = v)"
                      />
                    </template>
                    <Button
                      :label="f.caption || f.target"
                      :disabled="f.readonly"
                      size="small"
                      severity="secondary"
                      class="w-full"
                      @click="callFunction(f)"
                    />
                  </div>

                  <!-- prop-list: two dependent selectors (model + property) -->
                  <div
                    v-else-if="f.type === 'prop-list'"
                    class="flex flex-col items-end gap-1 w-44"
                  >
                    <Select
                      :model-value="local[f.target_model || '']"
                      :options="instancesOfTypes(f.options)"
                      :placeholder="f.caption_model || 'model'"
                      filter
                      class="w-full"
                      @update:model-value="(v: string) => { local[f.target_model || ''] = v; onPropList(f); }"
                    />
                    <Select
                      :model-value="local[f.target_prop || '']"
                      :options="propsOf(local[f.target_model || ''])"
                      :placeholder="f.caption_prop || 'property'"
                      filter
                      class="w-full"
                      @update:model-value="(v: string) => { local[f.target_prop || ''] = v; onPropList(f); }"
                    />
                  </div>

                  <!-- string / reference: read-only display -->
                  <InputText
                    v-else-if="f.type === 'string' || f.type === 'reference'"
                    :model-value="String(local[f.target] ?? '')"
                    disabled
                    size="small"
                    class="w-44"
                  />

                  <!-- unknown type: show raw value, read-only -->
                  <span v-else class="text-xs opacity-60 w-44 text-right">
                    {{ local[f.target] }}
                  </span>
                </div>
              </div>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
      </div>

      <p v-else-if="selected" class="text-sm opacity-60">
        This model exposes no editable interface.
      </p>
    </div>
  </Panel>
</template>
