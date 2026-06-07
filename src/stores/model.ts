import { defineStore } from "pinia";
import { ref } from "vue";

// Control-plane store: the catalog of available scenarios and the current
// selection. Per-frame realtime data never lives here (see useRealtimeBus).
export const useModelStore = defineStore("model", () => {
  const scenarios = ref<string[]>([]);
  const current = ref<string | null>(null);

  async function fetchScenarios() {
    const res = await fetch("/model_definitions/index.json");
    if (!res.ok) throw new Error("failed to load scenario index");
    scenarios.value = await res.json();
  }

  return { scenarios, current, fetchScenarios };
});
