<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from "vue";
import Select from "primevue/select";
import { useRealtimeBus } from "@/composables/useRealtimeBus";
import { useExplain } from "@/composables/useExplain";
import { MonitorRenderer, type MonitorLane } from "@/render/MonitorRenderer";

// Bedside patient-monitor host. Streams the Monitor model's purpose-built
// waveform signals (fast chart channel) into a single sweep canvas, and feeds
// the big numerics from the 1 Hz slow stream (rts). Waveforms never touch Vue
// reactivity; only the slow numerics do (safe at ~1 Hz, like NumericsPanel).
const el = ref<HTMLDivElement | null>(null);
const { addRenderer, removeRenderer } = useRealtimeBus();
const { watch: watchProps, watchSlow, slowValues } = useExplain();
let adapter: MonitorRenderer | null = null;

// format a slow-stream value, "—" when absent
const f = (n: Record<string, number>, p: string, d: number) => {
  const v = n[p];
  return typeof v === "number" ? v.toFixed(d) : "—";
};

// Lane definitions: waveform signal + colour + numeric readout. ABP uses the
// post-ductal (AD) numerics to match the AD pressure waveform.
const LANES: MonitorLane[] = [
  {
    signal: "Monitor.ecg_signal",
    label: "ECG",
    color: "#4ade80",
    unit: "bpm",
    readNumeric: (n) => f(n, "Monitor.heart_rate", 0),
  },
  {
    signal: "Monitor.sao2_pre_signal",
    label: "SpO₂ pre",
    color: "#22d3ee",
    unit: "%",
    fill: true,
    readNumeric: (n) => f(n, "Monitor.sao2_pre", 0),
  },
  {
    signal: "Monitor.sao2_post_signal",
    label: "SpO₂ post",
    color: "#38bdf8",
    unit: "%",
    fill: true,
    readNumeric: (n) => f(n, "Monitor.sao2_post", 0),
  },
  {
    signal: "Monitor.abp_signal",
    label: "ABP",
    color: "#f87171",
    unit: "mmHg",
    readNumeric: (n) =>
      `${f(n, "Monitor.abp_post_syst", 0)}/${f(n, "Monitor.abp_post_diast", 0)}`,
    readSub: (n) => `(${f(n, "Monitor.abp_post_mean", 0)})`,
  },
  {
    signal: "Monitor.resp_signal",
    label: "Resp",
    color: "#e5e7eb",
    unit: "/min",
    readNumeric: (n) => f(n, "Monitor.resp_rate", 0),
  },
  {
    signal: "Monitor.co2_signal",
    label: "CO₂",
    color: "#facc15",
    unit: "kPa",
    fill: true,
    readNumeric: (n) => f(n, "Monitor.etco2", 1),
  },
];

const FAST_PATHS = LANES.map((l) => l.signal);
const SLOW_PATHS = [
  "Monitor.heart_rate",
  "Monitor.sao2_pre",
  "Monitor.sao2_post",
  "Monitor.abp_post_syst",
  "Monitor.abp_post_diast",
  "Monitor.abp_post_mean",
  "Monitor.resp_rate",
  "Monitor.etco2",
];

// sweep window (full left→right travel time)
const WINDOW_OPTIONS = [
  { label: "4 s", value: 4 },
  { label: "6 s", value: 6 },
  { label: "8 s", value: 8 },
  { label: "12 s", value: 12 },
];
const windowS = ref(6);

const latest = computed<Record<string, number>>(() => {
  const arr = slowValues.value as any[];
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : {};
});

watch(windowS, (v) => adapter?.setWindow(v));
watch(latest, (n) => adapter?.setNumerics(n));

onMounted(() => {
  adapter = new MonitorRenderer(el.value!, LANES, windowS.value);
  addRenderer(adapter);
  watchProps(FAST_PATHS); // stream the waveform signals (additive)
  watchSlow(SLOW_PATHS); // numerics on the slow stream
  adapter.setNumerics(latest.value);
});

onBeforeUnmount(() => {
  if (adapter) {
    removeRenderer(adapter);
    adapter.dispose();
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-end gap-1.5 text-xs">
      <span class="opacity-60">sweep</span>
      <Select
        v-model="windowS"
        :options="WINDOW_OPTIONS"
        option-label="label"
        option-value="value"
        size="small"
        class="w-20"
      />
    </div>
    <div
      ref="el"
      class="w-full rounded overflow-hidden"
      style="height: 70vh; min-height: 480px; background: #0a0e14"
    ></div>
  </div>
</template>
