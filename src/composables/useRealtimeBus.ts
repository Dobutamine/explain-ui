import RealtimeBus from "@explain/realtime/RealtimeBus";
import type { RendererAdapter } from "@/render/types";
import { useExplain } from "./useExplain";

// Singleton RealtimeBus: owns the single rAF loop that drains the data plane and
// drives renderer adapters. The loop runs only while the engine streams
// (rt_start → start, rt_stop → stop). Per-frame data flows worker → bus →
// adapter, never through Vue reactivity.
let _bus: any = null;

export function useRealtimeBus() {
  const { model } = useExplain();
  if (!_bus) {
    _bus = new RealtimeBus(model);
    model.on("rt_start", () => _bus.start());
    model.on("rt_stop", () => _bus.stop());
  }
  return {
    addRenderer: (a: RendererAdapter) => _bus.addRenderer(a),
    removeRenderer: (a: RendererAdapter) => _bus.removeRenderer(a),
  };
}

export function disposeRealtimeBus() {
  if (_bus) {
    _bus.dispose();
    _bus = null;
  }
}
