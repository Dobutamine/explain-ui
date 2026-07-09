import { reactive, watch } from "vue";
import { useExplain } from "@/composables/useExplain";

// Singleton ring-buffer accumulator over the ~1 Hz slow stream, used to give the
// numeric readouts a sense of trend. The slow stream itself keeps NO history:
// `useExplain.slowValues` is replaced with the latest DRAINED batch on every
// `rts` event (the engine clears its buffer each drain). So if we want to know
// where a value is heading we have to keep our own short history here.
//
// One module-level watcher feeds every path's buffer; cards read `history()`
// (to draw a sparkline), `stats()` (min/max/mean over a window) and `delta()`
// (signed change for tinting). We keep up to 5 min (300 samples at 1 Hz) so the
// user-selectable trend window (30 s / 1 min / 5 min) can slice the tail.

const MAX_LEN = 300;

const series = reactive(new Map<string, number[]>());
let lastTime = -Infinity;
let installed = false;

function clearAll() {
  series.clear();
  lastTime = -Infinity;
}

function ingestRow(row: Record<string, any>) {
  const t = row?.time;
  if (typeof t !== "number") return;
  // sim restarted / scenario reloaded — time jumped backwards: drop stale history
  if (t < lastTime) clearAll();
  if (t === lastTime) return; // duplicate sample across overlapping batches
  lastTime = t;

  for (const key in row) {
    if (key === "time") continue;
    const v = row[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    let buf = series.get(key);
    if (!buf) series.set(key, (buf = []));
    buf.push(v);
    if (buf.length > MAX_LEN) buf.splice(0, buf.length - MAX_LEN);
  }
}

function install() {
  if (installed) return;
  installed = true;
  const { slowValues } = useExplain();
  // Process every row in the batch (not just the last) so fast-forward
  // `calculate()` bursts populate history too.
  watch(slowValues, (batch: any) => {
    if (!Array.isArray(batch) || batch.length === 0) return;
    for (const row of batch) ingestRow(row);
  });
}

export function useSlowHistory() {
  install();

  // Live history buffer for `path` (oldest → newest), optionally limited to the
  // last `windowSec` samples (~1 sample/s). Empty until the first samples
  // arrive. Returns a sliced copy when windowed, else the live buffer.
  function history(path: string, windowSec?: number): number[] {
    const buf = series.get(path);
    if (!buf) return [];
    if (windowSec && buf.length > windowSec) return buf.slice(buf.length - windowSec);
    return buf;
  }

  // min/max/mean/last over the recent window (default whole buffer). Null until
  // at least one sample exists.
  function stats(
    path: string,
    windowSec?: number,
  ): { min: number; max: number; mean: number; last: number; n: number } | null {
    const buf = history(path, windowSec);
    if (!buf.length) return null;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const v of buf) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    return { min, max, mean: sum / buf.length, last: buf[buf.length - 1], n: buf.length };
  }

  // Signed change of `path` over the last `n` samples (last − n-ago). Returns
  // null when there is not enough history yet.
  function delta(path: string, n = 10): number | null {
    const buf = series.get(path);
    if (!buf || buf.length < 2) return null;
    const last = buf[buf.length - 1];
    const idx = Math.max(0, buf.length - 1 - n);
    return last - buf[idx];
  }

  return { history, stats, delta };
}
