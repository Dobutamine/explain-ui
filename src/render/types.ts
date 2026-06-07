// Shell-side TypeScript types for the realtime render layer. These mirror the
// shapes the RealtimeBus hands to renderer adapters (the engine itself is JS).

export interface ChartFrame {
  version: number;
  stride: number;
  slots: string[];
  count: number;
  rows: Float64Array;
}

export interface AnimComponent {
  name: string;
  index: number;
  kind: "vol" | "flow";
  models: string[];
  tinting: boolean;
}

export interface AnimLayout {
  count: number;
  stride: number;
  max_to2: number;
}

export interface AnimFrame {
  version: number;
  stride: number;
  components: AnimComponent[];
  layout: AnimLayout;
  frame: Float32Array;
}

// The rt_channels handshake payload, as posted by the worker.
export interface ChannelsPayload {
  descriptor: any;
  chart: { version: number; slots: string[] };
  anim: { version: number; components: AnimComponent[]; layout: AnimLayout } | null;
}

export interface RendererAdapter {
  onRegistry?(payload: ChannelsPayload): void;
  onFrame(chart: ChartFrame | null, anim: AnimFrame | null): void;
  dispose?(): void;
}
