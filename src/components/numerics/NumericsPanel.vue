<script setup lang="ts">
import { computed, onMounted } from "vue";
import Panel from "primevue/panel";
import { useExplain } from "@/composables/useExplain";

// Monitor-style numeric readouts driven by the ~1 Hz slow stream (rts). The
// Monitor device model computes these; we subscribe them to the slow watchlist
// and render the latest sample. (Slow stream → safe to be reactive.)
const { slowValues, watchSlow } = useExplain();

// Each readout has one or two props; two props render as "a/b" (e.g. ABP
// systole/diastole). An optional `mean` prop is shown in parentheses below.
const READOUTS: { props: string[]; mean?: string; label: string; unit: string; d: number }[] = [
  { props: ["Monitor.heart_rate"], label: "HR", unit: "bpm", d: 0 },
  {
    props: ["Monitor.abp_pre_syst", "Monitor.abp_pre_diast"],
    mean: "Monitor.abp_pre_mean",
    label: "ABP",
    unit: "mmHg",
    d: 0,
  },
  { props: ["Monitor.sao2_pre"], label: "SaO2 pre", unit: "%", d: 0 },
  { props: ["Monitor.sao2_post"], label: "SaO2 post", unit: "%", d: 0 },
  { props: ["Monitor.resp_rate"], label: "RR", unit: "/min", d: 0 },
  { props: ["Monitor.etco2"], label: "etCO2", unit: "kPa", d: 1 },
];

onMounted(() => watchSlow(READOUTS.flatMap((r) => (r.mean ? [...r.props, r.mean] : r.props))));

const latest = computed(() => {
  const arr = slowValues.value as any[];
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
});

function one(p: string, d: number) {
  const v = latest.value?.[p];
  return typeof v === "number" ? v.toFixed(d) : "—";
}

function fmt(r: { props: string[]; d: number }) {
  return r.props.map((p) => one(p, r.d)).join("/");
}
</script>

<template>
  <Panel header="Monitor" toggleable>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <div
        v-for="r in READOUTS"
        :key="r.label"
        class="border border-surface-700 rounded p-2 text-center"
      >
        <div class="text-xs opacity-60">{{ r.label }}</div>
        <div class="text-2xl font-semibold tabular-nums whitespace-nowrap">{{ fmt(r) }}</div>
        <div v-if="r.mean" class="text-xs leading-none opacity-60 tabular-nums">
          ({{ one(r.mean, r.d) }})
        </div>
        <div class="text-xs opacity-50">{{ r.unit }}</div>
      </div>
    </div>
  </Panel>
</template>
