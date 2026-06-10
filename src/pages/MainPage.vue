<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import Select from "primevue/select";
import Button from "primevue/button";
import InputGroup from "primevue/inputgroup";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import { useModelStore } from "@/stores/model";
import { useExplain } from "@/composables/useExplain";
import RealtimeChart from "@/components/host/RealtimeChart.vue";
import Diagram from "@/components/host/Diagram.vue";
import ModelEditor from "@/components/controls/ModelEditor.vue";
import ScalerPanel from "@/components/controls/ScalerPanel.vue";
import VentilatorPanel from "@/components/controls/VentilatorPanel.vue";
import EclsPanel from "@/components/controls/EclsPanel.vue";
import SaveStatePanel from "@/components/controls/SaveStatePanel.vue";
import NumericReadoutPanel from "@/components/numerics/NumericReadoutPanel.vue";
import ChatPanel from "@/components/controls/ChatPanel.vue";
import LoopChart from "@/components/host/LoopChart.vue";
import Monitor from "@/components/host/Monitor.vue";
import VentilatorScope from "@/components/host/VentilatorScope.vue";

const store = useModelStore();
const { scenarios, current } = storeToRefs(store);
const { model, status, modelReady, isRunning, error, load, start, stop, calculate } = useExplain();

// SharedArrayBuffer transport is active only when cross-origin isolated.
const isolated = globalThis.crossOriginIsolated === true;
const calcSecs = ref(10);
const CALC_OPTIONS = [5, 10, 30, 60, 120, 300]; // seconds to calculate
const vizTab = ref("diagram"); // active visualization tab: diagram | chart | loop | monitor | ventilator
const monitorTab = ref("monitoring"); // active right-column tab (more to come)
const controlTab = ref("editor"); // active left-column tab (more to come)

// Monitor groups defined in the loaded scenario's `configuration.monitors`.
// Re-derived whenever a scenario finishes loading (depends on modelReady).
const monitorGroups = computed(() => {
  if (!modelReady.value) return [];
  const mons = (model as any).loadedFileData?.configuration?.monitors ?? {};
  return Object.entries<any>(mons)
    .filter(([, m]) => m?.enabled !== false)
    .map(([key, m]) => ({
      key,
      title: m.title ?? key,
      parameters: m.parameters ?? [],
      collapsed: m.collapsed ?? false,
    }));
});

const DEFAULT_SCENARIO = "term_neonate";

// selecting a scenario loads it immediately (no Load button needed)
watch(current, (name) => {
  if (name) load(name);
});

onMounted(async () => {
  await store.fetchScenarios();
  // pick the default scenario at startup; the watcher above loads it
  current.value = scenarios.value.includes(DEFAULT_SCENARIO)
    ? DEFAULT_SCENARIO
    : (scenarios.value[0] ?? null);
});

// delete a model definition file from public/model_definitions (dev endpoint)
async function deleteScenario(name: string) {
  if (!window.confirm(`Delete model definition "${name}"? This removes the file.`)) return;
  try {
    const res = await fetch("/api/delete-snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    // a missing endpoint (stale dev server) falls through to the SPA → HTML 200,
    // so verify we actually got the JSON {ok:true} the endpoint returns.
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      throw new Error(
        body?.error ||
          `delete endpoint unavailable (status ${res.status}) — restart the dev server (npm run dev)`,
      );
    }
    if (current.value === name) current.value = null; // keep model loaded, clear selection
    await store.fetchScenarios();
  } catch (err) {
    console.error("delete model definition failed", err);
    window.alert(`Delete failed: ${(err as Error).message}`);
  }
}

function onStart() {
  // chart series are managed by the Chart panel (model→parameter selectors);
  // the PV-loop and ECG add their own channels. Just run.
  start();
}

// single play/stop toggle for realtime
function toggleRun() {
  if (isRunning.value) stop();
  else onStart();
}
</script>

<template>
  <div class="p-4 flex flex-col gap-4 min-h-screen">
    <!-- Title + status, pinned to the top of the screen -->
    <div
      class="sticky top-0 z-20 -mx-4 -mt-4 mb-2 flex items-center gap-3 flex-wrap border-b border-surface-700 bg-surface-900 px-4 py-1.5"
    >
      <span class="text-sm font-semibold">Explain</span>
      <span class="flex items-center gap-3 flex-wrap text-[10px] leading-none opacity-70">
        <span>COI: <b>{{ isolated }}</b></span>
        <span>ready: <b>{{ modelReady }}</b></span>
        <span v-if="error" class="text-red-400">error: {{ error }}</span>
      </span>
    </div>

    <!-- Parameters (left 1/4) · Diagram/Chart/PV-loop tabs (center 1/2) · Monitor (right 1/4) -->
    <div v-if="modelReady" class="flex flex-col lg:flex-row gap-3 items-start">
      <div class="w-full lg:w-1/4">
        <Tabs v-model:value="controlTab">
          <TabList>
            <Tab value="editor" v-tooltip.top="'Model editor'" aria-label="Model editor">
              <i class="pi pi-sliders-h"></i>
            </Tab>
            <Tab value="ventilator" v-tooltip.top="'Ventilator'" aria-label="Ventilator">
              <i class="pi pi-cloud"></i>
            </Tab>
            <Tab value="ecls" v-tooltip.top="'ECLS'" aria-label="ECLS">
              <i class="pi pi-sync"></i>
            </Tab>
            <Tab value="scaler" v-tooltip.top="'Scaler'" aria-label="Scaler">
              <i class="pi pi-expand"></i>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="editor">
              <div class="flex flex-col gap-3">
                <ModelEditor />
              </div>
            </TabPanel>
            <TabPanel value="ventilator">
              <div class="flex flex-col gap-3">
                <VentilatorPanel />
              </div>
            </TabPanel>
            <TabPanel value="ecls">
              <div class="flex flex-col gap-3">
                <EclsPanel />
              </div>
            </TabPanel>
            <TabPanel value="scaler">
              <div class="flex flex-col gap-3">
                <ScalerPanel />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      <div class="w-full lg:w-1/2">
        <Tabs v-model:value="vizTab">
          <TabList>
            <Tab value="diagram" v-tooltip.top="'Diagram'" aria-label="Diagram">
              <i class="pi pi-sitemap"></i>
            </Tab>
            <Tab value="chart" v-tooltip.top="'Chart'" aria-label="Chart">
              <i class="pi pi-chart-line"></i>
            </Tab>
            <Tab value="loop" v-tooltip.top="'PV-loop'" aria-label="PV-loop">
              <i class="pi pi-chart-scatter"></i>
            </Tab>
            <Tab value="monitor" v-tooltip.top="'Patient monitor'" aria-label="Patient monitor">
              <i class="pi pi-desktop"></i>
            </Tab>
            <Tab value="ventilator" v-tooltip.top="'Ventilator graphs'" aria-label="Ventilator graphs">
              <i class="pi pi-cloud"></i>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="diagram">
              <Diagram />
            </TabPanel>
            <TabPanel value="chart">
              <RealtimeChart />
            </TabPanel>
            <TabPanel value="loop">
              <LoopChart />
            </TabPanel>
            <TabPanel value="monitor">
              <Monitor />
            </TabPanel>
            <TabPanel value="ventilator">
              <VentilatorScope />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      <div class="w-full lg:w-1/4">
        <Tabs v-model:value="monitorTab">
          <TabList>
            <Tab value="monitoring" v-tooltip.top="'Monitoring'" aria-label="Monitoring">
              <i class="pi pi-gauge"></i>
            </Tab>
            <Tab value="chat" v-tooltip.top="'Explain Labs chat'" aria-label="Explain Labs chat">
              <i class="pi pi-comments"></i>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="monitoring">
              <div class="flex flex-col gap-3">
                <NumericReadoutPanel
                  v-for="g in monitorGroups"
                  :key="g.key"
                  :title="g.title"
                  :parameters="g.parameters"
                  :collapsed="g.collapsed"
                />
              </div>
            </TabPanel>
            <TabPanel value="chat">
              <ChatPanel />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>

    <!-- Status (left) · run/calculate controls (center) · model loading (right) -->
    <div
      class="compact-bar sticky bottom-0 z-20 -mx-4 -mb-4 mt-auto grid grid-cols-3 items-center gap-1.5 border-t border-surface-700 bg-surface-900 px-3 py-1 text-xs"
    >
      <!-- left: status -->
      <span class="opacity-70 justify-self-start">STATUS: {{ status }}</span>

      <!-- center: play / stop / calculate -->
      <div class="flex items-center gap-1.5 justify-self-center">
        <Button
          v-tooltip.top="isRunning ? 'Stop' : 'Start'"
          :icon="isRunning ? 'pi pi-stop' : 'pi pi-play'"
          :aria-label="isRunning ? 'Stop' : 'Start'"
          size="small"
          severity="secondary"
          :disabled="!modelReady"
          @click="toggleRun"
        />
        <InputGroup style="width: auto">
          <Button
            v-tooltip.top="'Calculate'"
            icon="pi pi-calculator"
            aria-label="Calculate"
            size="small"
            severity="secondary"
            :disabled="!modelReady"
            @click="calculate(calcSecs)"
          />
          <Select
            v-model="calcSecs"
            :options="CALC_OPTIONS"
            size="small"
            class="w-16"
            :disabled="!modelReady"
          />
        </InputGroup>
        <span class="opacity-60">seconds</span>
      </div>

      <!-- right: local model loading -->
      <div class="flex items-center gap-1.5 justify-self-end">
        <span class="opacity-70">local models</span>
        <Select
          v-model="current"
          :options="scenarios"
          placeholder="Select a scenario"
          size="small"
          class="w-56"
        />
        <Button
          v-tooltip.top="'Delete selected model definition'"
          icon="pi pi-trash"
          aria-label="Delete model definition"
          severity="secondary"
          size="small"
          :disabled="!current"
          @click="current && deleteScenario(current)"
        />
        <SaveStatePanel v-if="modelReady" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Make the bottom run-control bar denser than PrimeVue's "small" size. */
.compact-bar :deep(.p-button),
.compact-bar :deep(.p-select),
.compact-bar :deep(.p-inputtext),
.compact-bar :deep(.p-inputnumber-input) {
  font-size: 0.7rem;
  padding-top: 0.15rem;
  padding-bottom: 0.15rem;
  min-height: 0;
}
.compact-bar :deep(.p-button) {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
</style>
