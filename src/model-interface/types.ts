// UI-owned schema for editing model parameters. This metadata was formerly a
// `static model_interface` array on each engine model class; it has been
// relocated here so the physics engine (explain/) stays pure — UI presentation
// is not the model's concern. See registry.ts for the per-model_type data.

// One editable field describing a model property (or a callable method for
// `function`), including how the UI should render and constrain it.
export interface InterfaceField {
  target: string; // prop name (or method name for `function`)
  type: string; // see TYPE handling in ModelEditor.vue
  caption?: string;
  readonly?: boolean;
  edit_mode?: string; // basic | extra | factors | advanced | all | caption
  build_prop?: boolean;
  // numeric controls
  factor?: number; // display = raw * factor; write = uiValue / factor
  delta?: number; // spinner step
  rounding?: number; // decimal places
  ll?: number; // lower limit
  ul?: number; // upper limit
  slider?: boolean; // render as a slider instead of a spinner
  // list controls
  options?: string[]; // model-type names (list / multiple-list)
  choices?: string[]; // literal choices, used when custom_options is true
  custom_options?: boolean;
  // function controls
  args?: InterfaceField[]; // positional argument descriptors
  default?: any; // initial value for a function arg
  // prop-list controls (two-level model + property reference)
  target_model?: string;
  target_prop?: string;
  caption_model?: string;
  caption_prop?: string;
}

// Ordered edit_mode buckets. `caption`/`all` fold into `basic` so the common
// description/enabled fields show up first; anything unrecognised lands in
// `basic` too.
export interface FieldGroup {
  mode: string;
  label: string;
  fields: InterfaceField[];
}

const GROUP_ORDER: { mode: string; label: string }[] = [
  { mode: "basic", label: "Basic" },
  { mode: "extra", label: "Extra" },
  { mode: "factors", label: "Factors" },
  { mode: "advanced", label: "Advanced" },
];

function resolveMode(field: InterfaceField): string {
  const m = field.edit_mode;
  if (m === "extra" || m === "factors" || m === "advanced") return m;
  return "basic"; // basic, caption, all, undefined, unknown
}

// Partition interface fields into ordered, non-empty groups for sectioned UI.
export function groupByEditMode(fields: InterfaceField[]): FieldGroup[] {
  const buckets = new Map<string, InterfaceField[]>();
  for (const f of fields) {
    const mode = resolveMode(f);
    (buckets.get(mode) ?? buckets.set(mode, []).get(mode)!).push(f);
  }
  return GROUP_ORDER.filter((g) => (buckets.get(g.mode)?.length ?? 0) > 0).map(
    (g) => ({ mode: g.mode, label: g.label, fields: buckets.get(g.mode)! }),
  );
}
