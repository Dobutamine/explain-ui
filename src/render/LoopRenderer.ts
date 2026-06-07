import type { ChartFrame, AnimFrame, ChannelsPayload, RendererAdapter } from "./types";

// Canvas x-y "loop" renderer (e.g. a pressure–volume loop): plots one chart
// signal against another parametrically. Closed loops aren't monotonic in x, so
// this draws a polyline directly rather than using uPlot. Reads the same chart
// channel as ChartRenderer; never Vue-reactive.
const MAX_POINTS = 20000; // hard safety cap regardless of window
const DEFAULT_WINDOW_S = 3;

export class LoopRenderer implements RendererAdapter {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private xSig: string;
  private ySig: string;
  private xi = -1;
  private yi = -1;
  private slots: string[] = []; // latest channel layout, to re-resolve indices
  private xs: number[] = [];
  private ys: number[] = [];
  private times: number[] = []; // model time per point, for the rolling window
  private windowS = DEFAULT_WINDOW_S; // trail length (seconds)
  private ro: ResizeObserver;

  constructor(el: HTMLElement, xSignal = "", ySignal = "") {
    this.el = el;
    this.xSig = xSignal;
    this.ySig = ySignal;
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
  }

  onRegistry(payload: ChannelsPayload) {
    this.slots = payload?.chart?.slots ?? [];
    this.applySignals();
  }

  /** Choose which channels map to the x and y axes. */
  setSignals(xSignal: string, ySignal: string) {
    this.xSig = xSignal;
    this.ySig = ySignal;
    this.applySignals();
  }

  /** Set the rolling trail length (seconds). */
  setWindow(seconds: number) {
    if (seconds > 0) this.windowS = seconds;
  }

  private applySignals() {
    this.xi = this.slots.indexOf(this.xSig);
    this.yi = this.slots.indexOf(this.ySig);
    this.xs = [];
    this.ys = [];
    this.times = [];
  }

  onFrame(chart: ChartFrame | null, _anim: AnimFrame | null) {
    if (!chart || this.xi < 0 || this.yi < 0) return;
    const { rows, stride, count } = chart;
    for (let r = 0; r < count; r++) {
      const base = r * stride;
      this.times.push(rows[base]); // slot 0 is model time
      this.xs.push(rows[base + this.xi]);
      this.ys.push(rows[base + this.yi]);
    }
    // trim to the rolling time window
    const tEnd = this.times[this.times.length - 1];
    const tMin = tEnd - this.windowS;
    let drop = 0;
    while (drop < this.times.length && this.times[drop] < tMin) drop++;
    // safety cap on point count
    drop = Math.max(drop, this.times.length - MAX_POINTS);
    if (drop > 0) {
      this.times.splice(0, drop);
      this.xs.splice(0, drop);
      this.ys.splice(0, drop);
    }
    this.draw();
  }

  private draw() {
    const ctx = this.ctx;
    // CSS-pixel dimensions (ctx is already scaled by devicePixelRatio)
    const w = this.el.clientWidth || 300;
    const h = this.el.clientHeight || 240;
    ctx.clearRect(0, 0, w, h);
    if (this.xs.length < 2) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < this.xs.length; i++) {
      if (this.xs[i] < minX) minX = this.xs[i];
      if (this.xs[i] > maxX) maxX = this.xs[i];
      if (this.ys[i] < minY) minY = this.ys[i];
      if (this.ys[i] > maxY) maxY = this.ys[i];
    }
    // asymmetric insets: reserve a wider left/bottom margin for the axis labels
    // so the trace never overlaps them.
    const padT = 10;
    const padR = 12;
    const padL = 22; // room for the vertical y-axis label
    const padB = 18; // room for the x-axis label
    const sx = (x: number) =>
      padL + ((x - minX) / (maxX - minX || 1)) * (w - padL - padR);
    const sy = (y: number) =>
      h - padB - ((y - minY) / (maxY - minY || 1)) * (h - padB - padT);

    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx(this.xs[0]), sy(this.ys[0]));
    for (let i = 1; i < this.xs.length; i++) ctx.lineTo(sx(this.xs[i]), sy(this.ys[i]));
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui";
    // x-axis label: centered under the plot, in the reserved bottom margin
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.xSig, (padL + (w - padR)) / 2, h - 2);
    // y-axis label: vertical, centered in the reserved left margin
    ctx.save();
    ctx.translate(10, (padT + (h - padB)) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.ySig, 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /** Snapshot the current rolling-window buffer for CSV export. */
  getSeries(): { time: number[]; labels: string[]; cols: number[][] } {
    return {
      time: this.times.slice(),
      labels: [this.xSig, this.ySig],
      cols: [this.xs.slice(), this.ys.slice()],
    };
  }

  private resize() {
    const dpr = globalThis.devicePixelRatio || 1;
    this.canvas.width = (this.el.clientWidth || 300) * dpr;
    this.canvas.height = (this.el.clientHeight || 240) * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  dispose() {
    this.ro.disconnect();
    this.canvas.remove();
  }
}
