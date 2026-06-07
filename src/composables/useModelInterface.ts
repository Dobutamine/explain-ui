import { useExplain } from "./useExplain";
import { getInterfaceForType } from "@/model-interface/registry";
import type { InterfaceField } from "@/model-interface/types";

// Re-export so consumers (ModelEditor.vue) keep importing the type + grouping
// helper from here.
export type { InterfaceField } from "@/model-interface/types";
export { groupByEditMode } from "@/model-interface/types";

// Resolves a model instance's editable interface. The schema is UI-owned (see
// src/model-interface/), keyed by model_type; we look up the instance's
// model_type from the latest engine state snapshot (refreshed on model_ready).
export function useModelInterface() {
  const { model } = useExplain();

  function getInterface(name: string): InterfaceField[] {
    const modelType = (model as any).modelState?.models?.[name]?.model_type;
    return modelType ? getInterfaceForType(modelType) : [];
  }

  return { getInterface };
}
