# Explain — command protocol (bot-facing)

You can do more than explain the model: you can **propose actions on the running
simulation**. The Explain web app parses actions out of your reply, validates them,
and shows the user an **Apply / Dismiss** button for each. Nothing changes the patient
until the user clicks Apply — so propose freely, but propose correctly.

This file says **how** to emit an action. The companion `command-catalog.md` lists
**what** you may emit — in **Full mode** (the default) that's *every* settable parameter
and function on *every* model; in **Guided mode** it's a small curated set. Anything not
backed by the catalog + the live model map is rejected by the app.

## How to emit a command

Put each action in its own fenced code block tagged `explain-command`, containing a
single JSON object. You may include several blocks in one reply. Keep your normal
prose too — explain what you're doing and why; the blocks are stripped from the text
the user reads and rendered as action cards instead.

````
Sure — I'll start mechanical ventilation and set a rate of 40.

```explain-command
{"op":"call","model":"Ventilator","target":"switch_ventilator","args":[true],"reason":"start ventilation"}
```

```explain-command
{"op":"setProp","model":"Ventilator","target":"vent_rate","value":40,"reason":"set rate to 40/min"}
```
````

## The envelope

One JSON object per block. Fields by `op`:

| `op` | required fields | meaning |
|------|-----------------|---------|
| `call` | `model`, `target`, `args` (array) | invoke a model function (e.g. `switch_ventilator`) |
| `setProp` | `model`, `target`, `value` | set a model property (e.g. `vent_rate`); optional `it`/`at` (see Scheduling) |
| `event` | `name`, `changes` (array) | build a **named, saved event** of timed property changes (see Scheduling) |
| `start` | — | start the realtime simulation loop |
| `stop` | — | stop the realtime simulation loop |
| `diagram` | `action`, + per-action fields | edit the diagram (see below) |
| `loadDefinition` | `name`, `summary` | load+run a **brand-new calibrated patient** you built (see "Building a new patient") |

`model` is the **instance name** (see the model map below), `target` is the field or
function name from the catalog. `reason` is optional but always include it — a short
human label shown on the action card (e.g. `"raise PEEP to recruit lung"`).

## Scheduling changes over time (`it` / `at`, and `op:"event"`)

A change doesn't have to be instantaneous. Two optional numeric fields control timing
(both in **simulated seconds**, and they only advance while the simulation is running):

- **`it`** — *ramp duration*. The property tweens linearly from its current value to the
  target over `it` seconds. Numeric properties only; booleans/lists ignore it (instant swap).
- **`at`** — *delay*. The change waits `at` seconds (relative to when it is applied) before
  it starts.

You can put `it`/`at` on a plain `setProp`:

```explain-command
{"op":"setProp","model":"Heart","target":"heart_rate_ref","value":200,"it":15,"reason":"ramp HR to 200 over 15s"}
```

To bundle several timed changes into one **named, reusable event**, use `op:"event"`. Each
entry in `changes[]` is a `setProp`-style `{model,target,value,it?,at?}` (values in display
units, validated against the catalog exactly like a `setProp`). Applying the card **saves
the event into the Event Scheduler panel** — it does *not* fire it; the user then applies or
arms it there. `fire_at` (absolute sim-clock auto-fire) is an optional panel feature; leave
it out unless asked.

```explain-command
{"op":"event","name":"induce tachy","changes":[
  {"model":"Heart","target":"heart_rate_ref","value":200,"it":15},
  {"model":"Breathing","target":"breathing_enabled","value":false,"at":30}
],"reason":"ramp HR to 200 over 15s, then apnea at +30s"}
```

If any change fails validation (unknown field, out-of-range value, …) the whole event is
rejected with the offending change named — fix and re-emit.

## Editing the diagram (`op:"diagram"`)

You can also build or restyle the **diagram** the user sees — compartments (sprites
bound to engine models) and connectors (paths between them). These commands need the
**Diagram tab to be open**; if it isn't, the card tells the user to open it.

Each turn's context includes a **`Current diagram`** block listing every component id and
its model binding, plus the usual **`Models in scenario:`** map. Reference existing
components by the exact id from `Current diagram`; bind to engine instances by the exact
name from the model map; give every *new* component a unique `name`.

The `action` field selects the edit; see `command-catalog.md` (the "Diagram editing"
section) for the per-action fields, the allowed `picto` images, `path.type` values, and the
cosmetic `setLayout` patch keys. Sequencing within one reply works: a `connect` may
reference a component an earlier `addComponent` in the same reply creates.

````
Sure — I'll add a kidney compartment and wire it to the aorta.

```explain-command
{"op":"diagram","action":"addComponent","name":"Kidney","models":["Kidneys"],"picto":"general.png","label":"Kidney","pos":{"type":"arc","dgs":210},"reason":"add kidney"}
```

```explain-command
{"op":"diagram","action":"connect","from":"AA","to":"Kidney","models":["AA_Kidney"],"path":{"type":"arc"},"reason":"renal artery"}
```
````

## Building a new patient (`op:"loadDefinition"`)

Beyond tweaking the running patient, you can **build a brand-new, calibrated patient
from target physiological values** the user gives you (typed, or in an attached PDF /
CSV) and run it immediately. This replaces the whole model, so it's **Full scope only**
and always confirm-before-apply.

**You can only do this if you are the Agent-SDK bot with a checkout of the Explain
repo + Node** (the bot host). The build runs the engine headless; a knowledge-only
fallback bot cannot do it — in that case, tell the user the feature needs the build bot.

### Workflow

1. **Collect the targets.** From the user's message (and any attached file) extract the
   physiological targets: weight, gestational age, HR, MAP, CVP, mean PAP, SpO2/PO2,
   pCO2, pH/BE, Hb, temperature, PDA, and any pathophysiology (e.g. RDS severity).
   Ask for anything critical that's missing (at least a weight or gestational age).

2. **Pick the closest baseline** scenario to start from (it's much easier to calibrate a
   nearby baseline than to build from scratch): `term_neonate`, `preterm_24wk`…`preterm_36wk`,
   `adult_female`, `term_fetus`, a CDH/CHD/PDA variant, etc. (see the scenario list in the
   knowledge pack / `public/model_definitions/index.json`).

3. **Write a SPEC and run the builder** in your checkout (ideally a throwaway git worktree
   so baselines stay read-only):

   ```bash
   echo '{"baseline":"term_neonate","name":"custom_preterm","targets":{"weight":1.2,"gestational_age":28,"map":33,"hr":165,"spo2":90,"pco2":52,"be":-5}}' \
     | node scripts/build_patient.mjs > patients/custom_preterm.json 2> build.log
   ```

   `stdout` is the full runnable scenario JSON; `stderr` (`build.log`) is the calibration
   trace + a final residual report (`CONVERGED` / `INCOMPLETE`, with per-target Δ). **Read
   the report** — tell the user which targets were met and surface any that weren't.

4. **Emit a tiny `loadDefinition`** naming the patient. **Do NOT paste the scenario JSON
   into your reply** — it's ~300 KB; the bot host reads the file from disk and attaches it
   to the response as `artifact`, and the app loads it via that. Your block stays small:

   ```explain-command
   {"op":"loadDefinition","name":"custom_preterm","summary":"1.2 kg / 28 wk preterm — MAP 33, SpO2 90, pCO2 52, BE −5","reason":"build and run the requested preterm"}
   ```

### SPEC schema

```jsonc
{
  "baseline": "term_neonate",          // required — a scenario name to start from
  "name": "custom_patient",            // output patient name
  "targets": {                          // all optional; only listed vitals are calibrated
    "weight": 1.2, "gestational_age": 28, "height": 0.355, "age": 0, // structural
    "hb": 9.5, "temp": 36.8, "pda": 0.4,                             // structural
    "hr": 165, "map": 33, "cvp": 4, "pap_m": 28,                     // iterated (mmHg, bpm)
    "spo2": 90, "po2": 55, "pco2": 52, "ph": 7.28, "be": -5, "co": 0.3 // iterated
  },
  "pathophysiology": { "rds": "mild|moderate|severe", "pvr_scale": 1.7 },
  "tolerance": { "map": 3, "pco2": 4 },  // optional per-target band overrides
  "max_iters": 12, "warm_seconds": 45, "final_seconds": 200
}
```

Units match the monitor/ABG the app shows: pressures mmHg, SpO2 %, temp °C, pH unitless,
pCO2/PO2 mmHg, BE mmol/L, weight kg, height m, CO L/min.

### What the builder calibrates (and limits)

The builder runs a closed loop: warm to steady state → measure vitals → nudge one lever
per off-target vital → repeat. Lever map (one dominant lever each): MAP←systemic
resistance, mean PAP←pulmonary resistance, CVP←venous unstressed volume, HR←heart-rate
reference, PO2/SpO2←alveolar O₂ diffusion, **pCO2←spontaneous ventilatory drive** (so it
assumes the patient breathes spontaneously — for a ventilated patient set ventilator
rate/Vt instead), BE/pH←Stewart unmeasured anions, CO←contractility. Targets it can't
reach in `max_iters` are reported `INCOMPLETE`; don't claim a value the report didn't hit.

## Picking the model and target

A request like *"lower the systemic vascular resistance"* or *"make the left ventricle
stiffer"* names a thing, not a field. Resolve it in three steps:

1. **Find the instance.** Each user turn's context includes a **`Models in scenario:`**
   block listing every live instance grouped by `model_type`
   (e.g. `HeartChamber: LA, RA, LV, RV`). Pick the instance the user means — that's your
   `model` (e.g. `LV`, or the singleton `Circulation`).
2. **Find the field.** Look up that instance's `model_type` in `command-catalog.md` and
   choose the parameter or function that matches the intent (e.g. `Circulation` →
   `svr_factor_art`, or `HeartChamber` → `el_max_factor_ps`).
3. **Prefer the `*_factor_ps` knob** for physiological tuning: a `factor` field where
   `1.0` = baseline, `>1` increases, `<1` decreases. It composes with interventions and
   weight-scaling, so "stiffer LV" → `{"op":"setProp","model":"LV","target":"el_max_factor_ps","value":1.3}`
   is better than editing a raw elastance. Use base values only when the user gives an
   explicit target number in real units.

If you can't find a matching instance in the map or field in the catalog, say so instead
of guessing a name.

## Rules

- **Only emit a command when the user actually asks to change something** ("turn on
  the ventilator", "raise the FiO2", "start the sim"). For questions ("why is the
  saturation low?") just answer — no command block.
- **Use real names verbatim.** `model` = an instance name from the live `Models in
  scenario:` map; `target` + argument names = exactly as in `command-catalog.md`. Do not
  invent instances, properties, functions, or extra args.
- **Scope.** The user runs either Full (default — anything in the catalog) or Guided (the
  small curated set). You can't see which. Propose the most direct command; if it comes
  back rejected as *"not enabled in Guided scope"*, tell the user to switch the chat
  panel to **Full** and re-ask.
- **Values are in the displayed clinical unit** shown in the catalog (e.g. FiO2 as a
  fraction `0.4`, rate in `/min`, pressures in `cmH2O`). Stay within the stated range —
  out-of-range values are rejected.
- **One action per block.** Multiple blocks are fine and applied independently.
- **Don't fabricate results.** You're proposing, not executing. Say what the command
  *will* do. The user must click Apply; only then does it run. The next turn's context
  block tells you what actually happened: a line **`Applied from your suggestions:`** lists
  the actions the user accepted (with how long ago), and the live vitals reflect their
  effect. Use that to confirm/adjust — if a proposal isn't in that list, it wasn't applied.
- If the user asks for something not in the catalog, say it isn't available yet rather
  than emitting a command that will be rejected.

## When you're a fallback (non-Agent-SDK) bot

If you receive this file as part of a system prompt rather than reading it from a
working directory, the same rules apply — emit the `explain-command` blocks inline in
your reply exactly as above.
