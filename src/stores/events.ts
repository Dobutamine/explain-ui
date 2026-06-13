import { defineStore } from "pinia";
import { ref } from "vue";
import { useExplain } from "@/composables/useExplain";
import { useModelStore } from "@/stores/model";

// One property change inside an event. `value` is the RAW engine value (any
// display factor already divided out by the builder). `it` is the ramp duration
// in seconds for numeric changes; it is ignored for boolean/list changes, which
// the engine TaskScheduler applies instantly. `at` is a delay in seconds before
// the change starts, relative to when the event is applied (TaskScheduler-native).
export interface EventChange {
  model: string; // model instance name, e.g. "Heart"
  target: string; // raw engine prop, e.g. "heart_rate"
  type: "number" | "boolean" | "list";
  value: number | boolean | string;
  it: number;
  at: number;
}

// A named, reusable bundle of property changes. `fire_at` (absolute
// model_time_total in seconds) + `armed` drive optional auto-firing.
export interface ScheduledEvent {
  id: string;
  name: string;
  changes: EventChange[];
  fire_at: number | null;
  armed: boolean;
}

// Events live inside the loaded scenario JSON under `configuration.events`
// (same level as `configuration.monitors`). The store mirrors that list in
// memory and persists it back through the dev save-snapshot endpoint.
export const useEventsStore = defineStore("events", () => {
  const { model } = useExplain();
  const modelStore = useModelStore();
  const events = ref<ScheduledEvent[]>([]);

  function scenarioName(): string {
    return (model as any).loadedFileData?.name || modelStore.current || "snapshot";
  }

  // (re)load the in-memory list from the currently-loaded scenario file
  function syncFromScenario() {
    const stored = (model as any).loadedFileData?.configuration?.events;
    events.value = Array.isArray(stored)
      ? (structuredClone(stored) as ScheduledEvent[])
      : [];
  }

  function upsert(ev: ScheduledEvent) {
    const i = events.value.findIndex((e) => e.id === ev.id);
    if (i >= 0) events.value[i] = ev;
    else events.value.push(ev);
  }

  function remove(id: string) {
    events.value = events.value.filter((e) => e.id !== id);
  }

  // Write the events list into the loaded scenario file and re-save it. Only
  // `configuration.events` changes vs. what was loaded — the original
  // model_definition is preserved (saving an event must NOT snapshot the live
  // running sim). Falls back to console on failure (e.g. production: no endpoint).
  async function persist(): Promise<boolean> {
    const base = (model as any).loadedFileData;
    if (!base) return false;
    base.configuration = base.configuration || {};
    base.configuration.events = structuredClone(events.value);

    const name = scenarioName();
    try {
      const res = await fetch("/api/save-snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, data: base }),
      });
      if (!res.ok) throw new Error(`save endpoint returned ${res.status}`);
      return true;
    } catch (err) {
      console.error("event persist failed (events kept in memory)", err);
      return false;
    }
  }

  return { events, syncFromScenario, upsert, remove, persist };
});
