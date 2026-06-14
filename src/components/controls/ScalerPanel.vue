<script setup lang="ts">
import { ref } from "vue";
import Select from "primevue/select";
import InputNumber from "primevue/inputnumber";
import Button from "primevue/button";
import Panel from "primevue/panel";
import { useExplain } from "@/composables/useExplain";

// Allometric / group scaling via the engine's ModelScaler (Model.scaleModel).
const { scale, refreshState } = useExplain();

const GROUPS = [
  "weight_scale",
  "blood_volume",
  "heart_volume",
  "lung_volume",
  "systemic_resistances",
  "systemic_elastances",
  "pulmonary_resistances",
  "pulmonary_elastances",
  "heart_el_min",
  "heart_el_max",
];

const group = ref<string>("blood_volume");
const factor = ref<number>(1.0);

function apply() {
  scale(group.value, factor.value);
  refreshState();
}
function reset() {
  scale("reset");
  refreshState();
}
</script>

<template>
  <Panel toggleable>
    <template #header>
      <span class="font-semibold">Scaler</span>
    </template>

    <div class="flex flex-col gap-3">
      <Select v-model="group" :options="GROUPS" class="w-full" />
      <div class="flex items-center gap-2">
        <InputNumber
          v-model="factor"
          :step="0.05"
          :max-fraction-digits="3"
          size="small"
          class="w-32"
        />
        <Button label="Apply" size="small" @click="apply" />
        <Button label="Reset" size="small" severity="secondary" @click="reset" />
      </div>
    </div>
  </Panel>
</template>
