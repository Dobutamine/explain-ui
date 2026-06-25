import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ChartFrame, AnimFrame, ChannelsPayload, RendererAdapter } from "./types";

// uPlot adapter for the realtime chart channel. Appends EVERY chart row the bus
// drains (no dropped samples), keeps a rolling time window, and redraws once per
// frame. Holds plain arrays — never Vue-reactive state.
const DEFAULT_WINDOW_S = 3;
const COLORS = ["#f87171", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#f472b6"];

export class ChartRenderer implements RendererAdapter {
  private el: HTMLElement;
  private plot: uPlot | null = null;
  private xs: number[] = [];
  private ys: number[][] = [];
  private labels: string[] = []; // labels of the series actually drawn
  private allLabels: string[] = []; // every channel slot (excl. time), data order
  private displayIdx: number[] = []; // data-column index for each drawn series
  // Which channel labels to draw. The fast watchlist is shared (PV loop's LV
  // props, the always-on ECG counters, stale picks), so by default we show
  // nothing and let the host pick exactly the series the user selected.
  private visible: string[] = [];
  private windowS = DEFAULT_WINDOW_S; // rolling time window (seconds)
  private sharedAxis = false; // true → all series on one shared left y-axis
  private colorOffset = 0; // shift into COLORS so e.g. a split chart's lone
  // series can use the "second" colour (blue)
  // Y-axis scaling. true → uPlot's default autoscaling. false → each y scale is
  // pinned to a fixed [min, max] held in `fixedYRanges` (keyed by scale key:
  // "y" when sharedAxis, else "y0"/"y1"). Locking snapshots the current
  // autoscaled range so the view doesn't jump.
  private autoScaleY = true;
  private fixedYRanges: Record<string, [number, number]> = {};
  // true → fill the area between each series and the zero baseline with a
  // translucent wash of its stroke colour (mimics a Doppler flow envelope).
  private fill = false;
  private ro: ResizeObserver;

  constructor(el: HTMLElement) {
    this.el = el;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
  }

  /** Choose which watched channels to plot (in this order). Series colours
   *  follow the given order, so callers can keep swatches in sync. */
  setVisible(labels: string[]) {
    this.visible = labels ?? [];
    this.rebuildDisplay();
  }

  /** Set the rolling time window (seconds) shown on the x-axis. */
  setWindow(seconds: number) {
    if (seconds > 0) this.windowS = seconds;
  }

  /** true → draw all series against one shared left y-axis (comparable,
   *  same-unit params); false → one independent axis per series. */
  setSharedAxis(on: boolean) {
    if (this.sharedAxis === on) return;
    this.sharedAxis = on;
    this.build();
  }

  /** Shift the colour assignment so series 0 uses COLORS[offset]. Used by a
   *  split chart so its single series matches the source series' colour. */
  setColorOffset(n: number) {
    if (this.colorOffset === n) return;
    this.colorOffset = n;
    this.build();
  }

  /** Toggle y-axis autoscaling. Switching OFF snapshots the current autoscaled
   *  range of every y scale and pins it (the view stays put); switching ON
   *  hands the scales back to uPlot. */
  setAutoScaleY(on: boolean) {
    if (this.autoScaleY === on) return;
    if (!on) this.fixedYRanges = this.readYRanges();
    else this.fixedYRanges = {};
    this.autoScaleY = on;
    this.build();
  }

  /** Lock every active y scale to an explicit [min, max] (and turn autoscaling
   *  off). Unlike setAutoScaleY(false), which snapshots the current view, this
   *  pins a caller-supplied range — used when a preset ships a fixed scale. */
  applyFixedYRange(min: number, max: number) {
    if (!(min < max)) return;
    this.autoScaleY = false;
    this.fixedYRanges = {};
    for (const k of this.scaleKeys()) this.fixedYRanges[k] = [min, max];
    this.build();
  }

  /** Toggle the translucent area fill under every series. */
  setFill(on: boolean) {
    if (this.fill === on) return;
    this.fill = on;
    this.build();
  }

  /** The scale keys currently in play: "y" (shared) or one "y<i>" per series. */
  private scaleKeys(): string[] {
    if (this.labels.length === 0) return [];
    return this.sharedAxis ? ["y"] : this.labels.map((_, i) => "y" + i);
  }

  /** Read each active y scale's current [min, max] off the live plot. */
  private readYRanges(): Record<string, [number, number]> {
    const out: Record<string, [number, number]> = {};
    if (!this.plot) return out;
    for (const k of this.scaleKeys()) {
      const s = this.plot.scales[k];
      if (s && s.min != null && s.max != null) out[k] = [s.min, s.max];
    }
    return out;
  }

  /** Describe the editable y-axes for the host UI: one entry per axis with its
   *  scale key, the series label(s) it carries, its colour, and current range
   *  (the live autoscaled range when auto, the pinned range when locked). */
  getYAxes(): { key: string; label: string; color: string; min: number; max: number }[] {
    const ranges = this.autoScaleY ? this.readYRanges() : this.fixedYRanges;
    if (this.sharedAxis) {
      const r = ranges["y"] ?? [0, 1];
      return [{ key: "y", label: this.labels.join(", "), color: "#cbd5e1", min: r[0], max: r[1] }];
    }
    return this.labels.map((label, i) => {
      const key = "y" + i;
      const r = ranges[key] ?? [0, 1];
      return { key, label, color: this.colorFor(i), min: r[0], max: r[1] };
    });
  }

  /** Set a locked y scale's [min, max] (no-op while autoscaling, or if invalid).
   *  Re-feeds the current data so the new range takes effect immediately, even
   *  when the sim is paused. */
  setYRange(key: string, min: number, max: number) {
    if (!(min < max)) return;
    this.fixedYRanges[key] = [min, max];
    if (!this.autoScaleY && this.plot) this.plot.setData([this.xs, ...this.ys]);
  }

  private colorFor(i: number) {
    return COLORS[(i + this.colorOffset) % COLORS.length];
  }

  /** A translucent wash of series i's stroke colour for the area fill. */
  private fillFor(i: number) {
    const hex = this.colorFor(i);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  }

  onRegistry(payload: ChannelsPayload) {
    this.allLabels = (payload?.chart?.slots ?? []).slice(1); // slot 0 is "time"
    this.rebuildDisplay();
  }

  // Resolve `visible` against the current channel layout into drawn series +
  // their data-column indices, then (re)build the plot. Keeps display order =
  // `visible` order regardless of watchlist insertion order.
  private rebuildDisplay() {
    this.labels = [];
    this.displayIdx = [];
    for (const label of this.visible) {
      const i = this.allLabels.indexOf(label);
      if (i === -1) continue; // not in the channel yet (watch not applied)
      this.labels.push(label);
      this.displayIdx.push(i);
    }
    this.xs = [];
    this.ys = this.labels.map(() => []);
    this.build();
  }

  private build() {
    if (this.plot) {
      this.plot.destroy();
      this.plot = null;
    }
    if (this.labels.length === 0) return;

    const gridColor = "#334155"; // grid + tick marks

    const series: uPlot.Series[] = [{}];
    const yAxes: uPlot.Axis[] = [];

    if (this.sharedAxis) {
      // All series on one shared left axis (default uPlot "y" scale) so
      // same-unit params can be compared by magnitude. Axis text is neutral
      // since it serves multiple colours.
      this.labels.forEach((label, i) => {
        series.push({ label, stroke: this.colorFor(i), width: 1, ...(this.fill ? { fill: this.fillFor(i), fillTo: 0 } : {}) });
      });
      yAxes.push({
        side: 3,
        stroke: "#cbd5e1",
        grid: { show: true, stroke: gridColor, width: 1 },
        ticks: { stroke: gridColor, width: 1 },
      });
    } else {
      // Each series gets its OWN scale + y-axis so two parameters with very
      // different ranges (e.g. mmHg vs L) each fill the chart instead of one
      // looking flat. Series 0 → left axis, the second → right axis; axis
      // labels are coloured to match their series. Grid from the left only.
      this.labels.forEach((label, i) => {
        const color = this.colorFor(i);
        const scaleKey = "y" + i;
        series.push({ label, scale: scaleKey, stroke: color, width: 1, ...(this.fill ? { fill: this.fillFor(i), fillTo: 0 } : {}) });
        yAxes.push({
          scale: scaleKey,
          side: i === 0 ? 3 : 1, // 3 = left, 1 = right
          stroke: color,
          grid: { show: i === 0, stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1 },
        });
      });
    }

    const scales: uPlot.Options["scales"] = {
      // Pin the x range to exactly the rolling window. uPlot's default numeric
      // range adds ~10% padding each side, which made the visible span ~1 s
      // wider than `windowS` (e.g. 5 s looking like 6 s).
      x: {
        time: false,
        range: (_u, _min, dataMax) =>
          dataMax == null ? [0, this.windowS] : [dataMax - this.windowS, dataMax],
      },
    };
    // When autoscaling is off, pin each y scale to its stored range via a range
    // fn that ignores the data (reads `fixedYRanges` live, so setYRange edits
    // take effect on the next setData without a rebuild).
    if (!this.autoScaleY) {
      for (const k of this.scaleKeys()) {
        scales[k] = { range: () => this.fixedYRanges[k] ?? [0, 1] };
      }
    }

    const opts: uPlot.Options = {
      width: this.el.clientWidth || 600,
      height: this.el.clientHeight || 240,
      series,
      // x is elapsed time; its labels grow unboundedly and aren't useful here,
      // so hide the x-axis entirely. Each series brings its own y-axis.
      axes: [{ show: false }, ...yAxes],
      scales,
      // uPlot's legend carries an x-axis "Value" entry and value cells we don't
      // want; the host renders its own minimal legend instead.
      legend: { show: false },
      cursor: { show: false },
    };
    this.plot = new uPlot(opts, [this.xs, ...this.ys], this.el);
  }

  onFrame(chart: ChartFrame | null, _anim: AnimFrame | null) {
    if (!chart || !this.plot) return;
    const { rows, stride, count } = chart;
    for (let r = 0; r < count; r++) {
      const base = r * stride;
      this.xs.push(rows[base]); // time
      for (let s = 0; s < this.displayIdx.length; s++) {
        this.ys[s].push(rows[base + 1 + this.displayIdx[s]]);
      }
    }
    // trim to the rolling window
    const tEnd = this.xs[this.xs.length - 1];
    const tMin = tEnd - this.windowS;
    let drop = 0;
    while (drop < this.xs.length && this.xs[drop] < tMin) drop++;
    if (drop > 0) {
      this.xs.splice(0, drop);
      for (const y of this.ys) y.splice(0, drop);
    }
    this.plot.setData([this.xs, ...this.ys]);
  }

  /** Snapshot the current rolling-window buffer (drawn series) for CSV export. */
  getSeries(): { time: number[]; labels: string[]; cols: number[][] } {
    return {
      time: this.xs.slice(),
      labels: this.labels.slice(),
      cols: this.ys.map((c) => c.slice()),
    };
  }

  private resize() {
    if (this.plot) {
      this.plot.setSize({
        width: this.el.clientWidth || 600,
        height: this.el.clientHeight || 240,
      });
    }
  }

  dispose() {
    this.ro.disconnect();
    if (this.plot) {
      this.plot.destroy();
      this.plot = null;
    }
  }
}
