<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import Panel from "primevue/panel";
import { useExplain } from "@/composables/useExplain";

// Generic, reusable numeric readout panel. Driven by a model-definition
// `configuration.monitors` group (or any equivalent list). Each parameter:
//   { label, unit, factor, rounding, props: [path, ...], weight_based }
// Values come from the ~1 Hz slow stream; a parameter listing two props is
// shown as "a/b" (e.g. systolic/diastolic). The same component renders every
// monitor group — see MainPage where it is v-for'd over the definition's
// monitors. Mirrors the styling of the hand-built Monitor / Blood gas panels.

interface MonitorParam {
  label: string;
  unit?: string;
  factor?: number;
  rounding?: number;
  props?: string[];
  weight_based?: boolean;
}

const props = defineProps<{
  title: string;
  parameters: MonitorParam[];
  collapsed?: boolean;
}>();

const { slowValues, modelState, watchSlow } = useExplain();

// subscribe every path this panel needs to the slow watchlist. The engine side
// accumulates + dedups, so several panels coexist without clobbering.
function subscribe() {
  const paths = new Set<string>();
  for (const p of props.parameters ?? []) {
    for (const path of p.props ?? []) paths.add(path);
  }
  if (paths.size) watchSlow([...paths]);
}
onMounted(subscribe);
watch(() => props.parameters, subscribe); // re-subscribe when the group changes

const latest = computed(() => {
  const arr = slowValues.value as any[];
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
});

const weight = computed(() => {
  const w = (modelState.value as any)?.weight;
  return typeof w === "number" && w > 0 ? w : 1;
});

function fmt(param: MonitorParam): string {
  const paths = param.props ?? [];
  if (!paths.length) return "—";
  return paths
    .map((path) => {
      let v = latest.value?.[path];
      if (typeof v !== "number") return "—";
      v *= param.factor ?? 1;
      if (param.weight_based) v /= weight.value;
      return v.toFixed(param.rounding ?? 0);
    })
    .join("/");
}

// local collapse state seeded from the prop so the user can still toggle it
const collapsedState = ref(props.collapsed ?? false);
watch(
  () => props.collapsed,
  (v) => (collapsedState.value = v ?? false),
);
</script>

<template>
  <Panel :header="title" toggleable v-model:collapsed="collapsedState">
    <div class="grid grid-cols-4 gap-1">
      <div
        v-for="p in parameters"
        :key="p.label"
        class="border border-surface-600 bg-surface-800/40 rounded p-1 text-center"
      >
        <div class="text-[10px] leading-tight opacity-60 truncate">{{ p.label }}</div>
        <div class="text-base font-semibold tabular-nums">{{ fmt(p) }}</div>
        <div class="text-[10px] leading-tight opacity-50">{{ p.unit }}</div>
      </div>
    </div>
  </Panel>
</template>
