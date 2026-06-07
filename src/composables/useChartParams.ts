import { computed, ref } from "vue";
import { useExplain } from "./useExplain";

// Shared model/parameter + preset logic for the realtime chart and the loop
// chart. Each component supplies its own selectors and decides how a preset's
// paths map onto them; this composable just provides the model/param catalog
// and the preset store (scenario presets + session-saved ones).
//
// `presetKey` selects the configuration.presets sub-object:
//   "RealTimeCharts" for the time chart, "LoopCharts" for the PV loop.
export function useChartParams(presetKey: string) {
  const { model, modelState } = useExplain();

  const modelNames = computed(() => {
    const m = (modelState.value as any)?.models;
    return m ? Object.keys(m).sort() : [];
  });

  function numericProps(modelName: string | null): string[] {
    if (!modelName) return [];
    const m = (modelState.value as any)?.models?.[modelName];
    if (!m) return [];
    return Object.keys(m)
      .filter((k) => typeof m[k] === "number")
      .sort();
  }

  // "Model.prop" → [model, prop]
  function pathToSel(path: string | undefined): [string | null, string | null] {
    if (!path) return [null, null];
    const dot = path.indexOf(".");
    return dot < 0 ? [path, null] : [path.slice(0, dot), path.slice(dot + 1)];
  }

  // presets saved this session (until the chart remounts on scenario reload),
  // merged on top of the scenario's own presets.
  const savedPresets = ref<Record<string, { paths: string[] }>>({});
  const presets = computed<Record<string, any>>(() => {
    void modelState.value; // re-evaluate when a new scenario loads
    const scen = (model as any).loadedFileData?.configuration?.presets?.[presetKey];
    return { ...(scen && typeof scen === "object" ? scen : {}), ...savedPresets.value };
  });
  const presetNames = computed(() => Object.keys(presets.value));

  function savePreset(name: string, paths: string[]) {
    const n = name.trim();
    if (!n || !paths.length) return;
    savedPresets.value = { ...savedPresets.value, [n]: { paths } };
  }

  function deletePreset(name: string) {
    if (name in savedPresets.value) {
      const next = { ...savedPresets.value };
      delete next[name];
      savedPresets.value = next;
    } else {
      const scen = (model as any).loadedFileData?.configuration?.presets?.[presetKey];
      if (scen && name in scen) delete scen[name];
      savedPresets.value = { ...savedPresets.value }; // bump reactivity to recompute
    }
  }

  return {
    modelNames,
    numericProps,
    pathToSel,
    presets,
    presetNames,
    savePreset,
    deletePreset,
  };
}
