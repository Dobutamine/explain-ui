<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import InputNumber from "primevue/inputnumber";
import ToggleSwitch from "primevue/toggleswitch";
import Slider from "primevue/slider";
import Panel from "primevue/panel";
import { useExplain } from "@/composables/useExplain";

// Bespoke pregnancy / labor console for the Uterus + MaternalPlacenta models.
// All controls are plain config props (no setter side-effects like the
// ventilator's set_fio2), so writes go straight through setProp(). The panel
// self-disables when no Uterus model is present in the loaded scenario.
//
// Live measured read-outs come off the ~1 Hz slow stream (watchSlow),
// re-registered on every (re)build since build() resets the DataCollector
// watchlist.
const { modelState, slowValues, setProp, watchSlow, modelReady } = useExplain();

interface Field {
  m: "Uterus" | "MaternalPlacenta"; // owning model
  p: string; // model property
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  rounding: number;
}

// Contraction / labor settings (shown when contractions are running).
const LABOR_FIELDS: Field[] = [
  { m: "Uterus", p: "contraction_period", label: "Period", unit: "s", min: 30, max: 600, step: 10, rounding: 0 },
  { m: "Uterus", p: "contraction_duration", label: "Duration", unit: "s", min: 10, max: 180, step: 5, rounding: 0 },
  { m: "Uterus", p: "contraction_amplitude", label: "Amplitude", unit: "mmHg", min: 0, max: 120, step: 5, rounding: 0 },
  { m: "Uterus", p: "resting_tone", label: "Resting tone", unit: "mmHg", min: 0, max: 30, step: 1, rounding: 0 },
];

const pregnant = ref(false);
const couplePlacenta = ref(false);
const contractions = ref(false);
const pregGa = ref(0);
// editable display values keyed by field prop
const vals = ref<Record<string, number>>({});

const SLOW_PATHS = [
  "Uterus.ut_blood_flow",
  "Uterus.iup",
  "Uterus.montevideo_units",
  "Uterus.ut_o2er",
  "MaternalPlacenta.mp_blood_flow",
  "MaternalPlacenta.mp_flow_fraction",
  "MaternalPlacenta.mp_o2er",
];

const latest = computed<Record<string, number>>(() => {
  const arr = slowValues.value as any[];
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : {};
});

function fmt(v: number | undefined, digits: number, scale = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v * scale).toFixed(digits);
}

const measured = computed(() => {
  const l = latest.value;
  return [
    { label: "Ut flow", value: fmt(l["Uterus.ut_blood_flow"], 0), unit: "mL/min" },
    { label: "Pl flow", value: fmt(l["MaternalPlacenta.mp_blood_flow"], 0), unit: "mL/min" },
    { label: "Pl share", value: fmt(l["MaternalPlacenta.mp_flow_fraction"], 0), unit: "%" },
    { label: "Ut O₂ER", value: fmt(l["Uterus.ut_o2er"], 0), unit: "%" },
    { label: "Pl O₂ER", value: fmt(l["MaternalPlacenta.mp_o2er"], 0), unit: "%" },
    { label: "IUP", value: fmt(l["Uterus.iup"], 0), unit: "mmHg" },
    { label: "MVU", value: fmt(l["Uterus.montevideo_units"], 0), unit: "" },
  ];
});

// pull a fresh editable snapshot from engine state (mount / rebuild / refresh)
function syncLocal() {
  const u = (modelState.value as any)?.models?.Uterus;
  if (!u) return;
  pregnant.value = !!u.pregnant;
  couplePlacenta.value = !!u.couple_placenta;
  contractions.value = !!u.contractions_running;
  pregGa.value = typeof u.preg_ga === "number" ? u.preg_ga : 0;
  const models: Record<string, any> = {
    Uterus: u,
    MaternalPlacenta: (modelState.value as any)?.models?.MaternalPlacenta,
  };
  for (const f of LABOR_FIELDS) {
    const raw = models[f.m]?.[f.p];
    if (typeof raw === "number") vals.value[f.p] = raw;
  }
}

watch(modelState, syncLocal);
// build() resets the DataCollector watchlist — re-register on every (re)build
watch(modelReady, (ready) => {
  if (ready) watchSlow(SLOW_PATHS);
});

onMounted(() => {
  watchSlow(SLOW_PATHS);
  syncLocal();
});

function onField(f: Field, v: number | null) {
  if (v == null) return;
  vals.value[f.p] = v;
  setProp(`${f.m}.${f.p}`, v, 0);
}
function onPregnant(v: boolean) {
  pregnant.value = v;
  setProp("Uterus.pregnant", v, 0);
}
function onCouple(v: boolean) {
  couplePlacenta.value = v;
  setProp("Uterus.couple_placenta", v, 0);
}
function onContractions(v: boolean) {
  contractions.value = v;
  setProp("Uterus.contractions_running", v, 0);
}
function onGa(v: number) {
  pregGa.value = v;
  setProp("Uterus.preg_ga", v, 0);
}
</script>

<template>
  <Panel toggleable>
    <template #header>
      <div class="flex items-center gap-2 w-full">
        <span class="font-semibold">Pregnancy / Labor</span>
        <span
          class="text-xs px-1.5 py-0.5 rounded"
          :class="pregnant ? 'bg-pink-600/20 text-pink-400' : 'bg-zinc-500/20 opacity-60'"
        >
          {{ pregnant ? "● pregnant" : "not pregnant" }}
        </span>
        <ToggleSwitch
          class="ml-auto"
          :model-value="pregnant"
          @update:model-value="onPregnant"
        />
      </div>
    </template>

    <div class="flex flex-col gap-3" :class="{ 'opacity-40 pointer-events-none': !pregnant }">
      <!-- gestational age -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-xs opacity-70">Gestational age</span>
          <span class="text-sm tabular-nums">{{ pregGa.toFixed(0) }} <span class="text-xs opacity-50">wk</span></span>
        </div>
        <Slider
          :model-value="pregGa"
          :min="0"
          :max="42"
          :step="1"
          @update:model-value="(v: number | number[]) => onGa(Array.isArray(v) ? v[0] : v)"
        />
      </div>

      <!-- placental coupling -->
      <div class="flex items-center justify-between gap-2">
        <label class="text-sm opacity-80">Couple placenta</label>
        <ToggleSwitch :model-value="couplePlacenta" @update:model-value="onCouple" />
      </div>

      <!-- labor / contractions -->
      <div class="border-t border-surface-700 pt-2">
        <div class="flex items-center justify-between gap-2">
          <label class="text-sm opacity-80">Contractions</label>
          <ToggleSwitch :model-value="contractions" @update:model-value="onContractions" />
        </div>
        <div
          class="grid grid-cols-2 gap-x-3 gap-y-2 mt-2"
          :class="{ 'opacity-40 pointer-events-none': !contractions }"
        >
          <div v-for="f in LABOR_FIELDS" :key="f.p" class="flex flex-col gap-0.5">
            <span class="text-xs opacity-70">{{ f.label }} <span class="opacity-50">{{ f.unit }}</span></span>
            <InputNumber
              :model-value="vals[f.p]"
              :min="f.min"
              :max="f.max"
              :step="f.step"
              :max-fraction-digits="f.rounding"
              show-buttons
              button-layout="horizontal"
              size="small"
              class="w-full"
              :input-class="'w-full text-center'"
              @update:model-value="(v: number) => onField(f, v)"
            >
              <template #incrementbuttonicon><i class="pi pi-plus" /></template>
              <template #decrementbuttonicon><i class="pi pi-minus" /></template>
            </InputNumber>
          </div>
        </div>
      </div>

      <!-- measured read-outs (slow stream) -->
      <div class="border-t border-surface-700 pt-2">
        <div class="text-xs opacity-60 mb-1">measured</div>
        <div class="grid grid-cols-3 gap-x-3 gap-y-2">
          <div v-for="m in measured" :key="m.label" class="flex flex-col">
            <span class="text-xs opacity-60">{{ m.label }}</span>
            <span class="text-sm tabular-nums">
              {{ m.value }}
              <span class="text-xs opacity-50">{{ m.unit }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </Panel>
</template>
