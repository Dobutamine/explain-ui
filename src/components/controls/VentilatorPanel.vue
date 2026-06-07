<script setup lang="ts">
import { ref, onMounted } from "vue";
import Knob from "primevue/knob";
import ToggleSwitch from "primevue/toggleswitch";
import Panel from "primevue/panel";
import { useExplain } from "@/composables/useExplain";

// Knob-based device dashboard (the place PrimeVue's Knob fits, vs InputNumber in
// the generic ModelEditor). Drives the Ventilator model directly.
const { model, setProp } = useExplain();

const KNOBS = [
  { p: "vent_rate", label: "Rate /min", min: 0, max: 80, step: 1 },
  { p: "insp_time", label: "Tinsp s", min: 0.1, max: 1.5, step: 0.05 },
  { p: "tidal_volume", label: "Vt mL", min: 0, max: 50, step: 0.5 },
];

const vals = ref<Record<string, number>>({});
const enabled = ref(false);

onMounted(() => {
  const v = (model as any).modelState?.models?.Ventilator;
  if (!v) return;
  enabled.value = !!v.is_enabled;
  for (const k of KNOBS) vals.value[k.p] = v[k.p] ?? 0;
});

function onKnob(p: string, v: number) {
  vals.value[p] = v;
  setProp(`Ventilator.${p}`, v, 0);
}
function onEnable(v: boolean) {
  enabled.value = v;
  setProp("Ventilator.is_enabled", v, 0);
}
</script>

<template>
  <Panel header="Ventilator" toggleable>
    <div class="flex flex-col gap-3">
      <label class="flex items-center gap-2 text-sm">
        enabled
        <ToggleSwitch :model-value="enabled" @update:model-value="onEnable" />
      </label>
      <div class="flex gap-4 flex-wrap" :class="{ 'opacity-40 pointer-events-none': !enabled }">
      <div v-for="k in KNOBS" :key="k.p" class="flex flex-col items-center">
        <Knob
          :model-value="vals[k.p]"
          :min="k.min"
          :max="k.max"
          :step="k.step"
          :value-template="`{value}`"
          @update:model-value="(v:number) => onKnob(k.p, v)"
        />
        <div class="text-xs opacity-70 mt-1">{{ k.label }}</div>
      </div>
      </div>
    </div>
  </Panel>
</template>
