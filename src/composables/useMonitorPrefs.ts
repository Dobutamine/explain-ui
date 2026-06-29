import { reactive, watch } from "vue";

// User view preferences for the monitoring panel, persisted to localStorage so
// they survive reloads. Singleton (module-level) — every consumer shares one
// reactive object. Not scenario data (never written to the model JSON); purely a
// per-browser display choice.
export type SparkWindow = 30 | 60 | 300;

export interface MonitorPrefs {
  compact: boolean; // dense grid, hide sparklines
  sparkWindowSec: SparkWindow; // sparkline + stats window
}

const KEY = "explain.monitors.prefs";
const DEFAULTS: MonitorPrefs = { compact: true, sparkWindowSec: 60 };

function load(): MonitorPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

const prefs = reactive<MonitorPrefs>(load());

watch(
  prefs,
  (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      /* ignore quota / disabled storage */
    }
  },
  { deep: true },
);

export function useMonitorPrefs() {
  return prefs;
}
