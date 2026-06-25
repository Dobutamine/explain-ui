<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import Select from "primevue/select";
import Button from "primevue/button";
import InputGroup from "primevue/inputgroup";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import { useRouter } from "vue-router";
import { useModelStore } from "@/stores/model";
import { useAuthStore } from "@/stores/auth";
import { useStatesStore } from "@/stores/states";
import { useExplain } from "@/composables/useExplain";
import RealtimeChart from "@/components/host/RealtimeChart.vue";
import Diagram from "@/components/host/Diagram.vue";
import ModelEditor from "@/components/controls/ModelEditor.vue";
import ScalerPanel from "@/components/controls/ScalerPanel.vue";
import VentilatorPanel from "@/components/controls/VentilatorPanel.vue";
import EclsPanel from "@/components/controls/EclsPanel.vue";
import ResuscitationPanel from "@/components/controls/ResuscitationPanel.vue";
import PregnancyPanel from "@/components/controls/PregnancyPanel.vue";
import EventSchedulerPanel from "@/components/controls/EventSchedulerPanel.vue";
import SaveStatePanel from "@/components/controls/SaveStatePanel.vue";
import AdminUsersButton from "@/components/controls/AdminUsersButton.vue";
import NumericReadoutPanel from "@/components/numerics/NumericReadoutPanel.vue";
import ChatPanel from "@/components/controls/ChatPanel.vue";
import LoopChart from "@/components/host/LoopChart.vue";
import Monitor from "@/components/host/Monitor.vue";
import VentilatorScope from "@/components/host/VentilatorScope.vue";

const store = useModelStore();
const auth = useAuthStore();
const router = useRouter();
const { scenarios, current } = storeToRefs(store);

async function logout() {
  await auth.logout();
  router.push({ name: "login" });
}
const { model, status, modelReady, isRunning, error, load, loadFromObject, start, stop, calculate } =
  useExplain();
const statesStore = useStatesStore();

// SharedArrayBuffer transport is active only when cross-origin isolated.
const isolated = globalThis.crossOriginIsolated === true;
const calcSecs = ref(10);
const CALC_OPTIONS = [5, 10, 30, 60, 120, 300]; // seconds to calculate
const vizTab = ref("diagram"); // active visualization tab: diagram | chart | loop | monitor | ventilator | chat
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

// Name of the scenario / saved state currently loaded into the engine. Keyed on
// modelReady (toggles false→true on every (re)build) so it re-derives per load;
// uses the definition's embedded `name`, falling back to the selected scenario.
const loadedName = computed(() => {
  if (!modelReady.value) return null;
  return (model as any).loadedFileData?.name || current.value || null;
});

const DEFAULT_SCENARIO = "term_neonate";

// selecting a scenario loads it immediately (no Load button needed)
watch(current, (name) => {
  if (name) {
    load(name);
    statesStore.setCurrent(null); // a local scenario isn't a cloud state
  }
});

onMounted(async () => {
  await store.fetchScenarios();
  const u = auth.user;
  // Startup priority:
  // 1. A model developer's chosen LOCAL scenario (highest priority).
  if (u?.modelDeveloper && u.defaultLocalState && scenarios.value.includes(u.defaultLocalState)) {
    current.value = u.defaultLocalState; // watcher loads it (and clears cloud currentId)
    return;
  }
  // 2. The user's default CLOUD state.
  if (u?.defaultState) {
    const file = await statesStore.loadState(u.defaultState);
    if (file) {
      loadFromObject(file);
      return;
    }
  }
  // 3. The bundled scenario.
  current.value = scenarios.value.includes(DEFAULT_SCENARIO)
    ? DEFAULT_SCENARIO
    : (scenarios.value[0] ?? null);
});

// model-developer preference: flag the selected local scenario as the one to load
// at startup (overrides the cloud default). Click again to clear it.
function toggleDefaultLocal() {
  if (!current.value) return;
  const next = auth.user?.defaultLocalState === current.value ? null : current.value;
  // In dev the developer account isn't backed by MongoDB — persist the choice to
  // localStorage instead of POSTing to /api/states/set-default-local.
  if (import.meta.env.DEV) auth.setDefaultLocalState(next);
  else statesStore.setDefaultLocal(next);
}

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

// Spacebar toggles play/stop — but only when the user isn't typing in a field
// (inputs, textareas, selects, contenteditable) so it doesn't hijack text entry.
function onKeydown(e: KeyboardEvent) {
  if (e.code !== "Space" && e.key !== " ") return;
  if (e.repeat || !modelReady.value) return;
  const t = e.target as HTMLElement | null;
  if (
    t &&
    (t.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(t.tagName))
  )
    return;
  e.preventDefault(); // stop the page from scrolling
  toggleRun();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="p-4 flex flex-col gap-4 min-h-screen">
    <!-- Title + status, pinned to the top of the screen -->
    <div
      class="sticky top-0 z-20 -mx-4 -mt-4 mb-2 flex items-center gap-3 flex-wrap border-b border-surface-700 bg-surface-900 px-4 py-2"
    >
      <img
        src="/logo/explain-labs-logo.svg"
        alt="Explain Labs"
        class="h-12 w-auto shrink-0"
      />
      <span v-if="loadedName" class="min-w-0 truncate text-sm" v-tooltip.bottom="'Loaded state'">
        <span class="opacity-50">Current state:</span>
        <span class="ml-1 font-medium text-surface-100">{{ loadedName }}</span>
      </span>
      <div class="ml-auto flex items-center gap-3">
        <span v-if="auth.user" class="text-sm opacity-70">{{ auth.user.email }}</span>
        <AdminUsersButton v-if="auth.user?.admin" />
        <Button
          icon="pi pi-sign-out"
          label="Sign out"
          size="small"
          severity="secondary"
          text
          @click="logout"
        />
      </div>
    </div>

    <!-- Parameters (left 1/4) · Diagram/Chart/PV-loop tabs (center 1/2) · Monitor (right 1/4) -->
    <div v-if="modelReady" class="flex flex-col lg:flex-row gap-3 items-start">
      <div class="w-full lg:w-1/4 min-w-0">
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
            <Tab value="resuscitation" v-tooltip.top="'Resuscitation'" aria-label="Resuscitation">
              <i class="pi pi-heart"></i>
            </Tab>
            <Tab value="pregnancy" v-tooltip.top="'Pregnancy / Labor'" aria-label="Pregnancy / Labor">
              <i class="pi pi-venus"></i>
            </Tab>
            <Tab value="scaler" v-tooltip.top="'Scaler'" aria-label="Scaler">
              <i class="pi pi-expand"></i>
            </Tab>
            <Tab value="events" v-tooltip.top="'Event scheduler'" aria-label="Event scheduler">
              <i class="pi pi-clock"></i>
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
            <TabPanel value="resuscitation">
              <div class="flex flex-col gap-3">
                <ResuscitationPanel />
              </div>
            </TabPanel>
            <TabPanel value="pregnancy">
              <div class="flex flex-col gap-3">
                <PregnancyPanel />
              </div>
            </TabPanel>
            <TabPanel value="scaler">
              <div class="flex flex-col gap-3">
                <ScalerPanel />
              </div>
            </TabPanel>
            <TabPanel value="events">
              <div class="flex flex-col gap-3">
                <EventSchedulerPanel />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      <div class="w-full lg:w-1/2 min-w-0">
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
            <Tab value="chat" v-tooltip.top="'Explain AI Bot'" aria-label="Explain AI Bot">
              <i class="pi pi-comments"></i>
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
            <TabPanel value="chat">
              <ChatPanel />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      <div class="w-full lg:w-1/4 min-w-0">
        <Tabs v-model:value="monitorTab">
          <TabList>
            <Tab value="monitoring" v-tooltip.top="'Monitoring'" aria-label="Monitoring">
              <i class="pi pi-gauge"></i>
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
          </TabPanels>
        </Tabs>
      </div>
    </div>

    <!-- Status (left) · run/calculate controls (center) · model loading (right) -->
    <div
      class="compact-bar sticky bottom-0 z-20 -mx-4 -mb-4 mt-auto grid grid-cols-3 items-center gap-1.5 border-t border-surface-700 bg-surface-900 px-3 py-1 text-sm"
    >
      <!-- left: COI / ready indicators + status -->
      <div class="flex items-center gap-3 flex-wrap justify-self-start">
        <span class="flex items-center gap-3 flex-wrap opacity-70">
          <span>COI: <b>{{ isolated }}</b></span>
          <span>MODEL LOADED: <b>{{ modelReady }}</b></span>
          <span v-if="error" class="text-red-400">error: {{ error }}</span>
        </span>
        <span class="opacity-70">STATUS: <b>{{ status }}</b></span>
      </div>

      <!-- center: play / stop / calculate -->
      <div class="flex items-center gap-1.5 justify-self-center">
        <Button
          v-tooltip.top="isRunning ? 'Stop (Space)' : 'Start (Space)'"
          :icon="isRunning ? 'pi pi-stop' : 'pi pi-play'"
          :aria-label="isRunning ? 'Stop' : 'Start'"
          size="small"
          severity="secondary"
          :disabled="!modelReady"
          @click="toggleRun"
        />
        <InputGroup style="width: auto">
          <Button
            v-tooltip.top="'Fast forward'"
            icon="pi pi-forward"
            aria-label="Fast forward"
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

      <!-- right: local model loading (model developers only) + state save/load -->
      <div class="flex items-center gap-1.5 justify-self-end">
        <template v-if="auth.user?.modelDeveloper">
          <span class="opacity-70">local models</span>
          <Select
            v-model="current"
            :options="scenarios"
            placeholder="Select a scenario"
            size="small"
            class="w-56"
          />
          <Button
            v-tooltip.top="
              current && auth.user?.defaultLocalState === current
                ? 'Startup scenario (click to unset)'
                : 'Load this scenario at startup'
            "
            :icon="
              current && auth.user?.defaultLocalState === current
                ? 'pi pi-star-fill'
                : 'pi pi-star'
            "
            aria-label="Load this scenario at startup"
            severity="secondary"
            size="small"
            :disabled="!current"
            @click="toggleDefaultLocal"
          />
          <Button
            v-tooltip.top="'Delete selected model definition'"
            icon="pi pi-trash"
            aria-label="Delete model definition"
            severity="danger"
            text
            size="small"
            :disabled="!current"
            @click="current && deleteScenario(current)"
          />
        </template>
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
  font-size: 0.85rem;
  padding-top: 0.15rem;
  padding-bottom: 0.15rem;
  min-height: 0;
}
.compact-bar :deep(.p-button) {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
/* Bump the run/calculate button icons in step with the larger bar text. */
.compact-bar :deep(.p-button) .pi {
  font-size: 1rem;
}

/* Slightly larger tab icons across the control / viz / monitor tab strips. */
:deep(.p-tab) .pi {
  font-size: 1.25rem;
  transition: filter 0.15s ease, transform 0.15s ease;
}
/* Hover affordance for the icon-only tabs: inactive icons brighten + lift so it
   reads as clickable (the active tab already has its own highlight). */
:deep(.p-tab:not(.p-tab-active):hover) .pi {
  filter: brightness(1.4);
  transform: translateY(-1px);
}
</style>
