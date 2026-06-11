// Bot-issued command pipeline: parse -> validate -> execute.
//
// The Explain AI bot runs on a separate machine and can only talk back through
// its HTTP reply, so any command it wants to run rides INSIDE that reply as a
// fenced ```explain-command``` JSON block. This module turns those blocks into
// validated, executable actions against the live model.
//
//   parseCommands(answer)         -> strip blocks out of the prose, parse JSON
//   validateCommand(cmd, state)   -> allowlist + registry-schema check, unit conv
//   executeCommand(norm, explain) -> route to the matching useExplain() method
//
// Validation reuses the SAME schema the UI editor uses (MODEL_INTERFACES via
// getInterfaceForType) for bounds (ll/ul), list choices, function args, and the
// display->raw unit factor — so a bot command behaves exactly like a human edit.

import { getInterfaceForType } from "@/model-interface/registry";
import type { InterfaceField } from "@/model-interface/types";
import { isAllowed, type CommandOp } from "./botCommandAllowlist";

// ---- wire shape the bot emits (one JSON object per fenced block) ----
export interface BotCommand {
  op: CommandOp;
  model?: string; // call / setProp: the model instance name (e.g. "Ventilator")
  target?: string; // call: method name; setProp: property name
  args?: unknown[]; // call: positional args (clinical/display units)
  value?: unknown; // setProp: new value (clinical/display units)
  it?: number; // setProp: tween time in seconds (optional)
  at?: number; // delay before applying, seconds (optional)
  seconds?: number; // calculate
  name?: string; // load
  group?: string; // scale
  factor?: number; // scale
  reason?: string; // optional human label for the action card
}

// ---- normalized, engine-ready action (units already converted to raw) ----
export type NormalizedCommand =
  | { kind: "call"; fn: string; args: unknown[]; at: number }
  | { kind: "setProp"; prop: string; value: number | boolean | string; it: number; at: number }
  | { kind: "start" }
  | { kind: "stop" };

export interface ValidationResult {
  ok: boolean;
  normalized?: NormalizedCommand;
  description: string; // human-readable summary for the card
  error?: string; // why it was rejected (when ok === false)
}

export interface ParseResult {
  clean: string; // prose with the command blocks removed
  commands: BotCommand[]; // successfully parsed command objects
  parseErrors: string[]; // blocks that failed JSON.parse (surfaced, not silent)
}

const BLOCK_RE = /```explain-command\s*([\s\S]*?)```/g;

// Pull every ```explain-command``` block out of the bot reply, parse each as
// JSON, and return the leftover prose plus the parsed commands.
export function parseCommands(answer: string): ParseResult {
  const commands: BotCommand[] = [];
  const parseErrors: string[] = [];
  if (typeof answer !== "string") {
    return { clean: "", commands, parseErrors };
  }

  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(answer)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      // a single block may hold one object or an array of them
      for (const c of Array.isArray(parsed) ? parsed : [parsed]) {
        if (c && typeof c === "object") commands.push(c as BotCommand);
      }
    } catch {
      parseErrors.push(raw.slice(0, 120));
    }
  }

  const clean = answer.replace(BLOCK_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { clean, commands, parseErrors };
}

// ---- validation helpers ----

function fieldsFor(modelName: string, modelState: any): InterfaceField[] | null {
  const type = modelState?.models?.[modelName]?.model_type;
  if (!type) return null;
  return getInterfaceForType(type);
}

// display(UI) value -> raw(engine) value, mirroring ModelEditor.toRaw
function toRaw(f: InterfaceField, ui: number): number {
  return ui / (f.factor ?? 1);
}

// Resolve the allowed list values for a `list` field/arg. The registry mixes
// `options` (model-type names) and `choices` (literal strings) and doesn't
// always set `custom_options`; a plain `?? ` chain wrongly stops at an empty
// `options: []`. Pick the first non-empty of the relevant arrays.
function resolveChoices(f: InterfaceField): string[] {
  const candidates = [f.custom_options ? f.choices : f.options, f.choices, f.options];
  return candidates.find((c) => Array.isArray(c) && c.length > 0) ?? [];
}

// check a numeric display value against the field's ll/ul (which are in display
// units, e.g. tidal volume 1–500 mL); returns an error string or null
function checkNumberBounds(f: InterfaceField, label: string, v: number): string | null {
  if (typeof v !== "number" || Number.isNaN(v)) return `${label} must be a number`;
  if (typeof f.ll === "number" && v < f.ll) return `${label} ${v} below minimum ${f.ll}`;
  if (typeof f.ul === "number" && v > f.ul) return `${label} ${v} above maximum ${f.ul}`;
  return null;
}

function reject(description: string, error: string): ValidationResult {
  return { ok: false, description, error };
}

// How wide the command surface is. "guided" = the curated allowlist (safe demos);
// "full" = any non-readonly, runtime-settable registry field on any live model.
export type CommandScope = "guided" | "full";

// Runtime-settable property field types. Excludes the structural wiring types
// (multiple-list / prop-list / reference / dict — all rebuild-only) and string
// (~all readonly descriptions). `factor` is the persistent `*_factor_ps` knobs.
const SETTABLE_PROP_TYPES = new Set(["number", "factor", "boolean", "list"]);

// Is this field something the bot may set/call at runtime? The registry only
// lists editable fields, but it also carries readonly measured-outputs and
// structural wiring — exclude those.
export function isSettableField(f: InterfaceField, op: "setProp" | "call"): boolean {
  if (op === "call") return f.type === "function";
  return !f.readonly && SETTABLE_PROP_TYPES.has(f.type);
}

// Validate a single parsed command against the scope gate + the model-interface
// schema, converting display units to raw. Pure (no engine access) so it can be
// unit-tested with a plain modelState object. `scope` selects the gate: "guided"
// restricts to the allowlist, "full" allows any settable registry field.
export function validateCommand(
  cmd: BotCommand,
  modelState: any,
  scope: CommandScope = "full",
): ValidationResult {
  const op = cmd.op;
  const label = cmd.reason || `${op} ${cmd.model ?? ""}${cmd.target ? "." + cmd.target : ""}`;

  // sim-control ops carry no model/target and are allowed in both scopes
  if (op === "start")
    return { ok: true, normalized: { kind: "start" }, description: cmd.reason || "start simulation" };
  if (op === "stop")
    return { ok: true, normalized: { kind: "stop" }, description: cmd.reason || "stop simulation" };
  if (op !== "setProp" && op !== "call")
    return reject(label, `unsupported op "${op}"`);

  // Guided scope: only the curated allowlist. Full scope: rely on the
  // settable-field + bounds checks inside each case below.
  if (scope === "guided" && !isAllowed(op, cmd.model, cmd.target)) {
    return reject(
      label,
      `not enabled in Guided scope: ${op} ${cmd.model ?? ""}${cmd.target ? "." + cmd.target : ""} — switch to Full scope to allow`,
    );
  }

  switch (op) {
    case "setProp": {
      if (!cmd.model || !cmd.target) return reject(label, "setProp requires model + target");
      const fields = fieldsFor(cmd.model, modelState);
      if (!fields) return reject(label, `model "${cmd.model}" not found in current scenario`);
      const f = fields.find((x) => x.target === cmd.target);
      if (!f) return reject(label, `"${cmd.target}" is not an editable property of ${cmd.model}`);
      if (f.readonly) return reject(label, `"${cmd.target}" is read-only on ${cmd.model}`);
      if (!isSettableField(f, "setProp"))
        return reject(label, `${cmd.model}.${cmd.target} (type "${f.type}") is not settable at runtime`);

      const at = typeof cmd.at === "number" ? cmd.at : 0;
      const it = typeof cmd.it === "number" ? cmd.it : 0;
      const prop = `${cmd.model}.${cmd.target}`;

      if (f.type === "number" || f.type === "factor") {
        const v = cmd.value as number;
        const err = checkNumberBounds(f, cmd.target!, v);
        if (err) return reject(label, err);
        const unit = f.caption?.match(/\(([^)]+)\)/)?.[1] ?? "";
        return {
          ok: true,
          normalized: { kind: "setProp", prop, value: toRaw(f, v), it, at },
          description: cmd.reason || `${cmd.model}: ${cmd.target} → ${v}${unit ? " " + unit : ""}`,
        };
      }
      if (f.type === "boolean") {
        if (typeof cmd.value !== "boolean") return reject(label, `${cmd.target} expects true/false`);
        return {
          ok: true,
          normalized: { kind: "setProp", prop, value: cmd.value, it: 0, at },
          description: cmd.reason || `${cmd.model}: ${cmd.target} → ${cmd.value}`,
        };
      }
      if (f.type === "list") {
        const choices = resolveChoices(f);
        if (typeof cmd.value !== "string" || !choices.includes(cmd.value))
          return reject(label, `${cmd.target} must be one of: ${choices.join(", ")}`);
        return {
          ok: true,
          normalized: { kind: "setProp", prop, value: cmd.value, it: 0, at },
          description: cmd.reason || `${cmd.model}: ${cmd.target} → ${cmd.value}`,
        };
      }
      return reject(label, `property type "${f.type}" not supported for bot commands`);
    }

    case "call": {
      if (!cmd.model || !cmd.target) return reject(label, "call requires model + target");
      const fields = fieldsFor(cmd.model, modelState);
      if (!fields) return reject(label, `model "${cmd.model}" not found in current scenario`);
      const f = fields.find((x) => x.target === cmd.target && x.type === "function");
      if (!f) return reject(label, `"${cmd.target}" is not a callable function of ${cmd.model}`);

      const argDefs = f.args ?? [];
      const inArgs = Array.isArray(cmd.args) ? cmd.args : [];
      if (inArgs.length !== argDefs.length)
        return reject(label, `${cmd.target} expects ${argDefs.length} arg(s), got ${inArgs.length}`);

      const rawArgs: unknown[] = [];
      for (let i = 0; i < argDefs.length; i++) {
        const a = argDefs[i];
        const v = inArgs[i];
        if (a.type === "number") {
          const err = checkNumberBounds(a, a.target, v as number);
          if (err) return reject(label, err);
          rawArgs.push(toRaw(a, v as number));
        } else if (a.type === "boolean") {
          if (typeof v !== "boolean") return reject(label, `${a.target} expects true/false`);
          rawArgs.push(v);
        } else if (a.type === "list") {
          const choices = resolveChoices(a);
          if (typeof v !== "string" || !choices.includes(v))
            return reject(label, `${a.target} must be one of: ${choices.join(", ")}`);
          rawArgs.push(v);
        } else {
          rawArgs.push(v);
        }
      }

      const at = typeof cmd.at === "number" ? cmd.at : 0;
      const argStr = inArgs.map((a) => JSON.stringify(a)).join(", ");
      return {
        ok: true,
        normalized: { kind: "call", fn: `${cmd.model}.${cmd.target}`, args: rawArgs, at },
        description: cmd.reason || `${cmd.model}.${cmd.target}(${argStr})`,
      };
    }
  }
}

// The slice of useExplain() the executor needs (keeps this module Vue-free).
export interface ExplainHandle {
  call: (fn: string, args?: unknown[], at?: number) => void;
  setProp: (prop: string, value: any, it?: number, at?: number) => void;
  start: () => void;
  stop: () => void;
}

// Apply a validated, normalized command to the live engine.
export function executeCommand(norm: NormalizedCommand, explain: ExplainHandle): void {
  switch (norm.kind) {
    case "call":
      explain.call(norm.fn, norm.args, norm.at);
      break;
    case "setProp":
      explain.setProp(norm.prop, norm.value, norm.it, norm.at);
      break;
    case "start":
      explain.start();
      break;
    case "stop":
      explain.stop();
      break;
  }
}
