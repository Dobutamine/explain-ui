<script setup lang="ts">
import { ref, computed } from "vue";
import Select from "primevue/select";
import Button from "primevue/button";
import Panel from "primevue/panel";
import { useExplain } from "@/composables/useExplain";

// On-demand blood-gas analysis: the engine computes po2/pco2/ph/... for a chosen
// blood compartment, then we refresh state and display the result.
const { modelState, bloodComposition, refreshState } = useExplain();

const selected = ref<string | null>(null);
const collapsed = ref(true); // start collapsed

const bloodModels = computed(() => {
  const m = (modelState.value as any)?.models;
  if (!m) return [];
  return Object.keys(m)
    .filter((n) => m[n] && "to2" in m[n] && "po2" in m[n])
    .sort();
});

const GASES = [
  { p: "po2", label: "pO₂", unit: "mmHg", d: 1 },
  { p: "pco2", label: "pCO₂", unit: "mmHg", d: 1 },
  { p: "ph", label: "pH", unit: "", d: 2 },
  { p: "so2", label: "sO₂", unit: "", d: 2 },
  { p: "hco3", label: "HCO₃", unit: "mmol/L", d: 1 },
  { p: "be", label: "BE", unit: "mmol/L", d: 1 },
];

function calc() {
  if (!selected.value) return;
  bloodComposition(selected.value);
  refreshState();
}

function val(p: string, d: number) {
  const m = (modelState.value as any)?.models?.[selected.value as string];
  const v = m?.[p];
  return typeof v === "number" && v >= 0 ? v.toFixed(d) : "—";
}
</script>

<template>
  <Panel header="Bloodgas" toggleable v-model:collapsed="collapsed">
    <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <Select
        v-model="selected"
        :options="bloodModels"
        filter
        placeholder="Compartment"
        class="w-48"
      />
      <Button label="Analyze" size="small" :disabled="!selected" @click="calc" />
    </div>
    <div v-if="selected" class="grid grid-cols-3 gap-2">
      <div v-for="g in GASES" :key="g.p" class="border border-surface-700 rounded p-2 text-center">
        <div class="text-xs opacity-60">{{ g.label }}</div>
        <div class="text-lg font-semibold tabular-nums">{{ val(g.p, g.d) }}</div>
        <div class="text-xs opacity-50">{{ g.unit }}</div>
      </div>
    </div>
    </div>
  </Panel>
</template>
