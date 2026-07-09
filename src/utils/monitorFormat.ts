import type { MonitorParam } from "@/stores/monitors";

// Shared display logic for monitor parameters so the readout panel and the
// snapshot/export format values identically.

// raw engine value → display value (unit factor, then per-kg if weight_based)
export function scaleValue(param: MonitorParam, raw: number, weight: number): number {
  let v = raw * (param.factor ?? 1);
  if (param.weight_based) v /= weight > 0 ? weight : 1;
  return v;
}

// format a parameter's value from a slow-stream row; two props render as "a/b"
export function formatParam(
  param: MonitorParam,
  latest: Record<string, any> | null,
  weight: number,
): string {
  const paths = param.props ?? [];
  if (!paths.length) return "—";
  return paths
    .map((path) => {
      const v = latest?.[path];
      if (typeof v !== "number") return "—";
      return scaleValue(param, v, weight).toFixed(param.rounding ?? 0);
    })
    .join("/");
}
