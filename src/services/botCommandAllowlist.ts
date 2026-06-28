// Single source of truth for which bot-issued commands the webapp will execute.
//
// The chat pipeline (`botCommands.ts`) validates every command the bot proposes
// against this list, and the bot-facing catalog generator
// (`scripts/build_command_catalog.mjs`) reads the SAME list so the bot is never
// told it can do something the webapp would then refuse. To widen the bot's
// reach, add an entry here and regenerate the catalog — nothing else.
//
// v1 is a deliberate vertical slice: ventilator on/off + a few vent params +
// start/stop the sim. Broaden one model-type at a time.

export type CommandOp =
  | "call" // invoke a model method        -> useExplain().call
  | "setProp" // write a model property        -> useExplain().setProp
  | "scale" // scale a parameter group       -> useExplain().scale
  | "start" // start the realtime loop       -> useExplain().start
  | "stop" // stop the realtime loop         -> useExplain().stop
  | "calculate" // run N seconds offline          -> useExplain().calculate
  | "load" // load a scenario by name        -> useExplain().load
  | "loadDefinition" // load a bot-built patient definition -> useExplain().loadFromObject
  | "event" // build a named scheduled event  -> useEventsStore() (see chat store)
  | "diagram"; // edit the diagram             -> DiagramRenderer (see diagram actions below)

export interface AllowEntry {
  op: CommandOp;
  model?: string; // for call / setProp (the model instance name)
  target?: string; // function name (call) or prop name (setProp)
  note?: string; // short human description, surfaced in the bot catalog
}

export const COMMAND_ALLOWLIST: AllowEntry[] = [
  // --- Ventilator (mechanical ventilation device) ---
  {
    op: "call",
    model: "Ventilator",
    target: "switch_ventilator",
    note: "turn mechanical ventilation on/off (arg: boolean)",
  },
  { op: "call", model: "Ventilator", target: "set_fio2", note: "set inspired O2 fraction (0.21–1.0)" },
  {
    op: "call",
    model: "Ventilator",
    target: "set_ettube_diameter",
    note: "set endotracheal tube diameter (mm)",
  },
  {
    op: "call",
    model: "Ventilator",
    target: "set_ettube_length",
    note: "set endotracheal tube length (mm)",
  },
  { op: "setProp", model: "Ventilator", target: "vent_mode", note: "ventilation mode (PC/PRVC/PS/CPAP)" },
  { op: "setProp", model: "Ventilator", target: "vent_rate", note: "ventilator rate (/min)" },
  { op: "setProp", model: "Ventilator", target: "insp_time", note: "inspiration time (s)" },
  { op: "setProp", model: "Ventilator", target: "tidal_volume", note: "target tidal volume (mL)" },
  { op: "setProp", model: "Ventilator", target: "pip_cmh2o", note: "peak inspiratory pressure (cmH2O)" },
  {
    op: "setProp",
    model: "Ventilator",
    target: "pip_cmh2o_max",
    note: "max peak inspiratory pressure, PRVC (cmH2O)",
  },
  {
    op: "setProp",
    model: "Ventilator",
    target: "peep_cmh2o",
    note: "positive end-expiratory pressure (cmH2O)",
  },

  // --- Hemodynamics + autonomic nervous system ---
  { op: "setProp", model: "Heart", target: "heart_rate_ref", note: "reference heart rate (bpm)" },
  { op: "setProp", model: "Heart", target: "ans_sens", note: "autonomic sensitivity of the heart (0–1)" },
  { op: "setProp", model: "Ans", target: "ans_active", note: "autonomic nervous system on/off" },

  // --- Spontaneous breathing + metabolism ---
  {
    op: "setProp",
    model: "Breathing",
    target: "breathing_enabled",
    note: "spontaneous breathing on/off",
  },
  {
    op: "setProp",
    model: "Breathing",
    target: "minute_volume_ref",
    note: "reference minute volume (L/kg/min)",
  },
  { op: "setProp", model: "Metabolism", target: "met_active", note: "metabolism on/off" },
  { op: "setProp", model: "Metabolism", target: "vo2", note: "oxygen consumption VO2 (mL/kg/min)" },

  // --- Drugs ---
  {
    op: "call",
    model: "Drugs",
    target: "administer_bolus",
    note: "IV bolus (args: drug name, dose in mcg 0–1000)",
  },
  {
    op: "call",
    model: "Drugs",
    target: "set_infusion",
    note: "continuous infusion (args: drug name, rate mcg/kg/min)",
  },
  { op: "setProp", model: "Drugs", target: "drugs_running", note: "drug engine on/off" },

  // --- Resuscitation (CPR) ---
  { op: "call", model: "Resuscitation", target: "switch_cpr", note: "start/stop CPR (arg: boolean)" },
  {
    op: "call",
    model: "Resuscitation",
    target: "set_fio2",
    note: "set CPR ventilation FiO2 (0–1)",
  },
  {
    op: "setProp",
    model: "Resuscitation",
    target: "chest_comp_freq",
    note: "chest compression frequency (/min)",
  },

  // --- Simulation control ---
  { op: "start", note: "start the realtime simulation loop" },
  { op: "stop", note: "stop the realtime simulation loop" },

  // --- Whole-patient replacement (Full scope only) ---
  // Loads a complete, bot-built calibrated patient definition and runs it
  // immediately (replaces the current model). The definition is NOT carried in
  // the command block — it arrives out-of-band in the chat response `artifact`
  // field (the bot host builds it with scripts/build_patient.mjs). Gated to Full
  // scope in validateCommand (too powerful for Guided demos) + confirm-before-apply.
  { op: "loadDefinition", note: "load+run a bot-built calibrated patient (Full scope; definition rides in response.artifact)" },
];

// True when (op, model?, target?) matches an allowlist entry. Ops without a
// model/target (start/stop/...) match on op alone.
export function isAllowed(op: string, model?: string, target?: string): boolean {
  return COMMAND_ALLOWLIST.some(
    (e) =>
      e.op === op &&
      (e.model === undefined || e.model === model) &&
      (e.target === undefined || e.target === target),
  );
}

// --- Diagram editing (op: "diagram") ---------------------------------------
//
// Diagram edits are a separate capability surface from model commands: they
// don't target a registry field (no ll/ul/choices), they mutate the live
// DiagramRenderer instead of the engine. They're gated on the renderer being
// mounted (the Diagram tab) rather than on the guided/full allowlist. The
// per-action field rules are validated in botCommands.validateDiagramCommand and
// described to the bot via this descriptor list (build_command_catalog.mjs).
//
// FUTURE: risk-tiering / rate-limiting of structural diagram edits, mirroring
// the model-command allowlist note above.
export type DiagramAction =
  | "addComponent"
  | "connect"
  | "setLayout"
  | "setLabel"
  | "setModels"
  | "setPicto"
  | "delete";

export interface DiagramActionDef {
  action: DiagramAction;
  fields: string; // required/optional fields the bot must emit
  note: string; // short human description for the bot catalog
}

export const DIAGRAM_ACTIONS: DiagramActionDef[] = [
  {
    action: "addComponent",
    fields: "name (unique), models[] (engine instance names), picto, label?, pos?",
    note: "add a compartment bound to engine model(s); pos is {type:'arc',dgs} or {type:'rel',x,y}",
  },
  {
    action: "connect",
    fields: "from, to (existing component names), models?[], path?{type,width}",
    note: "draw a connector between two existing components, optionally bound to a Resistor model",
  },
  {
    action: "setLayout",
    fields: "name, patch (cosmetic layout keys only)",
    note: "restyle a component/connector: alpha, z_index, tinting, sprite color/scale/rotation/pos, label, path",
  },
  { action: "setLabel", fields: "name, text", note: "set a component's caption text" },
  { action: "setModels", fields: "name, models[]", note: "rebind which engine model(s) a component/connector represents" },
  { action: "setPicto", fields: "name, picto", note: "swap a compartment's sprite image" },
  { action: "delete", fields: "name", note: "remove a component (and its attached connectors) or a connector" },
];

export function isDiagramAction(a: unknown): a is DiagramAction {
  return typeof a === "string" && DIAGRAM_ACTIONS.some((d) => d.action === a);
}
