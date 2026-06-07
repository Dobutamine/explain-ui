<script setup lang="ts">
import { ref, onMounted } from "vue";
import Knob from "primevue/knob";
import ToggleSwitch from "primevue/toggleswitch";
import Panel from "primevue/panel";
import { useExplain } from "@/composables/useExplain";

// ECLS device dashboard. Knobs drive the well-bounded resistance-factor
// multipliers; the clamp toggle gates flow.
const { model, setProp } = useExplain();

const KNOBS = [
  { p: "pump_res_factor", label: "Pump R×" },
  { p: "oxy_res_factor", label: "Oxy R×" },
  { p: "drainage_res_factor", label: "Drain R×" },
  { p: "return_res_factor", label: "Return R×" },
];

const vals = ref<Record<string, number>>({});
const clamped = ref(false);

onMounted(() => {
  const e = (model as any).modelState?.models?.Ecls;
  if (!e) return;
  clamped.value = !!e.ecls_clamped;
  for (const k of KNOBS) vals.value[k.p] = e[k.p] ?? 1;
});

function onKnob(p: string, v: number) {
  vals.value[p] = v;
  setProp(`Ecls.${p}`, v, 0);
}
function onClamp(v: boolean) {
  clamped.value = v;
  setProp("Ecls.ecls_clamped", v, 0);
}
</script>

<template>
  <Panel header="ECLS" toggleable>
    <div class="flex flex-col gap-3">
      <label class="text-sm flex items-center gap-2">
        clamped
        <ToggleSwitch :model-value="clamped" @update:model-value="onClamp" />
      </label>
      <div class="flex gap-4 flex-wrap">
      <div v-for="k in KNOBS" :key="k.p" class="flex flex-col items-center">
        <Knob
          :model-value="vals[k.p]"
          :min="0"
          :max="5"
          :step="0.1"
          @update:model-value="(v:number) => onKnob(k.p, v)"
        />
        <div class="text-xs opacity-70 mt-1">{{ k.label }}</div>
      </div>
      </div>
    </div>
  </Panel>
</template>
