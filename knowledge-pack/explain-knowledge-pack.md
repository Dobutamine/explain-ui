# Explain Knowledge Pack

This document is a self-contained snapshot of the **Explain** physiological simulation
engine and its surrounding web app, assembled so an assistant can answer questions about
the model with the same grounding Claude Code has when working in the repo.

**Tier:** FULL tier: architecture notes, all physiology docs, the complete engine source, the UI/integration layer, and the scenario format.

Every embedded file is introduced by a `### FILE: <path>` header so you can cite exact
source locations (e.g. `explain/base_models/Capacitance.js`) in answers. Treat the source
and docs below as the ground truth; prefer quoting them over recalling general knowledge.

## How this pack is organized

1. **Architecture** — the repo's CLAUDE.md (build flow, message envelope, model contract, the factor/effective-value pattern).
2. **Engine onboarding** — explain/README.md.
3. **Physiology docs** — explain/docs/*.md, the per-model derivations and math.
4. **Engine source** — the live ES-module classes that run in the Web Worker.
5. **UI / integration layer** — the parameter-edit schema and the chat store.
6. **Scenario format** — the model-definition JSON the engine consumes.

---

## 1. Architecture

### FILE: CLAUDE.md

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: the `CLAUDE.md` checked in at `/Users/timantonius/Projects/CLAUDE.md` describes an unrelated NICU CSV-dataset project. It does **not** apply here — this directory is the Explain physiological simulation engine. Ignore that file when working in this tree.

## What this is

This directory is a **slice of a larger Quasar/Vue web app** — specifically the `src/explain` physiological simulation engine (`explain/`) plus a set of scenario definitions (`model_definitions/`). There is no `package.json`, no build tooling, and no `node_modules` here. The engine is plain ES modules that run inside a **Web Worker** in the host app.

Because the host app isn't in this directory, you **cannot `npm run dev` / build / lint / test from here**. To actually run the model you need the parent Quasar app, which bootstraps the engine via `src/boot/explain.js` and serves definitions from `public/model_definitions`. Within this directory, work is read/edit-level: modifying engine classes, model definitions, and docs.

## Architecture

Two threads, one wire protocol:

- **`explain/Model.js`** — main-thread wrapper (extends `ModelEmitter`). Spawns the worker, exposes the public API (`build`/`load`/`start`/`stop`/`calculate`/`setPropValue`/`callModelFunction`/`watchModelProps`/`scaleModel`/…), and re-emits worker responses as events you subscribe to with `explain.on(event, handler)`.
- **`explain/ModelEngine.js`** — the Web Worker. Owns the live `model` object (`{ models: {…}, modeling_stepsize, model_time_total, ncc_* counters, … }`), the build/step loop, and the GET/POST/PUT/DELETE message router (`self.onmessage`).

**Message envelope** (both directions): `{ type: "GET"|"PUT"|"POST"|"DELETE", message: string, payload: any }`. `Model.send()` posts to the worker; the worker `_send()`/`postMessage()` back. `Model.receive()` maps inbound types (`state`, `data`, `rtf`/`rts` realtime fast/slow, `model_ready`, `status`, `error`, …) to emitter events. Payloads crossing the boundary are JSON-stringified for `build`/`property_value`/`call` and re-parsed by `_normalize_payload` in the worker.

**Build flow** (`ModelEngine.build`): clears state → for each entry in `model_definition.models`, looks up the class by `model_type` in `available_model_map` and instantiates it → calls `init_model(args)` on every instance (args = `[{key, value}, …]` derived from the definition) → attaches `DataCollector`, `TaskScheduler`, `ModelScaler` helpers and freezes `model._baseline_weight`. Any instantiation/init error aborts the build and emits a `status` ERROR. On success it emits `model_ready`.

**Step loop:** `_model_step()` calls `step_model()` on every model in insertion order, then `DataCollector.collect_data()`, then `TaskScheduler.run_tasks()`, then advances `model.model_time_total` by `modeling_stepsize`. `calculate(seconds)` runs `seconds / modeling_stepsize` steps synchronously; `start()` runs `_model_step_rt` on a `setInterval` (`rtInterval` 0.015 s wall-clock, batching `rtInterval / modeling_stepsize` model steps per tick). Step errors are caught per-model when `ENABLE_STEP_ERROR_GUARD` is true so one bad model doesn't kill the loop.

## Model class contract

Every model lives in `explain/base_models/`, `explain/component_models/`, or `explain/device_models/` and extends `BaseModelClass` (directly or via an intermediate like `Capacitance`/`Resistor`/`TimeVaryingElastance`). Contract:

- static `model_type` (string key used at build time and in definition JSON). Model classes carry **no UI metadata** — the parameter-edit schema lives in the UI layer at `src/model-interface/` (see below), not on the class.
- constructor `(model_ref, name = "")` — `model_ref` is the whole engine `model` object; store it as `this._model_engine` (done by the base). Initialize independent props (config), dependent props (computed outputs), and `_`-prefixed local refs. (`build()` passes a 3rd `model_type` arg that the base constructor ignores.)
- `init_model(args)` — applies config (base impl maps `args` `{key,value}` onto `this[key]`, then instantiates/inits anything declared in `this.components`). Override to resolve cross-model references (e.g. `this._lv = this._model_engine.models["LV"]`) and set `_is_initialized = true`.
- `step_model()` — base impl runs `calc_model()` only when `is_enabled && _is_initialized`. Don't override unless you need custom gating.
- `calc_model()` — where the physics happens. Override this.

**Registering a new model:** create the class, give it a static `model_type`, then **add an `export` line in `explain/ModelIndex.js`** (the engine builds its `available_model_map` from everything ModelIndex exports). Forgetting the export is the usual cause of "model type not found" at build. To make its parameters editable in the app, add a `model_type` entry to `src/model-interface/registry.ts`.

## The factor/effective-value pattern (important)

Core physics params (`el_base`, `u_vol`, `el_k` on capacitances; `r_for`, `r_back`, `r_k` on resistors; analogous on elastances) are never used raw in calculations. Each has three multiplier layers, combined additively against the base into an `*_eff` value:

- `<p>_factor` — **non-persistent**; reset to `1.0` every step (transient interventions).
- `<p>_factor_ps` — **persistent**; survives steps (user/scenario adjustments).
- `<p>_factor_scaling_ps` — **persistent scaling**; written by `ModelScaler` for allometric/weight scaling.

Formula (see `Capacitance.calc_elastances`, `Resistor.calc_resistance`): `p_eff = p + (factor-1)*p + (factor_ps-1)*p + (factor_scaling_ps-1)*p`. When adding a tunable parameter, follow this convention so it composes with interventions and scaling. `ModelScaler` (`explain/helpers/ModelScaler.js`) only ever touches the `*_scaling_ps` layer; `scaleModel(group, factor)` in the API routes to its many `scale_*` methods via the big `switch` in `ModelEngine.scale_model`. `reset` restores `model.weight = model._baseline_weight`.

## Flow / pressure mechanics

`Resistor` reads `comp_from.pres` and `comp_to.pres`, computes `flow`, then moves volume by calling `comp_from.volume_out(flow*dt)` / `comp_to.volume_in(...)`. `volume_out` returns any volume it couldn't supply so the resistor doesn't create volume from an empty compartment. `Capacitance.calc_pressure` derives `pres` from `(vol - u_vol_eff)` with linear + non-linear (`el_k`) terms plus `pres_ext`. `BloodCapacitance.volume_in` additionally mixes `to2`/`tco2`/`solutes`/`drugs`/`temp`/`viscosity` by the incoming volume fraction — this is how blood gases/solutes propagate through the circuit.

## Cardiac/breathing cycle counters

`Heart` (and ventilator/breathing) drive timing off counters that live on the **engine `model` object**, not the component: `model.ncc_ventricular`, `model.ncc_atrial`, `ncc_breathing_insp/exp`, `ncc_ventilator_insp/exp` (initialized in `build()`). `DataCollector` always watches `Heart.ncc_ventricular`/`Heart.ncc_atrial` for ECG regardless of the user watchlist.

## DataCollector & TaskScheduler

- **`DataCollector`** keeps two watchlists — fast (`watch_list`, `sample_interval` 0.005 s) and slow (`watch_list_slow`, 1.0 s). Watched props are dot-paths `"Model.prop"` or `"Model.prop.subprop"` resolved against `model.models`. `get_model_data()` drains and clears the buffer. `clean_up()` drops watch entries whose model became disabled.
- **`TaskScheduler`** runs deferred mutations every `_task_interval` (0.015 s). `setPropValue(prop, value, it, at)` → numeric targets **tween** over `it` seconds after an `at`-second delay (type 0), booleans/strings swap instantly (type 1); `callModelFunction` schedules a method call (type 2). It writes directly to model props, typically a `*_factor_ps` or a base param.

## Model definition JSON

Files in `model_definitions/*.json` are full scenarios. Top level: `name`, `user`, `description`, `diagram_definition`, `animation_definition`, `configuration`, and **`model_definition`** (the part the engine consumes). `Model.load()` fetches `/model_definitions/<name>.json` and unwraps `jsonData.model_definition || jsonData` before `build()`.

Inside `model_definition`: engine-level settings (`weight`, `height`, `gestational_age`, `age`, `modeling_stepsize`, `model_time_total`, `scaler_config`, `_baseline_weight`) plus **`models`** — a map of `name → { name, model_type, …params }`. A typical neonate scenario has ~60 components (one each of the high-level systems: `Heart`, `Breathing`, `Ans`, `Circulation`, `Respiration`, `Blood`, `Gas`, `Metabolism`, `Pda`, `Shunts`, devices `Ventilator`/`Ecls`/`Monitor`/`Resuscitation`, …) wired together by ~40 `Resistor` entries via their `comp_from`/`comp_to` names. Available scenarios are listed in `model_definitions/index.json`. Note: `explain/model_definitions/` and `explain/states/` hold separate dev copies; the canonical set is the top-level `model_definitions/`.

## `model_interface` schema (UI layer — `src/model-interface/`)

The parameter-edit schema is **owned by the UI, not the engine**. It lives in `src/model-interface/`: `registry.ts` holds `MODEL_INTERFACES` (a `Record<model_type, InterfaceField[]>`) plus `getInterfaceForType()`, and `types.ts` defines `InterfaceField` and the `groupByEditMode()` helper. The Vue layer reads it via `useModelInterface()` (`src/composables/useModelInterface.ts`), which maps a model instance → its `model_type` → the registry entry; `ModelEditor.vue` / `ParameterPanel.vue` render the controls.

Each `InterfaceField` describes one editable field: `target` (prop name, or method name for `function`), `type` (`number`/`boolean`/`string`/`list`/`multiple-list`/`factor`/`function`/`prop-list`/`reference`), `caption`, `edit_mode` (`basic`/`extra`/`factors`/`advanced`), `build_prop`, `readonly`; numbers add `factor` (display = raw×factor), `delta`, `rounding`, `ll`/`ul`, `slider`; lists add `options`/`choices`/`custom_options`; functions add `args`. When you add a configurable parameter, add a matching field to the model_type's array in `registry.ts` or it won't be editable in the app. The registry was generated by dumping each class's effective (inheritance-resolved) interface from `explain/ModelIndex.js`.

## Composite models

Some component models build sub-models inside `init_model` via the `this.components` mechanism (base `init_model` instantiates any declared component into `model.models` and inits it). This lets a high-level model own a local sub-network while its children still participate in the global step loop. Always register internally created models on `model.models` (by going through `components` or the engine map) so the scheduler/collector can reach them.

## Docs

`explain/docs/*.md` and `explain/papers/` contain the physiological derivations for several models (`BloodCapacitance`, `BloodVessel`, `HeartChamber`, `Pda`, …). Consult these before changing the math in those classes. `explain/README.md` has a student-onboarding walkthrough and a console-usage cheat sheet (`window.explain` in the host app).

```


## 2. Engine onboarding

### FILE: explain/README.md

````markdown
# Explain Model (`src/explain`)

This folder contains the in-browser physiological simulation engine used by the web app.
The model runs in a dedicated Web Worker (`ModelEngine.js`) and is controlled from the main thread through the `Model` wrapper (`Model.js`).

## High-level architecture


## Runtime lifecycle

1. UI constructs `new Model()` (see `src/boot/explain.js`).
2. `Model` creates a worker from `ModelEngine.js`.
3. UI calls `build()` or `load(<definition_name>)`.
4. Worker `build()`:
   - copies top-level model settings,
   - instantiates each model component by `model_type` via `ModelIndex`,
   - calls `init_model(args)` on each component,
   - creates `DataCollector` and `TaskScheduler`.
5. UI can run:
   - **batch simulation** via `calculate(seconds)`, or
   - **real-time simulation** via `start()` / `stop()`.
6. Worker sends state/data/status events back to main thread.

## Worker message protocol

`Model` and `ModelEngine` communicate with message objects:

```js
{
  type: "GET" | "PUT" | "POST" | "DELETE",
  message: string,
  payload: any
}
```

### Inbound commands to worker (`ModelEngine`)


### Outbound events from worker

Important worker event types handled in `Model.receive()`:


These are re-emitted as `CustomEvent`s on `document` by `Model`.

## Public API (`Model.js`)

Core methods used by UI code:


## Data collection and scheduling

### `DataCollector`

  - `watch_list` (fast stream)
  - `watch_list_slow` (slow stream)

### `TaskScheduler`


## Model class contract

Most classes extend `BaseModelClass` and follow this pattern:

  - `model_type` (string identifier used at build time)
  - constructor defines independent/dependent/local fields
  - `init_model(args)` applies config and sets `_is_initialized`
  - `step_model()` checks `is_enabled && _is_initialized`
  - `calc_model()` performs actual calculations

The engine is pure physics: model classes carry **no UI metadata**. The
parameter-editing schema (formerly a `static model_interface` array on each
class) now lives in the UI layer at `src/model-interface/`, keyed by
`model_type`. The engine neither stores nor transports it.

## Composite model behavior

Some component models create additional internal models in `init_model`.

Example: `MicroVascularUnit` creates and configures internal `BloodVessel` components (arteriole/capillary/venule), then registers them in the engine model map. This allows a higher-level model to encapsulate a local network while still participating in global stepping.

## Adding a new model type

1. Create a class in `base_models/`, `component_models/`, or `device_models/`.
2. Extend `BaseModelClass` (or match required engine contract).
3. Define static `model_type`.
4. Implement `init_model` and/or `calc_model` as needed.
5. Export it from `ModelIndex.js`.
6. Reference the new `model_type` in model definition JSON.
7. If the parameters should be editable in the app, add a `model_type` entry to
   the UI schema at `src/model-interface/registry.ts`.

## Minimal usage example

```js
import { explain } from "src/boot/explain";

// Build from object (or call explain.load("definition_name"))
explain.build(modelDefinition);

// Observe selected variables
explain.watchModelProps([
  "Heart.heart_rate",
  "Heart.lv_sv",
  "Ventilator.vent_rate"
]);

// Run realtime
explain.start();

// Later...
explain.stop();
```

## Notes and caveats

## Student onboarding manual

### 1. Running the model

1. Start the Quasar dev server (`pnpm dev` from repo root) or the Electron target.
2. The explain engine bootstraps via `src/boot/explain.js`, which instantiates `Model` and loads the default definition.
3. Use UI buttons or the console (`window.explain`) to call `build`, `load`, `start`, `stop`, or `calculate(seconds)`.
4. Place custom definitions under `public/model_definitions` and run `explain.load("definition_name")` (omit `.json`).

### 2. Observing & tweaking data

- Fast telemetry: `explain.watchModelProps(["Heart.heart_rate", "Ventilator.peep"])`.
- Change parameters with easing: `explain.setPropValue("Ventilator.peep", 10, 5 /* seconds */, 0 /* delay */)`.
- Trigger functions: `explain.callModelFunction("Heart.resetBaro", [], 0.25)`.

### 3. Adding models

**Base models** (`src/explain/base_models`)
- Extend `BaseModelClass`, export static `model_type` + `model_interface`.
- Implement `init_model(config)` and `calc_model()`/`step_model()`.
- Import/export the class in `ModelIndex.js`.

**Component models** (`src/explain/component_models`)
- Compose multiple base models or encapsulate subsystems.
- Register internally created models on the engine `models` map so schedulers and collectors can target them.

**Device models** (`src/explain/device_models`)
- Represent external hardware; validate dependencies (e.g., lungs) in `init_model` and emit clear errors if missing.

**Helpers** (`src/explain/helpers`)
- Instantiate new helpers inside `ModelEngine` and keep their state serializable (strip private fields in `_processModelState`).

### 4. Editing definitions

1. Definitions live in `public/model_definitions/*.json`.
2. Each entry contains `{ name, model_type, settings, inputs }`.
3. Example block:

```json
{
  "name": "MyDevice",
  "model_type": "MyDevice",
  "settings": { "pressure": 18 },
  "inputs": { "Lung": "Lung" }
}
```

4. Reload via `explain.load("my_definition")` or rebuild in place with `explain.restart()`.

### 5. Debugging checklist

- Watch worker traffic in DevTools (console logs prefixed with `Model:`).
- Hook events: `document.addEventListener("status", (evt) => console.log(evt.detail))`.
- Snapshot: `explain.getModelState()`; inspect the payload emitted by the worker.
- Missing models usually mean `model_type` typos or missing exports in `ModelIndex`.

### 6. Cleanup

- When done (component unmount, hot reload), call `explain.dispose()` to terminate the worker and drop listeners.


````


## 3. Physiology docs

### FILE: explain/docs/Ans.md

````markdown
# Autonomic Nervous System (Ans, AnsAfferent, AnsEfferent)

The autonomic nervous system (ANS) subsystem is a closed-loop reflex controller. It senses
physiological quantities (pressures, blood gases), converts them to normalized **receptor firing
rates**, and feeds those back as **effect factors** onto target models (heart rate, contractility,
vascular tone, minute volume, …). It is the model's baroreflex and chemoreflex.

Three classes work together:

| Class | Role | Analogy |
|---|---|---|
| `Ans` | Manager — enables/disables the loop and refreshes the blood gases its receptors read | central control |
| `AnsAfferent` | Receptor — maps one input quantity to a firing rate (0–1) | baro-/chemoreceptor |
| `AnsEfferent` | Effector — averages incoming firing rates and writes an effect factor to a target | efferent nerve |

## Data flow

```
            input_prop (e.g. AAR.pres, AA.po2)
                   │
                   ▼
            ┌───────────────┐   firing_rate (0–1)      ┌───────────────┐   effector (factor)
   sensor → │  AnsAfferent  │ ───────────────────────► │  AnsEfferent  │ ──────────────────────► target_model.target_prop
            │  (receptor)   │   update_effector(fr, w)  │  (effector)   │   (e.g. Heart.ans_activity_hr)
            └───────────────┘                           └───────────────┘
                   ▲                                                                    │
                   └──────────────────── physiological response ────────────────────────┘
```

An afferent can drive **several** efferents (its `efferents` list); an efferent can be driven by
**several** afferents (they accumulate via `update_effector`). All three run on their own throttled
interval, decoupled from the model step size.

## `Ans` — the manager

`calc_model()` runs every `_update_interval` (0.05 s) and does two things:

1. Propagates its `ans_active` flag to every sub-model listed in `components` (the afferents and
   efferents), so the whole loop can be switched on/off at once.
2. Recomputes the blood composition (`calc_blood_composition`) for every compartment named in
   `blood_composition_models`, so chemoreceptor afferents reading `po2`/`pco2`/`ph` see fresh values.

`Ans` holds no control logic itself — it is wiring and gating.

## `AnsEfferent` — receptor curve

Each afferent maps its input to a normalized firing rate in **[0, 1]**, with **0.5 as the setpoint**
(no effect). Updated every `_update_interval` (0.015 s):

1. **Read input:** `input_value = models[input_model][input_prop]`.
2. **Activation** (deviation from setpoint, clamped to the configured window):
   - `input_value > max_value` → `activation = max_value − set_value`
   - `input_value < min_value` → `activation = min_value − set_value`
   - otherwise → `activation = input_value − set_value`
3. **Gain** — the slope that maps activation onto the firing-rate range, separately above and below
   the setpoint so an asymmetric input window still spans 0→1:
   - activation > 0: `gain = (1.0 − 0.5) / (max_value − set_value)`
   - activation ≤ 0: `gain = (0.5 − 0.0) / (set_value − min_value)`
   - (each guarded against a zero-width range → gain 0)
4. **Target firing rate:** `new_firing_rate = 0.5 + gain · activation`.
5. **First-order lag** with time constant `tc` (forward Euler), so the receptor responds gradually:
   `firing_rate += (Δt / tc) · (new_firing_rate − firing_rate)`  (with `Δt = _update_interval`; if
   `tc == 0` the new rate is applied instantly).
6. **Broadcast:** call `update_effector(firing_rate, effect_weight)` on each connected efferent.

So a rising input (e.g. arterial pressure) above setpoint drives the firing rate toward 1; below
setpoint toward 0; at setpoint it sits at 0.5.

## `AnsEfferent` — effect translation

Each efferent collects firing rates from its afferents during the interval and, every
`_update_interval` (0.015 s), turns the average into an effect factor written to its target.

**Accumulation** (`update_effector`, called by each afferent):
```
_cum_firing_rate         += (firing_rate − 0.5) · weight   // summed weighted deviation
_cum_firing_rate_counter += 1                              // number of afferent votes
```

**Averaging** (`calc_model`): the resting firing rate must be 0.5 *regardless of how many afferents
feed the efferent*, so the 0.5 setpoint is added **after** averaging the deviations:
```
firing_rate = 0.5 + _cum_firing_rate / _cum_firing_rate_counter   (or 0.5 if no afferent fired)
```
> Note: an earlier version seeded the accumulator with 0.5 and divided that by the vote count, which
> made the resting rate 0.5/N — wrong for any efferent with more than one afferent. The accumulator
> now holds only deviations and is reset to 0.

**Translation** to an effect factor — piecewise linear, pinned to `1.0` (no effect) at firing rate
0.5 and continuous at the breakpoint:
```
firing_rate ≥ 0.5 :  effector = 1.0 + (effect_at_max_firing_rate − 1.0) / 0.5 · (firing_rate − 0.5)
firing_rate < 0.5 :  effector = effect_at_min_firing_rate + (1.0 − effect_at_min_firing_rate) / 0.5 · firing_rate
```
At firing rate 1.0 the effector equals `effect_at_max_firing_rate`; at 0.0 it equals
`effect_at_min_firing_rate`; at 0.5 it equals 1.0. If `ans_active` is false the effector is forced to
1.0 (no effect).

A first-order lag with time constant `tc` smooths the effector, then it is written straight onto the
target: `models[target_model][target_prop] = effector`. The accumulator is reset for the next window.

## Configuration (model-definition fields)

**AnsAfferent**: `input_model`, `input_prop`, `min_value` / `set_value` / `max_value` (the receptor
window, in the input's own units), `tc`, `efferents` (list of efferent names), `effect_weight`.

**AnsEfferent**: `target_model`, `target_prop` (the factor it drives, e.g. `Heart.ans_activity_hr`),
`effect_at_min_firing_rate`, `effect_at_max_firing_rate`, `tc`.

**Ans**: `ans_active`, `components` (its afferents/efferents), `blood_composition_models`.

Example wiring (term neonate): afferent `BR_MAP` reads `AAR.pres` and drives `EF_HR`, `EF_SVR`,
`EF_HEART`; efferent `EF_HR` writes `Heart.ans_activity_hr` with
`effect_at_max_firing_rate = 0.428`, `effect_at_min_firing_rate = 1.5` (high pressure → faster
firing → factor < 1 → lower heart rate; the baroreflex).

## Notes & caveats

- **Timing / lag.** Afferents, efferents and the manager each run on their own interval and the
  afferent→efferent hand-off depends on step order, so the loop carries up to one interval of lag.
  This is intended (receptors and effectors are not instantaneous) and stable at the default
  intervals.
- **Reference guarding.** `AnsAfferent` skips its update when `input_model` is missing and only calls
  `update_effector` on efferents that resolve to a model with that hook; `AnsEfferent` skips the write
  when `target_model` is missing. So broken afferent/efferent wiring degrades gracefully. The `Ans`
  manager itself (`components`, `blood_composition_models`) still dereferences its names directly — a
  name that does not resolve to a built model there will throw.
- **Setpoint = 0.5** everywhere — both the receptor output and the effector's neutral point. Keep new
  afferents/efferents on that convention so resting tone composes to "no effect".

````

### FILE: explain/docs/AnsAfferent.md

```markdown
# AnsAfferent

An `AnsAfferent` is an autonomic **receptor**: it reads one input quantity (e.g. arterial pressure or
a blood gas), maps it through a baro-/chemoreceptor curve to a normalized firing rate (0–1, setpoint
0.5), low-passes it with a time constant, and broadcasts it to the connected efferents.

It is one of the three classes that make up the autonomic feedback loop — **see
[Ans.md](./Ans.md)** for the full description of the receptor curve (input → activation → gain →
firing rate), the data flow, the configuration fields (`input_model`, `input_prop`, `min/set/max`,
`tc`, `efferents`, `effect_weight`), and the reference-guarding behaviour.

```

### FILE: explain/docs/AnsEfferent.md

```markdown
# AnsEfferent

An `AnsEfferent` is an autonomic **effector**: it averages the firing rates pushed to it by the
afferents, translates that average into an effect factor, smooths it with a time constant, and writes
it onto a target model property (e.g. `Heart.ans_activity_hr`).

It is one of the three classes that make up the autonomic feedback loop — **see
[Ans.md](./Ans.md)** for the full description of the firing-rate averaging (setpoint added after
averaging, so the resting rate stays 0.5 regardless of how many afferents feed it), the effect
translation, the configuration fields (`target_model`, `target_prop`, `effect_at_min/max_firing_rate`,
`tc`), and the reference-guarding behaviour.

```

### FILE: explain/docs/BaseModelClass.md

```markdown
# BaseModelClass

`BaseModelClass` is the blueprint every model in the engine extends. It provides the common
lifecycle (construct → init → step) and the shared properties the engine relies on; subclasses add
the actual physics in `calc_model()`.

## Common properties

| Property | Meaning |
|---|---|
| `name` | unique model name (its key in `model.models`) |
| `description` | free-text description |
| `is_enabled` | when false the model is skipped in the step loop |
| `model_type` | the class key used at build time and in the definition JSON |
| `components` | dictionary of sub-models this model owns (composite-model mechanism) |
| `_model_engine` | reference to the whole engine `model` object (shared state, counters, other models) |
| `_t` | the modeling step size, **captured at construction** from `model_engine.modeling_stepsize` |
| `_is_initialized` | set true at the end of `init_model`; gates stepping |

## Lifecycle

1. **Construct** `(model_ref, name)` — store the engine reference and step size, set defaults.
2. **`init_model(args)`** — apply the definition's `{key, value}` args onto the instance, then for
   each entry in `this.components`: instantiate the sub-model into `model.models` (unless it already
   exists) and init it. Finally set `_is_initialized = true`.
3. **`step_model()`** — called every step by the engine; runs `calc_model()` only when
   `is_enabled && _is_initialized`.
4. **`calc_model()`** — empty here; **overridden by almost every subclass** to do the per-step
   calculation.

## Composite models (`components`)

A model can own a local sub-network by declaring sub-models in `components`. `init_model` instantiates
each into the global `model.models` map and initializes it, so the children still participate in the
global step loop, data collection and scaling. `Pda`, `Placenta`, `Ecls` and the `Ventilator` use
this to own their internal circuits.

## Notes

- **`_t` is a snapshot.** It is read once at construction. There is no runtime setter for
  `modeling_stepsize`, and the build sets it before any model is constructed, so `_t` is always
  correct in practice — but a future runtime step-size change would need `_t` refreshed on every model
  (and on `TaskScheduler`).
- Subclasses that override `init_model` should call `super.init_model(args)` (or set
  `_is_initialized = true` themselves) and resolve any cross-model references there.

```

### FILE: explain/docs/Blood.md

```markdown
# Blood

The `Blood` model is a **manager**, not a compartment. It seeds the circulating blood properties onto
every blood-containing compartment at build, exposes setters to change them at runtime, and
periodically samples representative compartments to publish arterial/venous blood gases.

## What it does

- **Bootstrap (`init_model`).** For every model whose type is in `blood_containing_modeltypes`
  (`BloodVessel`, `HeartChamber`, `BloodCapacitance`, `BloodTimeVaryingElastance`, `BloodPump`,
  `MicroVascularUnit`): propagate the Haldane coefficient, and — **only for freshly-constructed
  compartments (empty solutes)** — copy the reference `to2`, `tco2`, `solutes`, `temp` and
  `viscosity`. Guarding on empty solutes (rather than `to2/tco2 == 0`) preserves a restored saved
  state, where compartments already carry their own composition.
- **Publish blood gases (`calc_model`, every 1 s).** Run `calc_blood_composition` on the ascending
  aorta (`AA`, pre-ductal), descending aorta (`AD`, post-ductal) and the venae cavae (`IVCI`, `SVC`),
  and copy `ph`/`pco2`/`po2`/`hco3`/`be`/`so2` into `preductal_art_bloodgas`, `art_bloodgas` and the
  venous read-outs.

## Setters

`set_temperature`, `set_viscosity`, `set_haldane_coeff`, `set_to2`, `set_tco2`, `set_solute` — each
applies to all blood compartments (or a single named site). They update the corresponding property on
the compartments; `set_solute` (no site) sets the requested solute on every compartment and on the
reference.

## Configuration (model-definition fields)

`viscosity`, `temp`, `to2`, `tco2`, `solutes` (the circulating solute set), `P50_0` (O₂-haemoglobin
P50 baseline), `haldane_coeff` (Haldane-effect strength, 0 = off).

## Notes

- The actual gas chemistry lives in [`BloodComposition`](./BloodComposition.md); `Blood` only sets the
  inputs and reads the outputs.
- The reference `to2`/`tco2` are seeds; after build the simulation uses the per-compartment values
  (updated by flow mixing, diffusion and metabolism).

```

### FILE: explain/docs/BloodCapacitance.md

````markdown
# BloodCapacitance

A BloodCapacitance is a volume compartment that holds blood with tracked composition: dissolved gases, solutes, drugs, temperature, and viscosity. It extends the base `Capacitance` class with blood-specific mixing logic.

## Inheritance

```
BaseModelClass
  └── Capacitance            (volume, elastance, pressure)
        └── BloodCapacitance (blood composition tracking)
```

BloodCapacitance is itself the parent of `BloodVessel` (adds resistance and flow) and is used standalone for compartments that hold blood but have no built-in resistance (e.g., a pure compliance chamber). Flow into and out of a standalone BloodCapacitance is handled by separate `Resistor` models that reference it.

## What it models

A passive blood-containing compartment. It holds a volume of blood at a pressure determined by its elastance, and tracks the composition of that blood as fluid flows in and out. It does not have its own resistance or flow -- those are provided by connected `Resistor` or `BloodVessel` models.

## Properties

### Inherited from Capacitance

All capacitance properties are available. See the Capacitance base model for the full list. Key ones:

| Property | Unit | Description |
|---|---|---|
| `u_vol` | L | Unstressed volume |
| `el_base` | mmHg/L | Baseline elastance |
| `el_k` | unitless | Non-linear elastance coefficient |
| `vol` | L | Current volume |
| `pres` | mmHg | Total pressure |
| `pres_in` | mmHg | Recoil pressure |
| `pres_tm` | mmHg | Transmural pressure |

### Blood composition (unique to BloodCapacitance)

| Property | Unit | Description |
|---|---|---|
| `temp` | degC | Blood temperature |
| `viscosity` | cP | Blood viscosity |
| `to2` | mmol/L | Total oxygen concentration |
| `tco2` | mmol/L | Total carbon dioxide concentration |
| `ph` | unitless | Blood pH (-1 = not calculated) |
| `pco2` | mmHg | Partial pressure of CO2 (-1 = not calculated) |
| `po2` | mmHg | Partial pressure of O2 (-1 = not calculated) |
| `so2` | unitless | Oxygen saturation (-1 = not calculated) |
| `hco3` | mmol/L | Bicarbonate concentration (-1 = not calculated) |
| `be` | mmol/L | Base excess (-1 = not calculated) |
| `solutes` | object | Dictionary of solute concentrations (keyed by name) |
| `drugs` | object | Dictionary of drug concentrations (keyed by name) |

Note: `ph`, `pco2`, `po2`, `so2`, `hco3`, and `be` are initialized to -1 and are calculated by external gas exchange models (e.g., `AcidBase`). They are not computed by the BloodCapacitance itself.

### Haldane effect

`calc_blood_composition` (in `BloodComposition.js`) couples oxygen saturation back into the CO2
dissociation. The plasma CO2 partition gains an SO₂-dependent term:

```
cco2p = tco2 / (1 + kc/hp + kc*kd/hp² + haldane_coeff * (1 - so2))
pco2  = cco2p / alpha_co2p
```

Lower SO₂ raises the effective CO2-carrying capacity, so at a given `tco2` deoxygenated blood shows a
lower `pco2`/`hco3` — the Haldane effect. `so2` is taken from the previous calculation step (the
acid-base and oxygen solvers run sequentially); at steady state the one-step lag vanishes. The
strength is set by `haldane_coeff` on the `Blood` model (propagated to every blood component and
adjustable at runtime via `Blood.set_haldane_coeff`); `haldane_coeff = 0` disables the effect and
reproduces the previous behaviour. Note this is distinct from the **CO₂-Bohr effect** (high pCO₂
right-shifts P50, reducing O₂ affinity), which is modelled separately via the `dpCO2` term.

## Mixing logic (`volume_in`)

BloodCapacitance overrides the `volume_in` method to perform composition mixing when blood flows in from another compartment. For each tracked substance, the mixing uses a linear dilution formula:

```
concentration += ((concentration_from - concentration) * dvol) / vol
```

This is applied to:
- `to2` and `tco2` (dissolved gases)
- All entries in `solutes`
- All entries in `drugs`
- `temp` (temperature treated as a solute for mixing)
- `viscosity` (treated as a solute for mixing)

The `comp_from` parameter (the upstream compartment) must have matching properties (`to2`, `tco2`, `solutes`, `drugs`, `temp`, `viscosity`).

## Three-tier factor system

BloodCapacitance inherits the full three-tier factor system from Capacitance:

| Tier | Factors | Purpose |
|---|---|---|
| Non-persistent | `u_vol_factor`, `el_base_factor`, `el_k_factor` | Transient effects, reset each step |
| Persistent (`_ps`) | `u_vol_factor_ps`, `el_base_factor_ps`, `el_k_factor_ps` | Ongoing physiological modulation |
| Scaling (`_scaling`) | `u_vol_factor_scaling`, `el_base_factor_scaling`, `el_k_factor_scaling` | ModelScaler weight/manual scaling |

## Calculation cycle

BloodCapacitance does not override `calc_model()` -- it inherits the Capacitance cycle:

1. `calc_elastances()` -- compute effective elastance from base + all factor tiers
2. `calc_volumes()` -- compute effective unstressed volume from base + all factor tiers
3. `calc_pressure()` -- compute recoil, transmural, and total pressure

## Example definition (JSON)

```json
{
  "name": "PV",
  "description": "pulmonary veins",
  "model_type": "BloodCapacitance",
  "is_enabled": true,
  "vol": 0.04,
  "u_vol": 0.038,
  "el_base": 3100,
  "el_k": 0,
  "fixed_composition": false
}
```

## Usage in the model

- Used for compartments that are pure compliances (no built-in resistance), such as specific pooling volumes
- Serves as the parent class for `BloodVessel`, which adds resistance, flow, and ANS coupling

````

### FILE: explain/docs/BloodComposition.md

````markdown
# BloodComposition

`BloodComposition.js` exports **`calc_blood_composition(bc)`** — the acid-base and blood-gas solver.
Given a blood compartment's total contents (`to2`, `tco2`), solutes and temperature, it computes pH,
pCO₂, pO₂, SO₂, HCO₃⁻ and base excess. It is called by `Blood`, the diffusors/exchangers, the ANS
chemoreceptors and the ECLS/monitor read-outs.

## Inputs and outputs

| In | Out |
|---|---|
| `to2`, `tco2`, solutes (Na, K, Ca, Mg, Cl, lactate, albumin, phosphate, uma, haemoglobin), `temp` | `ph`, `pco2`, `po2`, `so2`, `hco3`, `be` |

A result cache short-circuits the (expensive) solve when none of the inputs changed since the last
call.

## Acid-base solve (Stewart / charge balance)

A **Brent root-finder** solves for the plasma H⁺ concentration that makes the net charge balance to
zero. At each candidate H⁺, total CO₂ is partitioned into dissolved CO₂, bicarbonate and carbonate
(carbonic-acid equilibria), albumin/phosphate buffering is added, and:

```
cco2p = tco2 / (1 + kc/H + kc·kd/H² + haldane_coeff · (1 − SO₂_prev))
pco2  = cco2p / alpha_co2p
hco3  = kc · cco2p / H
```

The **Haldane effect** term (`haldane_coeff · (1 − SO₂)`) raises the CO₂-carrying capacity as
saturation falls, using the previous step's SO₂ to break the O₂↔CO₂ coupling (they converge at steady
state). Base excess follows from `hco3`, `ph` and haemoglobin.

## Oxygen solve (P50 shift + Hill)

The O₂-haemoglobin **P50 is shifted** for pH (Bohr), pCO₂ (CO₂-Bohr), temperature and 2,3-DPG:

```
log10(P50) = log10(P50_0) − 0.48·ΔpH + 0.0015·ΔpCO2 + 0.024·ΔT + 0.051·ΔDPG
```

A second Brent solve finds the pO₂ whose O₂ content (Hill saturation with the shifted P50, plus
dissolved O₂) matches the target `to2`; SO₂ falls out of the Hill equation.

## Notes & caveats

- **Two distinct effects.** The CO₂→O₂-affinity term (`ΔpCO2`, "CO₂-Bohr") shifts P50; the **Haldane
  effect** (SO₂→CO₂ capacity) is the separate term in the CO₂ partition above. The CO₂-Bohr
  coefficient is `0.0015`/mmHg (a carbamino-specific value); the pH-mediated CO₂ effect runs through
  the `−0.48·ΔpH` term.
- `haldane_coeff` (default 1.0, tunable on `Blood`, 0 = off) controls the Haldane strength; both the
  Haldane and CO₂-Bohr coefficients should be validated against expected arterio-venous gases.
- See [Blood.md](./Blood.md) for how inputs are seeded and outputs published, and
  [BloodCapacitance.md](./BloodCapacitance.md) for the compartment that carries the values.

````

### FILE: explain/docs/BloodDiffusor.md

````markdown
# BloodDiffusor

A `BloodDiffusor` exchanges gases and solutes between **two blood compartments** — used where blood
equilibrates with blood across a membrane rather than with a gas, most notably the placenta
(fetal capillary ↔ maternal pool).

## What it models

```
blood1 (po2, pco2, solutes)  ⇌[BloodDiffusor]⇌  blood2 (po2, pco2, solutes)
   gases:   flux = (p1 − p2) · dif · Δt          (partial-pressure driven)
   solutes: flux = (c1 − c2) · dif · Δt          (concentration driven)
```

Each step it refreshes both compartments' blood composition (for the partial pressures), then moves
O₂ and CO₂ down their **partial-pressure** gradients and each configured solute down its
**concentration** gradient.

`dif_o2`, `dif_co2` and the per-solute `dif_solutes` use the
[factor / effective-value pattern](./Capacitance.md).

## Calculation cycle (`calc_model`)

1. `calc_blood_composition` on both compartments.
2. Compose the effective diffusion constants from the factors.
3. For O₂, CO₂ and each solute: compute the flux and apply it to both compartments, **each write
   guarded by `fixed_composition` and a positive volume**, so a fixed reservoir (e.g. the maternal
   pool `PL_MAT`) supplies/absorbs gas without changing its own composition and an empty compartment
   never divides by zero.

## Wiring

Configured with `comp_blood1` / `comp_blood2` and the diffusion constants. The placenta's `PL_GASEX`
connects the fetal capillary to the fixed maternal pool.

## Notes

- This is the reference implementation the other diffusors follow: it already guarded
  `fixed_composition` on every write, which is why the maternal pool stays constant.
- Gases use partial pressures (so they respect the dissociation curves), while solutes use raw
  concentrations.

````

### FILE: explain/docs/BloodPump.md

````markdown
# BloodPump

A `BloodPump` is a [`BloodCapacitance`](./BloodCapacitance.md) that adds a pump: it applies a
pump-generated pressure across its inlet/outlet resistors to drive flow (a centrifugal or roller
pump).

## Inheritance

```
BaseModelClass → Capacitance → BloodCapacitance → BloodPump
```

It inherits all blood-composition behaviour (volume mixing, the `fixed_composition`/empty-compartment
guards) and overrides `calc_pressure` to add the pump action.

## Pump pressure (`calc_pressure`)

```
pres_in = el_k_eff·(vol − u_vol_eff)² + el_eff·(vol − u_vol_eff)
pres    = pres_in + pres_ext + pres_cc + pres_mus
pump_pressure = −pump_rpm / 25
centrifugal (pump_mode 0):  inlet.p2_ext  = pump_pressure
roller      (pump_mode 1):  outlet.p1_ext = pump_pressure
```

`inlet`/`outlet` name the connecting resistors; the negative pump pressure on a resistor's external
inlet/outlet pressure creates the gradient that drives flow.

## Status

⚠️ **Currently unused.** No scenario instantiates a `BloodPump`; the ECLS pump (`ECLS_PUMP`) is a
`BloodVessel` driven directly by the [`Ecls`](./Ecls.md) device, which duplicates this pump-pressure
logic. The class is registered and UI-exposed, and was made defensively correct (declared
`pres_cc`/`pres_mus`/`inlet`/`outlet`, a null-guard on the connectors, and `pres_tm`) so it does not
crash or `NaN` if instantiated — but it is legacy/standby code.

## Configuration

`pump_rpm`, `pump_mode`, `inlet`, `outlet`, plus the inherited capacitance fields (`u_vol`, `el_base`,
`el_k`, …).

````

### FILE: explain/docs/BloodTimeVaryingElastance.md

````markdown
# BloodTimeVaryingElastance

A BloodTimeVaryingElastance is a volume compartment with a time-varying elastance (cyclically changing stiffness) that holds blood with tracked composition. It is used for compartments that contract and relax cyclically but are not heart chambers -- for example, a pulsatile vessel segment driven by an external activation signal.

## Inheritance

```
BaseModelClass
  └── TimeVaryingElastance         (volume, time-varying elastance, pressure)
        └── BloodTimeVaryingElastance  (blood composition tracking)
```

## Relationship to HeartChamber

Both `BloodTimeVaryingElastance` and `HeartChamber` extend `TimeVaryingElastance`. The difference is that `HeartChamber` adds ANS-mediated modulation of contractility (el_max) and relaxation (el_min) via beta-adrenergic receptor modeling. `BloodTimeVaryingElastance` does not have ANS coupling -- it uses the parent's `calc_elastances()` directly.

## What it models

A compartment whose elastance varies over time between a minimum (`el_min`) and maximum (`el_max`) value, driven by an external activation factor (`act_factor`). This produces pulsatile pressure changes. The compartment also tracks blood composition (gases, solutes, drugs, temperature, viscosity) using the same mixing logic as `BloodCapacitance`.

## Properties

### Inherited from TimeVaryingElastance

| Property | Unit | Description |
|---|---|---|
| `u_vol` | L | Unstressed volume |
| `el_min` | mmHg/L | Minimum elastance (during relaxation/diastole) |
| `el_max` | mmHg/L | Maximum elastance (during contraction/systole) |
| `el_k` | unitless | Non-linear elastance coefficient |
| `act_factor` | 0-1 | Activation factor (set externally, e.g., by Heart model) |
| `vol` | L | Current volume |
| `pres` | mmHg | Total pressure |
| `pres_in` | mmHg | Recoil pressure |
| `pres_tm` | mmHg | Transmural pressure |
| `pres_ext` | mmHg | External pressure (non-persistent, resets each step) |

### Blood composition (unique to BloodTimeVaryingElastance)

| Property | Unit | Description |
|---|---|---|
| `temp` | degC | Blood temperature |
| `viscosity` | cP | Blood viscosity |
| `to2` | mmol/L | Total oxygen concentration |
| `tco2` | mmol/L | Total carbon dioxide concentration |
| `ph` | unitless | Blood pH (-1 = not calculated) |
| `pco2` | mmHg | Partial pressure of CO2 (-1 = not calculated) |
| `po2` | mmHg | Partial pressure of O2 (-1 = not calculated) |
| `so2` | unitless | Oxygen saturation (-1 = not calculated) |
| `hco3` | mmol/L | Bicarbonate concentration (-1 = not calculated) |
| `be` | mmol/L | Base excess (-1 = not calculated) |
| `solutes` | object | Dictionary of solute concentrations |
| `drugs` | object | Dictionary of drug concentrations |

### Calculated intermediates

| Property | Unit | Description |
|---|---|---|
| `el_min_eff` | mmHg/L | Effective minimum elastance this step (after all factors) |
| `el_max_eff` | mmHg/L | Effective maximum elastance this step |
| `el_k_eff` | unitless | Effective non-linear elastance coefficient |
| `u_vol_eff` | L | Effective unstressed volume |

## Three-tier factor system

| Tier | Factors | Purpose |
|---|---|---|
| Non-persistent | `u_vol_factor`, `el_min_factor`, `el_max_factor`, `el_k_factor` | Transient effects, reset each step |
| Persistent (`_ps`) | `u_vol_factor_ps`, `el_min_factor_ps`, `el_max_factor_ps`, `el_k_factor_ps` | Ongoing physiological modulation |
| Scaling (`_scaling`) | `u_vol_factor_scaling`, `el_min_factor_scaling`, `el_max_factor_scaling`, `el_k_factor_scaling` | ModelScaler weight/manual scaling |

Each effective value is computed additively:

```
el_min_eff = el_min
  + (el_min_factor - 1) * el_min
  + (el_min_factor_ps - 1) * el_min
  + (el_min_factor_scaling - 1) * el_min
```

Note: `el_max_eff` is clamped to never fall below `el_min_eff`.

## Pressure calculation

The time-varying elastance produces a pressure that interpolates between end-diastolic and maximum systolic pressure based on the activation factor:

```
p_ms = (vol - u_vol_eff) * el_max_eff
p_ed = el_k_eff * (vol - u_vol_eff)^2 + el_min_eff * (vol - u_vol_eff)
pres_in = (p_ms - p_ed) * act_factor + p_ed
```

When `act_factor = 0` (diastole), pressure equals `p_ed`. When `act_factor = 1` (peak systole), pressure equals `p_ms`.

## Mixing logic (`volume_in`)

Overrides `volume_in` to perform composition mixing when blood flows in, identical to `BloodCapacitance`:

```
concentration += ((concentration_from - concentration) * dvol) / vol
```

Applied to: `to2`, `tco2`, all `solutes`, all `drugs`, `temp`, `viscosity`.

## Calculation cycle

Inherits from `TimeVaryingElastance`:

1. `calc_elastances()` -- compute el_min_eff, el_max_eff, el_k_eff from base values + all factor tiers
2. `calc_volumes()` -- compute u_vol_eff from base + all factor tiers
3. `calc_pressure()` -- compute time-varying recoil pressure from activation factor

## Externally managed mode

When `is_externally_managed = true`, all three tiers of factors are reset to 1.0 every step. The parent model sets base properties directly.

## Example definition (JSON)

```json
{
  "name": "COR",
  "description": "coronary circulation",
  "model_type": "BloodTimeVaryingElastance",
  "is_enabled": true,
  "vol": 0.005,
  "u_vol": 0.004,
  "el_min": 5000,
  "el_max": 15000,
  "el_k": 0
}
```

## Usage in the model

- Used for compartments that exhibit pulsatile behavior driven by an external activation signal but do not need the ANS-mediated contractility/relaxation modulation of HeartChamber
- The coronary circulation (COR) is a typical example -- it is compressed during systole by ventricular contraction via the `act_factor` set by the Heart model

````

### FILE: explain/docs/BloodVessel.md

````markdown
# BloodVessel

A BloodVessel represents a blood vessel segment in the circulatory model. It combines a volume compartment (capacitance) with flow resistance and supports autonomic nervous system (ANS) regulation.

## Inheritance

```
BaseModelClass
  └── Capacitance          (volume, elastance, pressure)
        └── BloodCapacitance   (blood composition: O2, CO2, solutes, drugs, temperature)
              └── BloodVessel  (resistance, flow, ANS coupling)
```

## What it models

A BloodVessel is both a **capacitance** (it holds a volume of blood at a certain pressure) and a **resistance** (blood flows through it with a pressure drop). Each BloodVessel creates one or more internal `Resistor` objects based on its `inputs` list. These resistors handle the actual flow calculations between upstream components and this vessel.

When the ANS changes vascular tone, the vessel's resistance **and** elastance change simultaneously. This coupling is governed by the `alpha` parameter and is a distinguishing feature of the Explain model.

## Initialization

During `init_model()`, the BloodVessel creates a `Resistor` instance for each entry in its `inputs` array. Each resistor is named `{inputName}_{vesselName}` (e.g., `AA_AD1`) and is registered in the model engine. These resistors are marked as `is_externally_managed = true`, meaning the BloodVessel controls their properties directly -- the resistors do not apply their own factors.

If a resistor already exists in the model engine (e.g., when loading from a saved state), the existing instance is reused.

## Calculation cycle (`calc_model`)

Each model step executes in this order:

1. **`calc_resistances()`** -- compute effective forward, backward, and non-linear resistances
2. **`calc_elastances()`** -- compute effective elastance with ANS and resistance-elastance coupling
3. **Update resistors** -- push the calculated values to all internal `Resistor` objects
4. **`calc_volumes()`** -- compute effective unstressed volume (inherited from Capacitance)
5. **`calc_pressure()`** -- compute recoil, transmural, and total pressure (inherited from Capacitance)
7. **`get_flows()`** -- sum forward and backward flows from all internal resistors

## Properties

### Base properties (from definition JSON)

| Property | Unit | Description |
|---|---|---|
| `u_vol` | L | Unstressed volume -- the volume at which transmural pressure is zero |
| `el_base` | mmHg/L | Baseline elastance (stiffness). Higher = stiffer vessel |
| `el_k` | unitless | Non-linear elastance coefficient. Adds quadratic pressure term at high volumes |
| `r_for` | mmHg·s/L | Forward flow resistance |
| `r_back` | mmHg·s/L | Backward flow resistance |
| `r_k` | unitless | Non-linear resistance coefficient. Adds flow-dependent resistance |
| `inputs` | string[] | Names of upstream components (a Resistor is created for each) |
| `alpha` | 0-1 | Resistance-elastance coupling factor (see ANS section) |
| `ans_sens` | 0-1 | Sensitivity to ANS activity. 0 = no effect, 1 = full effect |
| `no_flow` | boolean | If true, all flow is blocked |
| `no_back_flow` | boolean | If true, backward flow is blocked (valve-like behavior) |

### Dependent properties (calculated each step)

| Property | Unit | Description |
|---|---|---|
| `vol` | L | Current blood volume in the vessel |
| `pres` | mmHg | Total pressure (recoil + external) |
| `pres_in` | mmHg | Recoil pressure from elastance |
| `pres_tm` | mmHg | Transmural pressure (recoil - external) |
| `flow` | L/s | Net flow (forward - backward) |
| `flow_forward` | L/s | Total forward flow across all input resistors |
| `flow_backward` | L/s | Total backward flow across all input resistors |

### Calculated intermediates (available for monitoring)

| Property | Unit | Description |
|---|---|---|
| `r_for_eff` | mmHg·s/L | Effective forward resistance this step (after all factors) |
| `r_back_eff` | mmHg·s/L | Effective backward resistance this step |
| `r_k_eff` | unitless | Effective non-linear resistance coefficient |
| `el_eff` | mmHg/L | Effective elastance (from Capacitance) |
| `u_vol_eff` | L | Effective unstressed volume (from Capacitance) |

## Three-tier factor system

Each physical property can be modulated by three independent factor tiers. All factors default to 1.0 (no change). The effective value is computed additively:

```
value_eff = base
  + (factor - 1) * base          # tier 1: non-persistent
  + (factor_ps - 1) * base       # tier 2: persistent
  + (factor_scaling - 1) * base  # tier 3: scaling
```

### Tier 1: Non-persistent factors (reset every step)

| Factor | Affects |
|---|---|
| `el_base_factor` | `el_base` |
| `el_k_factor` | `el_k` |
| `u_vol_factor` | `u_vol` |
| `r_factor` | `r_for`, `r_back` |
| `r_k_factor` | `r_k` |

These are set by other models during a step (e.g., the breathing model applying intrathoracic pressure effects) and automatically reset to 1.0 after use.

### Tier 2: Persistent factors (`_ps`)

| Factor | Affects |
|---|---|
| `el_base_factor_ps` | `el_base` |
| `el_k_factor_ps` | `el_k` |
| `u_vol_factor_ps` | `u_vol` |
| `r_factor_ps` | `r_for`, `r_back` |
| `r_k_factor_ps` | `r_k` |

These persist across steps and are used by controllers like the ANS or Heart model to apply ongoing physiological modulation.

### Tier 3: Scaling factors (`_scaling`)

| Factor | Affects |
|---|---|
| `el_base_factor_scaling` | `el_base` |
| `el_k_factor_scaling` | `el_k` |
| `u_vol_factor_scaling` | `u_vol` |
| `r_factor_scaling` | `r_for`, `r_back` |
| `r_k_factor_scaling` | `r_k` |

These are used exclusively by the `ModelScaler` for weight-based or manual scaling. Having a dedicated tier means scaling does not interfere with physiological factors in tier 2. The `ModelScaler.incorporate()` method can bake scaling factors into the base properties and reset them to 1.0.

## ANS and resistance-elastance coupling

The ANS influences both resistance and elastance, but through different pathways:

### Resistance

ANS modulates resistance directly, scaled by sensitivity:

```
r_for_eff = r_for
  + (r_factor - 1) * r_for
  + (r_factor_ps - 1) * r_for
  + (ans_activity - 1) * r_for * ans_sens
  + (r_factor_scaling - 1) * r_for
```

### Elastance (alpha coupling)

When a vessel constricts (resistance increases), its wall also becomes stiffer (elastance increases). The `alpha` parameter controls how strongly resistance changes translate into elastance changes using a power-law relationship:

```
_r_elas_factor     = r_factor    ^ alpha
_r_ps_elas_factor  = r_factor_ps ^ alpha
_ans_elas_factor   = ans_activity ^ alpha

el_eff = el_base
  + (el_base_factor - 1) * el_base
  + (el_base_factor_ps - 1) * el_base
  + (_r_elas_factor - 1) * el_base
  + (_r_ps_elas_factor - 1) * el_base
  + (_ans_elas_factor - 1) * el_base * ans_sens
  + (el_base_factor_scaling - 1) * el_base
```

Typical alpha values:
- **Large arteries**: 0.5 (moderate coupling)
- **Arterioles**: 0.63 (stronger coupling)
- **Veins/venules**: 0.75 (strongest coupling)

An alpha of 0.0 means resistance changes have no effect on elastance.

## Externally managed mode

When `is_externally_managed = true`, the BloodVessel is controlled by a parent model (typically a `MicroVascularUnit`). In this mode, all three tiers of factors are reset to 1.0 every step, and the parent sets the base properties (`el_base`, `r_for`, `r_back`, `u_vol`, etc.) directly. This prevents double-application of factors.

## Pressure calculation

Pressure is calculated by the inherited `Capacitance.calc_pressure()`:

```
pres_in = el_k_eff * (vol - u_vol_eff)^2 + el_eff * (vol - u_vol_eff)
pres_tm = pres_in - pres_ext
pres    = pres_in + pres_ext
```

Where `pres_ext` is a non-persistent external pressure (e.g., intrathoracic pressure) that resets to 0 each step.

## Example definition (JSON)

```json
{
  "name": "AD1",
  "description": "descending aorta segment 1",
  "model_type": "BloodVessel",
  "is_enabled": true,
  "vol": 0.02725,
  "u_vol": 0.02625,
  "el_base": 625,
  "el_k": 0,
  "r_for": 6.2,
  "r_back": 6.2,
  "r_k": 0,
  "inputs": ["AA"],
  "alpha": 0.5,
  "ans_sens": 0.0
}
```

## Usage in the model hierarchy

- **Standalone**: Used for large arteries (AA, AD1, AD2) and veins (IVCI, SVCI) that are directly defined in the model.
- **Inside MicroVascularUnit**: Three BloodVessels (ART, CAP, VEN) are created as sub-components. They are marked `is_externally_managed = true` and the MVU distributes properties across them.
- **Inside Heart (indirectly)**: Heart valves use standalone `Resistor` objects that connect HeartChamber components, not BloodVessels.

````

### FILE: explain/docs/Breathing.md

````markdown
# Breathing

The Breathing model is the **spontaneous breathing driver**. It decides how much the patient should
breathe (target minute volume), splits that into a respiratory rate and tidal volume, generates a
respiratory-muscle effort waveform over each breath, and applies that effort to the `THORAX`
container — which in turn drives the lungs. It is the spontaneous counterpart to the `Ventilator`
device.

## What it models

```
minute volume target  ──Mecklenburgh──►  resp_rate + tidal volume
        │                                        │
        │                              breath phase state machine (insp / exp)
        ▼                                        ▼
   resp-muscle pressure waveform  ──►  THORAX.el_base_factor  ──►  thoracic recoil  ──►  lung volume change
                                                                          ▲
                                              adaptive rmp_gain ◄── tidal-volume feedback
```

## Target minute volume and the rate/volume split

```
minute_volume_ref' = minute_volume_ref · minute_volume_ref_factor · minute_volume_ref_scaling_factor · weight
target_minute_volume = minute_volume_ref' · mv_ans_factor · ans_activity_factor
```

The split uses the **Mecklenburgh** relationship `VT / RR = vt_rr_ratio`, i.e. tidal volume scales
with rate. Substituting into `MV = VT · RR` gives `MV = vt_rr_ratio · RR²`, inverted in
`vt_rr_controller`:

```
resp_rate          = sqrt( target_minute_volume / (vt_rr_ratio' · weight) )
target_tidal_volume = target_minute_volume / resp_rate
```

(`vt_rr_ratio'` folds in the `_factor` and `_scaling_factor`.) The inversion is guarded against a
non-positive denominator or target so it cannot produce an `Infinity`/`NaN` rate.

## Breath phase state machine

Driven by `_breath_timer` against `_breath_interval = 60 / resp_rate`, with inspiration/expiration
times set by `ie_ratio`:

```
_ti = ie_ratio · _breath_interval        (inspiration time)
_te = _breath_interval − _ti              (expiration time)
```

- `_breath_timer > _breath_interval` → start **inspiration** (reset timers, `ncc_insp = 0`).
- `_insp_timer > _ti` → start **expiration**; latch `insp_tidal_volume` from the accumulated inflow.
- `_exp_timer > _te` → end the breath; latch `exp_tidal_volume`, run the gain controller, update
  `minute_volume = exp_tidal_volume · resp_rate`.

Tidal volumes are integrated from `MOUTH_DS.flow · Δt` (positive flow during inspiration, negative
during expiration).

## Respiratory-muscle pressure

`calc_resp_muscle_pressure` builds the effort waveform, scaled by `rmp_gain`:

- **Inspiration:** linear ramp `mp = (ncc_insp / steps_per_inspiration) · rmp_gain`.
- **Expiration:** Mecklenburgh exponential decay
  `mp = (e^(−4·fraction) − e^(−4)) / (1 − e^(−4)) · rmp_gain`.

### Coupling to the thorax (important)

The effort is applied as `THORAX.el_base_factor += resp_muscle_pressure` each step (a non-persistent
factor, reset to 1.0 by the Container every step). This **modulates thoracic elastance**, not an
external pressure. It produces inspiration because the `THORAX` operates **below its unstressed
volume** (`vol ≈ 0.227 L < u_vol ≈ 0.267 L`): there `(vol − u_vol) < 0`, so raising the elastance
makes the recoil pressure *more negative*, increasing the suction transmitted to the lungs and
drawing air in. (An older external-pressure form, `THORAX.pres_ext += −resp_muscle_pressure`, is left
commented out for reference.)

## Adaptive gain (tidal-volume feedback)

At the end of each breath, `rmp_gain` is nudged ±0.1 to close the gap between the achieved
`exp_tidal_volume` and `target_tidal_volume`, clamped to `[0, rmp_gain_max]`. This is a slow integral
controller that learns the muscle effort needed to hit the target tidal volume.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `breathing_enabled` | spontaneous breathing on/off (`switch_breathing`) |
| `minute_volume_ref` (+ `_factor`, `_scaling_factor`) | reference minute volume (L/kg/min) |
| `vt_rr_ratio` (+ `_factor`, `_scaling_factor`) | Mecklenburgh tidal-volume/rate ratio |
| `ie_ratio` | inspiratory fraction of the breath |
| `rmp_gain_max` | ceiling on muscle-pressure gain |
| `mv_ans_factor`, `ans_activity_factor` | autonomic modulation of minute volume |

When `breathing_enabled` is false, `resp_rate`, the activation counters, `target_tidal_volume` and
the muscle pressure are all zeroed (so the thorax coupling adds 0).

## Notes & caveats

- **`MOUTH_DS` and `THORAX` are dereferenced without null checks.** Both are core to breathing and
  always present in respiratory scenarios; a configuration lacking them would throw.
- **`resp_rate_measured` has a startup transient.** `_rr_factor` starts at 0, so the
  `_rr_counter > 4·_rr_factor` branch fires repeatedly until it settles after the first breaths
  (same pattern as the `Heart` measured-rate logic). The settled value is correct.
- **`debug_factor1`** is declared but unused (debug cruft).
- **The phase machine keeps running when breathing is disabled** (a breath every 60 s, since
  `resp_rate = 0` leaves `_breath_interval` at 60), but with zero muscle pressure it has no
  mechanical effect — it still lets the tidal-volume integrators measure externally driven (e.g.
  ventilator) flow.

````

### FILE: explain/docs/Capacitance.md

````markdown
# Capacitance

A `Capacitance` is the base **volume compartment**: it holds a volume and produces a pressure from
its elastance. `BloodCapacitance`, `GasCapacitance` and (indirectly) `BloodVessel` build on it.

## Inheritance

```
BaseModelClass
  └── Capacitance         (volume → elastance → pressure)
        ├── BloodCapacitance   (+ blood composition)
        └── GasCapacitance     (+ gas composition, atmospheric/external pressures)
```

## The factor / effective-value pattern (engine-wide)

Core physics parameters are **never used raw**. Each (`el_base`, `u_vol`, `el_k` here; `r_for`,
`r_back`, `r_k` on `Resistor`; `el_min`/`el_max` on `TimeVaryingElastance`) has three multiplier
layers that combine **additively against the base** into an `*_eff` value:

| Layer | Persistence | Set by |
|---|---|---|
| `<p>_factor` | reset to 1.0 every step | transient interventions |
| `<p>_factor_ps` | persistent | user / scenario / regulator models (ANS, MOB, Circulation…) |
| `<p>_factor_scaling_ps` | persistent | `ModelScaler` (allometric/weight scaling) |

```
p_eff = p + (factor − 1)·p + (factor_ps − 1)·p + (factor_scaling_ps − 1)·p
```

So each factor of 1.0 is "no effect", and simultaneous factors add their deltas. When you add a
tunable parameter, follow this convention so it composes with interventions and scaling.

## Calculation cycle (`calc_model`)

1. **`calc_elastances`** — compute `el_eff` and `el_k_eff` from the factors; reset the non-persistent
   factors.
2. **`calc_volumes`** — compute `u_vol_eff`; reset the non-persistent factor.
3. **`calc_pressure`**:
   ```
   pres_in = el_k_eff · (vol − u_vol_eff)² + el_eff · (vol − u_vol_eff)
   pres_tm = pres_in − pres_ext                 (transmural)
   pres    = pres_in + pres_ext                 (total)
   pres_ext := 0                                (external pressure is non-persistent)
   ```
   The `el_k_eff` term adds non-linear stiffening at high volume; `pres_ext` is an external pressure
   (e.g. from a `Container` or chest compression) applied this step and then cleared.

## Volume flow

- **`volume_in(dvol, comp_from)`** — add `dvol` (skipped when `fixed_composition`). Subclasses extend
  this to mix in the incoming composition.
- **`volume_out(dvol)`** — remove `dvol` (skipped when `fixed_composition`); if the volume would go
  negative it is clamped to 0 and the **un-removed** amount is returned, so a `Resistor` never pulls
  volume that isn't there. A `fixed_composition` compartment supplies volume without depleting (an
  infinite reservoir).

## Notes

- **`fixed_composition`** freezes both volume and (in the subclasses) composition — used for
  infinite reservoirs (outside air, maternal blood, ventilator/ECLS gas sources).
- The non-linear term uses `(vol − u_vol_eff)²` (sign-independent), so it also adds positive pressure
  below the unstressed volume; this is the engine convention and `el_k` is 0 for most compartments.

````

### FILE: explain/docs/Circulation.md

````markdown
# Circulation

`Circulation` is **not a physical compartment** — it is a coordinator that groups the circulatory
models and applies whole-tree adjustments to them. It does two jobs: it propagates **autonomic
vascular tone** onto the vessels, and it tallies the **blood-volume distribution** across the
systemic, pulmonary and cardiac compartments for reporting.

It holds no volume, pressure or flow of its own; it only reads from and writes onto the vessels and
chambers named in its lists.

## What it groups

The model definition populates lists of model **names** by anatomical class:

- Systemic: `systemic_arteries`, `systemic_arterioles`, `systemic_capillaries`, `systemic_venules`,
  `systemic_veins`
- Pulmonary: `pulmonary_arteries`, `pulmonary_arterioles`, `pulmonary_capillaries`,
  `pulmonary_venules`, `pulmonary_veins`
- `heart_chambers`, `coronaries`

`init_model` flattens these into `_bloodvessel_list` (all), `_systemic_bloodvessel_list` and
`_pulmonary_bloodvessel_list` for fast iteration.

## Calculation cycle (`calc_model`)

Two throttled loops:

- **Fast (every 0.015 s)** — apply tone changes *only when an input changed* (each guarded by a
  `prev_*` comparison so the work is skipped when nothing moved):
  - `ans_activity` → written onto every vessel's `ans_activity` (drives the BloodVessel α-coupled
    vasoreactivity).
  - `svr_factor_art` / `svr_factor_ven` → systemic arteriolar / venular resistance.
  - `pvr_factor_art` / `pvr_factor_ven` → pulmonary arteriolar / venular resistance.
- **Slow (every 1.0 s)** — `calc_blood_volumes()` tallies the volume distribution.

## Vascular tone: the `set_*_factor` methods

Resistance tone is applied through each vessel's **persistent** resistance factor `r_factor_ps` —
the layer that survives steps and accumulates contributions from several models (Circulation, ANS,
MOB). Because it is cumulative, Circulation applies the **delta** since the last call, not the
absolute value:

```
delta = new_factor − prev_factor
for each vessel in the group:  r_factor_ps += delta   (clamped at 0)
prev_factor := new_factor
```

The delta is computed **once** so every vessel in the group receives the same change, and
`r_factor_ps` is clamped at 0 (a negative resistance factor is non-physical). The four methods differ
only in which vessel list and which `*_factor` they drive:

| Method | Vessel list | Factor |
|---|---|---|
| `set_svr_factor_art` | `systemic_arterioles` | systemic arteriolar resistance |
| `set_svr_factor_ven` | `systemic_venules` | systemic venular resistance |
| `set_pvr_factor_art` | `pulmonary_arterioles` | pulmonary arteriolar resistance |
| `set_pvr_factor_ven` | `pulmonary_venules` | pulmonary venular resistance |

> Resistance tone is applied at the **arteriolar and venular** levels only — the dominant resistance
> sites — not on the large arteries/veins or capillaries.

## Blood-volume tally (`calc_blood_volumes`)

Sums `vol` over enabled members of each group:

```
syst_blood_volume  = Σ systemic vessels + Σ coronaries
pulm_blood_volume  = Σ pulmonary vessels
heart_blood_volume = Σ heart chambers
total_blood_volume = syst + pulm + heart
*_perc = 100 · part / total          (0 when total = 0)
```

Coronary volume is counted into the **systemic** total. Disabled models and missing names are
skipped, and the percentages are guarded against a zero total.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `systemic_*` / `pulmonary_*` / `heart_chambers` / `coronaries` | lists of model names by class |
| `ans_activity` | autonomic tone propagated to all vessels (1.0 = no effect) |
| `svr_factor_art`, `svr_factor_ven` | systemic arteriolar / venular resistance targets |
| `pvr_factor_art`, `pvr_factor_ven` | pulmonary arteriolar / venular resistance targets |

## Notes & caveats

- **Tone factors are cumulative and shared.** `r_factor_ps` is written by several models; Circulation
  only adds its delta. If a vessel's factor is driven to the 0 clamp (extreme dilation) it stops
  tracking further decreases until the target rises again — an inherent property of the per-vessel
  persistent-factor model.
- **Group membership is name-based.** A vessel only receives tone / is counted if its name appears in
  the appropriate list; the lists must be kept in sync with the circulation topology.
- **The volume tally runs once per second** (performance), so `*_blood_volume*` lag fast transients
  by up to a second.

````

### FILE: explain/docs/Container.md

````markdown
# Container

A `Container` is an enclosing compartment that **wraps other compartments** and squeezes them with its
own recoil pressure — the model of the thorax and the pericardium. Its volume is the sum of what it
contains, and its pressure is transmitted to those contents.

## What it models

```
THORAX (Container) ── contains ──► PERICARDIUM (Container) ── contains ──► LV, RV, LA, RA, COR
        ── also contains ──► lungs (ALL, ALR), great vessels, …
```

`THORAX` holds the lungs, heart and intrathoracic vessels; `PERICARDIUM` (inside the thorax) holds the
heart chambers. Containers nest, so pressure propagates inward (thorax → pericardium → chambers).

## Calculation cycle (`calc_model`)

1. **`calc_volumes`** — `vol = vol_extra + Σ contained.vol` (over members that exist and are
   enabled); compute `u_vol_eff` from the [factor pattern](./Capacitance.md).
2. **`calc_pressure`**:
   ```
   pres_in = el_k_eff · (vol − u_vol_eff)² + el_eff · (vol − u_vol_eff)
   pres    = pres_in + pres_ext
   for each contained component:  component.pres_ext += pres
   pres_ext := 0
   ```
   The container's full pressure is **added** to every contained component's `pres_ext`, which those
   components read in their own `calc_pressure`. Because contents reset `pres_ext` each step, the
   contributions compose without accumulating.

`el_base`, `u_vol`, `el_k` use the factor / effective-value pattern. The container itself holds no
flow and is not a flow endpoint — it only aggregates volume and broadcasts pressure.

## Notes

- **Membership is name-based and enable-aware.** Volume is summed and pressure transmitted only for
  members that resolve to a model and are `is_enabled`; missing or disabled members are skipped (so a
  disabled chamber neither adds phantom volume nor accumulates an unbounded `pres_ext`).
- **Sub-unstressed operation matters.** The thorax runs *below* its unstressed volume
  (`vol < u_vol`), so a higher elastance makes `pres_in` more negative — this is how
  `Breathing`'s muscle effort (which raises `THORAX.el_base_factor`) produces inspiratory suction.
- The order of stepping sets whether a content sees this step's container pressure or last step's
  (at most one step of lag) — inherent to sequential stepping, stable at the default step size.

````

### FILE: explain/docs/Ecls.md

````markdown
# Ecls

The `Ecls` device model simulates an **extracorporeal life support** (ECMO/ECLS) circuit: blood is
drained from the patient, pumped through a membrane oxygenator, and returned. It is a coordinator —
it owns the circuit sub-models (cannulas, tubing, pump, oxygenator, gas side) and drives their
resistances, pressures and gas exchange each update tick.

## Circuit topology

```
patient(drainage_site) ──[ECLS_DRAINAGE]──► ECLS_TUBING_IN ──[pump]──► ECLS_PUMP ──► ECLS_OXY ──► ECLS_TUBING_OUT ──[ECLS_RETURN]──► patient(return_site)
                                                                          │
                                                              [ECLS_GASEX: GasExchanger]
                                                                          │
                              ECLS_GAS_SOURCE ─[ECLS_GAS_INSP_VALVE]─► ECLS_GAS_OXY ─► ECLS_GAS_OUT   (sweep gas)
```

- **Blood path:** drainage cannula → inflow tubing → centrifugal/roller pump → oxygenator → outflow
  tubing → return cannula. `drainage_site` (default `RA`) and `return_site` (default `AAR`) name the
  patient compartments the cannulas connect to.
- **Gas path:** a fresh sweep gas (`gas_fio2`/`gas_fico2`) flows through the oxygenator; `ECLS_GASEX`
  exchanges O₂/CO₂ between the oxygenator blood and the sweep gas.

## Cannula library

`drainage_cannulas` / `return_cannulas` are dictionaries of real devices (Bio-Medicus, Medtronic
Crescent) with inner diameter, length and a measured resistance. Selecting a `*_cannula_type` copies
its geometry and resistance into the active parameters (in the constructor and re-checked each tick).

## Calculation cycle (`calc_model`)

When `ecls_running` is **false**: zero the reported pressures/flows, reset the moving-average
filters, and **disable all circuit sub-models** (so a stopped circuit stops conducting).

When **running**, every `_update_interval` (0.015 s):

1. Rebuild the moving-average windows if their sizes changed.
2. Resolve the circuit sub-model references (skip the tick if any is missing).
3. Apply drainage/return sites and the selected cannula resistances/geometry.
4. Sync every sub-model's `is_enabled` to `ecls_running`; set `no_flow = ecls_clamped` on the blood
   path; enable the gas exchanger only when unclamped.
5. Push resistances (cannulas, tubing, pump, oxygenator — each with its `*_res_factor`).
6. Recompute the sweep-gas composition when `gas_fio2`/`gas_fico2` changes, and the inspiratory-valve
   resistance when `gas_flow` changes.
7. **Pump drive:** `pump_pressure = −pump_rpm / 25`, applied as an external pressure across the pump
   (centrifugal, `pump_mode 0`) or the oxygenator (roller, `pump_mode 1`).
8. Read out filtered venous / interface / arterial pressures and circuit flow; once per second,
   recompute blood composition on the tubing to report venous & post-oxygenator saturations and
   post-oxygenator pCO₂.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `ecls_running`, `ecls_clamped` | circuit on/off and clamp |
| `drainage_site`, `return_site` | patient compartments for the cannulas |
| `*_cannula_type` | selected device from the cannula library |
| `*_res_factor` | per-component resistance multipliers (drainage/return/tubing/pump/oxy) |
| `oxy_res_*`, `oxy_vol` | oxygenator resistance / volume |
| `pump_rpm`, `pump_mode` | pump speed and type (0 = centrifugal, 1 = roller) |
| `gas_flow`, `gas_fio2`, `gas_fico2`, `gas_humidity`, `gas_temp` | sweep-gas settings |
| `dif_o2`, `dif_co2` | gas-exchanger diffusion constants |
| `pressure_avg_window`, `flow_avg_window` | moving-average sample counts |

## Notes & caveats

- **Stopping the circuit now disables it.** The `is_enabled` sync used to run only while
  `ecls_running` was true, so a stopped ECLS left its sub-models enabled and able to conduct passive
  flow; the off-branch now disables them.
- **Sub-model references are resolved lazily** (each tick while running) and the tick is skipped if
  any is missing, rather than dereferencing undefined.
- **Pump logic is duplicated.** The pump-pressure computation here mirrors `BloodPump.calc_pressure`;
  the circuit's `ECLS_PUMP` is a `BloodVessel` driven externally rather than a `BloodPump`.
- **Minor:** `flow` is reported in L/min (`× 60`) though the property comment says L/s; the
  `_ecls_gasexchanger` field is declared but unused (the code uses `_ecls_gasex`).

````

### FILE: explain/docs/Fluids.md

````markdown
# Fluids

The `Fluids` model administers **intravenous fluids** — boluses and infusions — into a blood
compartment over a set time. It is a small scheduler: a call queues a fluid, and each update step it
drips a fraction of that fluid's volume (with its solute composition) into the target compartment via
the compartment's `volume_in`.

It holds no volume itself; it pushes volume and composition onto an existing blood compartment.

## Administering a fluid — `add_volume(volume, in_time, fluid_in, site)`

| Argument | Default | Meaning |
|---|---|---|
| `volume` | — | volume to give, in **mL** |
| `in_time` | 10 | duration over which to give it, in **seconds** |
| `fluid_in` | `"normal_saline"` | fluid type — key into the `fluids` dictionary for the solute mix |
| `site` | `"VLB"` | name of the target blood compartment |

It builds a fluid object and pushes it onto the running list:

```
vol       = volume / 1000                       (mL → L)
time_left = in_time                             (s)
delta     = (volume/1000) / (in_time / update_interval)   (L delivered per processing step)
solutes   = { ...fluids[fluid_in] }             (composition of the chosen fluid)
to2 = tco2 = 0,  temp = fluids_temp,  viscosity = 1,  drugs = {}
```

`delta` is sized so the full volume is delivered across the `in_time / update_interval` processing
steps. An unknown `fluid_in` yields empty solutes (`{...undefined}` → `{}`), i.e. solute-free fluid,
rather than an error.

## Processing — `process_fluid_list` (every `_update_interval`, 0.015 s)

1. **Drop finished fluids** — `removeByProperty` filters out any with `time_left ≤ 0`.
2. **For each remaining fluid:**
   - Deliver this step's increment: `models[site].volume_in(delta, fluid)` — the compartment adds
     `delta` litres and mixes in the fluid's composition (solutes, temperature, viscosity) by volume
     fraction.
   - Advance the timer (`time_left -= update_interval`); when it reaches 0, zero the delta so no
     further volume is added before the fluid is removed next cycle.

The delivery happens **before** the timer/zeroing, so the final increment is actually administered
(see notes).

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `fluids` | dictionary `{ fluidType: { solute: concentration, … } }` — e.g. `normal_saline: {na:154, cl:154}`, `ringers_lactate`, `packed_cells`, `albumin_20%` |
| `fluids_temp` | temperature of administered fluid (°C) |
| `default_volume` | default bolus volume for the UI |

`add_volume` is exposed in the model-interface registry, so the UI can give boluses interactively.

## Notes & caveats

- **Full dose is now delivered.** The increment is applied before the timer is zeroed; an earlier
  ordering zeroed the last `delta` before delivering it, losing one step's worth — negligible for a
  long infusion but significant for a short bolus (a one-step bolus delivered nothing).
- **Missing target site is skipped** (optional-chaining guard) rather than throwing.
- **Composition is gas-free and low-viscosity.** Administered fluid carries `to2 = tco2 = 0` and
  `viscosity = 1`, so a large bolus dilutes the compartment's oxygen/CO₂ content and lowers its
  viscosity — the intended haemodilution effect.
- **Vestigial fields.** `fluid.vol` is decremented but not used as a stop condition (delivery is
  timer-driven); `_default_time` / `_default_type` are unused.

````

### FILE: explain/docs/Gas.md

```markdown
# Gas

The `Gas` model is a **manager** for the gas-containing compartments, the gas-phase analogue of
[`Blood`](./Blood.md). It seeds atmospheric pressure, temperature, humidity and the initial gas
composition onto every `GasCapacitance` at build, and exposes setters to change them at runtime.

## What it does

- **Bootstrap (`init_model`).** For each `GasCapacitance`: set `pres_atm`, `temp`, `target_temp`.
  Apply any per-site `temp_settings` / `humidity_settings`. Then **bootstrap the gas composition only
  for freshly-constructed compartments** — those with no gas of any species (sum of `co2`/`cco2`/
  `cn2`/`ch2o`/`cother` is 0) — via the standalone `calc_gas_composition(fio2, …)`. Guarding on the
  raw concentrations preserves a restored saved state even if the derived `ctotal` was not serialized.
- **`calc_model`** is empty: the per-compartment composition is computed by `GasCapacitance` itself
  and by the `GasExchanger`/`GasDiffusor` elements; `Gas` is purely an initializer/manager.

## Setters

- `set_atmospheric_pressure` — propagate `pres_atm` to all gas compartments.
- `set_temperature(temp, sites)` / `set_humidity(humidity, sites)` — record per-site settings and
  apply them (default sites `OUT`, `MOUTH`).
- `set_fio2(new_fio2, sites)` — re-derive the gas composition of the given sites at the new FiO₂
  (`parseFloat`-guarded against string input that would corrupt the fraction math).

## Configuration (model-definition fields)

`pres_atm`, `fio2`, `temp`, `humidity`, `temp_settings`, `humidity_settings`.

## Notes

- The gas chemistry itself is documented in [`GasComposition`](./GasComposition.md) and
  [`GasCapacitance`](./GasCapacitance.md).
- Compartments not listed in `humidity_settings` start dry and are humidified over time by
  `GasCapacitance.add_watervapour`.

```

### FILE: explain/docs/GasCapacitance.md

````markdown
# GasCapacitance

A `GasCapacitance` is a [`Capacitance`](./Capacitance.md) that holds **gas** instead of blood. It adds
gas composition (O₂, CO₂, N₂, water vapour, other), temperature/humidity dynamics, and the
atmospheric/external pressures relevant to a gas space (airways, alveoli, ventilator/ECLS circuits).

## Inheritance

```
BaseModelClass
  └── Capacitance
        └── GasCapacitance   (gas composition, heat, water vapour, atmospheric pressure)
```

## Gas state

Concentrations (mmol/L): `co2` (oxygen — note the name is "concentration of O₂"), `cco2`, `cn2`,
`cother`, `ch2o`, summed as `ctotal`. Partial pressures (`po2`, `pco2`, `pn2`, `pother`, `ph2o`) and
fractions (`fo2`, …) are derived from those.

## Calculation cycle (`calc_model`)

1. **`add_heat`** — relax `temp` toward `target_temp`; adjust volume for the temperature change
   (skipped for `fixed_composition`).
2. **`add_watervapour`** — drive `ch2o` toward the saturated vapour concentration at the current
   temperature; adjust volume (the concentration update is skipped for `fixed_composition`).
3. **`calc_elastances` / `calc_volumes`** (inherited) and **`calc_pressure`** — which adds the
   external/chest/muscle/atmospheric pressures:
   `pres = pres_in + pres_ext + pres_cc + pres_mus + pres_atm`, and reports `pres_rel`
   (relative to atmospheric).
4. **`calc_gas_composition`** (the method) — recompute `ctotal` from the concentrations and derive the
   partial pressures and fractions. (Distinct from the standalone
   [`calc_gas_composition`](./GasComposition.md) initializer.)

## Composition mixing (`volume_in`)

When gas flows in, the incoming concentrations and temperature are mixed by volume fraction — the same
algebraically-correct dilution as `BloodCapacitance`. The mixing is **skipped for `fixed_composition`
compartments** (an infinite reservoir holds its composition) and **guarded against an empty
compartment** (no division by zero).

## Notes

- `fixed_composition` is honoured in `volume_in`, in the `add_watervapour` concentration update, and
  by the diffusors/exchangers — so reservoirs like `MOUTH`, the ventilator gas source and the ECLS
  sweep gas stay constant.
- `pres_cc` (chest compression) and `pres_mus` (muscle) are external-pressure channels that
  `GasCapacitance` reads; `Capacitance`/`Container`/`TimeVaryingElastance` read only `pres_ext`.

````

### FILE: explain/docs/GasComposition.md

````markdown
# GasComposition

`GasComposition.js` exports the standalone function **`calc_gas_composition(gc, fio2, temp, humidity,
fico2)`** — an **initializer** that sets a gas compartment's composition from a target dry-gas mix and
the local temperature/humidity. It is the counterpart to the `GasCapacitance.calc_gas_composition`
*method* (which instead derives partials from existing concentrations).

## What it computes

Given a dry inspired mix (`fio2`, `fico2`, with N₂ taking the remainder), and the compartment's
pressure:

```
ctotal = pressure / (R · (273.15 + temp)) · 1000          (ideal gas law, mmol/L)
ph2o   = exp(20.386 − 5132 / (temp + 273.15)) · humidity   (saturated vapour × humidity)
for each species s:  p_s = f_s_dry · (pressure − ph2o);  f_s = p_s / pressure;  c_s = f_s · ctotal
```

So the wet partial pressures, fractions and concentrations of O₂, CO₂, N₂, "other" and water vapour
are all set consistently (they sum to `ctotal`).

## When it is used

To **seed or reset** a compartment to a known gas mix: at build (`Gas.init_model`), when FiO₂/
humidity/temperature is changed (`Gas.set_fio2`, `Ventilator`/`Ecls` setters), and on the ventilator/
ECLS gas sources. It is **not** the per-step update — `GasCapacitance.calc_gas_composition` (the
method) does that.

## Notes

- It first calls `gc.calc_model()` to obtain a current pressure, then **persists** `gc.temp` and
  `gc.humidity` so the compartment stays consistent with the concentrations it sets, and **guards
  against a non-physical pressure** (would otherwise produce Infinity/NaN fractions).
- The Kelvin conversions use `273.15` consistently (matching the per-step water-vapour formula in
  `GasCapacitance`).
- ⚠️ It overwrites the composition; calling it on a diffusing compartment every step would reset it to
  the fixed mix — which is exactly why `GasDiffusor` uses the *method*, not this function.

````

### FILE: explain/docs/GasDiffusor.md

````markdown
# GasDiffusor

A `GasDiffusor` diffuses gases between **two gas compartments**, driven by their partial-pressure
difference. It is the gas-to-gas analogue of [`BloodDiffusor`](./BloodDiffusor.md) (which is
blood-to-blood) and [`GasExchanger`](./GasExchanger.md) (which is blood-to-gas).

## What it models

```
gas1 (po2, pco2, pn2, pother)  ⇌[GasDiffusor]⇌  gas2 (...)
   flux = (p1 − p2) · dif · Δt
```

Each step it refreshes both gas compartments' composition, then moves O₂, CO₂, N₂ and "other" down
their partial-pressure gradients between the compartments' concentrations (`co2`/`cco2`/`cn2`/
`cother`).

`dif_o2`, `dif_co2`, `dif_n2`, `dif_other` use the [factor / effective-value pattern](./Capacitance.md).

## Calculation cycle (`calc_model`)

1. Refresh each compartment's partial pressures via the **`GasCapacitance.calc_gas_composition`
   method** — which derives partials from the current concentrations. (Not the standalone
   `calc_gas_composition` initializer, which would reset the compartments to a fixed room-air mix.)
2. Compose the effective diffusion constants.
3. For each species, compute the flux and apply it to both compartments, **each write guarded by
   `fixed_composition` and a positive volume**.

## Notes

- **Not used in the standard scenarios** (the lung uses a `GasExchanger` to blood, not a gas-gas
  diffusor), so this element is latent — but correct if wired up.
- The method-vs-initializer distinction in step 1 is essential: calling the standalone initializer
  here would overwrite both compartments with room air every step (and so produce no real diffusion).

````

### FILE: explain/docs/GasExchanger.md

````markdown
# GasExchanger

A `GasExchanger` moves O₂ and CO₂ between a **blood** compartment and a **gas** compartment, driven by
their partial-pressure difference — the alveolar gas exchange of the lung and the membrane of an ECLS
oxygenator.

## What it models

```
blood (po2, pco2)  ⇌[GasExchanger]⇌  gas (po2, pco2)
        flux = (p_blood − p_gas) · dif · Δt
```

Each step it refreshes the blood composition, computes the O₂ and CO₂ fluxes from the partial-pressure
gradients, and transfers them: oxygen and carbon dioxide move down their gradients between the blood's
`to2`/`tco2` and the gas's `co2`/`cco2`.

`dif_o2` and `dif_co2` use the [factor / effective-value pattern](./Capacitance.md)
(`dif_o2_factor`/`_ps`/`_scaling`) so `Respiration` (and scaling) can modulate diffusion capacity.

## Calculation cycle (`calc_model`)

1. `calc_blood_composition(comp_blood)` to get current `po2`/`pco2`.
2. Skip the step if either compartment's volume is 0 (both volumes are denominators).
3. Compose the effective diffusion constants from the factors.
4. ```
   flux_o2  = (po2_blood  − po2_gas)  · dif_o2_step  · Δt
   flux_co2 = (pco2_blood − pco2_gas) · dif_co2_step · Δt
   ```
   Update the new blood `to2`/`tco2` (floored at 0) and the gas `co2`/`cco2`.
5. Write the results back, **guarding each compartment by `fixed_composition`** so a fixed
   (infinite-reservoir) compartment is not changed.

## Wiring

Configured with `comp_blood` and `comp_gas` (the two compartment names). Used as `GASEX_LL` /
`GASEX_RL` (lung capillary ↔ alveolar gas) and `ECLS_GASEX` (oxygenator blood ↔ sweep gas).

## Notes

- O₂ leaves blood when `po2_blood > po2_gas` and enters it when the gradient reverses; the signed flux
  handles both directions, so the same element loads O₂ at the lung and the gradient simply flips for
  CO₂.
- Both the volume guard and the `fixed_composition` guards were added so a collapsed alveolus cannot
  produce NaN and a fixed sweep-gas/blood reservoir stays constant.

````

### FILE: explain/docs/Heart.md

````markdown
# Heart

The `Heart` model is the **cardiac driver**. It owns the rhythm and conduction, synthesizes the ECG,
generates the activation that contracts the chambers, applies neuro-hormonal control to contractility/
relaxation/heart rate, and measures per-beat haemodynamics. It does not hold blood itself — the
chambers (`HeartChamber`/`BloodTimeVaryingElastance`) do; the Heart drives their `act_factor`.

## Conduction and rhythm

A timed state machine models the cardiac conduction system, gated off the engine-level counters
`ncc_atrial` / `ncc_ventricular`:

```
SA node fires ─► PQ (atrial) ─► AV delay ─► QRS (ventricular) ─► QT ─► (refractory clears) ─► next beat
```

- **Heart rate** is the reference rate scaled by the autonomic and modulating factors
  (`ans_activity_hr · ans_sens`, `hr_factor`, `hr_mob_factor`, …); `hr_override` pins it to the
  reference.
- The **sinus interval** `60 / heart_rate` drives the SA node; `pq_time`, `av_delay`, `qrs_time` and
  the rate-corrected `qt_time` (Bazett) set the phase durations.

## Activation → chamber contraction (`calc_varying_elastance`)

Two activation functions are computed each step and pushed onto the chambers as `act_factor`:

- **Atrial** `aaf` — a half-sine over the PQ window (→ atria: LA, RA / RAIVCI, RASVC).
- **Ventricular** `vaf` — a skewed pulse over `qrs_time + qt_time` (→ ventricles: LV, RV, coronaries).

The Heart also propagates `ans_sens`, `ans_activity` (scaled by `ans_activity_factor` from the MOB
hypoxia feedback) to the chambers, so the autonomic and myocardial-oxygen-balance effects reach
`HeartChamber.calc_elastances`.

## Contractility / relaxation / pericardium control

Throttled setters apply **deltas** to persistent chamber factors:

- `set_contractillity(left, right)` → chamber `el_max_factor_ps` (inotropy).
- `set_relaxation(left, right)` → chamber `el_min_factor_ps` (lusitropy).
- `set_pericardium(el_factor, extra_volume)` → `PERICARDIUM.el_base_factor_ps` and `vol_extra`.

## Per-beat measurements (`analyze`)

At the systole↔diastole transitions it latches the end-systolic and end-diastolic volumes and
pressures for LV/RV/LA/RA, and derives stroke volume and ejection fraction:

```
SV = EDV − ESV          EF = SV / EDV   (guarded against EDV = 0)
```

## ECG (`calc_ecg`)

A lead-II-like signal synthesized from a sum of Gaussians (P, Q, R, S, T), each positioned within its
conduction phase so the morphology tracks the configured `pq`/`qrs`/`qt` timings; baseline is
isoelectric at 0 mV.

## Configuration (model-definition fields)

`heart_rate_ref`, `pq_time`, `qrs_time`, `qt_time`, `av_delay`; ECG amplitudes `p_amp`…`t_amp`;
`ans_sens`, `ans_activity`, `ans_activity_hr`; the `*_factor` modulators; `pc_el_factor`,
`pc_extra_volume`.

## Notes & caveats

- **End-diastolic pressures.** The diastole-branch in `analyze` now writes `*_edp` (it previously
  wrote `*_esp`, leaving `lv_edp`/`rv_edp`/… at 0 and corrupting the end-systolic values).
- **MOB coupling.** `ans_activity_factor` scales the sympathetic drive the Heart sends to the
  chambers; it is set by the `Mob` model's hypoxia feedback (1.0 = no effect).
- The systole detection reads `LA_LV.flow` / `LV_AA.flow` directly — these mitral/aortic-valve
  connectors are assumed present.

````

### FILE: explain/docs/HeartChamber.md

````markdown
# HeartChamber

A HeartChamber represents a cardiac chamber (atrium or ventricle) with time-varying elastance, ANS-mediated contractility and relaxation, and blood composition tracking. It is the model used for LA, LV, RAIVCI, RASVC, and RV.

## Inheritance

```
BaseModelClass
  └── TimeVaryingElastance         (volume, time-varying elastance, pressure)
        └── HeartChamber           (ANS coupling, blood composition)
```

## Relationship to BloodTimeVaryingElastance

Both `HeartChamber` and `BloodTimeVaryingElastance` extend `TimeVaryingElastance` and add blood composition tracking. The key difference is that HeartChamber overrides `calc_elastances()` to incorporate autonomic nervous system effects on contractility and relaxation via beta-1 adrenergic receptor modeling.

## What it models

A cardiac chamber whose elastance cycles between `el_min` (diastole) and `el_max` (systole), driven by the `act_factor` provided by the `Heart` model. The ANS modulates both values:

- **Diastolic function (el_min)**: Beta-1 receptor activation produces a lusitropic effect -- it *decreases* el_min, improving relaxation. A lower el_min means better diastolic filling.
- **Systolic function (el_max)**: Beta-1 receptor activation produces a positive inotropic effect -- it *increases* el_max, strengthening contraction.

The `Heart` model also applies contractility (`cont_factor_left/right`) and relaxation (`relax_factor_left/right`) factors via the `el_max_factor_ps` and `el_min_factor_ps` persistent factors.

## Properties

### Inherited from TimeVaryingElastance

| Property | Unit | Description |
|---|---|---|
| `u_vol` | L | Unstressed volume |
| `el_min` | mmHg/L | Minimum elastance (diastolic stiffness) |
| `el_max` | mmHg/L | Maximum elastance (systolic stiffness / contractility) |
| `el_k` | unitless | Non-linear elastance coefficient |
| `act_factor` | 0-1 | Activation factor (set by Heart model: `aaf` for atria, `vaf` for ventricles) |
| `vol` | L | Current blood volume |
| `pres` | mmHg | Total pressure |
| `pres_in` | mmHg | Recoil pressure |
| `pres_tm` | mmHg | Transmural pressure |
| `pres_ext` | mmHg | External pressure (non-persistent, e.g., pericardial pressure) |

### ANS properties (unique to HeartChamber)

| Property | Unit | Description |
|---|---|---|
| `ans_sens` | 0-1 | Sensitivity to ANS activity. Set by the Heart model. |
| `ans_activity` | unitless | ANS activity level. 1.0 = baseline, >1 = sympathetic stimulation. Set by Heart model. |

### Blood composition

| Property | Unit | Description |
|---|---|---|
| `temp` | degC | Blood temperature |
| `viscosity` | cP | Blood viscosity |
| `to2` | mmol/L | Total oxygen concentration |
| `tco2` | mmol/L | Total carbon dioxide concentration |
| `ph` | unitless | Blood pH (-1 = not calculated) |
| `pco2` | mmHg | Partial pressure of CO2 (-1 = not calculated) |
| `po2` | mmHg | Partial pressure of O2 (-1 = not calculated) |
| `so2` | unitless | Oxygen saturation (-1 = not calculated) |
| `hco3` | mmol/L | Bicarbonate concentration (-1 = not calculated) |
| `be` | mmol/L | Base excess (-1 = not calculated) |
| `solutes` | object | Dictionary of solute concentrations |
| `drugs` | object | Dictionary of drug concentrations |

### Calculated intermediates

| Property | Unit | Description |
|---|---|---|
| `el_min_eff` | mmHg/L | Effective minimum elastance this step |
| `el_max_eff` | mmHg/L | Effective maximum elastance this step |
| `el_k_eff` | unitless | Effective non-linear elastance coefficient |
| `u_vol_eff` | L | Effective unstressed volume |

## ANS elastance modulation

HeartChamber overrides `calc_elastances()` to add ANS effects. The key difference from the parent class:

### Diastolic function (lusitropic effect)

ANS activation *decreases* el_min (better relaxation):

```
el_min_eff = el_min
  + (el_min_factor - 1) * el_min
  + (el_min_factor_ps - 1) * el_min
  + (el_min_factor_scaling - 1) * el_min
  - (ans_activity - 1) * el_min * ans_sens    // note: SUBTRACTED
```

### Systolic function (inotropic effect)

ANS activation *increases* el_max (stronger contraction):

```
el_max_eff = el_max
  + (el_max_factor - 1) * el_max
  + (el_max_factor_ps - 1) * el_max
  + (el_max_factor_scaling - 1) * el_max
  + (ans_activity - 1) * el_max * ans_sens    // note: ADDED
```

A safety check ensures `el_max_eff` never falls below `el_min_eff`.

## Three-tier factor system

| Tier | Factors | Purpose |
|---|---|---|
| Non-persistent | `u_vol_factor`, `el_min_factor`, `el_max_factor`, `el_k_factor` | Transient effects, reset each step |
| Persistent (`_ps`) | `u_vol_factor_ps`, `el_min_factor_ps`, `el_max_factor_ps`, `el_k_factor_ps` | Heart model contractility/relaxation factors |
| Scaling (`_scaling`) | `u_vol_factor_scaling`, `el_min_factor_scaling`, `el_max_factor_scaling`, `el_k_factor_scaling` | ModelScaler weight/manual scaling |

The persistent factors are the primary mechanism by which the `Heart` model controls chamber function:
- `el_max_factor_ps` is adjusted by `Heart.set_contractillity()` via `cont_factor_left/right`
- `el_min_factor_ps` is adjusted by `Heart.set_relaxation()` via `relax_factor_left/right`

## Pressure calculation

Inherited from `TimeVaryingElastance`:

```
p_ms = (vol - u_vol_eff) * el_max_eff
p_ed = el_k_eff * (vol - u_vol_eff)^2 + el_min_eff * (vol - u_vol_eff)
pres_in = (p_ms - p_ed) * act_factor + p_ed
```

During diastole (`act_factor = 0`), pressure is determined by `el_min_eff` (and `el_k_eff` for non-linear behavior). During systole (`act_factor` approaches peak), pressure is dominated by `el_max_eff`.

## Mixing logic (`volume_in`)

Overrides `volume_in` to perform composition mixing when blood flows in:

```
concentration += ((concentration_from - concentration) * dvol) / vol
```

Applied to: `to2`, `tco2`, all `solutes`, all `drugs`, `temp`, `viscosity`.

## Calculation cycle

1. `calc_elastances()` -- compute el_min_eff, el_max_eff, el_k_eff with ANS modulation (overridden)
2. `calc_volumes()` -- compute u_vol_eff (inherited from TimeVaryingElastance)
3. `calc_pressure()` -- compute time-varying pressure (inherited from TimeVaryingElastance)

## Interaction with the Heart model

The `Heart` model orchestrates all HeartChamber instances:

1. Sets `act_factor` each step: `aaf` (atrial activation function) for LA, RAIVCI, RASVC; `vaf` (ventricular activation function) for LV, RV
2. Sets `ans_activity` and `ans_sens` for ANS coupling
3. Adjusts `el_max_factor_ps` via `set_contractillity()` (systolic function control)
4. Adjusts `el_min_factor_ps` via `set_relaxation()` (diastolic function control)

Flow between chambers is handled by separate `Resistor` models (e.g., `LA_LV` for the mitral valve, `LV_AA` for the aortic valve).

## Example definition (JSON)

```json
{
  "name": "LV",
  "description": "left ventricle",
  "model_type": "HeartChamber",
  "is_enabled": true,
  "vol": 0.0267,
  "u_vol": 0.003,
  "el_min": 133,
  "el_max": 5800,
  "el_k": 0
}
```

## Instances in the model

| Name | Chamber | Activation |
|---|---|---|
| `LA` | Left atrium | Atrial (aaf) |
| `LV` | Left ventricle | Ventricular (vaf) |
| `RAIVCI` | Right atrium (IVC portion) | Atrial (aaf) |
| `RASVC` | Right atrium (SVC portion) | Atrial (aaf) |
| `RV` | Right ventricle | Ventricular (vaf) |

````

### FILE: explain/docs/HeartFunction.md

````markdown
# HeartFunction — Load-Induced Ventricular Contractility Compromise

`HeartFunction` models how a ventricle becomes **compromised** when it labors against a very high
pressure (afterload) or is over-dilated by too much volume (preload). It is a feedback controller in
the same family as `Mob` and `Ans`: it runs in the step loop, reads the per-beat metrics that
`Heart.analyze()` already produces, and writes multiplier **factors** onto the `LV` and `RV`
`HeartChamber`s. It owns no sub-models and touches no base parameters directly.

## Physiology — why a single signal (wall stress)

The healthy Frank–Starling response (more filling → more stroke volume) and afterload sensitivity
(higher ejection pressure → higher end-systolic volume, lower stroke volume) are **already emergent**
in the time-varying elastance core (`TimeVaryingElastance.calc_pressure`): the ESPVR
(`el_max` = Ees = contractility) and the EDPVR coupled to the circuit reproduce them with no extra
code. What `HeartFunction` adds is the **pathological** part — sustained load actually *degrading*
contractility rather than just shifting the operating point on a fixed curve.

The unifying signal is the **Laplace wall stress** of a thin-walled sphere:

```
sigma = P · r / (2 · h)
```

A single quantity captures both mechanisms:

- **Afterload** raises `sigma` through the pressure `P` (end-systolic wall stress `sigma_es`).
- **Dilation** raises `sigma` through the cavity radius `r` (end-diastolic wall stress `sigma_ed`).

This is more faithful than driving off raw pressure/volume, and unlike an Ea/Ees ratio it captures
pure volume overload. Note the modern physiology: there is **no true sarcomere "descending limb" in
vivo** (titin caps sarcomere length ~2.2 µm). High-afterload decompensation is **afterload mismatch**
(Ross 1976) — stroke volume falls when preload reserve is exhausted or Ees is low — and dilation harm
is the Laplace wall-stress / energetic mismatch, not overstretch. The model is built around that view.

## Geometry

Per ventricle, from the end-systolic and end-diastolic cavity volumes (`Heart.lv_esv/lv_edv`,
`rv_esv/rv_edv`):

```
r      = (3 · V_cav / 4π)^(1/3)                                  cavity radius  (V in mL → r in cm)
R_out  = (3 · (V_cav + V_wall) / 4π)^(1/3)                       outer radius
h      = R_out − r                                               wall thickness
```

Wall volume scales with heart weight (reusing Mob's relation), split by a configurable LV/RV mass
fraction, so it tracks body weight automatically:

```
hw       = hw_intercept + hw_slope · weight_kg · 1000            [g]
V_wall_x = wall_volume_x  (if > 0)  else  hw · wall_frac_x / wall_density   [mL]
```

Wall stress uses the chamber transmural recoil pressure (`pres_in`) and the per-phase volume:
`sigma_es = lv_esp · r_es / (2·h_es)`, `sigma_ed = lv_edp · r_ed / (2·h_ed)`.

## Setpoints (auto-calibration)

Baseline wall stress depends on each scenario's geometry, so the setpoints `sigma_*_ref_{lv,rv}`
auto-calibrate: during an initial window (`setpoint_warmup` seconds **of elapsed model time since the
model started** — not the absolute engine clock, since scenarios are saved with a non-zero
`model_time_total`) the model tracks the resting peak wall stress and freezes the reference to it.
While warming up, all factors are held at `1.0` (no effect). Provide a positive `sigma_*_ref` in the
definition to override and skip auto-learning.

## Acute layer (reversible, seconds–minutes)

When end-systolic stress (afterload) or end-diastolic stress (over-dilation) exceeds its setpoint,
contractility is depressed, smoothed by a first-order lag toward the target:

```
excess_es  = max(0, sigma_es − ref_es)
excess_ed  = max(0, sigma_ed − ref_ed)
target     = clamp(1 − g_es·excess_es − g_ed·excess_ed, cont_floor, 1)
load_factor += dt · (1/cont_tc) · (target − load_factor)
```

`load_factor` is written to the chamber's `el_max_load_factor`. It fully recovers to `1.0` within
~`cont_tc` when the load normalizes (afterload mismatch is reversible / inotrope-correctable).

## Chronic layer (remodeling, slow)

A slow wall-stress average (time constant `stress_avg_tc`) drives two remodeling integrators with the
time constant `remodel_tc` (default ~1 day; compress it to observe remodeling within a short run):

- **Concentric** `rc` (sustained high `sigma_es`, pressure overload): thickens the wall (raises the
  effective `V_wall`, lowering `sigma` — compensation) with a maladaptive tail of diastolic
  stiffening and a mild contractility decline.
- **Eccentric** `re` (sustained high `sigma_ed`, volume overload): dilates the cavity and declines
  contractility.

These map onto chamber factors:

```
el_max_remodel_factor = clamp(1 − mal_conc·rc − mal_ecc·re, remodel_floor, 1)
el_k_remodel_factor   = 1 + stiff_conc · rc      (concentric diastolic stiffening)
u_vol_remodel_factor  = 1 + dil_ecc · re         (eccentric cavity dilation)
```

## Wiring into the chamber

`HeartChamber.calc_elastances()` adds the two `el_max` terms and the `el_k` term, and
`HeartChamber.calc_volumes()` (overridden) adds the `u_vol` term — all following the existing additive
`+ (factor − 1) · base` convention, so they compose cleanly with the ANS inotropic term and Mob's
`el_max_mob_factor`. The existing `el_max_eff < el_min_eff` clamp protects the lower bound. Atria are
left untouched (factors stay `1.0`).

## Verification

`scripts/probe_heartfunction.mjs` builds `term_neonate`, warms up, then applies an afterload challenge
and a volume-overload challenge, printing wall stress, the acute factor, and the remodeling state.
Observed behavior: at baseline factors stay ≈1.0; a transfusion drives `sigma_ed`/`sigma_es` well above
setpoint, collapses ejection fraction, depresses `el_max_load_factor` to its floor, and—on a
time-compressed run—dilates `u_vol_remodel_factor` and drops `el_max_remodel_factor` (the full
both-timescale decompensation cascade). An afterload challenge raises `sigma_es` and depresses
contractility directionally; note that the `term_neonate` circulation has a low-resistance runoff, so
forcing severe *pure* pressure overload is hard in that scenario (a model-of-circulation property, not
a `HeartFunction` limitation).

## Key parameters

| Parameter | Meaning |
| --- | --- |
| `hf_active`, `remodel_active` | master switches for the acute and chronic layers |
| `wall_frac_lv/rv`, `wall_volume_lv/rv`, `wall_density` | wall-volume geometry |
| `g_es_lv/rv`, `g_ed_lv/rv` | acute contractility-depression gains (afterload / dilation) |
| `cont_tc`, `cont_floor` | acute response time constant and lower bound |
| `remodel_tc`, `stress_avg_tc` | chronic remodeling and stress-averaging time constants |
| `k_conc`, `k_ecc`, `mal_conc`, `mal_ecc`, `stiff_conc`, `dil_ecc`, `remodel_floor` | remodeling gains and bound |
| `setpoint_warmup`, `sigma_*_ref_*` | setpoint auto-calibration window / overrides |

````

### FILE: explain/docs/HeartValve.md

````markdown
# HeartValve

A `HeartValve` is a `Resistor` with a distinct `model_type` — it adds no code of its own:

```js
export class HeartValve extends Resistor {
  static model_type = "HeartValve";
}
```

All of its behaviour (flow mechanics, the forward/backward resistances, the non-linear term, the
flags) comes from [`Resistor`](./Resistor.md). The separate type exists for clarity in definitions and
so the UI can present valve-relevant fields.

## Valve behaviour

Valve action is configuration, not code: a heart valve sets **`no_back_flow = true`** so blood flows
only in the forward direction (e.g. `LA_LV`, `RV_PA`, `LV_AA`). A valve that is atretic/absent in a
given scenario additionally sets `no_flow = true`.

See [Resistor.md](./Resistor.md) for the flow equations, the `volume_out`/`volume_in` handshake, and
the resistance/factor details.

````

### FILE: explain/docs/Hormones.md

````markdown
# Hormones (RAAS / ADH)

The `Hormones` model is the **long-loop neuro-hormonal volume / osmolality controller** — the slow
counterpart to the fast [`Ans`](./Ans.md) baroreflex. It models the
renin–angiotensin–aldosterone system (RAAS) plus ADH (vasopressin) as a small set of named,
inspectable hormone **activity levels** (`1.0` = resting baseline), each driven first-order toward a
stimulus-set target and each writing effector channels that are **independent of the ANS** (so they
compose, never collide).

Like the [`Kidneys`](./Kidneys.md) autoregulation loop it is a **controller/process model**: it
holds no blood, resolves references to other models lazily, runs on an update interval, and **owns
its effector channels while enabled** (releasing them once on disable). Default config is
**neutral** — with setpoints anchored to the scenario's resting state, every `(hormone − 1) ≈ 0`,
so a scenario that ships a `Hormones` model behaves identically at rest and only diverges when
perturbed or when a pathway is clamped.

## Sensors → hormones → effectors

```
SENSORS (lazy refs)                 HORMONES (1.0 = baseline)        EFFECTORS (owned, default-neutral)
KID_ART.pres ───────────┐
Circulation.total_blood_volume ─┬─► angiotensin ─┐                 Circulation.svr_factor_art / _ven   (arteriolar/venular constriction)
AA.solutes.na (osm≈2·Na) ──┐    │   (renin=drive) ├─► aldosterone   KID_CAP_KID_VEN.r_factor_ps         (renal EFFERENT constriction)
AA.solutes.k ──────────────┼────┘                │   (cascade+K)    Kidneys.reabsorption_factors.na/.k  (Na retention / K wasting)
                           └─────────────────────┴─► adh            Kidneys.reabs_factor_adh            (water retention / antidiuresis)
```

- **angiotensin II** ← low renal perfusion + low blood volume. `renin` is the instantaneous drive;
  `angiotensin` is its lagged effective level (`angiotensin_tc`).
- **aldosterone** ← angiotensin (cascade) + hyperkalemia. Slow (`aldosterone_tc`).
- **adh** ← plasma osmolality (osmotic, `osm ≈ 2·Na`) + low volume/pressure (baroregulated).

> **Why the renal EFFERENT, not the afferent.** The renal afferent (`KID_ART.r_factor_ps`) is owned
> by the Kidneys autoregulation loop (overwritten every tick). Angiotensin II therefore acts renally
> through the **efferent** arteriole (`KID_CAP_KID_VEN`, a free-standing `Resistor`) — which is also
> its signature physiology: efferent constriction raises glomerular pressure and **defends GFR** when
> perfusion falls. Systemic constriction goes through `Circulation.svr_factor_art/_ven`, which fans a
> delta out to every systemic arteriole/venule's `r_factor_ps` (`BloodVessel` α-couples that into
> elastance — realistic combined constriction). The ANS uses a *separate* `ans_activity` channel, so
> the two compose without clashing.

## Dynamics

Each hormone relaxes first-order toward a stimulus target on the controller tick
(`_update_interval`, default 1 s; hormones are slow so a fine tick is unnecessary):
`x += u·(1/tc)·(−x + target)`, clamped to `[hormone_min, hormone_max]`. With `p/V/Na/K` the sensed
values and `*_setpoint` the resting anchors:

```
renin       = 1 + renin_gain·(p_set−p)/p_set + renin_vol_gain·(V_set−V)/V_set        → angiotensin (lag)
aldo_target = 1 + aldo_gain·(angiotensin−1) + aldo_k_in_gain·(K−K_set)/K_set         → aldosterone (slow lag)
adh_target  = 1 + adh_gain_osmo·(Na−Na_set)/Na_set + adh_gain_baro·(V_set−V)/V_set   → adh (lag)
```

Each `*_enabled` gate that is off pins its hormone(s) to `1.0` (neutral). Effector factors map
`1 + gain·(hormone−1)` (K wasting is `1 − aldo_k_gain·(aldo−1)`), each clamped, then written to the
owned channel.

## Kidneys integration

Two neutral-by-default hooks were added to `Kidneys` for this layer (see [`Kidneys`](./Kidneys.md)):
- **`reabs_factor_adh`** — ADH's dedicated water-reabsorption multiplier, folded into `_reabs_eff`
  (separate from the user `reabs_factor_ps` layer).
- **`reabsorption_factors`** (per-solute dict) — aldosterone's per-solute multiplier applied in
  `_solute_reabs` (`na > 1` retain, `k < 1` waste); also reusable for diuretics.

## Read-outs
| Read-out | Meaning |
|---|---|
| `angiotensin` / `aldosterone` / `adh` | effective hormone activity (1.0 = baseline) |
| `renin` | instantaneous angiotensin drive (un-lagged) |
| `svr_factor` / `svr_ven_factor` | applied systemic arteriolar / venular constriction factor |
| `efferent_factor` | applied renal efferent `r_factor_ps` |
| `na_reabs_factor` / `k_reabs_factor` / `water_reabs_factor` | applied Kidneys reabsorption factors |
| `sensed_perfusion` / `sensed_volume` / `sensed_na` / `sensed_osmolality` / `sensed_k` | sensor read-outs |

## Configuration & calibration
Anchor `perfusion_setpoint` ≈ baseline `KID_ART.pres` (neonate ≈ 40, adult ≈ 82 mmHg),
`volume_setpoint` ≈ baseline `Circulation.total_blood_volume` (neonate ≈ 0.286 L, adult ≈ 4.84 L),
`osmo_na_setpoint` ≈ 138, `k_setpoint` ≈ 3.5 — so resting hormone levels ≈ 1.0 and no channel rails
(measured headless with `Ans` disabled). Gains/time-constants are configurable per hormone; both
scenarios ship **enabled** with **physiologic** time constants (`angiotensin_tc` 30 s, `adh_tc`
120 s, `aldosterone_tc` 1800 s).

**Validated headless** (`scripts/headless.mjs <scenario> --bleed FRAC | --naload Δ --phase2 S`,
optionally `--hset aldosterone_tc=…` to compress for a quick loop check):
- **Resting neutrality:** hormones ≈ 1.0; GFR/urine/FENa unchanged from the no-hormone calibration;
  disabling (`hormones_running=false`) is byte-identical.
- **Hemorrhage (−8% volume):** angiotensin/aldosterone↑, efferent constricts → GFR defended
  (adult 100 → 72 mL/min), urine → oliguria (1.0 → 0.64 mL/kg/hr).
- **Hyperosmolar (+12 mmol/L Na):** ADH↑ (1.0 → 1.35) → antidiuresis (urine 1.0 → 0.48 mL/kg/hr),
  RAAS stays quiet (osmolality drives only ADH).
- Stable over long physiologic-`tc` runs (no oscillation/railing).

## Simplifications / limitations (current scope)
- **Aldosterone's volume effect is muted:** the engine's water transport follows the water fraction,
  not osmotically coupled to Na, so aldosterone shows mainly as ↓FENa / ↓urine-Na rather than large
  volume shifts. ADH (water) and AngII (vasoconstriction) carry the volume/pressure defense.
- With **physiologic** `aldosterone_tc` (~30 min), aldosterone barely moves in short scenarios —
  expected; compress `aldosterone_tc` for interactive demos.
- While enabled, `Hormones` **owns** `Circulation.svr_factor_*`, `KID_CAP_KID_VEN.r_factor_ps`, and
  the Kidneys hormone factors — manual edits to those channels are overridden (same precedent as
  autoregulation owning `KID_ART.r_factor_ps`). The clean "off" switch is `hormones_running = false`
  (or per-pathway `raas_enabled` / `adh_enabled`), which releases the channels back to neutral.
- Not modeled: ANP / natriuretic peptides, thirst / fluid intake, direct osmotic water-follows-Na
  coupling. Severe (>~15%) acute hemorrhage can drive the circulation model to non-physiologic
  (negative) pressures — a pre-existing circulation limitation, independent of this layer.
```

````

### FILE: explain/docs/Kidneys.md

````markdown
# Kidneys

The `Kidneys` model turns the otherwise passive renal vascular bed
(`KID_ART → KID_CAP → KID_VEN`) into an active filtration unit. It is a
**controller/process model** (like [`Placenta`](./Placenta.md)) — it holds no
blood itself, it operates on the existing glomerular capillary `KID_CAP` and a
new `URINE` bladder compartment it owns.

**Scope: fluid balance & urine output, per-solute reabsorption, and optional GFR autoregulation**
(myogenic + TGF, see below). Reabsorption fractions are static (no hormonal control yet); no
clearance/acid-base or RAAS/ADH — those are future phases.

## What it does each step

```
oncotic = oncotic_base · (KID_CAP.solutes.albumin / albumin_ref)   # rises with hemoconcentration
NFP     = max(0, KID_CAP.pres − p_bowman − oncotic)                 # Starling net filtration pressure
GFR     = kf_eff · NFP                                              # glomerular filtration rate (L/s)
Vf      = GFR · dt                                                  # filtrate volume this step (L)
Uw      = Vf · (1 − reabsorption_fraction)                          # net urine WATER leaving the blood
```

### Per-solute reabsorption (mass balance)

Each filterable solute is reabsorbed by **its own** fraction, so urine need not be
iso-osmotic with plasma. `_transfer(Vf, wr)` does a conservative **mass balance** (NOT
`volume_in`, which would copy *all* solutes incl. albumin/Hb and cause artifactual
proteinuria). With water fraction `wr` and per-solute fraction `fr[s]`:

```
fr[s]  = reabsorption_fractions[s]  (else wr)         # clamped [0, 0.9999]
Mf[s]  = Vf · C_plasma[s]                             # filtered solute mass
Mx[s]  = min(Mf[s] · (1 − fr[s]), C[s]·V)             # excreted mass (clamped to available)
C'[s]  = (C[s]·V − Mx[s]) / (V − Uw)                  # new blood conc (reabsorbed stays in blood)
URINE.solutes[s] = (URINE.solutes[s]·Uvol + Mx[s]) / (Uvol + Uw)
```

Only the **net** excreted water (`Uw`) and solute mass (`Mx`) leave `KID_CAP`; the
reabsorbed remainder is simply never removed (it returns to blood). `albumin` & `hemoglobin`
are **not** filtered — total mass conserved, concentration scaled by `vol_before/vol_after`
(hemoconcentration). Volume is guarded with a `1e-9` floor.

- **Backward compatible:** if `fr[s] = wr` for every solute (e.g. an empty
  `reabsorption_fractions`), then `Mx[s] = C[s]·Uw` and `C'[s] = C[s]` — urine is iso-osmotic
  with plasma and output is identical to the old single-fraction model.
- `fr[s] > wr` → solute concentrates in blood / **dilutes** in urine; `fr[s] < wr` →
  **concentrates** in urine.

Net effect: diuresis slowly lowers circulating blood volume; `URINE.vol` accumulates total
diuresis; the kidney now handles water and each solute independently (e.g. Na/Cl avidly
reabsorbed, phosphate/urate spilled).

> **Hormonal modulation hooks (driven by the [`Hormones`](./Hormones.md) RAAS/ADH model).** Two
> dedicated, neutral-by-default factor channels let a hormonal controller modulate reabsorption
> without colliding with the user/scenario `reabs_factor_ps` layer or the absolute
> `reabsorption_fractions` dict:
> - **`reabs_factor_adh`** (water) — a 4th multiplier folded into `_reabs_eff`
>   (`reabsorption_fraction · reabs_factor · reabs_factor_ps · reabs_factor_scaling_ps · reabs_factor_adh`).
>   ADH drives antidiuresis through it. Default `1.0`.
> - **`reabsorption_factors`** (per-solute dict) — multiplies each solute's fraction in `_solute_reabs`
>   (`fr ·= reabsorption_factors[s] ?? 1`), so aldosterone can retain Na (`na > 1`) and waste K
>   (`k < 1`); also reusable for diuretics. Default `{}` (every solute → 1.0). Distinct from the
>   absolute `reabsorption_fractions` dict (this modulates on top of it).
>
> Both default to neutral, so a scenario without a `Hormones` model is byte-identical. The absolute
> `reabsorption_fractions` is also still scheduler-tweakable per key
> (`setPropValue("Kidneys.reabsorption_fractions.na", …)`). The water fraction keeps its
> `reabs_factor`/`_ps`/`_scaling_ps` stack; explicit per-solute overrides track the `wr` fallback
> when absent.

## Read-outs
| Property | Unit | Meaning |
|---|---|---|
| `gfr` | mL/min | glomerular filtration rate |
| `urine_flow` | mL/min | net urine output |
| `nfp` | mmHg | net filtration pressure |
| `urine_volume` | mL | cumulative diuresis (= `URINE.vol × 1000`) |
| `fe_na` | % | fractional excretion of Na (= `(1 − fr_na)·100`) |

Per-solute urine concentrations live in `URINE.solutes`.

## Configuration
| Param | Meaning |
|---|---|
| `kidneys_running` | master gate (false → GFR/urine = 0, bladder holds) |
| `kf` | glomerular filtration coefficient (L/s·mmHg) — **the dominant, scenario-specific calibration knob** |
| `p_bowman` | Bowman's capsule pressure (mmHg) |
| `oncotic_base`, `albumin_ref` | plasma oncotic pressure at the reference albumin |
| `reabsorption_fraction` | **water** reabsorption fraction (urine water = GFR·(1−FR)) |
| `reabsorption_fractions` | per-solute reabsorption dict `{na, k, …}`; absent → uses the water fraction |
| `filterable_solutes` | small solutes filtered into urine (albumin/Hb excluded) |

`kf` carries the additive 3-layer factor stack (`kf_factor` / `_ps` / `_scaling_ps`),
`reabsorption_fraction` a multiplicative one (clamped to [0, 0.9999]). The two scenarios now ship
**distinct, headless-calibrated** per-solute fractions reflecting neonatal tubular immaturity (the
neonate excretes a larger fraction of every solute → higher FE across the board):

| reabsorption fraction | neonate | adult | → FE neonate / adult |
|---|---|---|---|
| water (`reabsorption_fraction`) | 0.980 | 0.990 | — |
| na | 0.990 | 0.993 | **1.0% / 0.7%** |
| cl | 0.988 | 0.991 | 1.2% / 0.9% |
| lact | 0.99 | 0.99 | 1.0% / 1.0% |
| ca | 0.975 | 0.985 | 2.5% / 1.5% |
| mg | 0.95 | 0.96 | 5.0% / 4.0% |
| k | 0.88 | 0.90 | 12% / 10% |
| phosphates | 0.82 | 0.88 | 18% / 12% |
| uma | 0.70 | 0.92 | 30% / 8% |

FENa is now **distinct** between scenarios (neonate ~1%, adult ~0.7%) — neonatal Na handling is
immature, so its FENa is correctly higher. Each Na/Cl fraction stays above its scenario's water
fraction (net-reabsorbed → dilute in urine); K/Mg/Ca/phosphate/urate fall below it (net-excreted →
concentrated in urine).

The `URINE` compartment is a `BloodCapacitance` declared in the Kidneys
`components` block (auto-instantiated by the base `init_model`), a pure sink with
no resistor connections (it never feeds back into the circulation).

> **Wiring note.** `KID_CAP` is a component of the `Circulation` model and may be
> instantiated *after* `Kidneys` in build order, so `_kid_cap` is resolved **lazily**
> on the first `calc_model` step (the `URINE` own-component is resolved in `init_model`).

## Calibration
`kf` differs ~6× between scenarios because baseline `KID_CAP.pres` differs
(neonate ≈ 37, adult ≈ 79 mmHg). Back-solve `kf ≈ target_GFR(L/s) / NFP_baseline`.
Targets: neonate GFR ~2–4 mL/min & urine ~1–3 mL/kg/hr; adult GFR ~90–110 mL/min
& urine ~0.5–1.5 mL/kg/hr. Keep `p_bowman + oncotic_base` well below `KID_CAP.pres`
(the neonate NFP margin is thin, ~11 mmHg) or filtration stops.

**Headless calibration.** Reproduce/re-tune with the in-repo runner
`node scripts/headless.mjs <term_neonate|adult_female>` (builds the scenario, freezes `Ans`,
steps to steady state, cycle-averages the renal panel: GFR, urine mL/kg/hr, NFP, the full FE
panel, urine concentrations, and `afferent_factor`). Override knobs without editing the scenario
JSON via `--kf`, `--water`, `--frac na=…,k=…`; add `--no-autoreg` to isolate raw filtration. The
shipped values were calibrated this way (autoregulation enabled, `Ans` disabled):

| measured (cycle-avg, steady state) | neonate | adult |
|---|---|---|
| GFR | 3.9 mL/min | 100 mL/min |
| urine output | 1.3 mL/kg/hr | 1.0 mL/kg/hr |
| FENa | 1.0% | 0.7% |
| NFP / `KID_CAP.pres` | 10.9 / 37.0 mmHg | 44.0 / 79.0 mmHg |
| `afferent_factor` (autoreg neutrality) | 1.02 | 0.88 |

Stable across 60–150 s warm-ups (no drift/oscillation); `afferent_factor` ≈ 1 confirms
autoregulation sits near-neutral at baseline (no railing).

## GFR autoregulation (myogenic + TGF)

Optional closed-loop autoregulation (`autoregulation_enabled`, **default `false`** → the
model is byte-identical to the no-autoregulation behaviour until toggled on). When enabled, a
controller adjusts the **afferent arteriole** — the `KID_ART` `BloodVessel` (`aff_vessel_name`)
— by writing its `r_factor_ps`. A `BloodVessel` owns its input resistor and pushes its computed
resistance into it every step, so this modulates the renal supply resistor `AD_KID_ART`.
Constricting it (`r_factor_ps > 1`) cuts renal inflow → lowers `KID_CAP.pres` → NFP → GFR (and
α-couples a small elastance stiffening); dilating (`< 1`) raises them. Renal blood flow
autoregulates alongside GFR. The controller runs on a 15 ms tick (`u`); each limb and the
applied factor are first-order lagged (`x += u·(1/tc)·(−x + target)`).

> **Why control the afferent vessel (upstream of the sensor), not the glomerular inflow.** The
> myogenic limb senses `KID_ART.pres`, which sits *downstream* of `AD_KID_ART`. Constricting
> `AD_KID_ART` lowers `KID_ART.pres` (more drop upstream), so the loop is **negative feedback**
> (sense high → constrict → pressure falls → self-correcting). Controlling the downstream
> `KID_ART_KID_CAP` resistor instead would *raise* the sensed pressure when it constricts —
> positive feedback that rails the operating point. `AD_KID_ART` is also the dominant series
> resistance, so a firm plateau needs only modest gain.

**Myogenic limb (fast, `myogenic_tc ≈ 4 s`)** — senses the pressure the afferent feels
(`myogenic_input_model.myogenic_input_prop`, default `KID_ART.pres`). Piecewise-linear,
saturating outside the autoregulatory window `[p_min, p_max]`:

```
act = clamp(p_in, p_min, p_max) − p_set                 # deviation, saturated at the shoulders
gain = (p_in >= p_set) ? gain_up : gain_down
myo_target = 1 + gain·act                               # at setpoint → 1.0; rise → constrict
```

**TGF limb (slow, `tgf_tc ≈ 30 s`)** — senses distal NaCl delivery
`tgf_signal = GFR × KID_CAP.solutes.na` (`tgf_use_nacl`; falls back to `GFR` alone). When
`tgf_setpoint ≤ 0` it **auto-seeds**: the signal is smoothed by an EMA and the setpoint is
captured only after a `tgf_seed_delay` (default 30 s) warm-up, so it reflects the steady
state rather than the startup transient (seeding too early biases it low → standing
constriction at rest). The TGF limb stays neutral (`tgf_factor = 1`) until seeded.

```
err = (tgf_signal − tgf_setpoint) / tgf_setpoint
tgf_target = 1 + tgf_gain·err                           # high delivery → constrict
```

**Combine → clamp → lag → write** (`afferent_apply_tc ≈ 6 s`):

Each limb target is floored at a small positive (`_limb_factor_floor`) so a large downward
deviation × high gain can't drive a factor negative. Then:

```
combined = myogenic_factor · tgf_factor                 # multiplicative
combined = clamp(combined, afferent_factor_min, afferent_factor_max)
afferent_factor ← lag(afferent_factor → combined)       # then re-clamp
KID_ART.r_factor_ps = afferent_factor                   # vessel propagates to AD_KID_ART
```

As perfusion pressure (`AD.pres`) rises, the afferent constricts and holds GFR / renal blood
flow ~flat; beyond the window the factor saturates and GFR follows pressure again (the classic
shoulders). The three lags + hard clamp keep the loop well-damped and `r_for_eff > 0`.

| Read-out | Meaning |
|---|---|
| `myogenic_factor` / `tgf_factor` | per-limb afferent multipliers |
| `afferent_factor` | applied (lagged, clamped) `r_factor_ps` on the afferent |
| `sensed_pressure` | pressure driving the myogenic limb (mmHg) |
| `tgf_signal` | current TGF signal (`GFR×Na` or `GFR`) |

> **Ordering / one-step sensor delay.** `Kidneys` is a top-level model, so it steps before the
> `Circulation` sub-compartments (`KID_ART`, `AD_KID_ART`, …) that are created during the build's
> init pass. It therefore writes `KID_ART.r_factor_ps` **before** `KID_ART` steps and composes it
> into the resistance it pushes to `AD_KID_ART` — same step, no effector lag (and `r_factor_ps`
> persists, so ordering is non-fatal regardless). `Kidneys` reads `KID_ART.pres` from the previous
> step's pass — a deliberate one-step sensor delay the lags absorb. Disabling mid-run writes
> `KID_ART.r_factor_ps` back to `1.0` once, restoring linear behaviour.

**Calibration.** Set `myogenic_p_set` to each scenario's baseline `KID_ART.pres` so the
controller is near-neutral at steady state (the negative feedback makes this a fine-centering,
not a stability requirement). Both scenarios ship **enabled**:

| param | neonate | adult |
|---|---|---|
| `autoregulation_enabled` | **true** | **true** |
| `myogenic_p_set` / `_p_min` / `_p_max` | 40 / 25 / 65 | 83 / 55 / 140 |
| `myogenic_gain_up` / `_down` | 0.18 | 0.25 |
| `myogenic_tc` | 4 s | 4 s |
| `tgf_gain` / `tgf_tc` | 2.0 / 30 s | 3.0 / 30 s |
| `afferent_apply_tc` | 6 s | 6 s |
| `afferent_factor_min` / `max` | 0.5 / 10.0 | 0.5 / 20.0 |
| `tgf_setpoint` | 0 (auto-seed) | 0 (auto-seed) |

Validated headless (build the scenario, disable `Ans`, cycle-average, sweep preload to vary the
upstream perfusion pressure `AD.pres`). Measured against `AD.pres` (the controller regulates
`KID_ART.pres`, so it cannot be the x-axis): autoregulation cuts GFR variation **~77%** (neonate)
and **~79%** (adult) vs off, stable, with ANS-on baseline `afferent_factor` ≈ 1.0 (neonate 1.02,
adult 0.88) — no railing.

## Simplifications (current scope)
- Autoregulation is **opt-in**; with it off, GFR rides directly on `KID_CAP.pres` (linear in
  perfusion pressure).
- Oncotic pressure is linear in albumin (not Landis-Pappenheimer).
- Reabsorption is per-solute (each solute its own fraction), but **static** — no tubular load /
  transport-maximum / secretion kinetics, and not yet hormonally driven (RAAS/ADH is the next phase).
- `URINE` never empties on its own (a future `void_bladder()` function can reset it).

````

### FILE: explain/docs/Metabolism.md

````markdown
# Metabolism

The Metabolism model is the tissue **oxygen sink and CO₂ source**. Every step it removes oxygen from
and adds carbon dioxide to a configured set of blood compartments, driving the arterio-venous gas
gradient that the rest of the circulation transports and the lungs/placenta clear.

It is the counterpart to gas exchange (`GasExchanger`, `BloodDiffusor`): exchange *loads* O₂ and
*unloads* CO₂ at the lung/membrane; metabolism *unloads* O₂ and *loads* CO₂ at the tissues.

## What it models

A single whole-body oxygen consumption `vo2` (ml O₂ / kg / min) is distributed across several blood
compartments according to a per-compartment **fractional oxygen use** `fvo2`. CO₂ production follows
from the **respiratory quotient** `resp_q` (CO₂ produced / O₂ consumed).

```
vo2 (ml/kg/min)  ──split by fvo2──►  per-compartment O₂ draw  ──×resp_q──►  per-compartment CO₂ release
```

## Step calculation (`calc_model`)

Runs every model step when `met_active` is true.

1. **Whole-body O₂ use for this step**, converted ml → mmol and per-minute → per-step:
   ```
   vo2_step = (0.039 · vo2 · vo2_factor · weight) / 60 · Δt        [mmol]
   ```
   - `0.039` mmol/ml is the O₂ molar density at 37 °C, 1 atm (≈ 1 / 25.4 L·mol⁻¹).
   - `weight` is the engine body weight (kg); `vo2_factor` lets other models (e.g. MOB, temperature)
     scale consumption; `Δt` is the model step size.

2. **For each entry in `metabolic_active_models` (`{ compartment: fvo2 }`):**
   - Resolve the compartment. If it is a `MicroVascularUnit`, metabolism is applied to its
     capillary sub-compartment `<name>_CAP` instead (gas exchange with tissue happens there).
   - O₂ removed and CO₂ added this step:
     ```
     dto2  = vo2_step · fvo2
     dtco2 = vo2_step · fvo2 · resp_q
     to2  := max(0, (to2·vol − dto2) / vol)
     tco2 :=        (tco2·vol + dtco2) / vol
     ```
     i.e. a fixed amount of O₂/CO₂ is exchanged with the compartment's blood volume; the new
     concentration follows from the compartment volume. `to2` is floored at 0 so a compartment cannot
     go O₂-negative.

`fvo2` are meant to be **fractions of the whole-body VO₂** and should sum to ≈ 1.0 across all entries.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `met_active` | master on/off switch |
| `vo2` | whole-body O₂ consumption (ml/kg/min) |
| `vo2_factor` | external multiplier on VO₂ (set by other models) |
| `resp_q` | respiratory quotient (CO₂/O₂), typically ~0.8 |
| `metabolic_active_models` | `{ compartmentName: fvo2 }` — where O₂ is consumed and CO₂ produced |

`set_metabolic_active_model(site, new_fvo2)` adds/updates one site's fraction at runtime.

Example (term neonate): `vo2 = 8.1`, `resp_q = 0.8`, with `fvo2` spread over `BR_CAP` (0.453,
brain — the largest sink), `RLB`/`RUB` (lower/upper body), `INT_CAP`, `LS_CAP`, `KID_CAP`, and small
fractions on `AA`/`AD`.

## Notes & caveats

- **`fvo2` should sum to ~1.0.** If the configured fractions sum to more (or less) than 1, the
  effective whole-body VO₂ is correspondingly higher (or lower) than the `vo2` setting — this is a
  definition concern, not enforced by the model.
- **O₂ floor breaks strict conservation.** When `to2` would go negative it is clamped to 0, but the
  matching CO₂ is still produced in full. At physiological gradients this never triggers; under
  extreme O₂ debt it would slightly over-produce CO₂ (a simplification — anaerobic metabolism is not
  modelled).
- **Empty / missing compartments are skipped** (volume ≤ 0 or an unresolved name) so they neither
  divide by zero nor halt processing of the remaining compartments.

````

### FILE: explain/docs/Mob.md

````markdown
# Mob — Myocardial Oxygen Balance

`Mob` models the **oxygen economy of the heart muscle**: how much O₂ the myocardium consumes, how
that O₂ is drawn from the coronary blood pool, and how myocardial **hypoxia** feeds back onto cardiac
function (rate, contractility, autonomic drive). It is the cardiac analogue of `Metabolism` — but
where `Metabolism` is a passive tissue sink, `Mob` also closes a regulatory loop with the `Heart`.

It owns the coronary sub-network (`COR`, `AA_COR`, `COR_RAIVCI`, `COR_RASVC`) declared under its
`components` block.

## Oxygen consumption

Two physiologically explicit terms, both in **mmol O₂ / s**, scaled by heart weight `hw`:

```
hw      = hw_intercept + hw_slope · weight_kg · 1000           [g]   (heart mass from body weight)
bm_vo2  = bm_vo2_per_g · hw                                    [mmol/s]   basal metabolism
sw_vo2  = sw_vo2_per_g · hw · stroke_work_total / cycle_time   [mmol/s]   contractile (stroke) work
mob_vo2 = bm_vo2 + sw_vo2
```

**Stroke work** is the area of the ventricular pressure–volume loop, accumulated by trapezoidal
`P·dV` integration each step and split by flow direction:

- filling (dV > 0) accumulates into `_pv_area_*_inc`
- ejection (dV < 0) accumulates into `_pv_area_*_dec`
- at the start of each cardiac cycle: `stroke_work = _pv_area_dec − _pv_area_inc` (the enclosed loop
  area), the per-beat O₂ cost is computed, and the accumulators reset.

The per-beat stroke-work cost is then amortized over the current `cardiac_cycle_time` to give a rate.

## Coronary pool update

Per step, `mvo2_step = mob_vo2 · Δt` is drawn from the coronary blood pool `COR`, with CO₂ added back
via the respiratory quotient `resp_q`:

```
COR.to2  := (to2·vol − mvo2_step) / vol
COR.tco2 := (tco2·vol + mvo2_step·resp_q) / vol
```

The update is applied only when it keeps `to2 ≥ 0` (see caveats).

## Hypoxia feedback to the Heart

Coronary O₂ (`COR.to2`) drives a one-sided activation: at/above `to2_ref` there is no effect; below
it the activation goes negative, reaching its floor at `to2_min`. Three independent channels each
low-pass the activation with their own time constant (`hr_tc`, `cont_tc`, `ans_tc`) and map it onto a
factor in `[*_min, *_max]`:

| Channel | Computed factor | Written to | Effect |
|---|---|---|---|
| Heart rate | `hr_factor` | `Heart.hr_mob_factor` | lowers heart rate (bradycardia) |
| Contractility | `cont_factor` | each chamber's `el_max_mob_factor` | lowers `el_max` (negative inotropy) |
| Autonomic | `ans_activity_factor` | `Heart.ans_activity_factor` | scales the sympathetic drive the Heart propagates to the chambers |

At normal coronary O₂ all three factors are 1.0 (no effect); under severe coronary hypoxia each
drives toward its `*_min` (default 0.01), i.e. profound suppression of rate, contractility and
autonomic responsiveness — the model of an ischemic, failing myocardium.

### How the channels reach the physics

- **`hr_mob_factor`** is read in `Heart.calc_model` (heart-rate sum).
- **`el_max_mob_factor`** is read in `HeartChamber.calc_elastances` as an additive factor on `el_max`
  (alongside `el_max_factor`, `el_max_factor_ps`, …).
- **`ans_activity_factor`** is read in `Heart.calc_varying_elastance`: the chambers receive
  `ans_activity · ans_activity_factor` instead of `ans_activity`, so it scales the sympathetic
  inotropy/lusitropy term in `HeartChamber.calc_elastances`.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `mob_active` | master on/off |
| `to2_ref`, `to2_min` | coronary O₂ window over which hypoxia ramps in |
| `resp_q` | respiratory quotient (CO₂/O₂) |
| `bm_vo2_per_g`, `sw_vo2_per_g` | basal and stroke-work O₂ cost per gram of myocardium |
| `hw_intercept`, `hw_slope` | heart-mass-from-body-weight regression |
| `hr_factor_min/max`, `hr_tc` | heart-rate hypoxia channel |
| `cont_factor_min/max`, `cont_tc` | contractility hypoxia channel |
| `ans_factor_min/max`, `ans_tc` | autonomic hypoxia channel |

## Notes & caveats

- **Contractility and autonomic channels were previously inert.** `el_max_mob_factor` had no term in
  `HeartChamber.calc_elastances`, and `Heart` never read `ans_activity_factor` — so only the
  heart-rate channel was wired. Both are now connected (see above). Because the autonomic channel also
  acts on contractility (it scales `ans_activity`, which drives `el_max`/`el_min`), hypoxia now
  suppresses contractility through **two** compounding channels; the combined strength should be
  validated/tuned (via `cont_factor_min` and `ans_factor_min`) against expected behaviour in the host
  app.
- **O₂-debt handling freezes the pool.** When a step's consumption would drive `COR.to2` negative,
  the whole coronary update is skipped (O₂ not floored to 0, no CO₂ added), so `COR.to2` cannot fall
  below one step's consumption. Under extreme ischemia the hypoxia signal therefore plateaus rather
  than reaching `to2_min`.
- **`mob` is a rough reporter only.** The published `mob` value mixes a rate balance (mmol/s) with a
  concentration (`to2_cor`, mmol/L) and is not dimensionally meaningful; do not use it as a true
  balance.
- **Negative stroke work is not guarded.** If the filling-phase P·dV area exceeds the ejection-phase
  area (`stroke_work_total < 0`), `sw_vo2` and hence `mob_vo2` can go negative, which would *add* O₂
  to the coronary pool. This does not occur for a normally ejecting ventricle.
- **Model references are not null-guarded.** `AA`, `AA_COR`, `COR`, `Heart`, `LV`, `RV` and the
  Heart's `_lv`/`_rv`/`_la` are dereferenced directly; a configuration lacking any of them throws.

````

### FILE: explain/docs/Monitor.md

````markdown
# Monitor

The `Monitor` device model is a **read-only patient monitor**. It does not change the physiology — it
samples other models each step and publishes bedside read-outs. It is a pure observer: nothing in the
engine reads from it, and it never writes to the models it samples, so it can be added or removed
without affecting the simulation. The `DataCollector` relays its read-outs (via the normal watchlist)
to the user.

The model is deliberately minimal. It computes a handful of bedside values itself — **heart rate**,
**respiratory rate**, **end-tidal CO₂**, **temperature**, the **O₂ saturations** (pre-/post-ductal and
venous) and the **post-ductal blood pressure** — and exposes everything else through three uniform,
**JSON-configurable** read-out systems (`flow_targets`, `minmax_targets`, `signal_targets`) plus a few
derived metrics.

> The arterial blood pressure (`abp_syst`/`abp_diast`/`abp_mean`) is a built-in 2-level read-out rather
> than a `minmax_targets` entry on purpose: the bedside numerics stream on the slow channel, and a flat
> 2-part path (`Monitor.abp_syst`) reads back reliably there. (`minmax_targets` still works for any
> compartment, but its keys are 3-part paths — `Monitor.minmax.<name>_pres_max` — better suited to the
> fast/diagram side.)

## Built-in read-outs

| Output | How |
|---|---|
| `heart_rate` | rolling average of the beat-to-beat rate over the last **`hr_avg_beats`** beats (bpm) |
| `resp_rate` | rolling average of the breath-to-breath rate over the last **`rr_avg_time`** seconds (breaths/min) |
| `etco2` | end-tidal CO₂, mirrored each step from `Ventilator.etco2` (last value kept if no ventilator) |
| `temp` | blood temperature (°C), mirrored each step from `AA.temp` (last value kept if AA is absent) |
| `sao2_pre`, `sao2_post` | pre-/post-ductal arterial O₂ saturation, from `AA.so2` / `AD.so2` |
| `svo2` | venous O₂ saturation, from the right atrium / IVC (`RAIVCI.so2`) |
| `abp_syst`, `abp_diast`, `abp_mean` | post-ductal arterial blood pressure (mmHg), latched each beat from the per-beat max/min of `AD.pres` (mean ≈ `(2·diast + syst)/3`) |

**Heart rate** — on each ventricular beat (`Heart.ncc_ventricular === 1`), the beat-to-beat rate is
`60 / interval` (interval = time since the previous beat). A running window of the last `hr_avg_beats`
rates is kept (with a running sum) and averaged into `heart_rate`, so it updates every beat.

**Respiratory rate** — `calc_resp_rate()` detects a breath when an **active** breathing source reaches
the start of inspiration (`ncc_insp === 1`): the spontaneous `Breathing` model (when
`breathing_enabled`) or the `Ventilator` (when `is_enabled`). It keeps a rolling window of
breath-to-breath intervals spanning ~`rr_avg_time` seconds and reports `breaths / window-time × 60`,
updated every breath. Both references are optional (`?? null`); a missing source is simply skipped.

## Configurable read-outs

All three take a JSON array of `{ name, model }` objects, resolve them in `init_model` (dropping any
whose model does not resolve), and seed their output keys to `0` so the watch paths exist from the
start. This is the intended way to add bedside numbers without touching engine code.

### Flows (`flow_targets` → `Monitor.flows`)

`model` is a `"ModelName.prop"` dot-path (the prop defaults to `flow`):

```json
"flow_targets": [
  { "name": "kidney_flow", "model": "AD_KID_ART.flow" },
  { "name": "brain_flow",  "model": "AA_BR_ART.flow" }
]
```

Each connector's `flow · Δt` is integrated every step (`collect_flows`) and, once every
`flow_avg_beats` beats, converted to a beat-averaged value (`counter / beats_time · 60`) and published
under **`Monitor.flows.<name>`** in **L/min** — e.g. watch `Monitor.flows.kidney_flow`.

### Min/max (`minmax_targets` → `Monitor.minmax`)

`model` is a compartment name; the per-beat min/max of its `pres` and `vol` are tracked
(`collect_pressures`) and latched on each beat:

```json
"minmax_targets": [
  { "name": "left_ventricle", "model": "LV" },
  { "name": "right_atrium",   "model": "RAIVCI" }
]
```

Published as **flat** keys under `Monitor.minmax`, reset every beat:

| Key | Unit | Source |
|---|---|---|
| `<name>_pres_min`, `<name>_pres_max` | mmHg | compartment `pres` (total pressure) |
| `<name>_pres_mean` | mmHg | `(2·pres_min + pres_max) / 3` |
| `<name>_vol_min`, `<name>_vol_max` | mL | compartment `vol` (× 1000) |

Watch e.g. `Monitor.minmax.left_ventricle_pres_max`. The keys are **flat** (not a nested object)
because the `DataCollector` watcher resolves at most two property levels (`model.prop1.prop2`) — i.e.
a watch path of at most three dotted parts; `Monitor.minmax.left_ventricle.pres_max` (four parts)
would not resolve. Targets without a numeric `pres`/`vol` (e.g. a resistor) are not tracked.

### Raw signals (`signal_targets` → `Monitor.signals`)

For waveforms / raw values (no averaging), `model` is a `"ModelName.prop"` dot-path:

```json
"signal_targets": [
  { "name": "ecg",     "model": "Heart.ecg_signal" },
  { "name": "lv_pres", "model": "LV.pres" }
]
```

Each is read **unprocessed every step** (`collect_signals`) and published under
**`Monitor.signals.<name>`** — e.g. watch `Monitor.signals.ecg`. A `prop` is required (entries without
a `"."` are dropped).

## Derived metrics

Computed once every `flow_avg_beats` beats from the `flows` dict, so the scenario must define the
matching `flow_targets`:

| Output | Formula | Requires `flow_targets` |
|---|---|---|
| `fo_flow` | `flows.fo_ivci_flow + flows.fo_svc_flow` | `fo_ivci_flow`, `fo_svc_flow` |
| `do2_br` | `flows.brain_flow · AA.to2 · 22.4` | `brain_flow` |
| `do2_lb` | `flows.kid_flow · 4 · AD.to2 · 22.4` | `kid_flow` |

## Configuration

`hr_avg_beats` (12), `flow_avg_beats` (1), `rr_avg_time` (20 s), `sat_avg_time` (5 s), plus the three
`*_targets` arrays. Model references are resolved by name: `Heart` (beats), `Breathing` + `Ventilator`
(breaths). The `flow_targets`/`minmax_targets`/`signal_targets` entries name their own models.

## Notes & caveats

- **Pure observer.** The Monitor never writes to the models it samples; no model depends on it. The
  `DataCollector` reads its outputs through the watchlist like any other model.
- **Breath sourcing.** `resp_rate` counts breaths from the spontaneous `Breathing` source *and* the
  `Ventilator` (each gated by its enable flag). In assisted ventilation, where both are active, both
  breath types are counted, which can overcount the rate; in purely spontaneous or purely ventilated
  states it is correct.
- **Start-up transient.** The first heart-rate and respiratory-rate windows include the time before
  the first beat/breath, so the very first read-out is slightly off; it settles after one window.
- **`do2_br` / `do2_lb` need `AA` / `AD`.** The oxygen-delivery metrics read the aortic O₂ content
  (`AA.to2` / `AD.to2`); both references are resolved with a `?? null` fallback, so they hold their
  last value if those compartments are absent.

````

### FILE: explain/docs/Pda-velocity.md

````markdown
# Pda — Velocity Outputs

The `Pda` model exposes several velocity properties at the pulmonary end of the duct. Two of them are computed by fundamentally different physics and behave in complementary ways: a modified-Bernoulli formulation, and a continuity (flow ÷ area) formulation. This document explains *why* each method behaves the way it does, when each one is right, and where they disagree.

## The properties

`Pda.calc_model` (in `src/explain/component_models/Pda.js`, lines 329–332) sets four velocity outputs:

- **`velocity_doppler`** — the raw modified-Bernoulli jet velocity at the pulmonary end: `v_jet_pa = sign(ΔP) · √(|ΔP|/4)`.
- **`velocity_pa`** — that same jet velocity, scaled by continuity from the vena-contracta cross-section to the PA-end area: `v_jet_pa · (A_min / A_pa)`.
- **`velocity_ao`** — the analogous quantity at the aortic end of the duct.
- **`velocity_pa_area`** — the bulk mean velocity from the resistive flow: `Q_DA→PA / A_pa`.

In what follows, "the Bernoulli path" means `velocity_pa` / `velocity_doppler`, and "the continuity path" means `velocity_pa_area`.

## Observed trade-off

| | Bernoulli path | Continuity path |
|---|---|---|
| Peak velocity rises as the duct constricts | ✓ matches clinical Doppler | ✗ peak *falls* — unphysiological |
| Waveform shape resembles a real Doppler envelope | ✗ jagged / noisy | ✓ smooth |
| Open-duct peak velocity is clinically realistic | ✗ tends to overshoot | ✓ ~1 m/s as expected |

The rest of the doc explains each row.

## The two formulas

### Modified Bernoulli — `v = √(ΔP / 4)` (m/s, ΔP in mmHg)

This is the standard simplification of `½ρv² = ΔP` for blood (ρ ≈ 1060 kg/m³). Converting ΔP from mmHg to Pa and solving for v in m/s gives `v ≈ 0.5015·√(ΔP_mmHg)`, which is conventionally reported as `v² = ΔP/4`.

The formula assumes:
- The fluid is inviscid (no viscous dissipation between the upstream and downstream pressure-measurement sites).
- The proximal velocity is small enough to ignore.
- All of the trans-ductal pressure energy is converted to kinetic energy at the vena contracta.

In a *restrictive* lesion these assumptions are approximately true and the equation correctly reports the **jet peak velocity** at the vena contracta. In a *non-restrictive* segment the inviscid assumption fails (viscous drag is significant) and the equation over-estimates v.

### Continuity — `v = Q / A`

The bulk mean velocity at the chosen cross-section. In `Pda.js` it is evaluated at `A_pa`, the anatomic area at the PA end of the duct. `Q` is the resistive flow returned by the `DA_PA` `Resistor` instance (`src/explain/base_models/Resistor.js`, lines 204–254). The Resistor solves `Q = (p1 − p2) / R` each step — pure resistive, no inertance term.

This gives the average velocity over the anatomic lumen. When the flow profile is smooth and fills the lumen (low Reynolds number, no jet), the bulk mean is close to the Doppler peak. When a jet forms inside a much-narrower vena contracta, the bulk mean across the anatomic lumen dramatically underestimates the jet peak.

## Why the Bernoulli peak RISES as the duct constricts

`Pda.calc_conical_resistance` (lines 364–394) is a Hagen–Poiseuille integration over a linearly tapered cone:

```
R = (8 · μ · L / 3π) · (r1² + r1·r2 + r2²) / (r1³ · r2³)
```

So `R ∝ 1/r⁴` (to leading order). As the duct constricts, R rises rapidly and the duct becomes the dominant resistance between the aorta and the pulmonary artery. Increasingly, the *systemic-pulmonary pressure difference itself* (roughly 30–60 mmHg after transition) is dropped across the duct, so ΔP across the duct approaches that systemic-pulmonary difference.

`v = √(ΔP / 4)` with ΔP = 60 mmHg gives ~3.9 m/s — the textbook value for a restrictive PDA jet. As ΔP grows from a few mmHg (open) to tens of mmHg (constricted), v grows monotonically, matching clinical Doppler observations.

## Why the continuity peak FALLS as the duct constricts

Combine the network behavior:

- `Q ∝ ΔP / R`, and `R ∝ 1/d⁴`, so `Q ∝ ΔP · d⁴`.
- `A ∝ d²`.

Therefore `v = Q / A ∝ (ΔP · d⁴) / d² = ΔP · d²`. The `d²` factor dominates the (bounded) rise in ΔP, so `v → 0` as `d → 0`.

This is *not a bug*. The continuity formula reports the bulk mean velocity across the **anatomic** lumen. Real flow through a stenotic orifice does *not* fill the anatomic lumen smoothly — it forms a high-speed core jet through a vena contracta narrower than the anatomic opening, surrounded by separation/recirculation. The Doppler probe measures the **jet peak**, not the anatomic mean, so continuity-at-anatomic-area systematically underestimates the clinical Doppler value as the duct constricts.

## Why the continuity waveform looks like a clean Doppler envelope

`Q` comes from a Resistor whose only input each step is the instantaneous pressure difference between its two endpoints. Those endpoints are aortic-arch and pulmonary-artery node pressures filtered through the entire systemic and pulmonary circulation ODE — large reservoirs, slow compliances, smooth cardiac forcing. The resulting `Q` waveform inherits that smoothness: a clean systolic acceleration, a diastolic phase, no high-frequency content.

`velocity_pa_area = Q · 0.001 / A_pa` is just `Q` rescaled by a constant, so it inherits the smooth shape directly. That is why this output looks like a real Doppler envelope.

## Why the Bernoulli waveform looks noisier

The code at lines 319–322 uses **local** gradients across each half of the duct:

```js
const dp_ao = p_aa - p_da;
const dp_pa = p_da - p_pa;
v_jet_ao = Math.sign(dp_ao) * Math.sqrt(Math.abs(dp_ao) / 4.0);
v_jet_pa = Math.sign(dp_pa) * Math.sqrt(Math.abs(dp_pa) / 4.0);
```

`p_da` is the pressure at the DA capacitance node (`src/explain/base_models/Capacitance.js`, lines 168–180: pressure is the instantaneous elastic recoil on `vol − u_vol`). The DA node holds a small volume of blood and its pressure swings transiently within each cardiac cycle around the mean of `p_aa` and `p_pa`. Those swings inject into `dp_ao` and `dp_pa` with opposite signs and produce cycle-by-cycle artifacts in `v_jet_*`.

**Discrepancy worth flagging**: the comment block at lines 306–311 *claims* a single trans-ductal gradient `p_aa − p_pa` is used "to keep the sign of all three outputs consistent during flow reversal (PHT / bidirectional shunting); using the local p_da would let the DA capacitance's transient pressure swings flip the sign of one half independently of the other." That comment describes the *intent*, but the code uses local gradients. Either the code or the comment is stale — this is the most likely source of the "noisy Bernoulli" observation, and resolving it would meaningfully clean up the Bernoulli waveform.

## Why Bernoulli OVER-estimates at baseline

`v = √(ΔP/4)` assumes *all* of ΔP converts to kinetic energy at the orifice. In an open duct with low Reynolds number, a meaningful fraction of ΔP is instead dissipated viscously along the length of the duct — that fraction does not accelerate fluid. The Bernoulli formula over-states v by exactly that fraction. The equation only becomes accurate once viscous loss is small relative to jet kinetic energy, i.e., once the orifice is restrictive enough that flow detaches and forms a jet.

## Why continuity is realistic at baseline

Open PDA carries roughly 0.5–1.5 L/min through a 2–4 mm lumen, putting Reynolds number well below the turbulent threshold (~2300). Flow is laminar/transitional, the profile fills the lumen, and the bulk mean velocity is a good approximation of the Doppler envelope peak (≈ 0.5–1.5 m/s). This matches what clinicians see on echo for non-restrictive PDA.

## Doppler reality check

Echo Doppler reports the highest velocity in the sample volume — physically that is the vena contracta jet peak.

- **Non-restrictive PDA**: jet peak ≈ bulk mean. Continuity is right; Bernoulli over-shoots.
- **Restrictive PDA**: jet peak ≫ bulk mean. Bernoulli is right; continuity from anatomic area is wrong.

Neither single formula is correct across the whole closure trajectory.

## Summary

| Regime              | v = Q/A (continuity)         | v = √(ΔP/4) (Bernoulli)        |
|---------------------|------------------------------|--------------------------------|
| Open duct (low R)   | ✓ realistic peak & shape     | ✗ overestimates (viscous loss) |
| Restrictive duct    | ✗ underestimates (no jet)    | ✓ peak rises correctly         |
| Waveform shape      | ✓ smooth (network-filtered)  | ✗ noisy (p_da transients)      |

The user's empirical observations match the physics exactly: each formula is right in one regime and wrong in the other.

## Path forward (not implemented)

Two follow-up steps would resolve the trade-off without removing either existing output:

1. **Hybrid output `velocity_pa_combined`**. Blend Bernoulli and continuity via a sigmoid weight in `R_total / R_open_total` (the same driver already used for the elastance coupling at `Pda.js` lines 294–301, which mirrors the `BloodVessel` α-pattern at `src/explain/component_models/BloodVessel.js` lines 4–17 and 353–366). Below a ratio of ~5 the weight favors continuity (open-duct regime, smooth and realistic); above ~20 it favors Bernoulli (restrictive regime, jet peak rises); the transition is smooth between. Keeping the existing outputs preserves backward compatibility with old preset charts.

2. **Single trans-ductal gradient for Bernoulli**. Align the code at lines 319–322 with the comment block at lines 306–311 — drive both `v_jet_ao` and `v_jet_pa` from `p_aa − p_pa` rather than from the local gradients. This removes the spurious `p_da` transient artifacts and is independently worth doing even without (1).

## Cross-references

- Resistor flow equation: `src/explain/base_models/Resistor.js`, lines 204–254.
- Capacitance pressure equation: `src/explain/base_models/Capacitance.js`, lines 168–180.
- BloodVessel α-coupling (header + code): `src/explain/component_models/BloodVessel.js`, lines 4–17 and 353–366.
- Prior art (Shunts uses continuity only): `src/explain/component_models/Shunts.js`, lines 240–245.

````

### FILE: explain/docs/Pda.md

````markdown
# Pda

A `Pda` (Patent Ductus Arteriosus) is a composite component model representing the ductus arteriosus — the fetal shunt between the aortic arch and the pulmonary artery. Unlike a typical `BloodVessel`, the `Pda` is a thin coordinator: it owns three sub-models (two `Resistor`s and one `BloodCapacitance`) and drives their properties from a single set of geometric inputs (diameter, length, viscosity).

See also: [Pda-velocity.md](./Pda-velocity.md) for the rationale behind the multiple velocity outputs.

## Inheritance

```
BaseModelClass
  └── Pda    (coordinates AAR_DA, DA, DA_PA)
```

The `Pda` does not extend `Capacitance` or `BloodVessel` itself. It steps once per cycle and writes derived values onto its sub-models.

## What it models

The ductus arteriosus is a short conical vessel (~2–3 cm) connecting the pulmonary trunk to the descending aorta. In utero it is held open by PGE₂; after birth, rising PO₂ and falling PGE₂ trigger smooth-muscle constriction that closes it functionally within 12–24 hours, followed by fibrotic remodeling over 2–3 weeks.

The model represents the duct as a **linearly tapered cone**, wider at the aortic end and narrower at the pulmonary end. Closure scales both diameters together via `diameter_relative` from `1.0` (fully open) to `0.0` (closed). The cone is split at its midpoint and the two halves are modeled as separate Hagen-Poiseuille resistances feeding a small central capacitance.

```
AA ──[AAR_DA: Resistor]── DA ──[DA_PA: Resistor]── PA
        r_for/r_back        (BloodCapacitance)    r_for/r_back
        = res_ao            holds vol, el_base    = res_pa
                            = this.el
```

## Calculation cycle (`calc_model`)

**Closed-duct fast path.** When `diameter_relative === 0` (the postnatal steady state) the cone math,
the Bernoulli √, and the continuity divisions all degenerate, so `calc_model` short-circuits: it
forces `no_flow = true` and `r_for/r_back = 1e8` on both resistors, zeroes the velocities, sets the
DA elastance to `el_base × CLOSED_EL_SCALE` (a deterministic `5000×` sentinel — see the coupling
section), and returns early. The full path below runs only while the duct is patent
(`diameter_relative > 0`).

Each open-duct step executes in this order:

1. **Diameters** — `diameter_ao` and `diameter_pa` from `diameter_relative` × their respective maxima.
2. **Pull state from sub-models** — `flow_ao`, `flow_pa`, `viscosity`, `vol`.
3. **Flow gating** — set `no_flow` on each resistor when its end is fully constricted.
4. **Resistances** — compute the AO-half and PA-half resistances over the linear cone, push them to `AAR_DA.r_for/r_back` and `DA_PA.r_for/r_back`.
5. **Resistance-elastance coupling** — compute `r_factor = res_total / res_open_total` and set the DA capacitance's `el_base` to `el_base * r_factor^alpha`.
6. **Velocities** — three flavors: modified Bernoulli (`velocity_doppler`), continuity bulk mean (`velocity_ao`, `velocity_pa`), and the jet-corrected hybrid (`velocity_ao_jet`, `velocity_pa_jet`).

## Properties

### Geometry (independent)

| Property | Unit | Description |
|---|---|---|
| `diameter_ao_max` | mm | Maximum diameter at the aortic end (open duct) |
| `diameter_pa_max` | mm | Maximum diameter at the pulmonary end (open duct) |
| `diameter_relative` | 0..1 | Linear scale on both end diameters. 1 = fully open, 0 = closed |
| `length` | mm | Total length of the cone |

### Physics inputs (independent)

| Property | Unit | Description |
|---|---|---|
| `el_base` | mmHg/L | Baseline (open-duct) elastance written to `DA.el_base` and scaled up by `(R/R_open)^alpha` as the duct constricts |
| `alpha` | 0..1.5 | Resistance-elastance coupling exponent (BloodVessel α-pattern). Default `0.55` — between large-artery (0.5) and arteriole (0.63) with a bump for the PDA's smooth-muscle content |
| `jet_exponent` | 0..3 | Exponent `n` on `(R_total / R_open_total)^(n/4)` used to amplify the continuity velocity into a jet-corrected end velocity. `n = 1` is a linear diameter correction. Default `0.6` |

### Dependent (recomputed each step)

| Property | Unit | Description |
|---|---|---|
| `diameter_ao` | mm | Current diameter at aortic end (= `diameter_relative · diameter_ao_max`) |
| `diameter_pa` | mm | Current diameter at pulmonary end (= `diameter_relative · diameter_pa_max`) |
| `viscosity` | cP | Blood viscosity pulled from `DA.viscosity` |
| `vol` | L | Current duct volume from `DA.vol` |
| `flow_ao` | L/s | Flow through `AAR_DA` (AA → DA) |
| `flow_pa` | L/s | Flow through `DA_PA` (DA → PA) |
| `res_ao` | mmHg·s/L | Resistance of the aortic half-cone (pushed to `AAR_DA.r_for/r_back`) |
| `res_pa` | mmHg·s/L | Resistance of the pulmonary half-cone (pushed to `DA_PA.r_for/r_back`) |
| `el` | mmHg/L | Coupled elastance, `el_base · (R/R_open)^alpha`, pushed to `DA.el_base` |

### Velocity outputs (dependent)

| Property | Unit | Description |
|---|---|---|
| `velocity_doppler` | m/s | Peak velocity from modified Bernoulli on the trans-ductal gradient: `sign(ΔP)·√(|ΔP|/4)` |
| `velocity_ao` | m/s | Bulk mean velocity at the aortic end (continuity, `Q/A`) |
| `velocity_pa` | m/s | Bulk mean velocity at the pulmonary end (continuity, `Q/A`) |
| `velocity_ao_jet` | m/s | `velocity_ao` amplified by stenosis: `velocity_ao · (R/R_open)^(jet_exponent/4)` |
| `velocity_pa_jet` | m/s | `velocity_pa` amplified by stenosis: `velocity_pa · (R/R_open)^(jet_exponent/4)` |

Each velocity is right in a different regime. See [Pda-velocity.md](./Pda-velocity.md) for the regime analysis.

## Resistance-elastance coupling

This mirrors the BloodVessel α-pattern. As the duct narrows:

- Resistance rises as ~`1/d⁴` (Hagen-Poiseuille over a cone).
- The wall stiffness rises with resistance via `el = el_base · (R/R_open)^alpha`.

`R_open` is computed each step from `diameter_ao_max`, `diameter_pa_max`, `length`, and `viscosity` (same conical formula). As `diameter_relative → 0`, `R → ∞` and `el → ∞` — the duct effectively seals. This reproduces the literature-described order-of-magnitude jump in total elastance during functional closure.

At exactly `diameter_relative === 0` the open-path computation is not run (the geometry degenerates); the closed-duct fast path instead sets `el = el_base × CLOSED_EL_SCALE` with `CLOSED_EL_SCALE = 5000`. The exact closed elastance does not affect DA pressure once the capacitance holds its unstressed volume, so a deterministic constant is used in place of the divergent `(R/R_open)^alpha` limit.

## Resistance formulas

### Uniform cylinder — `calc_resistance(diameter, length, viscosity)`

Standard Hagen-Poiseuille:

```
R = (8 · μ · L) / (π · r⁴)        in Pa·s/m³
```

then converted to `mmHg·s/L`.

### Conical taper — `calc_conical_resistance(d1, d2, length, viscosity)`

Hagen-Poiseuille integrated over a linearly tapered cone:

```
R = (8 · μ · L) / (3 · π) · (r1² + r1·r2 + r2²) / (r1³ · r2³)    in Pa·s/m³
```

then converted to `mmHg·s/L`. Reduces to the uniform cylinder when `r1 = r2`.

Both functions return a large sentinel (`1e8`) when the geometry collapses (`d ≤ 0` or `L ≤ 0`).

## Sub-model wiring

The Pda references three sub-models by name, cached in `init_model()`:

| Reference | Looks up | Type | Role |
|---|---|---|---|
| `_aar_da` | `AAR_DA` | `Resistor` | AA → DA, gets `r_for/r_back = res_ao` and `no_flow` |
| `_da` | `DA` | `BloodCapacitance` | the duct's small central volume, gets `el_base = this.el` |
| `_da_pa` | `DA_PA` | `Resistor` | DA → PA, gets `r_for/r_back = res_pa` and `no_flow` |

These three components are declared in the Pda's `components` dictionary in the model definition JSON and instantiated by `BaseModelClass.init_model()` before `Pda.init_model()` caches the references.

## Example definition (JSON)

```json
{
  "name": "Pda",
  "description": "ductus arteriosus model",
  "is_enabled": true,
  "model_type": "Pda",
  "components": {
    "AAR_DA": {
      "name": "AAR_DA",
      "description": "ductus arteriosus aorta connection",
      "is_enabled": true,
      "model_type": "Resistor",
      "r_for": 100000000,
      "r_back": 100000000,
      "r_k": 0,
      "comp_from": "AAR",
      "comp_to": "DA",
      "no_flow": true,
      "no_back_flow": false
    },
    "DA": {
      "name": "DA",
      "description": "blood capacitance model of the ductus arteriosus",
      "is_enabled": true,
      "model_type": "BloodCapacitance",
      "vol": 0.00015,
      "u_vol": 0.00015,
      "el_base": 30000,
      "el_k": 0,
      "pres_ext": 0,
      "fixed_composition": false
    },
    "DA_PA": {
      "name": "DA_PA",
      "description": "ductus arteriosus pulmonary connection",
      "is_enabled": true,
      "model_type": "Resistor",
      "r_for": 100000000,
      "r_back": 100000000,
      "r_k": 0,
      "comp_from": "DA",
      "comp_to": "PA",
      "no_flow": true,
      "no_back_flow": false
    }
  },
  "diameter_ao_max": 3.0,
  "diameter_pa_max": 2.0,
  "diameter_relative": 0,
  "length": 20,
  "el_base": 30000,
  "alpha": 0.55,
  "jet_exponent": 0.6
}
```

## Usage notes

- **Closure is symmetric in this model.** Real PDA closure proceeds from the pulmonary end first, but the current implementation scales both `diameter_ao` and `diameter_pa` by the same `diameter_relative`. Asymmetric closure would require independent scaling factors.
- **`velocity_pa` is the value most UIs monitor** (see model definitions, where `Pda.velocity_pa` is the default velocity channel). It is the continuity bulk mean — smooth waveform, realistic at open-duct flows, but undershoots once the duct becomes restrictive. For restrictive regimes use `velocity_doppler` or `velocity_pa_jet`.
- **Viscosity is dynamic.** `viscosity` is pulled from `DA.viscosity` each step (which itself follows hematocrit), so `res_ao`, `res_pa`, and the open-duct reference resistances all track viscosity changes automatically.

````

### FILE: explain/docs/Placenta.md

````markdown
# Placenta

The `Placenta` model is a **coordinator** for the fetal placental circulation and gas exchange. Like
`Pda` and `Shunts`, it owns no physics of its own — it drives a set of pre-built sub-models (umbilical
and fetal-placental resistors, the maternal blood pool, and a blood-blood gas diffusor) from a single
set of parameters, and switches the whole unit on or off.

## What it models

Fetal blood leaves the descending aorta, runs through the umbilical arteries to the fetal side of the
placenta, exchanges O₂/CO₂ with maternal blood across the placental membrane, and returns via the
umbilical vein to the inferior vena cava.

```
DA ──[PL_UMB_ART]──► PL_FETAL_ART ─► PL_FETAL_CAP ─► PL_FETAL_VEN ──[PL_UMB_VEN]──► IVCI
                                          │
                                    [PL_GASEX: BloodDiffusor]
                                          │
                                       PL_MAT  (maternal pool, fixed composition)
```

| Reference | Model | Role |
|---|---|---|
| `_umb_art` / `_umb_ven` | `PL_UMB_ART` / `PL_UMB_VEN` | umbilical artery / vein resistors |
| `_plf_art` / `_plf_cap` / `_plf_ven` | `PL_FETAL_ART/CAP/VEN` | fetal-placental resistors |
| `_plm` | `PL_MAT` | maternal blood pool — a `fixed_composition` reservoir held at `mat_to2`/`mat_tco2` |
| `_gas_exchanger` | `PL_GASEX` | `BloodDiffusor` exchanging O₂/CO₂ between fetal capillary and maternal pool |

## Calculation cycle (`calc_model`)

Every `_update_interval` (0.015 s):

1. **Sync enabled state** — every sub-model's `is_enabled` is set to `placenta_running`. This runs on
   every tick (not only while running) so that *stopping* the placenta actually disables flow and gas
   exchange.
2. **Only while running:**
   - **Clamp** — set `no_flow = umb_clamped` on the umbilical and fetal resistors.
   - **Resistances** — `umb_art_res · factor`, `umb_ven_res · factor`, `plf_res · factor` onto the
     respective resistors.
   - **Maternal gases** — hold `PL_MAT.to2 = mat_to2`, `PL_MAT.tco2 = mat_tco2` (the maternal pool is
     `fixed_composition`, so the diffusor draws from it without depleting it).
   - **Diffusion constants** — push `dif_o2`, `dif_co2` to the gas exchanger.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `placenta_running` | master on/off (drives `is_enabled` of all sub-models) |
| `umb_clamped` | clamp the umbilical/fetal vessels (no flow) while running |
| `umb_art_res`, `umb_ven_res`, `plf_res` (+ `*_factor`) | resistances and their multipliers (mmHg·s/L) |
| `mat_to2`, `mat_tco2` | maternal total O₂ / CO₂ content (mmol/L) held on `PL_MAT` |
| `dif_o2`, `dif_co2` | diffusion constants for the placental gas exchanger (mmol/mmHg·s) |

(The umbilical-cord dimensional references in the source header document the physiological basis for
the default volumes/resistances.)

## Notes & caveats

- **Two independent off-switches.** `placenta_running = false` disables every sub-model (flow *and*
  gas exchange stop). `umb_clamped = true` stops flow only (via `no_flow`) while the placenta keeps
  running — useful to model cord occlusion with the unit otherwise intact.
- **Maternal pool is an infinite reservoir.** `PL_MAT` is `fixed_composition`, so the diffusor
  exchanges gases with it without changing its composition; the Placenta also re-asserts
  `mat_to2`/`mat_tco2` each tick.
- **`mat_to2`/`mat_tco2` are total contents (mmol/L), not partial pressures** — the gas exchange
  itself is partial-pressure driven inside `PL_GASEX`, which derives pCO₂/pO₂ from these contents.
- **Sub-model references are required.** They are the Placenta's own `components`; `calc_model` skips
  the tick if any is missing rather than dereferencing null.

````

### FILE: explain/docs/Resistor.md

````markdown
# Resistor

A `Resistor` moves volume between two compartments driven by their pressure difference. It is the
flow element of the circuit; `HeartValve` is a thin subclass, and `BloodVessel` creates `Resistor`s
internally.

## What it models

Flow from `comp_from` to `comp_to`, with separate forward/backward resistances and an optional
non-linear (turbulent) term:

```
ΔP = (comp_from.pres + p1_ext) − (comp_to.pres + p2_ext)
forward  (ΔP ≥ 0):  flow = (ΔP − r_k_eff · prev_flow²) / r_for_eff
backward (ΔP < 0):  flow = (ΔP + r_k_eff · prev_flow²) / r_back_eff     (unless no_back_flow)
```

`r_for`, `r_back`, `r_k` all use the [factor / effective-value pattern](./Capacitance.md)
(`r_factor`/`_ps`/`_scaling_ps`, `r_k_factor`/…). The non-linear term uses the **previous** step's
flow (an explicit lagged scheme; at steady state `prev_flow == flow`).

## Calculation cycle (`calc_model`)

1. **`calc_resistance`** — compose `r_for_eff` / `r_back_eff` / `r_k_eff` from the factors; reset the
   non-persistent factors.
2. **`calc_flow`** — compute the inlet/outlet pressures (incl. the non-persistent `p1_ext`/`p2_ext`),
   pick the flow direction, and move the volume:
   - `comp_from.volume_out(flow · Δt)` returns any volume it could not supply;
   - `comp_to.volume_in(flow · Δt − un-supplied, comp_from)` adds the rest and mixes composition.

   This `volume_out` → `volume_in` handshake conserves volume — a resistor never creates volume from
   an empty compartment.

## Flags

| Flag | Effect |
|---|---|
| `no_flow` | block all flow (set `flow = 0` and return) |
| `no_back_flow` | block backward flow (valve behaviour; used by `HeartValve`) |
| `p1_ext` / `p2_ext` | external pressures added at the inlet/outlet (non-persistent) |

## Notes

- **Non-linear term.** It reads `_prev_flow`, not the just-reset `flow`; this is what makes `r_k`
  actually take effect (an earlier version used the zeroed `flow`, so `r_k` was inert). `_prev_flow`
  is cleared to 0 when no flow occurs (no-flow or blocked backflow) so the term stays consistent.
- **Resistance guard.** A non-positive effective resistance is skipped (no flow) to avoid an
  Infinity/NaN flow.
- `r_k` is 0 in the standard scenarios, so the linear Poiseuille term dominates; the non-linear term
  is available for turbulent/stenotic elements.

````

### FILE: explain/docs/Respiration.md

````markdown
# Respiration

`Respiration` is a **coordinator**, not a physical compartment (the same pattern as `Circulation`). It
groups the models of the respiratory tract by name and applies whole-system adjustments to their
elastance, resistance and gas-exchange factors. It owns no volume, pressure or flow of its own.

It is the *mechanical/structural* counterpart to `Breathing`: `Breathing` generates the breath effort,
while `Respiration` sets the lung/thorax stiffness, airway resistance and gas-exchange efficiency that
the breath acts against.

## What it groups

The model definition fills lists of model **names**:

| List | Default members | Role |
|---|---|---|
| `upper_airways` | `MOUTH_DS` | mouth → dead-space resistor |
| `lower_airways` (`_left`/`_right`) | `DS_ALL`, `DS_ALR` | dead-space → alveolar resistors |
| `dead_space` | `DS` | conducting-airway gas compartment |
| `thorax` | `THORAX` | chest-wall container |
| `lungs` (`left_lung`/`right_lung`) | `ALL`, `ALR` | alveolar gas compartments |
| `gas_echangers` (`_left`/`_right`) | `GASEX_LL`, `GASEX_RL` | blood↔gas exchangers |
| `pleural_space_*`, `intrapulmonary_shunt` | — | reserved (declared, not yet driven) |

> Note: `gas_echangers` is a (consistent) misspelling of "exchangers" — both the property and the
> definition key use it, so it is left as-is.

## Calculation cycle (`calc_model`)

One throttled loop (every 0.015 s) that applies each factor **only when it changed** (guarded by a
`_prev_*` comparison):

| Input | Method | Drives |
|---|---|---|
| `el_lungs_factor` | `set_el_lung_factor` | `el_base_factor_ps` on the lungs |
| `el_thorax_factor` | `set_el_thorax_factor` | `el_base_factor_ps` on the thorax |
| `res_upper_airways_factor` | `set_upper_airway_resistance` | `r_factor_ps` on the upper airways |
| `res_lower_airways_factor` | `set_lower_airway_resistance` | `r_factor_ps` on the lower airways |
| `gex_factor` | `set_gasexchange` | `dif_o2_factor_ps` and `dif_co2_factor_ps` on the gas exchangers |

## The `set_*` methods — delta application

Every target is a **persistent** factor (`*_factor_ps`) that accumulates contributions from several
models, so `Respiration` applies the **delta** since its last call, not the absolute value:

```
delta = new_factor − prev_factor
for each model in the group:  factor_ps += delta   (clamped at 0)
prev_factor := new_factor          (stored by calc_model after the call)
```

The delta is computed **once** so every model in the group gets the same change, and each factor is
clamped at 0 (negative elastance/resistance/diffusion factors are non-physical). `set_gasexchange`
applies the delta to both the O₂ and CO₂ diffusion factors, clamping each independently.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| group lists (`upper_airways`, `lungs`, `thorax`, …) | model names by anatomical role |
| `el_lungs_factor`, `el_thorax_factor` | lung / chest-wall stiffness multipliers |
| `res_upper_airways_factor`, `res_lower_airways_factor` | airway resistance multipliers |
| `gex_factor` | gas-exchange (O₂ + CO₂ diffusion) efficiency multiplier |

All default to 1.0 (no effect). Disease scenarios raise lung/airway factors (e.g. RDS → stiff lungs,
bronchospasm → high lower-airway resistance) or lower `gex_factor` (impaired diffusion).

## Notes & caveats

- **Factors are cumulative and shared.** `*_factor_ps` is written by several models; `Respiration`
  only adds its delta. A factor driven to the 0 clamp stops tracking further decreases until the
  target rises again — inherent to the per-model persistent-factor scheme.
- **Side- and space-specific lists are reserved.** `pleural_space_left/right`,
  `intrapulmonary_shunt`, and the `_left`/`_right` airway/lung/exchanger lists are declared but not
  yet used by any method — hooks for future per-side control.
- **Group membership is name-based** — a model is only affected if its name is in the relevant list.

````

### FILE: explain/docs/Resuscitation.md

```markdown
# Resuscitation

The `Resuscitation` device model drives a **CPR** scenario: rhythmic chest compressions plus
ventilations, in the standard compression/ventilation cycles. It is a coordinator — it generates the
compression-pressure waveform and applies it to the circulation, and it commands the `Ventilator` and
`Breathing` models to deliver (or suppress) breaths.

## What it models

- **Chest compressions** — a sinusoidal external pressure applied to a set of weighted target
  compartments (heart chambers, great vessels, lungs, coronaries).
- **Ventilations** — delivered through the mechanical `Ventilator` (spontaneous `Breathing` is
  switched off while CPR runs).
- **Compression/ventilation ratio** — e.g. 15 compressions : 2 breaths, or continuous compressions
  with asynchronous ventilation.

## Enabling CPR — `switch_cpr(state)`

When turned on it: starts the ventilator (`switch_ventilator(true)`), sets pressure-control settings
from `vent_pres_pip` / `vent_pres_peep` / `vent_insp_time`, switches off spontaneous `Breathing`, and
sets `cpr_enabled`. Turning it off just clears `cpr_enabled` (the ventilator/breathing states are left
as they are).

## Calculation cycle (`calc_model`)

Runs every step while `cpr_enabled`:

1. **Compression/ventilation timing** — the compression pause equals the time for `vent_no` breaths;
   ventilations are triggered on the `Ventilator` during the pause.
2. **Compression force** — a sine wave `chest_comp_pres = A·sin(2πf·t − π/2) + A` with
   `A = chest_comp_max_pres / 2` and `f = chest_comp_freq / 60`, so pressure ramps 0 → max → 0 each
   compression.
3. **Cycle control** — after `chest_comp_no` compressions (non-continuous mode) it enters a pause and
   triggers a breath; the pause lasts long enough for the configured ventilations.
4. **Apply force** — for each `{ compartment: weight }` in `chest_comp_targets`,
   `compartment.pres_ext += chest_comp_pres · weight`.

## Compression coupling (important)

The compression is delivered as **external pressure** (`pres_ext`), the channel that *every*
compartment type reads (blood vessels, heart chambers, the thorax container, gas compartments). It is
added (`+=`) so it composes with other external pressures and is consumed + reset by each
compartment's `calc_pressure` every step.

> Previously the force was written to `pres_cc`, which only `GasCapacitance` and `BloodPump` read — so
> the compressions reached the lungs but **not** the heart chambers or vessels, and generated no
> circulation. Writing `pres_ext` makes compressions actually drive forward flow. Because `pres_ext`
> is order-sensitive (reset each step), a compression can lag by at most one step depending on model
> step order.

Typical `chest_comp_targets` weights (scenario): ventricles `LV`/`RV` and coronaries `COR` at 1.0,
atria 0.5–0.8, great vessels 0.5–0.7, lungs `ALL`/`ALR` at 0.2.

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `cpr_enabled` | master on/off (normally toggled via `switch_cpr`) |
| `chest_comp_freq` | compressions per minute |
| `chest_comp_max_pres` | peak compression pressure (mmHg) |
| `chest_comp_targets` | `{ compartment: relative weight }` to compress |
| `chest_comp_no`, `chest_comp_cont` | compressions per cycle / continuous mode |
| `vent_freq`, `vent_no` | ventilation rate / breaths per cycle |
| `vent_pres_pip`, `vent_pres_peep`, `vent_insp_time` | ventilator pressure-control settings |
| `vent_fio2` | inspired O₂ fraction (pushed to the ventilator) |

## Notes & caveats

- **Requires `Ventilator` and `Breathing`.** Both are resolved at init; all calls to them are now
  null-guarded, so a missing ventilator no longer crashes at build (`set_fio2` in `init_model`) or
  during CPR — compressions still run, but no mechanical breaths are delivered.
- **Compression is order-sensitive.** Applied via `pres_ext +=`; if `Resuscitation` steps after a
  target compartment, that compartment sees the compression one step later. Stable at the default
  step size.
- **Frequencies must be > 0** — `chest_comp_freq` and `vent_freq` appear in denominators; zero would
  yield a degenerate (infinite-period) cycle.

```

### FILE: explain/docs/Shunts.md

````markdown
# Shunts

The `Shunts` model is a thin coordinator (like `Pda`) that drives the resistances of the **non-ductal
shunts** from a small set of geometric inputs. It does not hold volume or pressure itself — it owns no
sub-models but writes each step onto five pre-existing `Resistor`s.

It covers three shunt families:

| Shunt | Resistors driven | Path |
|---|---|---|
| **Foramen ovale (FO)** | `LA_RAIVCI`, `LA_RASVC` | LA ↔ the two right-atrial streams (RAIVCI, RASVC) |
| **Ventricular septal defect (VSD)** | `VSD` | LV ↔ RV |
| **Intrapulmonary shunts (IPS)** | `IPSL`, `IPSR` | arterial → venous within each lung (LL_ART→LL_VEN, RL_ART→RL_VEN) |

(The ductus arteriosus is handled separately by the `Pda` model.)

## What it models

The FO and VSD are openings whose resistance follows the **Hagen-Poiseuille** law from their diameter,
the septal thickness (length), and blood viscosity. `diameter_relative`-style closure is expressed
directly via `diameter_fo` / `diameter_vsd` (0 mm = closed → `no_flow`). The intrapulmonary shunts are
a small *fixed* resistance representing anatomic right-to-left lung shunting; they are **not**
diameter-driven.

## Calculation cycle (`calc_model`)

1. **Resolve references once.** `_resolve_refs()` caches `LA_RAIVCI`, `LA_RASVC`, `VSD`, `IPSL`,
   `IPSR`. If any is missing it logs a single warning and `calc_model` returns early every step (so a
   partial wiring degrades gracefully instead of throwing).
2. **Clamp diameters** to their `*_max`.
3. **Flow gating** — set `no_flow = (diameter === 0)` on the FO and VSD resistors.
4. **Resistances** — `res_fo`, `res_vsd` from `calc_resistance(diameter, septal_width, viscosity)`.
5. **Push resistances** to the resistors (see asymmetry below); IPS resistors get the constant
   `ips_res`.
6. **Read back flows** and compute orifice velocities (`Q/A`).

## Foramen ovale: flap-valve asymmetry and the split path

The FO is driven through **two** resistors (`LA_RAIVCI`, `LA_RASVC`) because the model splits the
right atrium into an IVC-stream and an SVC-stream. Each resistor receives:

```
r_for  = res_fo · fo_lr_factor      (LA → RA, restricted)
r_back = res_fo                     (RA → LA, easy)
```

`fo_lr_factor` (default 10, often higher in scenarios — e.g. 25) makes left-to-right flow much harder
than right-to-left, reproducing the **flap-valve** behaviour: in fetal/transitional physiology the FO
shunts right-to-left, and reverses only under raised left-atrial pressure.

> **Modelling note.** Because the FO is represented as two *parallel* resistors that each carry the
> full `res_fo`, the orifice's effective resistance is `res_fo / 2`. `velocity_fo` is therefore
> computed from the **combined** flow (`LA_RAIVCI.flow + LA_RASVC.flow`) over the single-orifice area
> from `diameter_fo`.

## Velocity outputs

```
area   = π · (diameter_mm · 1e-3 / 2)²          [m²]
velocity = (flow_L/s · 1e-3) / area             [m/s]   (0 when area = 0)
```

`velocity_fo` uses the summed FO flow; `velocity_vsd` uses the VSD flow.

## Resistance formula — `calc_resistance(diameter, length, viscosity)`

Standard Hagen-Poiseuille for a uniform cylinder:

```
R = (8 · μ · L) / (π · r⁴)        in Pa·s/m³   →  × 0.00000750062  →  mmHg·s/L
```

with diameter/length in mm and viscosity in cP. Returns the sentinel `1e8` (no flow) when
`diameter ≤ 0` or `length ≤ 0`. (This is a private copy of the same formula `Pda` uses.)

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `diameter_fo`, `diameter_fo_max` | foramen ovale diameter and ceiling (mm) |
| `diameter_vsd`, `diameter_vsd_max` | ventricular septal defect diameter and ceiling (mm) |
| `atrial_septal_width` | FO channel length (mm) |
| `ventricular_septal_width` | VSD channel length (mm) |
| `fo_lr_factor` | left-to-right resistance multiplier on the FO (flap valve) |
| `ips_res` | fixed intrapulmonary shunt resistance (mmHg·s/L) |
| `viscosity` | blood viscosity (cP) used in the resistance formula |

A healthy term neonate runs with `diameter_fo = 0` and `diameter_vsd = 0` (closed); congenital
scenarios open them.

## Notes & caveats

- **References resolve only once.** After the five resistors are cached, they are never re-resolved;
  a model added/removed at runtime would not be picked up. Missing wiring at first call is reported
  with a single console warning.
- **`viscosity` is a static input here** — unlike `Pda` (which pulls it from its capacitance each
  step), `Shunts.viscosity` is whatever the definition sets and does not track hematocrit.
- **IPS resistance is fixed.** `IPSL`/`IPSR` always receive `ips_res`; there is no diameter or
  flow-gating on them.

````

### FILE: explain/docs/TimeVaryingElastance.md

````markdown
# TimeVaryingElastance

A `TimeVaryingElastance` is a volume compartment whose stiffness **varies over the cardiac cycle** —
the base for contractile chambers (`HeartChamber`, `BloodTimeVaryingElastance`). It interpolates each
step between a relaxed (diastolic) and a contracted (systolic) pressure–volume relation, driven by an
activation factor.

## Inheritance

```
BaseModelClass
  └── TimeVaryingElastance        (el_min/el_max, act_factor)
        ├── HeartChamber               (+ blood composition, ANS/MOB contractility)
        └── BloodTimeVaryingElastance  (+ blood composition)
```

## Two elastances

- `el_min` — **end-diastolic** elastance (relaxed wall; the non-linear EDPVR).
- `el_max` — **end-systolic** elastance (contracted wall; the linear ESPVR).

Both use the [factor / effective-value pattern](./Capacitance.md) (`el_min_factor`/`_ps`/
`_scaling_ps`, likewise `el_max`, `el_k`, `u_vol`). `calc_elastances` also clamps `el_max_eff` to be
≥ `el_min_eff`.

## Pressure (`calc_pressure`)

```
p_ms = (vol − u_vol_eff) · el_max_eff                                  (end-systolic, linear)
p_ed = el_k_eff · (vol − u_vol_eff)² + el_min_eff · (vol − u_vol_eff)  (end-diastolic, non-linear)
pres_in = (p_ms − p_ed) · act_factor + p_ed
pres    = pres_in + pres_ext
```

`act_factor` runs 0 → 1 over a contraction: at 0 the chamber sits on its diastolic curve (`p_ed`), at
1 on its systolic curve (`p_ms`), interpolating in between. The non-linear `el_k` term lives only in
the diastolic relation (the EDPVR stiffens at high filling), which is the physiologically expected
shape.

`act_factor` is supplied by the `Heart` model (the atrial/ventricular activation functions `aaf`/
`vaf`); see [HeartChamber.md](./HeartChamber.md) for the ANS/MOB contractility coupling layered on
top of `el_max`.

## Volume flow

`volume_in`/`volume_out` behave as in [Capacitance](./Capacitance.md): `volume_out` clamps at 0 and
returns the un-removed volume; subclasses extend `volume_in` to mix the incoming blood composition
(guarded against an empty compartment and `fixed_composition`).

## Notes

- The `volume_out` negative-volume guard (`vol < 0 && vol < u_vol`) is functionally equivalent to
  `vol < 0` for any non-negative `u_vol`.
- Heart chambers can fall below their unstressed volume during ejection (ventricular suction), which
  the formula handles naturally.

````

### FILE: explain/docs/Ventilator.md

````markdown
# Ventilator

The `Ventilator` device model simulates a **mechanical ventilator** driving the lungs through an
endotracheal (ET) tube. It owns its own gas circuit (gas source, circuit, expiratory reservoir, and
the inspiratory/expiratory valves + ET-tube resistors) and modulates those parts each step to deliver
the configured ventilation mode.

## Gas circuit (owned sub-models)

```
VENT_GASIN ──[VENT_INSP_VALVE]──► VENT_GASCIRCUIT ──[VENT_ETTUBE]──► (airway/DS) ──[VENT_EXP_VALVE]──► VENT_GASOUT
   fresh gas        inspiratory          patient circuit        ET tube                  expiratory
   (fio2)             valve                                                                 valve → PEEP reservoir
```

While the ventilator is enabled, the spontaneous mouth path (`MOUTH_DS`) is blocked, so the patient
is ventilated through the tube rather than breathing around it.

## Ventilation modes (`vent_mode`)

| Mode | Cycling | Pressure |
|---|---|---|
| `PC` | time-cycled (`time_cycling`) | pressure-controlled to `pip` / `peep` |
| `PRVC` | time-cycled | pressure-controlled, with PIP auto-adjusted to hit `tidal_volume` |
| `PS` | flow-cycled (`flow_cycling`) | pressure-support, ends when flow drops below 30 % of peak |

If `synchronized`, `triggering()` watches the `Breathing` model and starts a ventilator breath when
the patient's inspiratory effort has moved the trigger volume.

## Calculation cycle (`calc_model`)

1. Convert `pip` / `pip_max` / `peep` from cmH₂O to mmHg.
2. If synchronized, run patient-trigger detection.
3. Run the mode's cycling (`time_cycling` or `flow_cycling`) and `pressure_control`.
4. Publish read-outs: airway `pres`, `flow`, integrated `vol`, end-tidal `co2`, `minute_volume`,
   and refresh the ET-tube resistance.

### Pressure control (`pressure_control`)

- **Inspiration** — close the expiratory valve, open the inspiratory valve with
  `r_for = (gasin.pres + pip − atm − peep) / (insp_flow/60)`; cut off when circuit pressure exceeds
  PIP; integrate inspiratory tidal volume.
- **Expiration** — close the inspiratory valve, open the expiratory valve, and set the expiratory
  reservoir volume so it holds PEEP; integrate expiratory tidal volume.

### PRVC auto-PIP (`pressure_regulated_volume_control`)

At each expiration, nudge `pip_cmh2o` ±1 cmH₂O to drive the achieved tidal volume toward
`tidal_volume`, clamped between `peep + 2` and `pip_cmh2o_max`.

## ET-tube resistance (`calc_ettube_resistance`)

`R = (a·flow + b) · (length / 110)`, floored at 15, where `a`/`b` come from the tube diameter
(`set_ettube_diameter`: `a = −2.375·d + 11.9375`, `b = −14.375·d + 65.9374`). Resistance is therefore
flow- and diameter-dependent (turbulent ET-tube behaviour) and pushed onto the `VENT_ETTUBE` resistor.

## Control API

`set_pc`, `set_prvc`, `set_psv` configure a mode and its targets; `switch_ventilator(state)` enables
the device (and blocks `MOUTH_DS`); `trigger_breath()` forces the next breath by expiring the current
one; `set_fio2` / `set_humidity` / `set_temp` re-derive the fresh-gas composition (`set_fio2` accepts
either a fraction or a percentage > 20).

## Configuration (model-definition fields)

| Field | Meaning |
|---|---|
| `vent_mode` | `PC` / `PRVC` / `PS` |
| `vent_rate`, `insp_time` | rate (breaths/min) and inspiratory time (s) |
| `pip_cmh2o`, `pip_cmh2o_max`, `peep_cmh2o` | pressure targets / ceiling (cmH₂O) |
| `tidal_volume` | target tidal volume (L) for PRVC |
| `insp_flow`, `exp_flow` | flow settings |
| `ettube_diameter`, `ettube_length` | ET-tube geometry (drives resistance) |
| `fio2`, `humidity`, `temp` | fresh-gas conditioning |
| `synchronized`, `trigger_volume_perc` | patient-triggered ventilation |

## Notes & caveats

- **`compliance` is per-breath, in mL/cmH₂O**, measured at end-expiration. (An earlier every-step
  recomputation in `calc_model` used inconsistent units and overwrote it; that line was removed.)
- **`resistance` is left as `null`** in `calc_model` — a placeholder; the meaningful airway resistance
  is the ET-tube value in `_et_tube_resistance` / `VENT_ETTUBE.r_for`.
- **`trigger_breath(...)` ignores its arguments** — it only forces the current breath to expire; the
  `pip`/`peep`/… parameters are vestigial.
- **External-model references are guarded.** `DS` (end-tidal CO₂), `MOUTH_DS` (mouth blocking) and the
  `Breathing` model (trigger) are now null-safe; the ET-circuit sub-models are the ventilator's own
  components and are assumed present.
- **`exp_time = 60/vent_rate − insp_time` can go negative** if `insp_time` exceeds the breath period
  (very high rate); that is a configuration error, not guarded.

````


## 4. Engine source

### FILE: explain/Model.js

```javascript
import ModelEmitter from "./ModelEmitter";
import { RT_MSG } from "./helpers/RealtimeChannels.js";

/**
 * Model manages lifecycle, messaging, and state synchronization between the UI
 * layer and the ModelEngine worker. It wraps all wire protocols (GET/POST/PUT/DELETE)
 * exposed by the engine and re-emits results via the ModelEmitter pub/sub system.
 * Components subscribe with explain.on(event, handler) / explain.off(event, handler).
 */
export default class Model extends ModelEmitter {
  // declare an object holding the worker thread which does the heavy llifting
  modelEngine = {};

  // declare an object holding the model definition as loaded from the server
  modelDefinition = {};

  // declare an object holding the model data
  modelData = {};
  modelDataSlow = {};

  // declare an object holding the model state
  modelState = {};

  // declare an object holding a saved model state
  savedState = {}

  // declare object holding the generated messages
  info_message = "";
  error_message = "";
  statusMessage = "";
  script_message = "";

  // declare a message log
  message_log = [];
  no_logs = 25;


  /**
   * Spin up the ModelEngine worker and attach message listeners immediately so
   * no early responses are missed.
   */
  constructor() {
    super();
    // spin up a new model engine worker thread
    this.modelEngine = new Worker(new URL("./ModelEngine.js", import.meta.url), { type: "module" });

    // catch unhandled worker errors (syntax errors, import failures, etc.)
    this.modelEngine.onerror = (event) => {
      const message = event.message || "Unknown worker error";
      console.error("Model worker error:", message, event);
      this.error_message = message;
      this.emit("error", { message, error: message, stack: null });
    };

    // set up a listener for messages from the model engine
    this.receive();
  }

  /**
   * Fetch a JSON model definition by name and push it into the engine once retrieved.
   * @param {string} definition_name File stem inside /model_definitions.
   */
  load(definition_name) {
    console.log(`Model: Loading modeling definition: '${definition_name}'.`)
    const url = "/model_definitions/" + definition_name + ".json";

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Uh oh! could not get the baseline_neonate from the server!"
          );
        }
        return response.json();
      })
      .then((jsonData) => {
        // store the full file data for the state store to pick up
        this.loadedFileData = jsonData;
        // unwrap model_definition if the file has that wrapper
        const definition = jsonData.model_definition || jsonData;
        // forward the diagram/animation definitions into the engine so the
        // worker-side AnimationPacker can build the sprite data contract.
        if (jsonData.diagram_definition && definition.diagram_definition === undefined) {
          definition.diagram_definition = jsonData.diagram_definition;
        }
        if (jsonData.animation_definition && definition.animation_definition === undefined) {
          definition.animation_definition = jsonData.animation_definition;
        }
        this.build(definition);
      })
      .catch((error) => {
        console.error("Error: ", error);
      });
  }

  /**
   * Proxy helper that posts raw messages to the worker if available.
   * @param {Object} message Envelope containing type/message/payload.
   */
  send(message) {
    if (this.modelEngine) {
      this.modelEngine.postMessage(message);
    }
  }

  /**
   * Attach the onmessage handler that translates engine responses into
   * local state mutations and emitter callbacks.
   */
  receive() {
    // set up a listener for messages from the model engine
    this.modelEngine.onmessage = (e) => {
      switch (e.data.type) {
        case "state":
          this.modelState = e.data.payload;
          this.emit("state");
          break;
        case "status":
          this.statusMessage = e.data.message;
          this.emit("status");
          break;
        case "model_ready":
          this.emit("model_ready", e.data.payload);
          break;
        case "rt_start":
          this.emit("rt_start");
          break;
        case "rt_stop":
          this.emit("rt_stop");
          break;
        case "data":
          this.modelData = e.data.payload;
          this.emit("data");
          break;
        case "data_slow":
          this.modelDataSlow = e.data.payload;
          this.emit("data_slow");
          break;
        case "rtf":
          this.modelData = e.data.payload;
          this.emit("rtf");
          break;
        case "rts":
          this.modelDataSlow = e.data.payload;
          this.emit("rts");
          break;
        case "prop_value":
          this.emit("prop_value", e.data.payload);
          break;
        case "model_props":
          this.emit("model_props", e.data.payload);
          break;
        case "model_types":
          this.emit("model_types", e.data.payload);
          break;
        case "state_saved":
          this.savedState = this._processModelState({...e.data.payload});
          this.emit("state_saved");
          break;
        case "error":
          this.error_message = e.data.message;
          console.error("Model engine error:", e.data.message, e.data.payload);
          this.emit("error", { message: e.data.message, ...e.data.payload });
          break;
        case RT_MSG.CHANNELS:
        case RT_MSG.CHART:
        case RT_MSG.ANIM:
          // realtime data plane — consumed by RealtimeBus, ignored here
          break;
        default:
          console.log("Unknown message type received from model engine");
          console.log(e.data);
          break;
      }
    };
  }

  // API CALLS
  /**
   * Inject a new explain definition into the engine.
   * @param {Object} explain_definition Parsed JSON definition.
   */
  build(explain_definition) {
    console.log("Model: Injecting the model definition into the ModelEngine.")
    this.modelDefinition = { ...explain_definition };
    this.send({
      type: "POST",
      message: "build",
      payload: JSON.stringify(explain_definition),
    });
  }

  /**
   * Re-bind the sprite diagram's animation to an edited diagram definition
   * WITHOUT rebuilding the model — the running simulation (model objects,
   * volumes, time) is preserved. Pass the diagram_definition object (the
   * `{ settings, components }` shape). The worker rebuilds its AnimationPacker
   * and re-posts the realtime channel registry so renderers rebind live.
   * @param {Object} diagram_definition
   */
  updateDiagram(diagram_definition) {
    this.send({
      type: "PUT",
      message: "diagram_definition",
      payload: JSON.stringify(diagram_definition),
    });
  }

  /**
   * Rebuild the engine using the last loaded definition snapshot.
   */
  restart() {
    this.send({
      type: "POST",
      message: "build",
      payload: JSON.stringify(this.modelDefinition),
    });
  }

  /**
   * Request an offline calculation run for a fixed number of seconds.
   * @param {number} time_to_calculate Simulation horizon in seconds.
   */
  calculate(time_to_calculate) {
    this.send({
      type: "POST",
      message: "calc",
      payload: parseInt(time_to_calculate),
    });
  }

  /**
   * Start the realtime loop inside the model engine.
   */
  start() {
    this.send({
      type: "POST",
      message: "start",
      payload: [],
    });
  }

  /**
   * Halt the realtime loop without clearing state.
   */
  stop() {
    this.send({
      type: "POST",
      message: "stop",
      payload: [],
    });
  }

  /**
   * Terminate the underlying worker and detach listeners to avoid leaks when
   * the owning component unmounts or hot reloads.
   */
  dispose() {
    if (this.modelEngine) {
      this.modelEngine.onmessage = null;
      this.modelEngine.terminate();
      this.modelEngine = null;
    }
  }

  /**
   * Remove every fast-sample watch entry.
   */
  clearWatchList() {
    this.send({
      type: "DELETE",
      message: "watchlist",
      payload: [],
    });
  }

  /**
   * Remove every slow-sample watch entry.
   */
  clearWatchListSlow() {
    this.send({
      type: "DELETE",
      message: "watchlist_slow",
      payload: [],
    });
  }

  /**
   * Subscribe to realtime values for given properties (model.prop1.prop2 strings).
   * @param {string|string[]} args Property path or array of paths.
   */
  watchModelProps(args) {
    // args is an array of strings with format model.prop1.prop2
    if (typeof args === "string") {
      args = [args];
    }
    this.send({
      type: "POST",
      message: "watch",
      payload: args,
    });
  }

  /**
   * Subscribe to slow-sampled values for given properties.
   * @param {string|string[]} args Property path or array of paths.
   */
  watchModelPropsSlow(args) {
    // args is an array of strings with format model.prop1.prop2
    if (typeof args === "string") {
      args = [args];
    }
    this.send({
      type: "POST",
      message: "watch_slow",
      payload: args,
    });
  }

  /**
   * Pull the latest fast-sampled model data snapshot.
   */
  getModelData() {
    this.send({
      type: "GET",
      message: "data",
      payload: [],
    });
  }

  /**
   * Pull the latest slow-sampled model data snapshot.
   */
  getModelDataSlow() {
    this.send({
      type: "GET",
      message: "data_slow",
      payload: [],
    });
  }

  /**
   * Update the fast sampler interval inside the engine.
   * @param {number} new_interval Interval in seconds.
   */
  setSampleInterval(new_interval) {
    this.send({
      type: "PUT",
      message: "sample_interval",
      payload: new_interval,
    });
  }

  /**
   * Update the slow sampler interval inside the engine.
   * @param {number} new_interval Interval in seconds.
   */
  setSampleIntervalSlow(new_interval) {
    this.send({
      type: "PUT",
      message: "sample_interval_slow",
      payload: new_interval,
    });
  }

  /**
   * Request the entire serialized engine state.
   */
  getModelState() {
    this.send({
      type: "GET",
      message: "state",
      payload: [],
    });
  }

  /**
   * Ask the engine to persist the current state as a saved snapshot.
   */
  saveModelState() {
    this.send({
      type: "POST",
      message: "save",
      payload: [],
    });
  }

  /**
   * Retrieve metadata about a specific model instance.
   * @param {string} model_name Name of the model instance in state.
   */
  getModelProps(model_name) {
    // get the properties of a specific model
    this.send({
      type: "GET",
      message: "model_props",
      payload: model_name,
    });
  }

  /**
   * Request the catalog of model types supported by the engine.
   */
  getModelTypes() {
    // get all the model types
    this.send({
      type: "GET",
      message: "model_types",
      payload: {},
    });
  }

  /**
   * Fetch a blood composition report for the given model instance.
   * @param {string} model_name Instance key inside modelState.
   */
  getBloodComposition(model_name) {
    // get the interface of a specific model
    this.send({
      type: "GET",
      message: "blood_composition",
      payload: model_name,
    });
  }


  /**
   * Create a brand-new model instance via the engine API.
   * @param {Object} model_args Arguments required by the engine to instantiate.
   */
  addNewModel(model_args) {
    // get the interface of a specific model
    this.send({
      type: "POST",
      message: "add",
      payload: model_args,
    });
  }

  /**
   * Remove a model instance from the engine.
   * @param {string} model_name Instance key inside modelState.
   */
  deleteModel(model_name) {
    // get the interface of a specific model
    this.send({
      type: "DELETE",
      message: "remove",
      payload: model_name,
    });
  }

  /**
   * Query the current value for a dot-delimited property path.
   * @param {string} property model.prop1.prop2 path.
   */
  getPropValue(property) {
    // get the value of a specific property with string format model.prop1.prop2
    this.send({
      type: "GET",
      message: "property_value",
      payload: property,
    });
  }

  /**
   * Schedule a property change with optional tweening parameters.
   * @param {string} prop model.prop1.prop2 path.
   * @param {number|string|boolean} new_value Target value.
   * @param {number} it Interpolation time in seconds (>= 0).
   * @param {number} at Delay before starting the interpolation.
   */
  setPropValue(prop, new_value, it = 1, at = 0) {
    // make sure the it is not zero
    if (it < 0) {
      it = 0;
    }
    let result = prop.split(".");
    let model = result[0];
    let prop1 = result[1];
    let prop2 = null;
    if (result.length > 2) {
      prop2 = result[2];
    }
    // set the property of a model with format {prop: model.prop1.prop2, v: value, at: time, it: time, type: task_type}
    this.send({
      type: "PUT",
      message: "property_value",
      payload: JSON.stringify({
        model: model,
        prop1: prop1,
        prop2: prop2,
        t: new_value,
        it: it,
        at: at,
        type: typeof new_value,
      }),
    });
  }

  /**
   * Ask the engine to execute a method on a model after an optional delay.
   * @param {string} model_function Dot path Model.method.
   * @param {Array} args Arguments to forward to the method.
   * @param {number} at Delay before invocation in seconds.
   */
  callModelFunction(model_function, args, at = 0) {
    this.send({
      type: "POST",
      message: "call",
      payload: JSON.stringify({
        func: model_function,
        args: args,
        it: 0,
        at: at,
        type: "function",
      }),
    });
  }

  /**
   * Scale a specific parameter group by a factor.
   * @param {string} group One of: "volumes", "unstressed_volumes", "elastances", "resistances", "reset"
   * @param {number} factor Scale factor (1.0 = no change, 0.5 = half, 2.0 = double)
   */
  scaleModel(group, factor = 1.0) {
    this.send({
      type: "POST",
      message: "scale",
      payload: { group, factor },
    });
  }

  /**
   * Remove transient helpers and local-only objects from a model state snapshot
   * so that it can be serialized or displayed cleanly.
   * @param {Object} model_state Raw state object returned by the engine.
   * @returns {Object} Sanitized model_state reference.
   */
  _processModelState(model_state) {
    // transfrom the modelstate object to a serializable object by removing the helper objects
    delete model_state["DataCollector"];
    delete model_state["TaskScheduler"];
    delete model_state["ModelScaler"];
    // remove the ncc counters
    for (const key in model_state) {
      if (key.startsWith("ncc")) {
        delete model_state[key];
      }
    }
    // iterate over all model and delete the local attributes
    Object.values(model_state.models).forEach((m) => {
      for (const key in m) {
        if (key.startsWith("_")) {
          delete m[key];
        }
        if (key === 'components') {
          if (Object.keys(m[key]).length > 0) {
            // build name array of keys
            let key_names = [] 
            Object.keys(m[key]).forEach(k => {
              key_names.push(k)
            })
            // replace
            key_names.forEach( key_name => {
              m['components'][key_name] = model_state.models[key_name]
              delete model_state.models[key_name]
            })
          }

        }
      }
    });
    return model_state;
  }
}

```

### FILE: explain/ModelEmitter.js

```javascript
/**
 * Minimal pub/sub emitter mixin for Model.
 * Uses Map<string, Set<Function>> for O(1) add/remove.
 * No dependencies, no wildcard support — intentionally minimal.
 */
export default class ModelEmitter {
  _listeners = new Map();

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
  }

  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  emit(event, ...args) {
    const set = this._listeners.get(event);
    if (set) {
      for (const callback of set) {
        callback(...args);
      }
    }
  }
}

```

### FILE: explain/ModelEngine.js

```javascript
// This is a dedicated web worker instance for the physiological model engine
// Web workers run in a separate thread for performance reasons and have no access to the DOM nor the window object
// The scope is defined by self and communication with the main thread by a message channel
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#web_workers_api

// Communication with the script which spawned the web worker takes place through a communication channel
// Messages are received in the onmessage event and are sent by the _send function

// Explain request object :
/* {
  type:       <string> stating the type of message (REST (PUT/POST/GET/DELETE/PATCH))
  message:    <string> stating the component of the model for which the message is intended (p.e. 'datalogger'/'interventions')
  payload:    <object> containing data to pass to the action
}
*/



// import all models present in the model_index module
import * as models from "./ModelIndex";
import DataCollector from "./helpers/DataCollector";
import TaskScheduler from "./helpers/TaskScheduler";
import ModelScaler from "./helpers/ModelScaler";
import ChannelWriter from "./helpers/ChannelWriter";
import AnimationPacker from "./helpers/AnimationPacker";
import { RT_MSG } from "./helpers/RealtimeChannels";
import { calc_blood_composition } from "./component_models/BloodComposition";

// store all imported models in a list to be able to instantiate them dynamically
let available_models = [];
Object.values(models).forEach((model) => available_models.push(model));
const available_model_map = {};
for (let i = 0; i < available_models.length; i++) {
  const model_class = available_models[i];
  available_model_map[model_class.model_type] = model_class;
}
const model_types_cached = [...new Set(available_models.map((mt) => mt.model_type))];
const ENABLE_STEP_ERROR_GUARD = true;

const _get_data_collector = function () {
  return model?.DataCollector || null;
};

const _get_task_scheduler = function () {
  return model?.TaskScheduler || null;
};

const _normalize_payload = function (payload) {
  if (typeof payload === "string") {
    return JSON.parse(payload);
  }
  return payload;
};

// declare a model object holding the current model
let model = {
  models: {},
};

// declare the model initialization flag
let model_initialized = false;

// declare a model data object holding the high resolution model data
let model_data = {};

// declare a model data object holding the low resolution model data
let model_data_slow = {};

// set the realtime updateintervals
let rtInterval = 0.015;
let rtSlowInterval = 1.0;
let rtSlowCounter = 0.0;
let rtClock = null;

// realtime typed data-plane (chart ring + anim snapshot)
let channel_writer = null;
let animation_packer = null;
let build_counter = 0;

// set up the endpoints for requests from the main thread
self.onmessage = (e) => {
  try {
    switch (e.data.type) {
      case "GET": // retrieve a resource
        switch (e.data.message) {
          case "state":
            get_model_state();
            break;
          case "data":
            get_model_data();
            break;
          case "data_slow":
            get_model_data_slow();
            break;
          case "property_value":
            get_property(e.data.payload);
            break;
          case "model_props":
            get_model_props(e.data.payload);
            break;
          case "model_types":
              get_model_types(e.data.payload);
              break;
          case "blood_composition":
            get_blood_composition(e.data.payload);
            break;
        }
        break;
      case "PUT": // update a resource
        switch (e.data.message) {
          case "sample_interval":
            _get_data_collector()?.set_sample_interval(e.data.payload);
            break;
          case "sample_interval_slow":
            _get_data_collector()?.set_sample_interval_slow(e.data.payload);
            break;
          case "property_value":
            console.log("ModelEngine: task scheduler request: ", e.data.payload )
            set_property(_normalize_payload(e.data.payload));
            break;
          case "diagram_definition":
            update_diagram(_normalize_payload(e.data.payload));
            break;
        }
        break;
      case "POST": // create a new resource
        switch (e.data.message) {
          case "build":
            console.log("ModelEngine: received new model definition.")
            model_initialized = build(_normalize_payload(e.data.payload));
            break;
          case "start":
            console.log("ModelEngine: realtime model started.")
            start();
            break;
          case "stop":
            console.log("ModelEngine: realtime model stopped.")
            stop()
            break;
          case "calc":
            console.log(`ModelEngine: calculating ${e.data.payload} seconds.`)
            calculate(e.data.payload);
            break;
          case "call":
            console.log("ModelEngine: calling model a specific function", e.data.payload )
            call_function(_normalize_payload(e.data.payload));
            break;
          case "add":
            add_model_to_engine(e.data.payload);
            break;
          case "save":
            save_state();
            break;
          case "scale":
            scale_model(e.data.payload);
            break;
          case "watch":
            watch_props(e.data.payload);
            break;
          case "watch_slow":
            watch_props_slow(e.data.payload);
            break;
        }
        break;
      case "DELETE": // remove a resource
        switch (e.data.message) {
          case "remove":
            remove_model_from_engine(e.data.payload)
            break;
          case "watchlist":
            clear_watchlist();
            break;
          case "watchlist_slow":
            clear_watchlist_slow();
            break;
        }
        break;
      default:
        console.log(`ModelEngine: invalid API request ${e.data.type}`)
        break;
    }
  } catch (err) {
    console.error("ModelEngine: unhandled error in message handler:", err);
    _send_error(`Unhandled error processing ${e.data.type} ${e.data.message}: ${err.message}`, err);
  }
};

// post the one-time realtime channel handshake: transport descriptor (+ SAB
// handles in shared mode) plus the chart and anim registries. Re-posted by the
// DataCollector callback whenever the chart layout/version changes.
const _post_rt_channels = function () {
  if (!channel_writer) return;
  postMessage({
    type: RT_MSG.CHANNELS,
    message: "",
    payload: {
      descriptor: channel_writer.descriptor(),
      chart: {
        version: model.DataCollector?.registry_version || 0,
        slots: model.DataCollector?.chart_slots || [],
      },
      anim: animation_packer ? animation_packer.registry() : null,
    },
  });
};

// Re-bind the sprite-diagram animation to an EDITED diagram definition without
// rebuilding the model — the live simulation (model objects, volumes, time)
// is left running. Swaps model.diagram_definition, rebuilds the AnimationPacker
// (component -> slot registry + direct model refs), re-acquires the anim
// snapshot at the new stride/version, and re-posts the rt_channels handshake so
// the main-thread reader and renderers rebind. Returns true on success.
const update_diagram = function (diagram_definition) {
  if (!model) return false;
  if (diagram_definition) model.diagram_definition = diagram_definition;
  if (!channel_writer) return false;
  try {
    build_counter += 1;
    animation_packer = new AnimationPacker(model, build_counter);
    channel_writer.acquireAnimSnapshot(
      animation_packer.stride || 0,
      animation_packer.version
    );
    _post_rt_channels();
    return true;
  } catch (e) {
    console.error("ModelEngine: diagram animation rebind failed:", e);
    return false;
  }
};

// define the model functions
const build = function (model_definition) {
  console.log("ModelEngine: building model from model definition.")
  // set the error counter
  let errors = 0;

  // set model initializer to false
  model_initialized = false;

  // store the model definition
  model_definition = model_definition;

  // erase all data
  model_data = {};
  model_data_slow = {};

  // stop all timers
  clearInterval(rtClock);

  // clear the current model object
  model = {
    models: {},
    scaler_config: {},
    ncc_atrial: 0,
    ncc_ventricular: 0,
    ncc_breathing_insp: 0,
    ncc_breathing_exp: 0,
    ncc_ventilator_insp: 0,
    ncc_ventilator_exp: 0,
  };

  // initialize the model parameters, except the model components key which needs special processing
  for (const [key, value] of Object.entries(model_definition)) {
    if (key !== "models") {
      // copy model parameter to the model object
      model[key] = value;
    }
  }

  // initialize all sub models
  Object.values(model_definition.models).forEach((sub_model_def) => {
    const model_class = available_model_map[sub_model_def.model_type];

    // if the component model was found then instantiate a model
    if (model_class) {
      try {
        // instantiate the new component and give it a name, pass the model type and a reference to the whole model
        let new_sub_model = new model_class(
          model,
          sub_model_def.name,
          sub_model_def.model_type
        );
        // add the new component to the model object
        model.models[sub_model_def.name] = new_sub_model;
      } catch (e) {
        errors += 1;
        console.error("ModelEngine: model instantiation error: ", sub_model_def.name, e);
        _send({
          type: "status",
          message: "ERROR: failed to instantiate " + sub_model_def.name + " (" + sub_model_def.model_type + ")",
          payload: [],
        });
      }

    } else {
      errors += 1;
      console.log("Model type not found: ", sub_model_def.model_type);
      _send({
        type: "status",
        message: "ERROR: " + sub_model_def.model_type + " model not found",
        payload: [],
      });
    }
  });

  // initialize all sub models
  if (errors < 1) {
    // now initialize all the models with the correct properties stored in the model definition
    Object.values(model.models).forEach((model_comp) => {
      // // find the arguments for the model in the model definition
      let args = [];
      for (const [key, value] of Object.entries(model_definition.models[model_comp.name])) {
        args.push({ key, value });
      }
      // set the arguments
      try {
        model_comp.init_model(args);
      } catch (e) {
        console.log("ModelEngine: model initialization error: ", model_comp.name);
        console.log(e);
        errors += 1;
        _send({
          type: "status",
          message:
            "ERROR: " +
            model_comp.name +
            "(" +
            model_comp.model_type +
            ") configuration error.",
          payload: [],
        });
      }
    });

    // add a datacollector instance to the model object
    model["DataCollector"] = new DataCollector(model);

    // add a task scheduler instance to the model object
    model["TaskScheduler"] = new TaskScheduler(model);

    // add a model scaler instance to the model object
    model["ModelScaler"] = new ModelScaler(model, model.scaler_config);

    // freeze the JSON's weight as the allometric baseline; reset() and
    // scale_to_weight() use this so behavior is correct regardless of scenario
    model._baseline_weight = model.weight;

    // wire up the realtime typed data plane (chart ring + anim snapshot).
    // Attaching channels flips the DataCollector to the typed fast path and
    // (re)posts the rt_channels handshake through the registry callback.
    try {
      build_counter += 1;
      channel_writer = new ChannelWriter((m, transfer) =>
        postMessage(m, transfer || [])
      );
      animation_packer = new AnimationPacker(model, build_counter);
      channel_writer.acquireAnimSnapshot(
        animation_packer.stride || 0,
        animation_packer.version
      );
      model.DataCollector.set_channels(channel_writer, _post_rt_channels);
    } catch (e) {
      console.error("ModelEngine: realtime channel setup failed:", e);
      channel_writer = null;
      animation_packer = null;
    }
  }

  if (errors > 0) {
    console.log("ModelEngine: model build failed.")
    _send({
      type: "status",
      message: `ERROR: model build failed"`,
      payload: [],
    });
    return false;
  } else {
    console.log("ModelEngine: model build succesful.")
    _send({
      type: "model_ready",
      message: "",
      payload: [],
    });
    return true;
  }
};

const remove_model_from_engine = function (model_name) {
  try {
    delete model.models[model_name]
    console.log('Removed model from engine: ', model_name)
    _send({
      type: "status",
      message: `Removed submodel from the model. `,
      payload: [],
    });
  } catch {
    console.log('Error in removing model from engine: ', model_name)
    _send({
      type: "status",
      message: `Error removing submodel from model. `,
      payload: [],
    });

  }

}

const add_model_to_engine = function (new_model) {

  const base_model = available_models.find(item => item.model_type === new_model.model_type );
  // make a key value list of the args
  let arg_list = []
  Object.keys(new_model).forEach(arg => {
    let arg_object = { key: arg, value: new_model[arg]}
    arg_list.push(arg_object)
  })
  let new_sub_model = {}
  try {
    new_sub_model = new base_model(model, new_model.name);
    new_sub_model.init_model(arg_list)
    model.models[new_model.name] = new_sub_model
    console.log('Added model to engine: ', new_sub_model)
    _send({
      type: "status",
      message: `Submodel added to the model`,
      payload: [],
    });
  } catch {
    console.log('Failed to add model to engine: ')
    _send({
      type: "status",
      message: `ERROR: failed to add model`,
      payload: [],
    });
  }

}

const start = function () {
  // start the model in realtime
  if (model_initialized) {
    // gate typed chart-ring writes to the realtime loop (offline calculate()
    // keeps using the object path)
    if (model.DataCollector) model.DataCollector.rt_active = true;
    // Re-post the channel handshake (chart + anim registries) now. The main-
    // thread RealtimeBus is created lazily after build, so it misses the
    // build-time handshake; re-posting on every start guarantees every renderer
    // (incl. the diagram's anim registry) is configured before frames flow.
    _post_rt_channels();
    // call the modelStep every rt_interval seconds
    clearInterval(rtClock);
    rtClock = setInterval(_model_step_rt, rtInterval * 1000.0);
    // send status update
    _send({
      type: "rt_start",
      message: ``,
      payload: [],
    });
    _send({
      type: "status",
      message: `realtime model started`,
      payload: [],
    });
  } else {
    _send({
      type: "status",
      message: `ERROR: model not initialized.`,
      payload: [],
    });
  }
};

const stop = function () {
  // stop the realtime model
  if (model_initialized) {
    if (model.DataCollector) model.DataCollector.rt_active = false;
    clearInterval(rtClock);
    rtClock = null;
    // signal that realtime model stopped
    _send({
      type: "rt_stop",
      message: ``,
      payload: [],
    });
    _send({
      type: "status",
      message: `realtime model stopped`,
      payload: [],
    });
  }
};

const calculate = function (time_to_calculate) {
  // calculate a number of seconds of the model
  if (model_initialized) {
    let noOfSteps = time_to_calculate / model.modeling_stepsize;
    _send({
      type: "status",
      message: `calculating ${time_to_calculate} s (${noOfSteps} steps)`,
      payload: [],
    });
    const start = performance.now();
    for (let i = 0; i < noOfSteps; i++) {
      _model_step();
    }
    const end = performance.now();
    const step_time = (end - start) / noOfSteps;

    _send({
      type: "status",
      message: `calculated in ${(end - start).toFixed(0)} ms (${step_time.toFixed(3)} ms/step)`,
      payload: [],
    });
    // get model data
    get_model_data();
    get_model_data_slow();
    get_model_state();
  } else {
    _send({
      type: "status",
      message: `ERROR: model not initialized.`,
      payload: [],
    });
  }

  // clean up the datacollector
  _get_data_collector()?.clean_up();
  _get_data_collector()?.clean_up_slow();
};

const set_property = function (new_prop_value) {
  _get_task_scheduler()?.add_task(new_prop_value);
};

const get_property = function (prop) {
  let p = prop.split(".");
  let v = {};
  switch (p.length) {
    case 2:
      v = model.models[p[0]][p[1]];
      break;
    case 3:
      v = model.models[p[0]][p[1]][p[2]];
      break;
  }
  _send({
    type: "prop_value",
    message: "",
    payload: { prop: prop, value: v },
  });
};

const get_model_props = function (model_name) {
  let modelStateCopy = { ...models };
  delete modelStateCopy["DataCollector"];
  delete modelStateCopy["TaskScheduler"];
  Object.values(modelStateCopy).forEach((m) => {
    for (const key in m) {
      if (key.startsWith("_")) {
        delete m[key];
      }
    }
  });
  _send({
    type: "model_props",
    message: "",
    payload: modelStateCopy,
  });

}

const get_model_types = function () {
  _send({
    type: "model_types",
    message: "",
    payload: model_types_cached,
  });

}

const call_function = function (new_function_call) {
  _get_task_scheduler()?.add_function_call(new_function_call);
};

const clear_watchlist = function () {
  _get_data_collector()?.clear_watchlist();
};

const clear_watchlist_slow = function () {
  _get_data_collector()?.clear_watchlist_slow();
};

const watch_props = function (args) {
  const data_collector = _get_data_collector();
  if (!data_collector) {
    return;
  }
  args.forEach((prop) => {
    data_collector.add_to_watchlist(prop);
  });
};

const watch_props_slow = function (args) {
  const data_collector = _get_data_collector();
  if (!data_collector) {
    return;
  }
  args.forEach((prop) => {
    data_collector.add_to_watchlist_slow(prop);
  });
};

const get_model_state = function () {
  // get the current whole model state
  postMessage({
    type: "state",
    message: "",
    payload: model,
  });
};

const get_model_data = function () {
  // get the realtime model data from the datacollector
  model_data = _get_data_collector()?.get_model_data() || [];

  // send data to the ui
  postMessage({
    type: "data",
    message: "",
    payload: model_data,
  });
};

const get_model_data_slow = function () {
  // get the slow update model data from the datacollector
  model_data_slow = _get_data_collector()?.get_model_data_slow() || [];

  // send data to the ui
  postMessage({
    type: "data_slow",
    message: "",
    payload: model_data_slow,
  });
};

const get_blood_composition = function (model_name) {
  console.log("ModelEngine: calculating blood composition.")
  const m = model.models[model_name];
  if (!m) {
    _send({
      type: "status",
      message: `ERROR: blood composition model not found (${model_name})`,
      payload: [],
    });
    return;
  }

  try {
    calc_blood_composition(m);
    _send({
      type: "status",
      message: `blood composition calculated for ${model_name}`,
      payload: [],
    });
  } catch (e) {
    console.log("ModelEngine: blood composition calculation failed.", e);
    _send({
      type: "status",
      message: `ERROR: blood composition calculation failed for ${model_name}`,
      payload: [],
    });
  }
}

const scale_model = function (payload) {
  if (!model_initialized || !model.ModelScaler) {
    _send({
      type: "status",
      message: "ERROR: model not initialized.",
      payload: [],
    });
    return;
  }
  try {
    const { group, factor } = payload;
    console.log(`ModelEngine: scaling ${group} by factor ${factor}`);
    switch (group) {
      // volume scaling (scales actual vol + u_vol_factor_scaling)
      case "blood_volume":
        model.ModelScaler.scale_blood_volume(factor);
        break;
      case "heart_volume":
        model.ModelScaler.scale_heart_volume(factor);
        break;
      case "lung_volume":
        model.ModelScaler.scale_lung_volume(factor);
        break;
      case "thorax_volume":
        model.ModelScaler.scale_thorax_volume(factor);
        break;
      case "pericardium_volume":
        model.ModelScaler.scale_pericardium_volume(factor);
        break;
      // blood
      case "blood_elastances":
        model.ModelScaler.scale_blood_elastances(factor);
        break;
      case "blood_resistances":
        model.ModelScaler.scale_blood_resistances(factor);
        break;
      // pulmonary
      case "pulmonary_elastances":
        model.ModelScaler.scale_pulmonary_elastances(factor);
        break;
      case "pulmonary_resistances":
        model.ModelScaler.scale_pulmonary_resistances(factor);
        break;
      case "pulmonary_u_vol":
        model.ModelScaler.scale_pulmonary_u_vol(factor);
        break;
      // systemic
      case "systemic_elastances":
        model.ModelScaler.scale_systemic_elastances(factor);
        break;
      case "systemic_resistances":
        model.ModelScaler.scale_systemic_resistances(factor);
        break;
      case "systemic_u_vol":
        model.ModelScaler.scale_systemic_u_vol(factor);
        break;
      // airway (dead space + conducting airways)
      case "airway_elastances":
        model.ModelScaler.scale_airway_elastances(factor);
        break;
      case "airway_u_vol":
        model.ModelScaler.scale_airway_u_vol(factor);
        break;
      case "airway_upper_resistances":
        model.ModelScaler.scale_airway_upper_resistances(factor);
        break;
      case "airway_lower_resistances":
        model.ModelScaler.scale_airway_lower_resistances(factor);
        break;
      // left lung
      case "left_lung_elastances":
        model.ModelScaler.scale_left_lung_elastances(factor);
        break;
      case "left_lung_resistances":
        model.ModelScaler.scale_left_lung_resistances(factor);
        break;
      case "left_lung_u_vol":
        model.ModelScaler.scale_left_lung_u_vol(factor);
        break;
      // right lung
      case "right_lung_elastances":
        model.ModelScaler.scale_right_lung_elastances(factor);
        break;
      case "right_lung_resistances":
        model.ModelScaler.scale_right_lung_resistances(factor);
        break;
      case "right_lung_u_vol":
        model.ModelScaler.scale_right_lung_u_vol(factor);
        break;
      // heart
      case "heart_el_min":
        model.ModelScaler.scale_heart_el_min(factor);
        break;
      case "heart_el_max":
        model.ModelScaler.scale_heart_el_max(factor);
        break;
      case "left_heart_el_min":
        model.ModelScaler.scale_left_heart_el_min(factor);
        break;
      case "left_heart_el_max":
        model.ModelScaler.scale_left_heart_el_max(factor);
        break;
      case "left_heart_u_vol":
        model.ModelScaler.scale_left_heart_u_vol(factor);
        break;
      case "right_heart_el_min":
        model.ModelScaler.scale_right_heart_el_min(factor);
        break;
      case "right_heart_el_max":
        model.ModelScaler.scale_right_heart_el_max(factor);
        break;
      case "right_heart_u_vol":
        model.ModelScaler.scale_right_heart_u_vol(factor);
        break;
      case "heart_resistances":
        model.ModelScaler.scale_heart_resistances(factor);
        break;
      // containers
      case "thorax_elastances":
        model.ModelScaler.scale_thorax_elastances(factor);
        break;
      case "pericardium_elastances":
        model.ModelScaler.scale_pericardium_elastances(factor);
        break;
      // utility
      case "weight":
        model.weight = factor;
        break;
      case "weight_scale":
        model.ModelScaler.scale_to_weight(factor);
        break;
      case "add_volume":
        model.ModelScaler.add_volume(factor);
        break;
      case "incorporate":
        model.ModelScaler.incorporate();
        break;
      case "reset":
        model.ModelScaler.reset();
        model.weight = model._baseline_weight;
        break;
    }
    get_model_state();
    _send({
      type: "status",
      message: `${group} scaled by factor ${factor}`,
      payload: [],
    });
  } catch (e) {
    console.error("ModelEngine: scaling error:", e);
    _send_error(`Scaling error: ${e.message}`, e);
  }
};

const _model_step = function () {
  // iterate over all models
  for (const model_name in model.models) {
    const model_component = model.models[model_name];
    if (ENABLE_STEP_ERROR_GUARD) {
      try {
        model_component.step_model();
      } catch(e) {
        console.error("Step model error: ", model_component.name, e);
        _send_error(`step_model error in ${model_component.name}: ${e.message}`, e);
      }
    } else {
      model_component.step_model();
    }

  }

  // call the datacollector
  _get_data_collector()?.collect_data(model.model_time_total);

  // do the tasks
  _get_task_scheduler()?.run_tasks();

  // increase the model clock
  model.model_time_total += model.modeling_stepsize;
};

const save_state = function() {
  postMessage({
    type: "state_saved",
    message: "",
    payload: model,
  });
  
}

// define the local model functions
const _model_step_rt = function () {
  try {
    // so the rt_interval determines how often the model is calculated
    const noOfSteps = rtInterval / model.modeling_stepsize;
    for (let i = 0; i < noOfSteps; i++) {
      _model_step();
    }

    // fast stream
    if (channel_writer && model.DataCollector && !model.DataCollector.legacy_mode) {
      // chart rows were written into the ring inside collect_data; here we pack
      // the latest anim frame and flush (flush is a no-op in shared mode).
      if (animation_packer) {
        animation_packer.pack_and_write(channel_writer, model.model_time_total);
      }
      channel_writer.flush();
    } else {
      // legacy object path
      _get_model_data_rt();
    }

    // get slow model data
    if (rtSlowCounter > rtSlowInterval) {
      rtSlowCounter = 0;
      _get_model_data_rt_slow();
    }
    rtSlowCounter += rtInterval;
  } catch (err) {
    // Stop the realtime loop to prevent repeated failures
    clearInterval(rtClock);
    rtClock = null;
    console.error("ModelEngine: fatal error in realtime loop:", err);
    _send_error(`Fatal error in realtime loop: ${err.message}`, err);
    _send({ type: "rt_stop", message: "", payload: [] });
  }
};

const _get_model_data_rt = function () {
  // get the realtime model data from the datacollector
  model_data = _get_data_collector()?.get_model_data() || [];

  // send data to the ui
  postMessage({
    type: "rtf",
    message: "",
    payload: model_data,
  });
};

const _get_model_data_rt_slow = function () {
  // get the realtime slow model data from the datacollector
  model_data = _get_data_collector()?.get_model_data_slow() || [];

  // send data to the ui
  postMessage({
    type: "rts",
    message: "",
    payload: model_data,
  });
};

const _send = function (message) {
  postMessage(message);
};

const _send_error = function (message, err) {
  postMessage({
    type: "error",
    message: message,
    payload: {
      error: err?.message || String(err),
      stack: err?.stack || null,
    },
  });
};

```

### FILE: explain/ModelIndex.js

```javascript
// import the base models
export { BloodDiffusor } from "./base_models/BloodDiffusor";
export { Capacitance }  from "./base_models/Capacitance";
export { Container} from "./base_models/Container";
export { GasCapacitance } from "./component_models/GasCapacitance";
export { GasDiffusor } from "./base_models/GasDiffusor"
export { GasExchanger } from "./base_models/GasExchanger";
export { Resistor } from "./base_models/Resistor";
export { TimeVaryingElastance } from "./base_models/TimeVaryingElastance";

// import the component models
export { Blood } from "./component_models/Blood";
export { BloodCapacitance } from "./component_models/BloodCapacitance";
export { BloodTimeVaryingElastance } from "./component_models/BloodTimeVaryingElastance";
export { BloodVessel } from "./component_models/BloodVessel";
export { BloodPump } from "./component_models/BloodPump";
export { Fluids } from "./component_models/Fluids";

export { HeartValve } from "./component_models/HeartValve";
export { Placenta } from "./component_models/Placenta";
export { Shunts } from "./component_models/Shunts";
export { Pda } from "./component_models/Pda";

export { Heart } from "./component_models/Heart";
export { Mob } from "./component_models/Mob";
export { HeartFunction } from "./component_models/HeartFunction";
export { Circulation } from "./component_models/Circulation";
export { HeartChamber } from "./component_models/HeartChamber";

export { Gas } from "./component_models/Gas";
export { Breathing } from "./component_models/Breathing";
export { Respiration } from "./component_models/Respiration";

export { Ans } from "./component_models/Ans";
export { AnsAfferent } from "./component_models/AnsAfferent";
export { AnsEfferent } from "./component_models/AnsEfferent";
export { Metabolism } from "./component_models/Metabolism";
export { Kidneys } from "./component_models/Kidneys";
export { Hormones } from "./component_models/Hormones";
export { Drugs } from "./component_models/Drugs";


// import the device models
export { Ecls } from "./device_models/Ecls";
export { Monitor } from "./device_models/Monitor";
export { Resuscitation } from "./device_models/Resuscitation";
export { Ventilator } from "./device_models/Ventilator";
```

### FILE: explain/base_models/BaseModelClass.js

```javascript
import * as Models from "../ModelIndex.js"

// This base model class is the blueprint for all the model objects (classes). It incorporates the properties and methods which all model objects must implement 
export class BaseModelClass {
  // model interface list as described above

  constructor(model_ref, name = "") {
    // initialize independent properties which all models implement
    this.name = name; // name of the model object
    this.description = ""; // description for documentation purposes
    this.is_enabled = false; // flag whether the model is enabled or not
    this.model_type = ""; // holds the model type e.g. BloodCapacitance
    this.components = {}; // holds a dictionary 

    // initialize local properties
    this._model_engine = model_ref; // object holding a reference to the model engine
    this._t = model_ref.modeling_stepsize; // setting the modeling stepsize
    this._is_initialized = false; // flag whether the model is initialized or not
  }

  init_model(args = {}) {
    // set the values of the independent properties
    args.forEach((arg) => {
      this[arg["key"]] = arg["value"];
    });


    Object.keys(this.components).forEach(component_name => {
      // do not overwrite existing models
      if (!this._model_engine.models.hasOwnProperty(component_name)) {
        this._model_engine.models[component_name] = new Models[this.components[component_name].model_type](this._model_engine, component_name);
      }
    })
  
    // initialize all model sub models with the arguments
    Object.keys(this.components).forEach(component_name => {
      let args = [];
      for (const [key, value] of Object.entries(this.components[component_name])) {
        args.push({ key, value });
      }
      this._model_engine.models[component_name].init_model(args)
    })
    
    // flag that the model is initialized
    this._is_initialized = true;
  }

  step_model() {
    // this method is called by the model engine and if the model is enabled and initialized it will do the model calculations
    if (this.is_enabled && this._is_initialized) {
      this.calc_model();
    }
  }

  calc_model() {
    // this method is overridden by almost all model classes as this is the place where model calculations take place
    // Override this method in subclasses
  }
}

```

### FILE: explain/base_models/BloodDiffusor.js

```javascript
import { BaseModelClass } from "./BaseModelClass";
import { calc_blood_composition } from "../component_models/BloodComposition"

export class BloodDiffusor extends BaseModelClass {
  // static properties
  static model_type = "BloodDiffusor";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties
    this.comp_blood1 = "PLF"; // name of the first blood-containing model
    this.comp_blood2 = "PLM"; // name of the second blood-containing model
    this.dif_o2 = 0.01; // diffusion constant for o2 (mmol/mmHg * s)
    this.dif_co2 = 0.01; // diffusion constant for co2 (mmol/mmHg * s)
    this.dif_solutes = {}; // diffusion constant for the different solutes (mmol/mmol * s)

     // non-persistent property factors. These factors reset to 1.0 after each model step
    this.dif_o2_factor = 1.0; // non-persistent diffusion factor for o2 (unitless)
    this.dif_co2_factor = 1.0; // non-persistent diffusion factor for co2 (unitless)
    this.dif_solutes_factor = 1.0; // non-persistent diffusion factor for solutes (unitless)

    // persistent property factors. These factors are persistent and do not reset
    this.dif_o2_factor_ps = 1.0; // persistent diffusion factor for o2 (unitless)
    this.dif_co2_factor_ps = 1.0; // persistent diffusion factor for co2 (unitless)
    this.dif_solutes_factor_ps = 1.0; // persistent diffusion factor for solutes (unitless)

    // scaling factors
    this.dif_o2_factor_scaling = 1.0; // scaling factor for the o2 diffusion factor (unitless)
    this.dif_co2_factor_scaling = 1.0; // scaling factor for the co2 diffusion factor (unitless)
    this.dif_solutes_factor_scaling = 1.0; // scaling factor for the solute diffusion factor (unitless)
  
    // dependent properties
    this.dif_o2_step = 0.0; // state variable for the o2 diffusion (mmol)
    this.dif_co2_step = 0.0; // state variable for the co2 diffusion (mmol)

    // local variables
    this._comp_blood1 = null; // reference to the first blood-containing model
    this._comp_blood2 = null; // reference to the second blood-containing model
  }

  calc_model() {
    // find the two blood-containing models and store references
    this._comp_blood1 = this._model_engine.models[this.comp_blood1];
    this._comp_blood2 = this._model_engine.models[this.comp_blood2];

    // calculate the blood composition of the blood components in this diffusor as we need the partial pressures for the gas diffusion
    calc_blood_composition(this._comp_blood1);
    calc_blood_composition(this._comp_blood2);

    // incorporate the factors
    this.dif_o2_step = this.dif_o2
        + (this.dif_o2_factor - 1) * this.dif_o2
        + (this.dif_o2_factor_ps - 1) * this.dif_o2
        + (this.dif_o2_factor_scaling - 1) * this.dif_o2;

    this.dif_co2_step = this.dif_co2
        + (this.dif_co2_factor - 1) * this.dif_co2
        + (this.dif_co2_factor_ps - 1) * this.dif_co2
        + (this.dif_co2_factor_scaling - 1) * this.dif_co2;

    let solutes_step = 1.0
        + (this.dif_solutes_factor - 1)
        + (this.dif_solutes_factor_ps - 1)
        + (this.dif_solutes_factor_scaling - 1);

    // diffuse the gases, where diffusion is partial pressure-driven
    let do2 = (this._comp_blood1.po2 - this._comp_blood2.po2) * this.dif_o2_step * this._t;

    // update the concentrations (skip a fixed-composition or empty compartment)
    if (!this._comp_blood1.fixed_composition && this._comp_blood1.vol > 0.0) {
      this._comp_blood1.to2 = (this._comp_blood1.to2 * this._comp_blood1.vol - do2) / this._comp_blood1.vol;
    }
    if (!this._comp_blood2.fixed_composition && this._comp_blood2.vol > 0.0) {
      this._comp_blood2.to2 = (this._comp_blood2.to2 * this._comp_blood2.vol + do2) / this._comp_blood2.vol;
    }

    let dco2 = (this._comp_blood1.pco2 - this._comp_blood2.pco2) * this.dif_co2_step * this._t;
    // update the concentrations
    if (!this._comp_blood1.fixed_composition && this._comp_blood1.vol > 0.0) {
      this._comp_blood1.tco2 = (this._comp_blood1.tco2 * this._comp_blood1.vol - dco2) / this._comp_blood1.vol;
    }
    if (!this._comp_blood2.fixed_composition && this._comp_blood2.vol > 0.0) {
      this._comp_blood2.tco2 = (this._comp_blood2.tco2 * this._comp_blood2.vol + dco2) / this._comp_blood2.vol;
    }

    // diffuse the solutes, where the diffusion is concentration gradient-driven
    Object.keys(this.dif_solutes).forEach((sol) => {
      let dif = this.dif_solutes[sol] * solutes_step;
      let dsol = (this._comp_blood1.solutes[sol] - this._comp_blood2.solutes[sol]) * dif * this._t;
      // update the concentration
      if (!this._comp_blood1.fixed_composition && this._comp_blood1.vol > 0.0) {
        this._comp_blood1.solutes[sol] = (this._comp_blood1.solutes[sol] * this._comp_blood1.vol - dsol) / this._comp_blood1.vol;
      }
      if (!this._comp_blood2.fixed_composition && this._comp_blood2.vol > 0.0) {
        this._comp_blood2.solutes[sol] = (this._comp_blood2.solutes[sol] * this._comp_blood2.vol + dsol) / this._comp_blood2.vol;
      }
    });

    // reset the non-persistent factors
    this.dif_o2_factor = 1.0;
    this.dif_co2_factor = 1.0;
    this.dif_solutes_factor = 1.0;
  }
}

```

### FILE: explain/base_models/Capacitance.js

```javascript
import { BaseModelClass } from "./BaseModelClass";

export class Capacitance extends BaseModelClass {
  // static properties
  static model_type = "Capacitance";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties
    this.u_vol = 0.0; // unstressed volume UV (L)
    this.el_base = 0.0; // baseline elastance E (mmHg/L)
    this.el_k = 0.0; // non-linear elastance factor K2 (unitless)
    this.pres_ext = 0.0; // non persistent external pressure p2(t) (mmHg)
    this.fixed_composition = false;

    // non-persistent property factors. These factors reset to 1.0 after each model step
    this.u_vol_factor = 1.0; // non-persistent unstressed volume factor step (unitless)
    this.el_base_factor = 1.0; // non-persistent elastance factor step (unitless)
    this.el_k_factor = 1.0; // non-persistent elastance factor step (unitless)

    // persistent property factors. These factors are persistent and do not reset
    this.u_vol_factor_ps = 1.0;  // persistent unstressed volume factor (unitless)
    this.el_base_factor_ps = 1.0; // persistent elastance factor (unitless)
    this.el_k_factor_ps = 1.0; // persistent elastance factor (unitless)

    // persistent scaling factors
    this.u_vol_factor_scaling_ps = 1.0;
    this.el_base_factor_scaling_ps = 1.0;
    this.el_k_factor_scaling_ps = 1.0;

    // initialize dependent properties
    this.vol = 0.0; // volume v(t) (L)
    this.pres = 0.0; // pressure p1(t) (mmHg)
    this.pres_in = 0.0; // recoil pressure of the elastance (mmHg)
    this.pres_tm = 0.0; // transmural pressure (mmHg)

    // local variables
    this.el_eff = 0.0; // calculated elastance (mmHg/L)
    this.u_vol_eff = 0.0; // calculated unstressed volume (L)
    this.el_k_eff = 0.0; // calculated elastance non-linear k (unitless)
  }

  // this routine is called in every model step by the ModelEngine Class
  calc_model() {
    // first calculate the current elastances and volumes
    this.calc_elastances();
    this.calc_volumes();
    // then calculate the pressure
    this.calc_pressure();
  }

  calc_elastances() {
    // calculate the elastance and non-linear elastance incorparting the factors
    this.el_eff = this.el_base 
        + (this.el_base_factor - 1) * this.el_base
        + (this.el_base_factor_ps - 1) * this.el_base
        + (this.el_base_factor_scaling_ps - 1) * this.el_base

    this.el_k_eff = this.el_k 
        + (this.el_k_factor - 1) * this.el_k
        + (this.el_k_factor_ps - 1) * this.el_k
        + (this.el_k_factor_scaling_ps - 1) * this.el_k

    // reset the non persistent factors
    this.el_base_factor = 1.0;
    this.el_k_factor = 1.0;
  }

  calc_volumes() {
    // calculate the unstressed volume incorporating the factors
    this.u_vol_eff = this.u_vol 
        + (this.u_vol_factor - 1) * this.u_vol
        + (this.u_vol_factor_ps - 1) * this.u_vol
        + (this.u_vol_factor_scaling_ps - 1) * this.u_vol

    // reset the non persistent factors
    this.u_vol_factor = 1.0;
  }
  
  calc_pressure() {
    // calculate the recoil pressure
    this.pres_in = this.el_k_eff * Math.pow(this.vol - this.u_vol_eff, 2) + this.el_eff * (this.vol - this.u_vol_eff);

    // calculate the transmural pressure
    this.pres_tm = this.pres_in - this.pres_ext;

    // calculate the total pressure by incorporating the external pressures
    this.pres = this.pres_in + this.pres_ext;

    // reset the external pressures
    this.pres_ext = 0.0;
  }

  volume_in(dvol) {
    if (!this.fixed_composition) {
      // add volume to the capacitance
      this.vol += dvol;
    }

    // return if the volume is zero or lower
    if (this.vol <= 0.0) return;
  }

  volume_out(dvol) {
    if (!this.fixed_composition) {
      // remove volume from capacitance
      this.vol -= dvol;
    }

    // if the volume is zero or lower, handle it
    if (this.vol < 0.0) {
      let _vol_not_removed = -this.vol;
      // reset the volume to zero.
      this.vol = 0.0;
      // return the volume that was not removed
      return _vol_not_removed;
    }

    // return zero as all volume is removed
    return 0.0;
  }
}

```

### FILE: explain/base_models/Container.js

```javascript
import { BaseModelClass } from "./BaseModelClass";

export class Container extends BaseModelClass {
  // static properties
  static model_type = "Container";

  constructor(model_ref, name = "") {
    // call the constructor of the parent class
    super(model_ref, name);

    // initialize independent properties
    this.u_vol = 0.0; // unstressed volume UV (L)
    this.el_base = 0.0; // baseline elastance E (mmHg/L)
    this.el_k = 0.0; // non-linear elastance factor K2 (unitless)
    this.pres_ext = 0.0; // non persistent external pressure p2(t) (mmHg)
    this.vol_extra = 0.0; // additional volume of the container (L)
    this.contained_components = []; // list of names of models this Container contains

    // non-persistent property factors. These factors reset to 1.0 after each model step
    this.u_vol_factor = 1.0; // non-persistent unstressed volume factor step (unitless)
    this.el_base_factor = 1.0; // non-persistent elastance factor step (unitless)
    this.el_k_factor = 1.0; // non-persistent elastance factor step (unitless)

    // persistent property factors. These factors are persistent and do not reset
    this.u_vol_factor_ps = 1.0;  // persistent unstressed volume factor (unitless)
    this.el_base_factor_ps = 1.0; // persistent elastance factor (unitless)
    this.el_k_factor_ps = 1.0; // persistent elastance factor (unitless)

    // scaling factors. These factors are persistent and do not reset, but they also scale the effect of the other factors instead of being added to them
    this.u_vol_factor_scaling_ps = 1.0;
    this.el_base_factor_scaling_ps = 1.0;
    this.el_k_factor_scaling_ps = 1.0;

    // initialize dependent properties
    this.vol = 0.0; // volume v(t) (L)
    this.pres = 0.0; // pressure p1(t) (mmHg)
    this.pres_in = 0.0; // recoil pressure of the elastance (mmHg)
    this.pres_tm = 0.0; // transmural pressure (mmHg)

    // local variables
    this.el_eff = 0.0; // calculated elastance (mmHg/L)
    this.u_vol_eff = 0.0; // calculated unstressed volume (L)
    this.el_k_eff = 0.0; // calculated elastance non-linear k (unitless)
  }

  calc_model() {
    // first calculate the current elastances and volumes
    this.calc_elastances();
    this.calc_volumes();
    
    // then calculate the pressure
    this.calc_pressure();
  }

  calc_elastances() {
    // calculate the elastance and non-linear elastance incorparting the factors
    this.el_eff = this.el_base 
        + (this.el_base_factor - 1) * this.el_base
        + (this.el_base_factor_ps - 1) * this.el_base
        + (this.el_base_factor_scaling_ps - 1) * this.el_base;

    this.el_k_eff = this.el_k 
        + (this.el_k_factor - 1) * this.el_k
        + (this.el_k_factor_ps - 1) * this.el_k
        + (this.el_k_factor_scaling_ps - 1) * this.el_k;

    // reset the non persistent factors
    this.el_base_factor = 1.0;
    this.el_k_factor = 1.0;
  }

  calc_volumes() {
    // reset the starting volume to the additional volume of the container
    this.vol = this.vol_extra;

    // get the cumulative volume from all contained models and add it to the volume of the container.
    // skip missing components (bad/typo'd name) and disabled ones (they don't participate)
    this.contained_components.forEach((c) => {
      const m = this._model_engine.models[c];
      if (m && m.is_enabled) {
        this.vol += m.vol;
      }
    });
    
    // calculate the unstressed volume incorporating the factors
    this.u_vol_eff = this.u_vol 
        + (this.u_vol_factor - 1) * this.u_vol
        + (this.u_vol_factor_ps - 1) * this.u_vol
        + (this.u_vol_factor_scaling_ps - 1) * this.u_vol;

    // reset the non persistent factors
    this.u_vol_factor = 1.0;
  }

  calc_pressure() {
    // calculate the recoil pressure
    this.pres_in = this.el_k_eff * Math.pow(this.vol - this.u_vol_eff, 2) + this.el_eff * (this.vol - this.u_vol_eff);

    // calculate the transmural pressure
    this.pres_tm = this.pres_in - this.pres_ext;

    // calculate the total pressure by incorporating the external pressures
    this.pres = this.pres_in + this.pres_ext;

    // transfer the container pressure to the contained components. Skip missing components and
    // disabled ones — a disabled component never runs its calc_pressure to reset pres_ext, so
    // adding to it here would accumulate unbounded until it is re-enabled.
    this.contained_components.forEach((c) => {
      const m = this._model_engine.models[c];
      if (m && m.is_enabled) {
        m.pres_ext += this.pres;
      }
    });

    // reset the external pressure
    this.pres_ext = 0.0;
  }
}

```

### FILE: explain/base_models/GasDiffusor.js

```javascript
import { BaseModelClass } from "./BaseModelClass";

export class GasDiffusor extends BaseModelClass {
  // static properties
  static model_type = "GasDiffusor";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties
    this.comp_gas1 = ""; // name of the first gas-containing model
    this.comp_gas2 = ""; // name of the second gas-containing model
    this.dif_o2 = 0.01; // diffusion constant for o2 (mmol/mmHg * s)
    this.dif_co2 = 0.01; // diffusion constant for co2 (mmol/mmHg * s)
    this.dif_n2 = 0.01; // diffusion constant for n2 (mmol/mmHg * s)
    this.dif_other = 0.01; // diffusion constant for n2 (mmol/mmHg * s)

    // non-persistent property factors. These factors reset to 1.0 after each model step
    this.dif_o2_factor = 1.0; // non-persistent diffusion factor for o2 (unitless)
    this.dif_co2_factor = 1.0; // non-persistent diffusion factor for co2 (unitless)
    this.dif_n2_factor = 1.0; // non-persistent diffusion factor for n2 (unitless)
    this.dif_other_factor = 1.0; // non-persistent diffusion factor for other gasses (unitless)

    // persistent property factors. These factors are persistent and do not reset
    this.dif_o2_factor_ps = 1.0; // persistent diffusion factor for o2 (unitless)
    this.dif_co2_factor_ps = 1.0; // persistent diffusion factor for co2 (unitless)
    this.dif_n2_factor_ps = 1.0; // persistent diffusion factor for n2 (unitless)
    this.dif_other_factor_ps = 1.0; // persistent diffusion factor for other gasses (unitless)

    // scaling factors. These factors are persistent and do not reset, but they are applied as scaling factors to the diffusion factors, meaning that they apply to the total diffusion factor after applying the non-persistent and persistent factors
    this.dif_o2_factor_scaling = 1.0;
    this.dif_co2_factor_scaling = 1.0;
    this.dif_n2_factor_scaling = 1.0;
    this.dif_other_factor_scaling = 1.0;

    // local variables
    this._comp_gas1 = null; // reference to the first gas-containing model
    this._comp_gas2 = null; // reference to the second gas-containing model
    this.dif_o2_step = 0.0; // state variable for the o2 diffusion (mmol)
    this.dif_co2_step = 0.0; // state variable for the co2 diffusion (mmol)
    this.dif_n2_step = 0.0; // state variable for the n2 diffusion (mmol)
    this.dif_other_step = 0.0; // state variable for the other gasses diffusion (mmol)
  }

  calc_model() {
    // find the two gas-containing models and store references
    this._comp_gas1 = this._model_engine.models[this.comp_gas1];
    this._comp_gas2 = this._model_engine.models[this.comp_gas2];

    // refresh the partial pressures of both gas compartments from their current concentrations,
    // as we need the partial pressures for the gas diffusion. Use the GasCapacitance method (which
    // derives partials from the actual concentrations) — NOT the standalone calc_gas_composition
    // initializer, which would reset both compartments to a fixed (room-air) composition.
    this._comp_gas1.calc_gas_composition();
    this._comp_gas2.calc_gas_composition();

    // incorporate the factors
    this.dif_o2_step = this.dif_o2
        + (this.dif_o2_factor - 1) * this.dif_o2
        + (this.dif_o2_factor_ps - 1) * this.dif_o2
        + (this.dif_o2_factor_scaling - 1) * this.dif_o2;

    this.dif_co2_step = this.dif_co2
        + (this.dif_co2_factor - 1) * this.dif_co2
        + (this.dif_co2_factor_ps - 1) * this.dif_co2
        + (this.dif_co2_factor_scaling - 1) * this.dif_co2;

    this.dif_n2_step = this.dif_n2
        + (this.dif_n2_factor - 1) * this.dif_n2
        + (this.dif_n2_factor_ps - 1) * this.dif_n2
        + (this.dif_n2_factor_scaling - 1) * this.dif_n2;

    this.dif_other_step = this.dif_other
        + (this.dif_other_factor - 1) * this.dif_other
        + (this.dif_other_factor_ps - 1) * this.dif_other
        + (this.dif_other_factor_scaling - 1) * this.dif_other;

    // diffuse the gases, where diffusion is partial pressure-driven. Each concentration write is
    // guarded by fixed_composition so a fixed (infinite-reservoir) compartment stays constant,
    // mirroring BloodDiffusor.
    let do2 = (this._comp_gas1.po2 - this._comp_gas2.po2) * this.dif_o2_step * this._t;
    if (!this._comp_gas1.fixed_composition && this._comp_gas1.vol > 0.0) {
      this._comp_gas1.co2 = (this._comp_gas1.co2 * this._comp_gas1.vol - do2) / this._comp_gas1.vol;
    }
    if (!this._comp_gas2.fixed_composition && this._comp_gas2.vol > 0.0) {
      this._comp_gas2.co2 = (this._comp_gas2.co2 * this._comp_gas2.vol + do2) / this._comp_gas2.vol;
    }

    let dco2 = (this._comp_gas1.pco2 - this._comp_gas2.pco2) * this.dif_co2_step * this._t;
    if (!this._comp_gas1.fixed_composition && this._comp_gas1.vol > 0.0) {
      this._comp_gas1.cco2 = (this._comp_gas1.cco2 * this._comp_gas1.vol - dco2) / this._comp_gas1.vol;
    }
    if (!this._comp_gas2.fixed_composition && this._comp_gas2.vol > 0.0) {
      this._comp_gas2.cco2 = (this._comp_gas2.cco2 * this._comp_gas2.vol + dco2) / this._comp_gas2.vol;
    }

    let dn2 = (this._comp_gas1.pn2 - this._comp_gas2.pn2) * this.dif_n2_step * this._t;
    if (!this._comp_gas1.fixed_composition && this._comp_gas1.vol > 0.0) {
      this._comp_gas1.cn2 = (this._comp_gas1.cn2 * this._comp_gas1.vol - dn2) / this._comp_gas1.vol;
    }
    if (!this._comp_gas2.fixed_composition && this._comp_gas2.vol > 0.0) {
      this._comp_gas2.cn2 = (this._comp_gas2.cn2 * this._comp_gas2.vol + dn2) / this._comp_gas2.vol;
    }

    let dother = (this._comp_gas1.pother - this._comp_gas2.pother) * this.dif_other_step * this._t;
    if (!this._comp_gas1.fixed_composition && this._comp_gas1.vol > 0.0) {
      this._comp_gas1.cother = (this._comp_gas1.cother * this._comp_gas1.vol - dother) / this._comp_gas1.vol;
    }
    if (!this._comp_gas2.fixed_composition && this._comp_gas2.vol > 0.0) {
      this._comp_gas2.cother = (this._comp_gas2.cother * this._comp_gas2.vol + dother) / this._comp_gas2.vol;
    }

    // reset the non-persistent factors
    this.dif_o2_factor = 1.0;
    this.dif_co2_factor = 1.0;
    this.dif_n2_factor = 1.0;
    this.dif_other_factor = 1.0;

  }
}

```

### FILE: explain/base_models/GasExchanger.js

```javascript
import { BaseModelClass } from "./BaseModelClass";
import { calc_blood_composition } from "../component_models/BloodComposition"

export class GasExchanger extends BaseModelClass {
  // static properties
  static model_type = "GasExchanger";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties
    this.comp_blood = ""; // name of the blood component
    this.comp_gas = ""; // name of the gas component
    this.dif_o2 = 0.0; // diffusion constant for oxygen (mmol/mmHg * s)
    this.dif_co2 = 0.0; // diffusion constant for carbon dioxide (mmol/mmHg * s)

    // non-persistent factors
    this.dif_o2_factor = 1.0; // factor modifying the oxygen diffusion constant
    this.dif_co2_factor = 1.0; // factor modifying the carbon diffusion constant

    // persistent factors
    this.dif_o2_factor_ps = 1.0; // factor modifying the oxygen diffusion constant
    this.dif_co2_factor_ps = 1.0; // factor modifying the carbon diffusion constant

    // scaling factor
    this.dif_o2_factor_scaling = 1.0; // scaling factor for the oxygen diffusion constant
    this.dif_co2_factor_scaling = 1.0; // scaling factor for the carbon diffusion constant
    
    // dependent properties
    this.flux_o2 = 0.0; // oxygen flux (mmol)
    this.flux_co2 = 0.0; // carbon dioxide flux (mmol)

    // local variables
    this._blood = null; // reference to the blood component
    this._gas = null; // reference to the gas component
    this.dif_o2_step = 0.0; // state variable for the o2 diffusion (mmol)
    this.dif_co2_step = 0.0; // state variable for the co2 diffusion (mmol)
  }

  calc_model() {
    // find the blood and gas components
    this._blood = this._model_engine.models[this.comp_blood];
    this._gas = this._model_engine.models[this.comp_gas];

    // set the blood composition of the blood component
    calc_blood_composition(this._blood);

    // get the partial pressures and gas concentrations from the components
    let po2_blood = this._blood.po2;
    let pco2_blood = this._blood.pco2;
    let to2_blood = this._blood.to2;
    let tco2_blood = this._blood.tco2;

    let co2_gas = this._gas.co2;
    let cco2_gas = this._gas.cco2;
    let po2_gas = this._gas.po2;
    let pco2_gas = this._gas.pco2;

    // guard against division by zero on either compartment (both volumes are used as denominators)
    if (this._blood.vol <= 0.0 || this._gas.vol <= 0.0) return;

    // incorporate the factors
    this.dif_o2_step = this.dif_o2 
        + (this.dif_o2_factor - 1) * this.dif_o2
        + (this.dif_o2_factor_ps - 1) * this.dif_o2
        + (this.dif_o2_factor_scaling - 1) * this.dif_o2; // apply scaling factor to the diffusion factor

    this.dif_co2_step = this.dif_co2 
        + (this.dif_co2_factor - 1) * this.dif_co2
        + (this.dif_co2_factor_ps - 1) * this.dif_co2
        + (this.dif_co2_factor_scaling - 1) * this.dif_co2; // apply scaling factor to the diffusion factor


    // calculate the O2 flux from the blood to the gas compartment
    this.flux_o2 = (po2_blood - po2_gas) * this.dif_o2_step * this._t;

    // calculate the new O2 concentrations of the gas and blood compartments
    let new_to2_blood = (to2_blood * this._blood.vol - this.flux_o2) / this._blood.vol;
    if (new_to2_blood < 0) new_to2_blood = 0.0;

    let new_co2_gas = (co2_gas * this._gas.vol + this.flux_o2) / this._gas.vol;
    if (new_co2_gas < 0) new_co2_gas = 0.0;

    // calculate the CO2 flux from the blood to the gas compartment
    this.flux_co2 = (pco2_blood - pco2_gas) * this.dif_co2_step * this._t;

    // calculate the new CO2 concentrations of the gas and blood compartments
    let new_tco2_blood = (tco2_blood * this._blood.vol - this.flux_co2) / this._blood.vol;
    if (new_tco2_blood < 0) new_tco2_blood = 0.0;

    let new_cco2_gas = (cco2_gas * this._gas.vol + this.flux_co2) / this._gas.vol;
    if (new_cco2_gas < 0) new_cco2_gas = 0.0;

    // transfer the new concentrations, guarding each compartment by fixed_composition so a fixed
    // (infinite-reservoir) compartment stays constant, mirroring BloodDiffusor/GasDiffusor
    if (!this._blood.fixed_composition) {
      this._blood.to2 = new_to2_blood;
      this._blood.tco2 = new_tco2_blood;
    }
    if (!this._gas.fixed_composition) {
      this._gas.co2 = new_co2_gas;
      this._gas.cco2 = new_cco2_gas;
    }

    // reset the non-persistent factors
    this.dif_o2_factor = 1.0;
    this.dif_co2_factor = 1.0;
  }
}

```

### FILE: explain/base_models/Resistor.js

```javascript
import { BaseModelClass } from "./BaseModelClass";

export class Resistor extends BaseModelClass {
  // static properties
  static model_type = "Resistor";

  constructor(model_ref, name = "") {
    // call the constructor of the parent class
    super(model_ref, name);

    // initialize independent properties
    this.r_for = 1.0; // forward flow resistance Rf (mmHg*s/l)
    this.r_back = 1.0; // backward flow resistance Rb (mmHg*s/l )
    this.r_k = 0.0; // non-linear resistance coefficient K1 (unitless)
    this.comp_from = ""; // holds the name of the upstream component
    this.comp_to = ""; // holds the name of the downstream component
    this.no_flow = false; // flags whether flow is allowed across this resistor
    this.no_back_flow = false; // flags whether backflow is allowed across this resistor
    this.p1_ext = 0.0; // external pressure on the inlet (mmHg)
    this.p2_ext = 0.0; // external pressure on the outlet (mmHg)
    this.fixed_composition = false;
    this.is_externally_managed = false; // flag read by owning models to skip their own flow calc

    // non-persistent property factors. These factors reset to 1.0 after each model step
    this.r_factor = 1.0; // non-persistent resistance factor
    this.r_k_factor = 1.0; // non-persistent non-linear coefficient factor

     // persistent property factors. These factors are persistent and do not reset
    this.r_factor_ps = 1.0; //  persistent resistance factor
    this.r_k_factor_ps = 1.0; // persistent non-linear coefficient factor

    // scaling factors
    this.r_factor_scaling_ps = 1.0; // persistent scaling factor for the resistance
    this.r_k_factor_scaling_ps = 1.0; // persistent scaling factor for the non-linear coefficient

    // initialize dependent properties
    this.flow = 0.0;  // flow f(t) (L/s)
    
    // local variables
    this._comp_from = {}; // holds a reference to the upstream component
    this._comp_to = {}; // holds a reference to the downstream component
    this.r_for_eff = 1000;  // calculated forward resistance (mmHg/L*s)
    this.r_back_eff = 1000; // calculated backward resistance (mmHg/L*s)
    this.r_k_eff = 0; // calculated non-linear resistance factor (unitless)
    this._prev_flow = 0.0; // flow from previous model step (L/s)
  }

  // this routine is called in every model step by the ModelEngine Class
  calc_model() {
    // find the up- and downstream components and store the references
    this._comp_from = this._model_engine.models[this.comp_from];
    this._comp_to = this._model_engine.models[this.comp_to];

    // calculate the resistances
    this.calc_resistance();

    // calculate the flow
    this.calc_flow();
  }

  // calculate resistance
  calc_resistance() {
       // incorporate all factors influencing this resistor
       this.r_for_eff = this.r_for 
          + (this.r_factor - 1) * this.r_for
          + (this.r_factor_ps - 1) * this.r_for
          + (this.r_factor_scaling_ps - 1) * this.r_for; // apply scaling factor to the forward resistance

       this.r_back_eff = this.r_back 
          + (this.r_factor - 1) * this.r_back
          + (this.r_factor_ps - 1) * this.r_back
          + (this.r_factor_scaling_ps - 1) * this.r_back; // apply scaling factor to the backward resistance

       this.r_k_eff = this.r_k 
          + (this.r_k_factor - 1) * this.r_k
          + (this.r_k_factor_ps - 1) * this.r_k
          + (this.r_k_factor_scaling_ps - 1) * this.r_k; // apply scaling factor to the non-linear coefficient

      // reset the non persistent factors
      this.r_factor = 1.0;
      this.r_k_factor = 1.0;
  }

  calc_flow() {
    // get the pressure of the volume containing compartments and incorporate the external pressures
    let _p1_t = this._comp_from.pres + this.p1_ext;
    let _p2_t = this._comp_to.pres + this.p2_ext;

    // reset the external pressures
    this.p1_ext = 0.0;
    this.p2_ext = 0.0;

    // reset the current flow
    this.flow = 0.0;

    // return if no flow is allowed across this resistor
    if (this.no_flow) {
      this._prev_flow = 0.0;
      // return from this function
      return;
    }

    // calculate the forward flow between two components
    if (_p1_t >= _p2_t) {
      // guard against a non-positive resistance (would produce Infinity/NaN flow)
      if (this.r_for_eff <= 0.0) {
        this._prev_flow = 0.0;
        return;
      }
      // calculate the forward flow. The non-linear term uses the previous step's flow (explicit
      // lagged scheme) — not this.flow, which was just reset to 0 above.
      this.flow = (_p1_t - _p2_t - this.r_k_eff * Math.pow(this._prev_flow, 2)) / this.r_for_eff;

      // update the volumes of the connected components but do not remove the volume which could not be removed from the upstream component (to prevent volume loss)
      const vol_not_removed = this._comp_from.volume_out(this.flow * this._t);
      this._comp_to.volume_in(this.flow * this._t - vol_not_removed, this._comp_from);

      // store the previous flow
      this._prev_flow = this.flow;
      
      // return from this function
      return;
    }

    // calculate the backward flow between two components
    if (_p1_t < _p2_t && !this.no_back_flow) {
      // guard against a non-positive resistance (would produce Infinity/NaN flow)
      if (this.r_back_eff <= 0.0) {
        this._prev_flow = 0.0;
        return;
      }
      // calculate the backward flow. The non-linear term uses the previous step's flow (explicit
      // lagged scheme) — not this.flow, which was just reset to 0 above.
      this.flow = (_p1_t - _p2_t + this.r_k_eff * Math.pow(this._prev_flow, 2)) / this.r_back_eff;

      // update the volumes of the connected components but do not remove the volume which could not be removed from the upstream component (to prevent volume loss)
      let vol_not_removed = this._comp_to.volume_out(-this.flow * this._t);
      this._comp_from.volume_in(-this.flow * this._t - vol_not_removed,this._comp_to);

      // store the previous flow
      this._prev_flow = this.flow;

      // return from this function
      return;
    }

    // reached only when p1 < p2 and backflow is blocked: no flow occurred this step,
    // so clear the stored flow to keep the non-linear term consistent next step
    this._prev_flow = 0.0;
  }
}

```

### FILE: explain/base_models/TimeVaryingElastance.js

```javascript
import { BaseModelClass } from "./BaseModelClass";

export class TimeVaryingElastance extends BaseModelClass {
  // static properties
  static model_type = "TimeVaryingElastance";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties
    this.u_vol = 0.0; // unstressed volume UV (L)
    this.el_min = 0.0; // minimal elastance Emin (mmHg/L)
    this.el_max = 0.0; // maximal elastance emax(n) (mmHg/L)
    this.el_k = 0.0; // non-linear elastance coefficient K2 (unitless)
    this.pres_ext = 0.0; // non persistent external pressure p2(t) (mmHg)
    this.act_factor = 0.0; // activation factor from the heart model (unitless)

    // non-persistent property factors. These factors reset to 1.0 after each model step
    this.u_vol_factor = 1.0; // non-persistent unstressed volume factor step (unitless)
    this.el_min_factor = 1.0; // non-persistent minimal elastance factor step (unitless)
    this.el_max_factor = 1.0; // non-persistent maximal elastance factor step (unitless)
    this.el_k_factor = 1.0; // non-persistent elastance factor step (unitless)

    // persistent property factors. These factors are persistent and do not reset
    this.u_vol_factor_ps = 1.0; // persistent unstressed volume factor (unitless)
    this.el_min_factor_ps = 1.0; // persistent minimal elastance factor (unitless)
    this.el_max_factor_ps = 1.0; // persistent maximal elastance factor (unitless)
    this.el_k_factor_ps = 1.0; // persistent elastance factor (unitless)

    // scaling factors. These factors are persistent and do not reset
    this.u_vol_factor_scaling_ps = 1.0; // persistent scaling factor for the unstressed volume (unitless)
    this.el_min_factor_scaling_ps = 1.0; // persistent scaling factor for the minimal elastance (unitless)
    this.el_max_factor_scaling_ps = 1.0; // persistent scaling factor for the maximal elastance (unitless)
    this.el_k_factor_scaling_ps = 1.0; // persistent scaling factor for the elastance non-linearity (unitless)

    // initialize dependent properties
    this.vol = 0.0; // volume v(t) (L)
    this.pres = 0.0; // pressure p1(t) (mmHg)
    this.pres_in = 0.0; // recoil pressure of the elastance (mmHg)
    this.pres_tm = 0.0; // transmural pressure (mmHg)

    // local properties
    this.el_min_eff = 0.0; // calculated minimal elastance (mmHg/L)
    this.el_max_eff = 0.0; // calculated maximal elastance (mmHg/L)
    this.u_vol_eff = 0.0; // calculated unstressed volume (L)
    this.el_k_eff = 0.0; // calculated elastance non-linear k (unitless)
  }

  // this routine is called in every model step by the ModelEngine Class
  calc_model() {
    // calculate the elastances and volumes
    this.calc_elastances();
    this.calc_volumes();
    // calculate the pressure
    this.calc_pressure();
  }

  calc_elastances() {    
    // calculate the elastances and non-linear elastance incorparting the factors
    this.el_min_eff = this.el_min 
        + (this.el_min_factor - 1) * this.el_min
        + (this.el_min_factor_ps - 1) * this.el_min
        + (this.el_min_factor_scaling_ps - 1) * this.el_min; // apply scaling factor to the elastance factor
    
    this.el_max_eff = this.el_max 
        + (this.el_max_factor - 1) * this.el_max
        + (this.el_max_factor_ps - 1) * this.el_max
        + (this.el_max_factor_scaling_ps - 1) * this.el_max; // apply scaling factor to the elastance factor

    this.el_k_eff = this.el_k 
        + (this.el_k_factor - 1) * this.el_k
        + (this.el_k_factor_ps - 1) * this.el_k
        + (this.el_k_factor_scaling_ps - 1) * this.el_k; // apply scaling factor to the elastance factor

    // make sure that el_max is not smaller than el_min
    if (this.el_max_eff < this.el_min_eff) {
      this.el_max_eff = this.el_min_eff;
    }
    
    // reset the non persistent factors
    this.el_min_factor = 1.0;
    this.el_max_factor = 1.0;
    this.el_k_factor = 1.0;
  }

  calc_volumes() {
    // calculate the unstressed volume incorporating the factors
    this.u_vol_eff = this.u_vol 
        + (this.u_vol_factor - 1) * this.u_vol
        + (this.u_vol_factor_ps - 1) * this.u_vol
        + (this.u_vol_factor_scaling_ps - 1) * this.u_vol; // apply scaling factor to the unstressed volume

    // reset the non persistent factors
    this.u_vol_factor = 1.0;
  }

  calc_pressure() {
    // calculate the recoil pressure
    let p_ms = (this.vol - this.u_vol_eff) * this.el_max_eff;
    let p_ed = this.el_k_eff * Math.pow(this.vol - this.u_vol_eff, 2) + this.el_min_eff * (this.vol - this.u_vol_eff);

    // calculate the current recoil pressure
    this.pres_in = (p_ms - p_ed) * this.act_factor + p_ed;

    // calculate the total pressure by incorporating the external pressures
    this.pres = this.pres_in + this.pres_ext

    // calculate the transmural pressure
    this.pres_tm = this.pres_in - this.pres_ext;

    // reset the external pressure
    this.pres_ext = 0.0;
  }

  // override the volume_in method
  volume_in(dvol, comp_from) {
    // add volume to the capacitance
    this.vol += dvol;

    // return if the volume is zero or lower
    if (this.vol <= 0.0) return;
  }

  volume_out(dvol) {
    // remove volume from capacitance
    this.vol -= dvol;

    // if the volume is zero or lower, handle it
    if (this.vol < 0.0 && this.vol < this.u_vol) {
      let _vol_not_removed = -this.vol;
      // reset the volume to zero.
      this.vol = 0.0;
      // return the volume that was not removed
      return _vol_not_removed;
    }

    // return zero as all volume is removed
    return 0.0;
  }
}

```

### FILE: explain/component_models/Ans.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";
import { calc_blood_composition } from "./BloodComposition";

export class Ans extends BaseModelClass {
  // static properties
  static model_type = "Ans";

  constructor(model_ref, name = "") {
    // initialize the parent class
    super(model_ref, name);

    // initialize independent properties
    this.ans_active = true; // flag whether the ANS is active
    this.components = {}
    this.blood_composition_models= []; // list of models from which the ANS needs to calculate blood gases

    // initialize local properties
    this._update_interval = 0.05; // update interval of the ANS (seconds)
    this._update_counter = 0.0; // update counter (seconds)
   
  }

  calc_model() {
    // Increase the update counter
    this._update_counter += this._t;

    // Check if it's time to run the calculations
    if (this._update_counter >= this._update_interval) {
      // Reset the update counter
      this._update_counter = 0.0;

      // switch through all components
      Object.keys(this.components).forEach(component => 
        {
          this._model_engine.models[component].ans_active = this.ans_active;
        }
      );

      // calculate the necessary blood compositions
      this.blood_composition_models.forEach(model => {
        let m = this._model_engine.models[model];
        if (m.ans_active) {
          calc_blood_composition(m);
        }
      });
    }
  }
}

```

### FILE: explain/component_models/AnsAfferent.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

export class AnsAfferent extends BaseModelClass {
  // static properties
  static model_type = "AnsAfferent";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // Initialize independent properties
    this.input_model = ""; // name of the input model
    this.input_prop = ""; // name of the input prop
    this.efferents = []; // list of efferents that are connected to this afferent
    this.effect_weight = 1.0; // weight of the effect of this afferent on the efferents
    this.min_value = 0.0; // minimum of the input (firing rate is 0.0)
    this.set_value = 0.0; // setpoint of the input (firing rate is 0.5)
    this.max_value = 0.0; // maximum of the input (firing rate is 1.0)
    this.tc = 1.0; // time constant of the firing rate change (s)
    this.ans_active = true; // whether the afferent is active and can influence the efferents
    
    // Initialize dependent properties
    this.input_value = 0.0; // input value
    this.firing_rate = 0.0; // normalized receptor firing rate (0 - 1)

    // Initialize local properties
    this._update_interval = 0.015; // update interval of the receptor (s)
    this._update_counter = 0.0; // counter of the update interval (s)
    this._max_firing_rate = 1.0; // maximum normalized firing rate 1.0
    this._set_firing_rate = 0.5; // setpoint normalized firing rate 0.5
    this._min_firing_rate = 0.0; // minimum normalized firing rate 0.0
    this._gain = 0.0; // gain of the firing rate
  }

  calc_model() {
    // Update every 15 ms instead of every step for performance reasons
    this._update_counter += this._t;
    if (this._update_counter >= this._update_interval) {
      this._update_counter = 0.0;

      // Get the input value (skip this update if the input model is not present)
      const _input = this._model_engine.models[this.input_model];
      if (!_input) return;
      this.input_value = _input[this.input_prop];

      // Calculate the activation value
      let _activation = 0;
      if (this.input_value > this.max_value) {
        _activation = this.max_value - this.set_value;
      } else if (this.input_value < this.min_value) {
        _activation = this.min_value - this.set_value;
      } else {
        _activation = this.input_value - this.set_value;
      }

      // Calculate the gain (guard against zero-range input windows)
      if (_activation > 0) {
        const _pos_range = this.max_value - this.set_value;
        this._gain = _pos_range !== 0
          ? (this._max_firing_rate - this._set_firing_rate) / _pos_range
          : 0.0;
      } else {
        const _neg_range = this.set_value - this.min_value;
        this._gain = _neg_range !== 0
          ? (this._set_firing_rate - this._min_firing_rate) / _neg_range
          : 0.0;
      }

      // Calculate the new firing rate
      const _new_firing_rate = this._set_firing_rate + this._gain * _activation;

      // Incorporate the time constant to calculate the firing rate (guard tc == 0)
      if (this.tc > 0) {
        this.firing_rate = this._update_interval * ((1.0 / this.tc) * (-this.firing_rate + _new_firing_rate)) + this.firing_rate;
      } else {
        this.firing_rate = _new_firing_rate;
      }

      // apply the firing rate to each effector that resolves to a model with an update_effector hook
      this.efferents.forEach((effector) => {
        const _eff = this._model_engine.models[effector];
        if (_eff && typeof _eff.update_effector === "function") {
          // Update the effector with the firing rate and effect weight
          _eff.update_effector(this.firing_rate, this.effect_weight);
        }
      });
      
      
    }
  }
}

```

### FILE: explain/component_models/AnsEfferent.js

```javascript

import { BaseModelClass } from "../base_models/BaseModelClass";

export class AnsEfferent extends BaseModelClass {
  // static properties
  static model_type = "AnsEfferent";
  /*
    The Efferent class models an autonomic nervous system efferent (effect) pathway.
    It calculates the average firing rate and translates it into an effect size on the target.
  */
  constructor(model_ref, name = "") {
    super(model_ref, name);

    // Initialize independent parameters
    this.target_model = ""; // name of the target using dot notation (e.g. Heart.hr_ans_factor)
    this.target_prop = ""; // name of the target using dot notation (e.g. Heart.hr_ans_factor)
    this.effect_at_max_firing_rate = 0.0; // effect size at average input firing rate of 1.0
    this.effect_at_min_firing_rate = 0.0; // effect size at average input firing rate of 0.0
    this.tc = 1.0; // time constant of the effect change (s)
    this.ans_active = true; // whether the efferent is active and can be influenced by the afferents

    // Initialize dependent parameters
    this.firing_rate = 0.0; // firing rate (unitless)
    this.effector = 1.0; // current effector size

    // Initialize local parameters
    this._update_interval = 0.015; // update interval of the effector (s)
    this._update_counter = 0.0; // update counter (s)
    this._cum_firing_rate = 0.0; // cumulative weighted firing-rate deviation since the last update
    this._cum_firing_rate_counter = 0.0; // number of afferent inputs accumulated since the last update
  }


  calc_model() {
    // Update every 15 ms instead of every step for performance reasons
    this._update_counter += this._t;
    if (this._update_counter >= this._update_interval) {
      this._update_counter = 0.0;

      // Determine the average firing rate. The accumulator holds the summed weighted deviations
      // from the 0.5 setpoint; add 0.5 AFTER averaging so the resting firing rate stays 0.5
      // regardless of how many afferents feed this efferent.
      this.firing_rate = 0.5;
      if (this._cum_firing_rate_counter > 0.0) {
        this.firing_rate = 0.5 + this._cum_firing_rate / this._cum_firing_rate_counter;
      }

      // Translate the average firing rate to the effect factor
      let effector;
      if (this.firing_rate >= 0.5) {
        effector = 1.0 + ((this.effect_at_max_firing_rate - 1.0) / 0.5) * (this.firing_rate - 0.5);
      } else {
        effector = this.effect_at_min_firing_rate + ((1.0 - this.effect_at_min_firing_rate) / 0.5) * this.firing_rate;
      }

      // If the ANS is not active, set the effector to 1.0 (no effect)
      if (!this.ans_active) {
        effector = 1.0;
        this.effector = 1.0;
      }

      // Incorporate the time constant for the effector change (guard tc == 0)
      if (this.tc > 0) {
        this.effector = this._update_interval * ((1.0 / this.tc) * (-this.effector + effector)) + this.effector;
      } else {
        this.effector = effector;
      }
      
      // Transfer the effect factor to the target model (skip if the target is not present)
      const _target = this._model_engine.models[this.target_model];
      if (_target) {
        _target[this.target_prop] = this.effector;
      }

      // Reset the accumulator for the next averaging window
      this._cum_firing_rate = 0.0;
      this._cum_firing_rate_counter = 0.0;
    }
  }

  // Update effector firing rate
  update_effector(new_firing_rate, weight) {
    // Increase the firing rate depending on the input and weight
    this._cum_firing_rate += (new_firing_rate - 0.5) * weight;
    this._cum_firing_rate_counter += 1.0;
  }
}
```

### FILE: explain/component_models/Blood.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";
import { calc_blood_composition } from "./BloodComposition"
// ----------------------------------------------------------------------------
export class Blood extends BaseModelClass {
  // static properties
  static model_type = "Blood";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // initialize independent properties
    this.viscosity = 6.0; // blood viscosity (centiPoise = Pa * s)
    this.temp = 37.0; // temperature (dgs C)
    this.to2 = 0.0; // total oxygen concentration (mmol/l)
    this.tco2 = 0.0; // total carbon dioxide concentration (mmol/l)
    this.solutes = {}; // dictionary holding the initial circulating solutes
    this.P50_0 = 20.0; // PO2 at which 50% of Hgb is saturated by O2 (fetal = 18.8 (high Hb O2 affinity), neonatal = 20.0, adult = 26.7)
    this.haldane_coeff = 1.0; // Haldane effect strength (0 = off): lower SO2 raises CO2-carrying capacity
    this.blood_containing_modeltypes = [
      "BloodVessel",
      "HeartChamber",
      "BloodCapacitance",
      "BloodTimeVaryingElastance",
      "BloodPump",
      "MicroVascularUnit"
    ];

    // initialize dependent properties
    this.preductal_art_bloodgas = {}; // dictionary containing the preductal arterial bloodgas
    this.art_bloodgas = {}; // dictionary containing the (postductal) arterial bloodgas
    this.ven_bloodgas = {}; // dictionary containing the venous bloodgas
    this.art_solutes = {}; // dictionary containing the arterial solute concentrations
    
    // initialize local properties (preceded with _)
    this._update_interval = 1.0; // interval at which the calculations are done
    this._update_counter = 0.0; // update counter intermediate
    this._ascending_aorta = null; // reference to ascending aorta model
    this._descending_aorta = null; // reference to descending aorta model
    this._blood_components = [];
  }

  init_model(args = {}) {
    // set the values of the independent properties
    args.forEach((arg) => {
      this[arg["key"]] = arg["value"];
    });

    this._blood_components = [];
    for (const model_name in this._model_engine.models) {
      const model = this._model_engine.models[model_name];
      if (this.blood_containing_modeltypes.includes(model.model_type)) {
        this._blood_components.push(model);
        // propagate the Haldane coefficient to every blood component (outside the bootstrap guard)
        model.haldane_coeff = this.haldane_coeff;
        // only bootstrap composition for freshly-constructed compartments (empty solutes). A
        // restored/loaded state already carries per-compartment composition, so guarding on
        // empty solutes (rather than the to2/tco2==0 proxy) preserves it even when a restored
        // compartment legitimately has to2==0 && tco2==0.
        if (Object.keys(model.solutes).length === 0) {
          model.to2 = this.to2;
          model.tco2 = this.tco2;
          model.solutes = { ...this.solutes };
          model.temp = this.temp;
          model.viscosity = this.viscosity;
        }
      }
    }

    // get the components where we measure the bloodgases
    this._ascending_aorta = this._model_engine.models["AA"];
    this._descending_aorta = this._model_engine.models["AD"];

    // copy the initial arterial solutes
    this.art_solutes = { ...this.solutes };

    // flag that the model is initialized
    this._is_initialized = true;
  }

  calc_model() {

    this._update_counter += this._t;
    if (this._update_counter >= this._update_interval) {
      this._update_counter = 0.0;

      // preductal arterial bloodgas
      calc_blood_composition(this._ascending_aorta);
      this.preductal_art_bloodgas = {
        ph: this._ascending_aorta.ph,
        pco2: this._ascending_aorta.pco2,
        po2: this._ascending_aorta.po2,
        hco3: this._ascending_aorta.hco3,
        be: this._ascending_aorta.be,
        so2: this._ascending_aorta.so2,
      };

      // postductal arterial bloodgas
      calc_blood_composition(this._descending_aorta);
      this.art_bloodgas = {
        ph: this._descending_aorta.ph,
        pco2: this._descending_aorta.pco2,
        po2: this._descending_aorta.po2,
        hco3: this._descending_aorta.hco3,
        be: this._descending_aorta.be,
        so2: this._descending_aorta.so2,
      };

      // venous bloodgas
      calc_blood_composition(this._model_engine.models["IVCI"])
      calc_blood_composition(this._model_engine.models["SVC"])

      // arterial solute concentrations
      this.art_solutes = { ...this._descending_aorta.solutes };
    }
  }

  set_temperature(new_temp, bc_site = "") {
    this.temp = new_temp;
    if (bc_site) {
      this._model_engine.models[bc_site].temp = new_temp;
    } else {
      this._blood_components.forEach((model) => {
        model.temp = new_temp;
      });
    }
    
  }

  set_viscosity(new_viscosity) {
    this.viscosity = new_viscosity;
    this._blood_components.forEach((model) => {
      model.viscosity = new_viscosity;
    });
  }

  set_haldane_coeff(new_coeff) {
    this.haldane_coeff = new_coeff;
    this._blood_components.forEach((model) => {
      model.haldane_coeff = new_coeff;
    });
  }

  set_to2(new_to2, bc_site = "") {
    if (bc_site) {
      this._model_engine.models[bc_site].to2 = new_to2;
    } else {
      this._blood_components.forEach((model) => {
        model.to2 = new_to2;
      });
    }
  }

  set_tco2(new_tco2, bc_site = "") {
    if (bc_site) {
      this._model_engine.models[bc_site].tco2 = new_tco2;
    } else {
      this._blood_components.forEach((model) => {
        model.tco2 = new_tco2;
      });
    }
  }

  set_solute(solute, solute_value, bc_site = "") {
    if (bc_site) {
      this._model_engine.models[bc_site].solutes[solute] = solute_value;
    } else {
      // update the reference value and propagate this specific solute to all blood components
      this.solutes[solute] = solute_value;
      this._blood_components.forEach((model) => {
        model.solutes[solute] = solute_value;
      });
    }
  }

}

```

### FILE: explain/component_models/BloodCapacitance.js

```javascript
import { Capacitance } from "../base_models/Capacitance";

// This class represents a blood capacitance model, which is a subclass of the Capacitance class.
// This class adds functionality to handle blood-specific properties such as temperature, viscosity, solute and drug concentrations.
export class BloodCapacitance extends Capacitance {
  // static properties
  static model_type = "BloodCapacitance";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties unique to a BloodCapacitance
    this.temp = 37.0; // blood temperature (dgs C)
    this.viscosity = 6.0; // blood viscosity (centiPoise = Pa * s)
    this.solutes = {}; // dictionary holding all solutes
    this.drugs = {}; // dictionary holding all drug concentrations

    // initialize dependent properties unique to a BloodCapacitance
    this.to2 = 0.0; // total oxygen concentration (mmol/l)
    this.tco2 = 0.0; // total carbon dioxide concentration (mmol/l)
    this.ph = -1.0; // ph (unitless)
    this.pco2 = -1.0; // pco2 (mmHg)
    this.po2 = -1.0; // po2 (mmHg)
    this.so2 = -1.0; // o2 saturation
    this.hco3 = -1.0; // bicarbonate concentration (mmol/l)
    this.be = -1.0; // base excess (mmol/l)
  }
  
  // the method overrides the 'volume_in' method of the Capacitance class and 
  // adds functionality to update the viscosity, temperature and to2, tco2, solutes and drug concentrations
  volume_in(dvol, comp_from) {
    // call the parent method from the Capacitance class to update the volume
    super.volume_in(dvol, comp_from);

    // a fixed-composition compartment is an infinite reservoir: hold its composition
    // (and temperature/viscosity) constant, just as the parent already holds its volume constant
    if (this.fixed_composition) return;

    // guard against division by zero on an empty compartment (would produce NaN concentrations)
    if (this.vol <= 0.0) return;

    // process the gases o2 and co2
    this.to2 += ((comp_from.to2 - this.to2) * dvol) / this.vol;
    this.tco2 += ((comp_from.tco2 - this.tco2) * dvol) / this.vol;

    // process the solutes
    Object.keys(this.solutes).forEach((solute) => {
      let solute_from = 0
      if (comp_from.solutes[solute]) {
        solute_from = comp_from.solutes[solute]
      }
      this.solutes[solute] += ((solute_from - this.solutes[solute]) * dvol) / this.vol;
    });

    // process the drug concentrations
    Object.keys(this.drugs).forEach((drug) => {
      let drug_from = 0.0
      if (comp_from.drugs[drug]) {
        drug_from = comp_from.drugs[drug]
      }
      this.drugs[drug] += ((drug_from - this.drugs[drug]) * dvol) / this.vol;
    });

    // process the temperature (treat it as a solute)
    this.temp += ((comp_from.temp - this.temp) * dvol) / this.vol;

    // process the viscosity (treat it as a solute)
    this.viscosity += ((comp_from.viscosity - this.viscosity) * dvol) / this.vol;
  }
}

```

### FILE: explain/component_models/BloodComposition.js

```javascript

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const kw              = 2.5119e-11; // water dissociation constant
const kc              = 7.94328235e-4; // carbonic acid dissociation constant
const kd              = 6.0255959e-8; // bicarbonate dissociation constant
const alpha_co2p      = 0.03067; // CO2 solubility coefficient
const left_hp_wide    = 5.848931925e-6; // lower bound for H⁺ concentration
const right_hp_wide   = 3.16227766017e-4; // upper bound for H⁺ concentration
const delta_ph_limits = 0.1; // delta for pH limits
const n               = 2.7; // Hill coefficient
const alpha_o2        = 1.38e-5; // O2 solubility coefficient
const left_o2_wide    = 0; // lower bound for pO2
const right_o2_wide   = 800.0; // upper bound for pO2
const delta_o2_limits = 10.0; // delta for pO2 limits
const brent_accuracy  = 1e-6;
const max_iterations  = 60;
const gas_constant    = 62.36367;
const DEFAULT_HALDANE_COEFF = 1.0; // default Haldane coefficient (0 = effect off); calibrate per scenario

// -----------------------------------------------------------------------------
// Independent variables
// -----------------------------------------------------------------------------

let P50_0 = 20.0; // PO2 at which 50% of Hgb is saturated by O2 (fetal = 18.8 (high Hb O2 affinity), neonatal = 20.0, adult = 26.7)
let P50 = 0;
let log10_p50 = 0;
let P50_n = 0;
let left_o2 = 0; // lower bound for pO2
let right_o2 = 800.0; // upper bound for pO2
let left_hp = 5.848931925e-6; // lower bound for H⁺ concentration
let right_hp = 3.16227766017e-4; // upper bound for H⁺ concentration

// -----------------------------------------------------------------------------
// State variables
// -----------------------------------------------------------------------------
let ph = 0.0;
let po2 = 0.0;
let so2 = 0.0;
let pco2 = 0.0;
let hco3 = 0.0;
let be = 0.0;
let to2 = 0.0;
let hemoglobin = 0.0;
let dpg = 5.0;
let temp = 0.0;
let tco2 = 0.0;
let sid = 0.0;
let albumin = 0.0;
let phosphates = 0.0;
let uma = 0.0;
let prev_ph = 7.37; // previous pH value, used to set the limits for H⁺ concentration
let prev_po2 = 18.7; // previous pO2 value, used to set the limits for pO2
let dpH = 0;             //Bohr effect: ↓pH → right shift → ↑P₅₀)
let dpCO2 = 0;       // CO₂-Bohr effect: ↑pCO2 → right shift → ↑P₅₀
let dT = 0;          // ↑T → right shift → ↑P₅₀
let dDPG = 0;          // ↑DPG → right shift → ↑P₅₀
let hemoglobin_gdl = 0.0;
let inv_mmol_to_ml = 0.0;
let haldane_coeff = 0.0; // Haldane effect: ↓SO₂ → ↑CO₂-carrying capacity → ↓pCO2 at given tCO2
let so2_prev = 0.98;     // SO₂ fraction from previous calculation (breaks the O₂↔CO₂ coupling)




export function calc_blood_composition(bc) {
    const sol = bc.solutes || {};
    const step_stamp = bc?._model_engine?.model_time_total;

    if (
      bc._bc_cache_initialized &&
      bc._bc_prev_tco2 === bc.tco2 &&
      bc._bc_prev_to2 === bc.to2 &&
      bc._bc_prev_temp === bc.temp &&
      bc._bc_prev_prev_ph === (bc.prev_ph || 7.37) &&
      bc._bc_prev_prev_po2 === (bc.prev_po2 || 18.7) &&
      bc._bc_prev_na === sol["na"] &&
      bc._bc_prev_k === sol["k"] &&
      bc._bc_prev_ca === sol["ca"] &&
      bc._bc_prev_mg === sol["mg"] &&
      bc._bc_prev_cl === sol["cl"] &&
      bc._bc_prev_lact === sol["lact"] &&
      bc._bc_prev_albumin === sol["albumin"] &&
      bc._bc_prev_phosphates === sol["phosphates"] &&
      bc._bc_prev_uma === sol["uma"] &&
      bc._bc_prev_hemoglobin === sol["hemoglobin"] &&
      (step_stamp === undefined || bc._bc_prev_step_stamp === step_stamp)
    ) {
      return;
    }

    _calc_blood_composition_js(bc);

    bc._bc_prev_step_stamp = step_stamp;
    bc._bc_prev_tco2 = bc.tco2;
    bc._bc_prev_to2 = bc.to2;
    bc._bc_prev_temp = bc.temp;
    bc._bc_prev_prev_ph = bc.prev_ph || 7.37;
    bc._bc_prev_prev_po2 = bc.prev_po2 || 18.7;
    bc._bc_prev_na = sol["na"];
    bc._bc_prev_k = sol["k"];
    bc._bc_prev_ca = sol["ca"];
    bc._bc_prev_mg = sol["mg"];
    bc._bc_prev_cl = sol["cl"];
    bc._bc_prev_lact = sol["lact"];
    bc._bc_prev_albumin = sol["albumin"];
    bc._bc_prev_phosphates = sol["phosphates"];
    bc._bc_prev_uma = sol["uma"];
    bc._bc_prev_hemoglobin = sol["hemoglobin"];
    bc._bc_cache_initialized = true;
}

// These functions are the same as in the wasm module, but implemented in JavaScript
function _calc_blood_composition_js(bc) {
    let sol = bc.solutes;
    tco2 = bc.tco2;
    to2 = bc.to2;
    sid = sol["na"] + sol["k"] + 2 * sol["ca"] + 2 * sol["mg"] - sol["cl"] - sol["lact"];
    albumin = sol["albumin"];
    phosphates = sol["phosphates"];
    uma = sol["uma"];
    hemoglobin = sol["hemoglobin"];
    temp = bc.temp;
    prev_ph = bc.prev_ph || 7.37; // previous pH value, used to set the limits for H⁺ concentration
    prev_po2 = bc.prev_po2 || 18.7; // previous pO2 value, used to set the limits for pO2

    // Haldane effect inputs: SO₂-dependent CO₂ binding capacity.
    // Use the previous-step SO₂ (stored on bc.so2 in percent) to break the O₂↔CO₂ coupling.
    // At steady state so2_prev == so2, so the one-step lag vanishes.
    haldane_coeff = bc.haldane_coeff ?? DEFAULT_HALDANE_COEFF;
    so2_prev = bc.so2 > 0 ? bc.so2 / 100.0 : 0.98;

    hemoglobin_gdl = hemoglobin / 0.6206;
    inv_mmol_to_ml = 760.0 / (gas_constant * (273.15 + temp));

    // set the wide limits based
    left_hp = left_hp_wide; // lower bound for H⁺ concentration
    right_hp = right_hp_wide; // upper bound for H⁺ concentration

    // set the limits based on the previous calculations if available
    if (prev_ph > 0) {
        left_hp = Math.pow(10.0, -(prev_ph + delta_ph_limits)) * 1000.0;
        right_hp = Math.pow(10.0, -(prev_ph - delta_ph_limits)) * 1000.0;
    }

    let hp = _brent_root_finding(_net_charge_plasma, left_hp, right_hp, max_iterations, brent_accuracy);
    if (hp > 0) {
        be =(hco3 - 25.1 + (2.3 * hemoglobin + 7.7) * (ph - 7.4)) * (1.0 - 0.023 * hemoglobin);
        bc.ph = ph;
        bc.pco2 = pco2;
        bc.hco3 = hco3;
        bc.be = be;
    } else {
        //console.log('small limit ab root finding failed in:', bc.name)
        // If the root finding failed, we will use the wide limits
        left_hp = left_hp_wide; // wide lower bound for H⁺ concentration
        if (left_hp < 0) left_hp = 0; // ensure lower bound is not negative
        right_hp = right_hp_wide; // wide upper bound for H⁺ concentration
        hp = _brent_root_finding(_net_charge_plasma, left_hp, right_hp, max_iterations, brent_accuracy);
        if (hp > 0) {
            be =(hco3 - 25.1 + (2.3 * hemoglobin + 7.7) * (ph - 7.4)) * (1.0 - 0.023 * hemoglobin);
            bc.ph = ph;
            bc.pco2 = pco2;
            bc.hco3 = hco3;
            bc.be = be;
        } else {
          console.log('definitive ab root finding failed in:', bc.name)
        }
    }

    dpH = ph - 7.40;             //Bohr effect: ↓pH → right shift → ↑P₅₀)
    dpCO2 = pco2 - 40.0;         // carbamino-specific CO₂-Bohr effect (~0.0015/mmHg); pH-mediated part runs via the -0.48·dpH term
    dT = temp - 37.0;            // ↑T → right shift → ↑P₅₀
    dDPG = dpg - 5.0;            // ↑DPG → right shift → ↑P₅₀

    log10_p50 = Math.log10(P50_0) - 0.48 * dpH + 0.0015 * dpCO2 + 0.024 * dT + 0.051 * dDPG;
    P50 = Math.pow(10.0, log10_p50);
    P50_n = Math.pow(P50, n);

    // set dynamic limits off
    let dyn_limits_used_oxy = false;
    // set the wide o2 intervals
    left_o2 = left_o2_wide; // lower bound po2
    right_o2 = right_o2_wide; // upper bound po2
    // if we have a previous po2 we can use this for dynamic limiting
    if (prev_po2 > 0) {
        left_o2 = prev_po2 - delta_o2_limits;
        if (left_o2 < 0) left_o2 = 0; // ensure lower bound is not negative
        right_o2 = prev_po2 + delta_o2_limits;
        dyn_limits_used_oxy = true;
    }

    // calculate the po2 and so2 using the brent root finding procedure
    let po2 = _brent_root_finding(_do2_content, left_o2, right_o2, max_iterations, brent_accuracy);
    if (po2 > -1) {
        bc.po2 = po2;
        bc.so2 = so2 * 100.0;
        bc.prev_po2 = po2;
    } else {
      // console.log('small limit oxy root finding failed in:', bc.name)
      if (dyn_limits_used_oxy) {
        // now try again with the wide limits
        left_o2 = left_o2_wide; // lower bound po2
        right_o2 = right_o2_wide; // upper bound po2
        po2 = _brent_root_finding(_do2_content, left_o2, right_o2, max_iterations, brent_accuracy);
        if (po2 > -1) {
          bc.po2 = po2;
          bc.so2 = so2 * 100.0;
          bc.prev_po2 = po2;
        } else {
          console.log('definitive oxy root finding failed in:', bc.name)
        }
      }
    }
}

function _net_charge_plasma(hp_estimate) {
    ph = -Math.log10(hp_estimate / 1000.0);
    // Haldane effect: lower SO₂ raises the CO₂-carrying capacity, so an extra SO₂-dependent
    // term in the denominator lowers dissolved CO₂ (and pCO2/hco3) at a given tCO2.
    let cco2p = tco2 / (1.0 + kc/hp_estimate + (kc*kd)/(hp_estimate * hp_estimate) + haldane_coeff * (1.0 - so2_prev));
    hco3       = (kc * cco2p) / hp_estimate;
    let co3p = (kd * hco3) / hp_estimate;
    let ohp  = kw / hp_estimate;

    pco2 = cco2p / alpha_co2p;

    let a_base = albumin*(0.123*ph - 0.631) + phosphates*(0.309*ph - 0.469);

    return hp_estimate + sid - hco3 - 2.0*co3p - ohp - a_base - uma;
}

function _calc_so2(po2_estimate) {
    let po2_n = Math.pow(po2_estimate, n);
    let denom = po2_n + P50_n;
    return po2_n / denom;
}

function _do2_content(po2_estimate) {
  // calculate the saturation from the current po2 from the current po2 estimate
  so2 = _calc_so2(po2_estimate);

  // calculate the to2 from the current po2 estimate
  // INPUTS: po2 in mmHg, so2 in fraction, hemoglobin in mmol/l
  // convert the hemoglobin unit from mmol/l to g/dL  (/ 0.6206)
  // convert to output from ml O2/dL blood to ml O2/l blood (* 10.0)
  let to2_new_estimate = (0.0031 * po2_estimate + 1.36 * hemoglobin_gdl * so2) * 10.0;
  to2_new_estimate = to2_new_estimate * inv_mmol_to_ml;

  // calculate the difference between the real to2 and the to2 based on the new po2 estimate and return it to the brent root finding function
  let dto2 = to2 - to2_new_estimate;

  return dto2;
}

function _brent_root_finding(f, x0, x1, max_iter, tolerance) {
  let fx0 = f(x0);
  let fx1 = f(x1);

  if (fx0 * fx1 > 0) {
    return -1;
  }

  if (Math.abs(fx0) < Math.abs(fx1)) {
    const tx = x0;
    x0 = x1;
    x1 = tx;
    const tfx = fx0;
    fx0 = fx1;
    fx1 = tfx;
  }

  let x2 = x0,
    fx2 = fx0,
    d = 0,
    mflag = true,
    steps_taken = 0;

  while (steps_taken < max_iter) {
    if (Math.abs(fx0) < Math.abs(fx1)) {
      const tx = x0;
      x0 = x1;
      x1 = tx;
      const tfx = fx0;
      fx0 = fx1;
      fx1 = tfx;
    }

    let new_point;
    if (fx0 !== fx2 && fx1 !== fx2) {
      let L0 = (x0 * fx1 * fx2) / ((fx0 - fx1) * (fx0 - fx2));
      let L1 = (x1 * fx0 * fx2) / ((fx1 - fx0) * (fx1 - fx2));
      let L2 = (x2 * fx1 * fx0) / ((fx2 - fx0) * (fx2 - fx1));
      new_point = L0 + L1 + L2;
    } else {
      new_point = x1 - (fx1 * (x1 - x0)) / (fx1 - fx0);
    }

    if (
      new_point < (3 * x0 + x1) / 4 ||
      new_point > x1 ||
      (mflag && Math.abs(new_point - x1) >= Math.abs(x1 - x2) / 2) ||
      (!mflag && Math.abs(new_point - x1) >= Math.abs(x2 - d) / 2) ||
      (mflag && Math.abs(x1 - x2) < tolerance) ||
      (!mflag && Math.abs(x2 - d) < tolerance)
    ) {
      new_point = (x0 + x1) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    let fnew = f(new_point);
    d = x2;
    x2 = x1;

    if (fx0 * fnew < 0) {
      x1 = new_point;
      fx1 = fnew;
    } else {
      x0 = new_point;
      fx0 = fnew;
    }

    steps_taken += 1;

    if (Math.abs(fnew) < tolerance) {
      return new_point;
    }
  }

  return -1;
}

```

### FILE: explain/component_models/BloodPump.js

```javascript
import { BloodCapacitance } from "./BloodCapacitance";

export class BloodPump extends BloodCapacitance {
  // static properties
  static model_type = "BloodPump";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    this.pump_rpm = 0.0; // pump speed in rotations per minute
    this.pump_mode = 0; // pump mode (0=centrifugal, 1=roller pump)
    this.pump_pressure =  0.0
    this.inlet = ""; // name of the inlet BloodResistor
    this.outlet = ""; // name of the outlet BloodResistor
    this.pres_cc = 0.0; // external pressure from chest compressions (mmHg)
    this.pres_mus = 0.0; // external muscle pressure (mmHg)

    // local properties
    this._inlet = null; // holds a reference to the inlet BloodResistor
    this._outlet = null; // holds a reference to the outlet BloodResistor

  }


  calc_pressure() {
    // find the inlet and outlet resistors
    this._inlet = this._model_engine.models[this.inlet];
    this._outlet = this._model_engine.models[this.outlet];

    // calculate the recoil pressure
    this.pres_in = this.el_k_eff * Math.pow(this.vol - this.u_vol_eff, 2) + this.el_eff * (this.vol - this.u_vol_eff);

    // calculate the transmural pressure
    this.pres_tm = this.pres_in - this.pres_ext;

    // calculate the total pressure by incorporating the external pressures
    this.pres = this.pres_in + this.pres_ext + this.pres_cc + this.pres_mus;

    // reset the external pressures
    this.pres_ext = 0.0;
    this.pres_cc = 0.0;
    this.pres_mus = 0.0;

    // calculate the pump pressure and apply the pump pressures to the connected resistors
    // (guard against missing connectors so an unwired pump does not crash)
    this.pump_pressure = -this.pump_rpm / 25.0;
    if (this.pump_mode === 0) {
      if (this._inlet) {
        this._inlet.p1_ext = 0.0;
        this._inlet.p2_ext = this.pump_pressure;
      }
    } else {
      if (this._outlet) {
        this._outlet.p1_ext = this.pump_pressure;
        this._outlet.p2_ext = 0.0;
      }
    }
  }
}

```

### FILE: explain/component_models/BloodTimeVaryingElastance.js

```javascript
import { TimeVaryingElastance } from "../base_models/TimeVaryingElastance";

// This class represents a blood time-varying elastance model, which is a subclass of the TimeVaryingElastance class.
// This class adds functionality to handle blood-specific properties such as temperature, viscosity, solute and drug concentrations.
export class BloodTimeVaryingElastance extends TimeVaryingElastance {
  // static properties
  static model_type = "BloodTimeVaryingElastance";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // initialize independent properties unique to a BloodTimeVaryingElastance
    this.temp = 37.0; // blood temperature (dgs C)
    this.viscosity = 6.0; // blood viscosity (centiPoise = Pa * s)
    this.solutes = {}; // dictionary holding all solutes
    this.drugs = {}; // dictionary holding all drug concentrations

    // initialize dependent properties unique to a BloodTimeVaryingElastance
    this.to2 = 0.0; // total oxygen concentration (mmol/l)
    this.tco2 = 0.0; // total carbon dioxide concentration (mmol/l)
    this.ph = -1.0; // ph (unitless)
    this.pco2 = -1.0; // pco2 (mmHg)
    this.po2 = -1.0; // po2 (mmHg)
    this.so2 = -1.0; // o2 saturation
    this.hco3 = -1.0; // bicarbonate concentration (mmol/l)
    this.be = -1.0; // base excess (mmol/l)
  }


  // the method overrides the 'volume_in' method of the TimeVaryingElastance class and 
  // adds functionality to update the viscosity, temperature and to2, tco2, solutes and drug concentrations
  volume_in(dvol, comp_from) {
    // call the parent method from the TimeVaryingElastance class to update the volume
    super.volume_in(dvol, comp_from);

    // a fixed-composition compartment is an infinite reservoir: hold its composition
    // (and temperature/viscosity) constant
    if (this.fixed_composition) return;

    // guard against division by zero on an empty compartment (would produce NaN concentrations)
    if (this.vol <= 0.0) return;

    // process the gases o2 and co2
    this.to2 += ((comp_from.to2 - this.to2) * dvol) / this.vol;
    this.tco2 += ((comp_from.tco2 - this.tco2) * dvol) / this.vol;

    // process the solutes
    Object.keys(this.solutes).forEach((solute) => {
      let solute_from = 0
      if (comp_from.solutes[solute]) {
        solute_from = comp_from.solutes[solute]
      }
      this.solutes[solute] += ((solute_from - this.solutes[solute]) * dvol) / this.vol;
    });

    // process the drug concentrations
    Object.keys(this.drugs).forEach((drug) => {
      let drug_from = 0.0
      if (comp_from.drugs[drug]) {
        drug_from = comp_from.drugs[drug]
      }
      this.drugs[drug] += ((drug_from - this.drugs[drug]) * dvol) / this.vol;
    });

    // process the temperature (treat it as a solute)
    this.temp += ((comp_from.temp - this.temp) * dvol) / this.vol;

    // process the viscosity (treat it as a solute)
    this.viscosity += ((comp_from.viscosity - this.viscosity) * dvol) / this.vol;
  }
}

```

### FILE: explain/component_models/BloodVessel.js

```javascript
import { BloodCapacitance } from "./BloodCapacitance";
import { Resistor } from "../base_models/Resistor";

/*
The BloodVessel class extends the BloodCapacitance class and adds a Resistor to represent a blood vessel in the model.
So a BloodVessel has a resistance and has flow properties and can react to the autonomic nervous system (ANS).

A BloodVessel is under autonomic control where the ans activity and ans sensitivity determine how the resistance
and the elastance of this blood vessel change. The coupling between the resistance and elastance is determined 
by the alpha parameter

So, if the ans activity changes then the effect on the elastance is determined by the ans sensitivity and the alpha factor. 
The effect on the resistance is only determined by the the ans activity ands ans sensitivity parameter.

So if a vessel constricts under autonomic control not only it's resistance changes but also it's elastance!
This is a key fundamental concept in Explain and makes it unique from under models.
*/

export class BloodVessel extends BloodCapacitance {
  // static properties
  static model_type = "BloodVessel";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties unique to a BloodVessel
    this.inputs = []; // list of inputs for this blood vessel
    this.r_for = 1.0; // forward flow resistance Rf (mmHg*s/l)
    this.r_back = 1.0; // backward flow resistance Rb (mmHg*s/l )
    this.r_k = 0.0; // non-linear resistance coefficient K1 (unitless)
    this.no_flow = false; // flags whether flow is allowed across this resistor
    this.no_back_flow = false; // flags whether backflow is allowed across this resistor
    this.p1_ext = 0.0; // external pressure on the inlet (mmHg)
    this.p2_ext = 0.0; // external pressure on the outlet (mmHg)
    this.alpha = 0.0; // determines relation between resistance change and elastance change. Veins/venules: 0.75, arterioles: 0.63, large arteries: 0.5
    this.ans_sens = 0.0; // sensitivity of this blood vessel for autonomic control. 0.0 is no effect, 1.0 is full effect
    this.ans_activity = 1.0; // ans activity factor (unitless)

    // non-persistent property factors. These factors reset to 1.0 after each model step
    this.r_factor = 1.0; // non-persistent resistance factor
    this.r_k_factor = 1.0; // non-persistent non-linear coefficient factor

    // persistent property factors. These factors are persistent and do not reset
    this.r_factor_ps = 1.0; // persistent resistance factor
    this.r_k_factor_ps = 1.0; // persistent non-linear coefficient factor

    // scaling factors for the properties
    this.r_factor_scaling_ps = 1.0; // scaling factor for the resistance factor
    this.r_k_factor_scaling_ps = 1.0; // scaling factor for the non-linear coefficient factor

    // initialize dependent properties
    this.flow = 0.0; // flow f(t) (L/s)
    this.flow_forward = 0.0; // forward flow from the input blood vessels (L/s)
    this.flow_backward = 0.0; // backward flow to the input blood vessels (L/s)

    // state variables to store the current resistance and elastance values
    this.r_for_eff = 1000;  // calculated forward resistance (mmHg/L*s)
    this.r_back_eff = 1000; // calculated backward resistance (mmHg/L*s)
    this.r_k_eff = 0; // calculated non-linear resistance factor (unitless)

    // local properties
    this._resistors = {}; // list of connectors for this blood vessel
    this._r_total_factor = 1.0; // composed multiplicative R multiplier; cached by calc_resistances and reused by calc_elastances for the α-coupling

  }

  // override the parent class method
  init_model(args={}) {
    // call parent class method
    super.init_model(args);

    // initialize a resistor with the inputs
    this.inputs.forEach((inputName) => { 
      // check whether the resistor already exists (in case of a saved state)
      if (this._model_engine.models.hasOwnProperty(inputName + "_" + this.name)) {
        this._resistors[inputName + "_" + this.name] = this._model_engine.models[inputName + "_" + this.name];
        return; // if so, do not create a new resistor
      }

      // create a new resistor for each input
      let res = new Resistor(this._model_engine, inputName + "_" + this.name);

      // set the properties of the resistor
      let args = [
        { key: "name", value: inputName + "_" + this.name},
        { key: "description", value: "input connector for " + this.name },
        { key: "is_enabled", value: this.is_enabled },
        { key: "model_type", value: "Resistor" },
        { key: "r_for", value: this.r_for },
        { key: "r_back", value: this.r_back },
        { key: "r_k", value: this.r_k },
        { key: "no_flow", value: this.no_flow },
        { key: "no_back_flow", value: this.no_back_flow },
        { key: "comp_from", value: inputName },
        { key: "comp_to", value: this.name },
      ]
      // initialize the resistor with the arguments
      res.init_model(args);

      // add the resistor to the list of models
      this._model_engine.models[inputName + "_" + this.name] = res;

      // add the resistor to the dictionary of connectors
      this._resistors[inputName + "_" + this.name] = res;
    });
  }
  
  // keep the owned input resistors in sync with this vessel's enabled state, also when the
  // vessel itself is disabled — calc_model does not run then, which would otherwise leave the
  // resistors enabled and still conducting flow through a disabled vessel
  step_model() {
    Object.values(this._resistors).forEach((resistor) => {
      resistor.is_enabled = this.is_enabled;
    });
    super.step_model();
  }

  calc_model() {
    // call this class specific calculation methods
    this.calc_resistances();
    this.calc_elastances();

    // update the associated resistors
    Object.values(this._resistors).forEach((resistor) => {
      resistor.is_enabled = this.is_enabled;
      resistor.r_for = this.r_for_eff
      resistor.r_back = this.r_back_eff
      resistor.r_k = this.r_k_eff

      resistor.no_back_flow = this.no_back_flow
      resistor.no_flow = this.no_flow
      resistor.p1_ext = this.p1_ext
      resistor.p2_ext = this.p2_ext
    })

    // call parent class methods
    this.calc_volumes();  
    this.calc_pressure();

    // get the flows from the resistors
    this.get_flows();
  }

  get_flows() {
    //reset the flow values
    this.flow = 0.0;
    this.flow_forward = 0.0;
    this.flow_backward = 0.0;

    // get the flow values from the resistors
    Object.values(this._resistors).forEach((resistor) => {
      if (resistor.is_enabled) {
        if (resistor.flow > 0) {
          // get the forward flow across the input
          this.flow_forward += resistor.flow;
        } else {
          // get the backward flow across the input
          this.flow_backward += -resistor.flow;
        }
      }
    });
    
    // calculate the net flow through this blood vessel
    this.flow = this.flow_forward - this.flow_backward;
  }

  calc_resistances() {
    // Multiplicative composition of all resistance multipliers. Composing
    // factors as a product (rather than summing their deltas as before) lets
    // simultaneous factors compound correctly: e.g. r_factor=2 with r_factor_ps=2
    // gives a true 4x rise instead of the linearised 3x. The ANS contribution
    // is the per-vessel sensitivity-weighted multiplier (1 + (a-1)*ans_sens),
    // matching the pre-existing semantics.
    const ans_mult = 1 + (this.ans_activity - 1) * this.ans_sens;

    const r_total_factor =
      this.r_factor *
      this.r_factor_ps *
      this.r_factor_scaling_ps *
      ans_mult;

    this.r_for_eff = this.r_for * r_total_factor;
    this.r_back_eff = this.r_back * r_total_factor;

    // r_k carries its own factor stack but the same ANS coupling, composed
    // multiplicatively like the linear resistance above.
    const r_k_total_factor =
      this.r_k_factor *
      this.r_k_factor_ps *
      this.r_k_factor_scaling_ps *
      ans_mult;
    this.r_k_eff = this.r_k * r_k_total_factor;

    // Cache the composed linear-resistance multiplier for the elastance step
    // (single source of truth for the α-coupling).
    this._r_total_factor = r_total_factor;

    // reset the non persistent factors
    this.r_factor = 1.0;
    this.r_k_factor = 1.0;
  }

  calc_elastances() {
    // Multiplicative composition of the passive elastance multipliers
    // (aging, scaling, scenario edits — direct E modifiers, not R-coupled).
    const el_passive_mult =
      this.el_base_factor *
      this.el_base_factor_ps *
      this.el_base_factor_scaling_ps;

    // Geometric R→E coupling: apply α once to the *combined* resistance
    // multiplier, not per-factor. Falls back to 1 if calc_resistances has not
    // run yet (defensive — under normal model order it always has).
    const el_geom_mult = Math.pow(this._r_total_factor ?? 1.0, this.alpha);

    this.el_eff = this.el_base * el_passive_mult * el_geom_mult;

    // el_k carries its own multipliers and is not α-coupled to R (same as
    // before — the non-linear stiffening term is treated as a structural
    // property of the wall, not driven by vasoactivity).
    const el_k_passive_mult =
      this.el_k_factor *
      this.el_k_factor_ps *
      this.el_k_factor_scaling_ps;
    this.el_k_eff = this.el_k * el_k_passive_mult;

    // reset the non persistent factors
    this.el_base_factor = 1.0;
    this.el_k_factor = 1.0;
  }
}

```

### FILE: explain/component_models/Breathing.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

export class Breathing extends BaseModelClass {
  // static properties
  static model_type = "Breathing";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // initialize independent properties
    this.breathing_enabled = true; // flag whether spontaneous breathing is enabled or not
    this.minute_volume_ref = 0.2; // reference minute volume (L/kg/min)
    this.minute_volume_ref_factor = 1.0; // factor influencing the reference minute volume
    this.minute_volume_ref_scaling_factor = 1.0; // scaling factor of the reference minute volume
    this.vt_rr_ratio = 0.0001212; // ratio between tidal volume and respiratory rate
    this.vt_rr_ratio_factor = 1.0; // factor influencing the ratio
    this.vt_rr_ratio_scaling_factor = 1.0; // scaling factor for vt-rr ratio
    this.rmp_gain_max = 100.0; // maximum pressure exerted by respiratory muscles
    this.ie_ratio = 0.3; // ratio of inspiratory and expiratory time
    this.mv_ans_factor = 1.0; // factor from the autonomic nervous system
    this.ans_activity_factor = 1.0; // global ANS activity factor

    // initialize dependent properties
    this.target_minute_volume = 0.0; // target minute volume
    this.resp_rate = 36.0; // respiratory rate (breaths/min)
    this.resp_rate_measured = 36.0; // measured respiratory rate (breaths/min)
    this.target_tidal_volume = 0.0; // target tidal volume (L)
    this.minute_volume = 0.0; // minute volume (L/min)
    this.exp_tidal_volume = 0.0; // expiratory tidal volume (L)
    this.insp_tidal_volume = 0.0; // inspiratory tidal volume (L)
    this.resp_muscle_pressure = 0.0; // respiratory muscle pressure (mmHg/L)
    this.ncc_insp = 0; // inspiratory counter
    this.ncc_exp = 0; // expiratory counter
    this.rmp_gain = 9.5; // elastance change gain (mmHg/L)

    // local properties
    this._eMin4 = Math.pow(Math.E, -4); // constant for Mecklenburgh function
    this._ti = 0.4; // inspiration time (s)
    this._te = 1.0; // expiration time (s)
    this._breath_timer = 0.0; // current breath time (s)
    this._breath_interval = 60.0; // breathing interval (s)
    this._insp_running = false; // flag for inspiration
    this._insp_timer = 0.0; // inspiration timer (s)
    this._temp_insp_volume = 0.0; // inspiratory volume counter (L)
    this._exp_running = false; // flag for expiration
    this._exp_timer = 0.0; // expiration timer (s)
    this._temp_exp_volume = 0.0; // expiratory volume counter (L)
    this._rr_counter = 0.0; // counter for measured resp rate
    this._rr_factor = 0.0; // factor for resp rate counting

    // debug factor
    this.debug_factor1 = 0.0
  }

  calc_model() {
    const _weight = this._model_engine.weight;

    // calculate the target minute volume
    const _minute_volume_ref = this.minute_volume_ref * this.minute_volume_ref_factor * this.minute_volume_ref_scaling_factor * _weight;
    this.target_minute_volume = (_minute_volume_ref + (this.mv_ans_factor - 1.0) * _minute_volume_ref) * this.ans_activity_factor;

    // calculate respiratory rate and tidal volume
    this.vt_rr_controller(_weight);

    // calculate inspiratory and expiratory times
    this._breath_interval = 60.0;
    if (this.resp_rate > 0) {
      this._breath_interval = 60.0 / this.resp_rate;
      this._ti = this.ie_ratio * this._breath_interval;
      this._te = this._breath_interval - this._ti;
    }

    // handle breathing phases
    if (this._breath_timer > this._breath_interval) {
      this._breath_timer = 0.0; // reset breath timer
      this._insp_running = true; // start inspiration
      this._insp_timer = 0.0; // reset inspiration timer
      this.ncc_insp = 0;
    }

    if (this._insp_timer > this._ti) {
      this._insp_timer = 0.0;
      this._insp_running = false;
      this._exp_running = true; // start expiration
      this.ncc_exp = 0;
      this._temp_exp_volume = 0.0;
      this.insp_tidal_volume = this._temp_insp_volume;
    }

    if (this._exp_timer > this._te) {
      this._exp_timer = 0.0;
      this._exp_running = false;
      this._temp_insp_volume = 0.0;
      this.exp_tidal_volume = -this._temp_exp_volume;

      if (this.breathing_enabled) {
        if (Math.abs(this.exp_tidal_volume) < this.target_tidal_volume) {
          this.rmp_gain += 0.1;
        }
        if (Math.abs(this.exp_tidal_volume) > this.target_tidal_volume) {
          this.rmp_gain -= 0.1;
        }
        this.rmp_gain = Math.max(
          0.0,
          Math.min(this.rmp_gain, this.rmp_gain_max)
        );
      }
      this.minute_volume = this.exp_tidal_volume * this.resp_rate;
    }

    this._breath_timer += this._t;

    if (this._insp_running) {
      this._insp_timer += this._t;
      this.ncc_insp += 1;
      if (this._model_engine.models["MOUTH_DS"].flow > 0) {
        this._temp_insp_volume +=
          this._model_engine.models["MOUTH_DS"].flow * this._t;
      }
    }

    if (this._exp_running) {
      this._exp_timer += this._t;
      this.ncc_exp += 1;
      if (this._model_engine.models["MOUTH_DS"].flow < 0) {
        this._temp_exp_volume +=
          this._model_engine.models["MOUTH_DS"].flow * this._t;
      }
    }

    this.resp_muscle_pressure = 0.0;
    if (this.breathing_enabled) {
      this.resp_muscle_pressure = this.calc_resp_muscle_pressure();
    } else {
      this.resp_rate = 0.0;
      this.ncc_insp = 0.0;
      this.ncc_exp = 0.0;
      this.target_tidal_volume = 0.0;
      this.resp_muscle_pressure = 0.0;
    }

    // measure the resp rate (start inspiration as starting point)
    if (this.ncc_insp == 1) {
      this.resp_rate_measured = 60 / this._rr_counter;
      this._rr_counter = 0.0;
      this._rr_factor = 1.0
    }
    // update the resp frequency even when there's no respiration
    if (this._rr_counter > 4 * this._rr_factor) {
      this.resp_rate_measured = 60 / this._rr_counter;
      this._rr_factor += 1;
    }
    this._rr_counter += this._t


    //this._model_engine.models["THORAX"].pres_ext += -this.resp_muscle_pressure
    this._model_engine.models["THORAX"].el_base_factor += this.resp_muscle_pressure
  }

  vt_rr_controller(_weight) {
    if (!this.breathing_enabled) {
      this.resp_rate = 0.0;
      return
    }
    // guard the Mecklenburgh inversion against a non-positive denominator or target minute volume
    // (would otherwise yield Infinity/NaN resp_rate and a zero breath interval)
    const _denom = this.vt_rr_ratio * this.vt_rr_ratio_factor * this.vt_rr_ratio_scaling_factor * _weight;
    if (_denom > 0 && this.target_minute_volume > 0) {
      this.resp_rate = Math.sqrt(this.target_minute_volume / _denom);
      this.target_tidal_volume = this.target_minute_volume / this.resp_rate;
    } else {
      this.resp_rate = 0.0;
    }
  }

  calc_resp_muscle_pressure() {
    let mp = 0.0;

    if (this._insp_running) {
      mp = (this.ncc_insp / (this._ti / this._t)) * this.rmp_gain;
    }

    if (this._exp_running) {
      mp = ((Math.pow(Math.E, -4.0 * (this.ncc_exp / (this._te / this._t))) - this._eMin4) / (1.0 - this._eMin4)) * this.rmp_gain;
    }

    return mp;
  }

  switch_breathing(state) {
    this.breathing_enabled = state;
  }
}

```

### FILE: explain/component_models/Circulation.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

/*
  The ANS—chiefly via sympathetic adrenergic fibers—regulates vasotone across the arterial–venous tree by tuning 
  smooth‐muscle contraction through α₁, α₂ and β₂ receptors, under the guidance of central vasomotor centers and reflexes 
  (baroreceptors, chemoreceptors). Parasympathetic/cholinergic control of vascular tone is limited to specialized beds 
*/

export class Circulation extends BaseModelClass {
  // static properties
  static model_type = "Circulation";

  /*
    The Circulation class is not a model but houses methods that influence groups of models. In case
    of the circulation class, these groups contain models related to blood circulation.
    */
  constructor(model_ref, name = "") {
    // initialize the parent class
    super(model_ref, name);

    // -----------------------------------------------
    // independent properties
    // -----------------------------------------------
    this.heart_chambers = [];           // list of all heart chambers
    this.coronaries = [];               // list of all coronary models
    
    this.systemic_arteries = [];        // list of systemic arteries
    this.systemic_arterioles = [];       // list of systemic arterioles
    this.systemic_capillaries = [];     // list of systemic capillaries 
    this.systemic_venules = [];        // list of systemic venules
    this.systemic_veins = [];           // list of systemic veins
    
    this.pulmonary_arteries = [];       // list of pulmonary arteries
    this.pulmonary_arterioles = [];     // list of pulmonary arterioles
    this.pulmonary_capillaries = [];    // list of pulmonary capillaries
    this.pulmonary_venules = [];        // list of pulmonary venules
    this.pulmonary_veins = [];          // list of pulmonary veins 
    
    this.ans_activity = 1.0;            // ans influence on circulation (1.0 = no effect)
    this.svr_factor_art = 1.0;          // factor influencing the systemic arteriolar vascular resistance
    this.svr_factor_ven = 1.0;          // factor influencing the systemic venular vascular resistance
    this.svr_factor_drug = 1.0;         // independent systemic arteriolar factor owned by the Drugs PK/PD model (composes with svr_factor_art)
    this.pvr_factor_art = 1.0;          // factor influencing the pulmonary arteriolar vascular resistance
    this.pvr_factor_ven = 1.0;          // factor influencing the pulmonary venular vascular resistance


    // -----------------------------------------------
    // dependent properties
    // -----------------------------------------------
    this.total_blood_volume = 0.0;      // total blood volume (L)
    this.syst_blood_volume = 0.0;       // total blood volume in systemic circulation (L)
    this.pulm_blood_volume = 0.0;       // total blood volume in pulmonary circulatino (L)
    this.heart_blood_volume = 0.0;      // blood volume of the heart (L)
    this.syst_blood_volume_perc = 0.0;  // percentage of total blood volume in systemic circulation (%)
    this.pulm_blood_volume_perc = 0.0;  // percentage of total blood volume in pulmonary circulation (%)
    this.heart_blood_volume_perc = 0.0; // percentage of total blood volume in heart (%)

    // local properties
    this._bloodvessel_list = [];
    this._systemic_bloodvessel_list = [];
    this._pulmonary_bloodvessel_list = [];

    this.prev_ans_activity = 0.0;
    this.prev_svr_factor_art = 1.0;
    this.prev_svr_factor_ven = 1.0;
    this.prev_svr_factor_drug = 1.0;
    this.prev_pvr_factor_art = 1.0;
    this.prev_pvr_factor_ven = 1.0;
    this._update_interval = 0.015;      // update interval (s)
    this._update_counter = 0.0;         // update interval counter (s)
    this._update_interval_slow = 1.0;      // update interval (s)
    this._update_counter_slow = 0.0;         // update interval counter (s)
  }
  init_model(args = {}) {
    super.init_model(args);

    // build a list of all blood vessel models for easy access
    this._bloodvessel_list = [
      ...this.systemic_arteries, 
      ...this.systemic_arterioles,
      ...this.systemic_capillaries,
      ...this.systemic_venules,
      ...this.systemic_veins,
      ...this.pulmonary_arteries,
      ...this.pulmonary_arterioles,
      ...this.pulmonary_capillaries,
      ...this.pulmonary_venules,
      ...this.pulmonary_veins
    ]

    this._systemic_bloodvessel_list = [
      ...this.systemic_arteries, 
      ...this.systemic_arterioles,
      ...this.systemic_capillaries,
      ...this.systemic_venules,
      ...this.systemic_veins
    ]

    this._pulmonary_bloodvessel_list = [
      ...this.pulmonary_arteries,
      ...this.pulmonary_arterioles,
      ...this.pulmonary_capillaries,
      ...this.pulmonary_venules,
      ...this.pulmonary_veins
    ]

  }

  calc_model() {
    this._update_counter += this._t;
    if (this._update_counter > this._update_interval) {
      this._update_counter = 0.0;

      // BloodVessels expose an ans_activity and an ans_sensitivity parameter which control the amount of vasoreactivity. 
      // The ciruclation model has an ans_activity parameter which can be set by an ANS effector and this ans_activity parameter is 
      // set on all BloodVessels and MicroVascular units of the circulation.

      // update the ans influence on the circulation if the influence has changed
      if (this.prev_ans_activity !== this.ans_activity) {
        for (const name of this._bloodvessel_list) {
          const m = this._model_engine.models[name];
          if (m && m.ans_activity !== undefined) {
            m.ans_activity = this.ans_activity;
          }
        }
        this.prev_ans_activity = this.ans_activity;
      }

      if (this.prev_svr_factor_art !== this.svr_factor_art) {
        this.set_svr_factor_art(this.svr_factor_art)
        this.prev_svr_factor_art = this.svr_factor_art
      }
      
      if (this.prev_svr_factor_ven !== this.svr_factor_ven) {
        this.set_svr_factor_ven(this.svr_factor_ven)
        this.prev_svr_factor_ven = this.svr_factor_ven
      }

      if (this.prev_svr_factor_drug !== this.svr_factor_drug) {
        this.set_svr_factor_drug(this.svr_factor_drug)
        this.prev_svr_factor_drug = this.svr_factor_drug
      }

      if (this.prev_pvr_factor_art !== this.pvr_factor_art) {
        this.set_pvr_factor_art(this.pvr_factor_art)
        this.prev_pvr_factor_art = this.pvr_factor_art
      }

      if (this.prev_pvr_factor_ven !== this.pvr_factor_ven) {
        this.set_pvr_factor_ven(this.pvr_factor_ven)
        this.prev_pvr_factor_ven = this.pvr_factor_ven
      }


    }

    this._update_counter_slow += this._t;
    if (this._update_counter_slow > this._update_interval_slow) {
      this._update_counter_slow = 0.0;
      // calculate all the blood volumes (every 1 second for performance reasons)
      this.calc_blood_volumes();
    }
  }

  set_svr_factor_art(new_svr_factor) {
    // r_factor_ps is a persistent factor that accumulates effects from several models, so apply the
    // delta (not the absolute value). Compute it once so every vessel gets the same change.
    const delta_svr = new_svr_factor - this.prev_svr_factor_art;
    this.systemic_arterioles.forEach(syst_model_name => {
      const m = this._model_engine.models[syst_model_name];
      if (!m) return;
      // clamp the persistent factor at 0 (a negative resistance factor is non-physical)
      let f_ps = m.r_factor_ps + delta_svr;
      if (f_ps < 0) f_ps = 0;
      m.r_factor_ps = f_ps;
    });
    // store the requested target once, after the loop
    this.svr_factor_art = new_svr_factor;
  }

  set_svr_factor_drug(new_svr_factor) {
    // independent drug channel; applies its delta to the SAME systemic arterioles' r_factor_ps so it
    // composes additively with svr_factor_art (Hormones) and the ANS reactivity rather than colliding
    const delta_svr = new_svr_factor - this.prev_svr_factor_drug;
    this.systemic_arterioles.forEach(syst_model_name => {
      const m = this._model_engine.models[syst_model_name];
      if (!m) return;
      let f_ps = m.r_factor_ps + delta_svr;
      if (f_ps < 0) f_ps = 0;
      m.r_factor_ps = f_ps;
    });
    this.svr_factor_drug = new_svr_factor;
  }

  set_svr_factor_ven(new_svr_factor) {
    const delta_svr = new_svr_factor - this.prev_svr_factor_ven;
    this.systemic_venules.forEach(syst_model_name => {
      const m = this._model_engine.models[syst_model_name];
      if (!m) return;
      let f_ps = m.r_factor_ps + delta_svr;
      if (f_ps < 0) f_ps = 0;
      m.r_factor_ps = f_ps;
    });
    this.svr_factor_ven = new_svr_factor;
  }

  set_pvr_factor_art(new_pvr_factor) {
    const delta_pvr = new_pvr_factor - this.prev_pvr_factor_art;
    this.pulmonary_arterioles.forEach(pulm_model_name => {
      const m = this._model_engine.models[pulm_model_name];
      if (!m) return;
      let f_ps = m.r_factor_ps + delta_pvr;
      if (f_ps < 0) f_ps = 0;
      m.r_factor_ps = f_ps;
    });
    this.pvr_factor_art = new_pvr_factor;
  }

  set_pvr_factor_ven(new_pvr_factor) {
    const delta_pvr = new_pvr_factor - this.prev_pvr_factor_ven;
    this.pulmonary_venules.forEach(pulm_model_name => {
      const m = this._model_engine.models[pulm_model_name];
      if (!m) return;
      let f_ps = m.r_factor_ps + delta_pvr;
      if (f_ps < 0) f_ps = 0;
      m.r_factor_ps = f_ps;
    });
    this.pvr_factor_ven = new_pvr_factor;
  }

  calc_blood_volumes() {
    // return the total blood volume
    this.total_blood_volume = 0.0;
    this.syst_blood_volume = 0.0;
    this.pulm_blood_volume = 0.0;
    this.heart_blood_volume = 0.0;

    this._systemic_bloodvessel_list.forEach(name => {
      const m = this._model_engine.models[name];
      if (m && m.vol && m.is_enabled) this.syst_blood_volume += m.vol;
    })

    this.heart_chambers.forEach(name => {
      const m = this._model_engine.models[name];
      if (m && m.vol && m.is_enabled) this.heart_blood_volume += m.vol;
    })

    this.coronaries.forEach(name => {
      const m = this._model_engine.models[name];
      if (m && m.vol && m.is_enabled) this.syst_blood_volume += m.vol;
    })

    this._pulmonary_bloodvessel_list.forEach(name => {
      const m = this._model_engine.models[name];
      if (m && m.vol && m.is_enabled) this.pulm_blood_volume += m.vol;
    })

    this.total_blood_volume = this.syst_blood_volume + this.pulm_blood_volume + this.heart_blood_volume
    // guard against a zero total (e.g. before the circulation has filled) to avoid NaN percentages
    if (this.total_blood_volume > 0) {
      this.syst_blood_volume_perc = this.syst_blood_volume / this.total_blood_volume * 100.0
      this.pulm_blood_volume_perc = this.pulm_blood_volume / this.total_blood_volume * 100.0
      this.heart_blood_volume_perc = this.heart_blood_volume / this.total_blood_volume * 100.0
    } else {
      this.syst_blood_volume_perc = 0.0
      this.pulm_blood_volume_perc = 0.0
      this.heart_blood_volume_perc = 0.0
    }

  }
}

```

### FILE: explain/component_models/Drugs.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

/*
  The Drugs class is the pharmacology (PK/PD) controller. Like `Hormones` and `Ans` it is a process
  controller: it holds no blood of its own, resolves references to other models lazily, and owns its
  effector channels while enabled (releasing them once on disable).

  CAUSAL LOOP (per drug):

    SOURCE  — dosing injects drug mass into a blood compartment's existing `drugs{}` dict:
                bolus    : C += dose / vol                 (dose in mcg, vol in L → ng/mL)
                infusion : C += (rate·weight/60)·dt / vol  (rate in mcg/kg/min)
    TRANSPORT — handled entirely by the engine's existing `volume_in` mixing (BloodCapacitance /
                BloodTimeVaryingElastance / HeartChamber): any key present in a compartment's
                `drugs{}` advects through the whole circuit by incoming-volume fraction, exactly as
                solutes (Na/K) do. We only SEED the key into every blood compartment (the dicts ship
                empty), lazily on the first step.
    SINK    — elimination = a diffuse first-order term on every compartment (`clearance.global`,
                e.g. COMT/MAO/uptake) PLUS organ-localized intrinsic clearance at configured clearing
                compartments (`clearance.sites`, e.g. KID_CAP renal, LS_CAP hepatic). Because those
                organ compartments are continuously perfused, the localized term yields
                perfusion-/flow-scaled whole-body clearance (a well-stirred organ model): if organ
                blood flow falls, the drug lingers — exactly like real renal/hepatic clearance.
    BIOPHASE — optional effect compartment per drug: dCe/dt = ke0·(C_site − Ce). When ke0 > 0 the PD
                map is driven by the lagged biophase concentration Ce, giving onset/offset hysteresis
                (effect peak trails the plasma peak). ke0 = 0 (default) → PD uses the site conc directly.
    EFFECT  — each drug contributes an independent sigmoid Emax/Hill per effect; the contributions
                are SUMMED across all enabled drugs onto the shared *_drug_factor channels (so two
                drugs compose additively rather than overwrite). M2 effects: heart rate (β1
                chronotropy → Heart.hr_drug_factor), contractility (β1 inotropy → each chamber's
                el_max_drug_factor), systemic vascular resistance (α1 → Circulation.svr_factor_drug).

  Concentration unit convention: mcg/L ≡ ng/mL throughout (dose in mcg, blood volumes in L).

  Adding a drug = a new `drug_defs` entry (it is seeded, transported, cleared and aggregated
  automatically). Next milestone (M4): surface params + dosing methods to the UI registry.
*/

export class Drugs extends BaseModelClass {
  // static properties
  static model_type = "Drugs";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // -----------------------------------------------
    // gating
    this.drugs_running = true; // master gate (false → effector channels released to neutral)

    // -----------------------------------------------
    // wiring (resolved lazily; the blood compartments are built by Circulation AFTER this model inits)
    this.injection_site = "IVCI"; // central-venous compartment that receives IV boluses/infusions
    this.effect_site = "AA"; // systemic-arterial compartment whose concentration drives the effect
    this.heart_name = "Heart"; // effector target (heart-rate + contractility channels)
    this.circulation_name = "Circulation"; // effector target (systemic vascular resistance channel)

    // -----------------------------------------------
    // per-drug registry. Concentrations live in the compartments' drugs{} dict (ng/mL = mcg/L).
    // clearance.global = diffuse first-order rate (1/s) on every compartment; clearance.sites =
    // organ-localized intrinsic rates (1/s) at the named clearing compartments (perfusion-scaled).
    // ke0 = effect-compartment rate (1/s); 0 disables the biophase lag. Each effect is an
    // independent sigmoid Emax/Hill; emax is the max FRACTIONAL change on its *_drug_factor.
    this.drug_defs = {
      adrenaline: {
        enabled: true,
        // PK — mostly diffuse (adrenaline is widely metabolised) with a minor renal/hepatic component
        clearance: { global: 0.022, sites: { KID_CAP: 0.6, LS_CAP: 0.9, INT_CAP: 0.4 } },
        ke0: 0.0, // biophase off by default
        // PD — heart rate (β1 chronotropy)
        hr_ec50: 20.0, hr_emax: 0.6, hr_hill: 1.5,
        // PD — contractility / inotropy (β1)
        cont_ec50: 25.0, cont_emax: 0.8, cont_hill: 1.5,
        // PD — systemic vascular resistance (α1); higher EC50 (α dominates at higher concentration)
        svr_ec50: 40.0, svr_emax: 0.5, svr_hill: 2.0,
      },
      noradrenaline: {
        enabled: true,
        // PK — similar fast handling; clearing organs configured to exercise organ-localized clearance
        clearance: { global: 0.018, sites: { KID_CAP: 0.6, LS_CAP: 1.0, INT_CAP: 0.4 } },
        ke0: 0.0,
        // PD — predominantly α1 vasoconstriction, modest β1 inotropy, minimal direct chronotropy
        hr_ec50: 30.0, hr_emax: 0.1, hr_hill: 1.5,
        cont_ec50: 30.0, cont_emax: 0.35, cont_hill: 1.5,
        svr_ec50: 25.0, svr_emax: 0.9, svr_hill: 2.0,
      },
    };

    // -----------------------------------------------
    // dependent parameters (diagnostic read-outs)
    this.concentrations = {}; // { drug: effect-site conc (ng/mL) }
    this.biophase = {}; // { drug: effect-compartment conc (ng/mL) }
    this.conc_inj = 0.0; // adrenaline injection-site conc (convenience read-out)
    this.conc_eff = 0.0; // adrenaline effect-site conc (convenience read-out)
    this.hr_drug_factor = 1.0; // applied (summed) → Heart.hr_drug_factor (1.0 = no effect)
    this.cont_drug_factor = 1.0; // applied (summed) → each chamber's el_max_drug_factor (1.0 = no effect)
    this.svr_drug_factor = 1.0; // applied (summed) → Circulation.svr_factor_drug (1.0 = no effect)

    // active continuous infusions: { drugName: rate_mcg_kg_min }
    this.infusions = {};

    // -----------------------------------------------
    // local parameters
    this._was_active = false; // tracks active→inactive for the one-shot channel release
    this._seeded = false; // whether the drugs{} keys have been seeded into the circuit
    this._blood_components = []; // resolved list of blood compartments (lazy)
    this._clearance_targets = []; // resolved [{ comp, drug, rate }] for organ-localized clearance
    this._ce = {}; // per-drug biophase (effect-compartment) concentration state
    this._injection = null;
    this._effect = null;
    this._heart = null;
    this._circ = null;

    // blood-carrying model types whose drugs{} dict participates in transport (mirrors Blood.js)
    this._blood_modeltypes = [
      "BloodVessel",
      "HeartChamber",
      "BloodCapacitance",
      "BloodTimeVaryingElastance",
      "BloodPump",
      "MicroVascularUnit",
    ];
  }

  init_model(args) {
    // base applies args (no components on this model). Refs/seeding are resolved lazily on first step
    // because Circulation builds the blood compartments during ITS init, possibly after this model.
    super.init_model(args);
  }

  calc_model() {
    // master gate — release owned channels once, then idle
    if (!this.drugs_running) {
      if (this._was_active) this._release_channels();
      this._was_active = false;
      return;
    }

    this._resolve_refs(); // resolves refs, seeds the drugs{} keys and clearance targets (once)

    // 1. SOURCE — apply active continuous infusions at the injection site
    if (this._injection && this._injection.vol > 0.0) {
      Object.keys(this.infusions).forEach((drug) => {
        const rate = this.infusions[drug]; // mcg/kg/min
        if (rate > 0.0 && this._injection.drugs[drug] !== undefined) {
          const mass = (rate * this._model_engine.weight) / 60.0 * this._t; // mcg added this step
          this._injection.drugs[drug] += mass / this._injection.vol; // → ng/mL
        }
      });
    }

    // 2. SINK — diffuse (global) clearance on every compartment ...
    Object.keys(this.drug_defs).forEach((drug) => {
      const kg = this.drug_defs[drug].clearance?.global ?? 0.0;
      if (kg <= 0.0) return;
      this._blood_components.forEach((comp) => {
        const c = comp.drugs[drug];
        if (c > 0.0) { const n = c - c * kg * this._t; comp.drugs[drug] = n > 0.0 ? n : 0.0; }
      });
    });
    // ... plus organ-localized intrinsic clearance at the clearing compartments (perfusion-scaled)
    this._clearance_targets.forEach(({ comp, drug, rate }) => {
      const c = comp.drugs[drug];
      if (c > 0.0) { const n = c - c * rate * this._t; comp.drugs[drug] = n > 0.0 ? n : 0.0; }
    });

    // 3. EFFECT — biophase lag (optional) then sum each effect across all enabled drugs
    let hr_sum = 0.0, cont_sum = 0.0, svr_sum = 0.0;
    Object.keys(this.drug_defs).forEach((drug) => {
      const def = this.drug_defs[drug];
      const c_site = this._effect?.drugs?.[drug] ?? 0.0;
      this.concentrations[drug] = c_site;
      // effect-compartment (biophase) lag toward the site concentration
      let c_drive = c_site;
      if (def.ke0 > 0.0) {
        const ce = this._ce[drug] ?? 0.0;
        this._ce[drug] = ce + def.ke0 * (c_site - ce) * this._t;
        c_drive = this._ce[drug];
      }
      this.biophase[drug] = c_drive;
      if (!def.enabled) return;
      hr_sum   += this._emax(c_drive, def.hr_emax,   def.hr_ec50,   def.hr_hill);
      cont_sum += this._emax(c_drive, def.cont_emax, def.cont_ec50, def.cont_hill);
      svr_sum  += this._emax(c_drive, def.svr_emax,  def.svr_ec50,  def.svr_hill);
    });
    this.hr_drug_factor = 1.0 + hr_sum;
    this.cont_drug_factor = 1.0 + cont_sum;
    this.svr_drug_factor = 1.0 + svr_sum;
    this.conc_eff = this.concentrations.adrenaline ?? 0.0;
    this.conc_inj = this._injection?.drugs?.adrenaline ?? 0.0;

    // write the (summed) effector channels
    if (this._heart) this._heart.hr_drug_factor = this.hr_drug_factor; // already wired into HR calc
    this._write_chamber_inotropy(this.cont_drug_factor); // mirrors the Mob inotropy path
    if (this._circ) this._circ.svr_factor_drug = this.svr_drug_factor; // independent SVR channel

    this._was_active = true;
  }

  // ---- dosing API (callable via callModelFunction / TaskScheduler) ----

  // instantaneous IV bolus: add `dose` mcg to the injection-site compartment (→ ng/mL)
  administer_bolus(drug, dose) {
    this._resolve_refs();
    if (this._injection && this._injection.vol > 0.0 && this._injection.drugs[drug] !== undefined) {
      this._injection.drugs[drug] += dose / this._injection.vol;
    }
  }

  // start/stop a weight-based continuous infusion (mcg/kg/min); rate 0 stops it
  set_infusion(drug, rate) {
    this.infusions[drug] = rate;
  }

  // adjust a PK/PD constant of a drug from the UI (the params live in a nested per-drug dict that the
  // flat setPropValue path can't reach, so this setter is exposed instead — mirrors Metabolism's
  // set_metabolic_active_model). `param` is a dotted path into the drug def, e.g. "hr_emax", "ke0",
  // "clearance.global".
  set_drug_param(drug, param, value) {
    const def = this.drug_defs[drug];
    if (!def || param == null) return;
    const parts = String(param).split(".");
    let obj = def;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }

  // ---- internals ----

  // resolve effector/site references lazily and seed the circuit (drug keys + clearance targets) once
  _resolve_refs() {
    if (!this._heart) this._heart = this._model_engine.models[this.heart_name] ?? null;
    if (!this._circ) this._circ = this._model_engine.models[this.circulation_name] ?? null;
    if (!this._injection) this._injection = this._model_engine.models[this.injection_site] ?? null;
    if (!this._effect) this._effect = this._model_engine.models[this.effect_site] ?? null;
    if (!this._seeded) this._seed_drugs();
  }

  // write the inotropy factor to every heart chamber, reaching them through the Heart's resolved
  // chamber refs exactly as Mob does for el_max_mob_factor (atria + both ventricles, RA split guarded)
  _write_chamber_inotropy(factor) {
    const h = this._heart;
    if (!h) return;
    if (h._lv) h._lv.el_max_drug_factor = factor;
    if (h._rv) h._rv.el_max_drug_factor = factor;
    if (h._la) h._la.el_max_drug_factor = factor;
    if (h._raivci) h._raivci.el_max_drug_factor = factor;
    if (h._rasvc) h._rasvc.el_max_drug_factor = factor;
    if (h._ra) h._ra.el_max_drug_factor = factor;
  }

  // ensure every blood compartment carries each drug key (the dicts ship empty), so the existing
  // volume_in mixing has something to propagate, and resolve the organ-localized clearance targets.
  // Runs once, after Circulation has built its components onto model.models.
  _seed_drugs() {
    this._blood_components = [];
    for (const model_name in this._model_engine.models) {
      const m = this._model_engine.models[model_name];
      if (m && this._blood_modeltypes.includes(m.model_type) && m.drugs) {
        this._blood_components.push(m);
        Object.keys(this.drug_defs).forEach((drug) => {
          if (m.drugs[drug] === undefined) m.drugs[drug] = 0.0;
        });
      }
    }
    if (this._blood_components.length === 0) return; // circuit not built yet — retry next step

    // resolve organ-localized clearance targets once the compartments exist
    this._clearance_targets = [];
    Object.keys(this.drug_defs).forEach((drug) => {
      const sites = this.drug_defs[drug].clearance?.sites ?? {};
      Object.keys(sites).forEach((site) => {
        const comp = this._model_engine.models[site];
        if (comp && comp.drugs) this._clearance_targets.push({ comp, drug, rate: sites[site] });
      });
    });
    this._seeded = true;
  }

  // release owned effector channels back to neutral exactly once (on disable)
  _release_channels() {
    this._resolve_refs();
    if (this._heart) this._heart.hr_drug_factor = 1.0;
    this._write_chamber_inotropy(1.0);
    if (this._circ) this._circ.svr_factor_drug = 1.0;
    this.hr_drug_factor = 1.0;
    this.cont_drug_factor = 1.0;
    this.svr_drug_factor = 1.0;
  }

  // sigmoid Emax / Hill: effect = emax · c^n / (ec50^n + c^n)
  _emax(c, emax, ec50, n) {
    if (!emax || c <= 0.0) return 0.0;
    const cn = Math.pow(c, n);
    return (emax * cn) / (Math.pow(ec50, n) + cn);
  }
}

```

### FILE: explain/component_models/Fluids.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";
// ----------------------------------------------------------------------------
export class Fluids extends BaseModelClass {
  // static properties
  static model_type = "Fluids";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // initialize independent properties
    this.fluids_temp = 37.0
    this.fluids = {}
    this.default_volume = 10;

    // initialize dependent properties
    
    // initialize local properties (preceded with _)
    this._default_time = 10;
    this._default_type = "normal_saline"
    this._running_fluid_list = []
    this._update_interval = 0.015;      // update interval (s)
    this._update_counter = 0.0;         // update interval counter (s)
  }
  
  init_model(args = {}) {
    super.init_model(args)
  }

  calc_model() {
    this._update_counter += this._t
    if (this._update_counter > this._update_interval) {
        this._update_counter = 0;
        this.process_fluid_list();
    }
  }

   add_volume(volume, in_time = 10, fluid_in = "normal_saline", site = "VLB") {
    // build a fluid object which can be fed to a BloodVessel, BloodCapacitance or BloodTimeVaryingElastance
    let fluid = {
      vol: volume / 1000.0,
      time_left: in_time,
      delta: (volume / 1000.0) / (in_time / this._update_interval),
      site: site,
      to2 : 0.0,
      tco2 : 0.0,
      temp: this.fluids_temp,
      viscosity: 1,
      solutes: {...this.fluids[fluid_in]},
      drugs: {}
    }
    this._running_fluid_list.push(fluid)
  }

  process_fluid_list() {
    if (this._running_fluid_list.length > 0) {
      // remove the fluids which are done
      let filtered_list = this.removeByProperty(this._running_fluid_list, "time_left", 0.0)
      this._running_fluid_list = [...filtered_list]

      this._running_fluid_list.forEach(f => {
        // administer this step's increment first (skip silently if the target site is missing),
        // then advance the timer — so the final increment is not zeroed before it is delivered
        this._model_engine.models[f.site]?.volume_in(f.delta, f)

        f.vol -= f.delta
        f.time_left -= this._update_interval
        if (f.time_left <= 0) {
          f.delta = 0.0;
          f.time_left = 0.0
        }
      })
    }
  }
  removeByProperty(arr, propName, valueToRemove) {
    return arr.filter(item => item[propName] > valueToRemove);
  }

}

```

### FILE: explain/component_models/Gas.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";
import { calc_gas_composition } from "./GasComposition"

export class Gas extends BaseModelClass {
  // static properties
  static model_type = "Gas";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // initialize independent properties
    this.pres_atm = 760.0; // atmospheric pressure in mmHg
    this.fio2 = 0.21; // fractional O2 concentration
    this.temp = 20.0; // global gas temperature (dgs C)
    this.humidity = 0.5; // global gas humidity (fraction)
    this.humidity_settings = {}; // dictionary holding the initial humidity settings of gas containing models
    this.temp_settings = {}; // dictionary holding the initial temperature settings of gas containing models

    // local properties
    this.gas_containing_modeltypes = ["GasCapacitance"];
    this._gas_components = [];
  }

  init_model(args = {}) {
    // set the values of the independent properties
    args.forEach((arg) => {
      this[arg["key"]] = arg["value"];
    });

    this._gas_components = [];
    for (const model_name in this._model_engine.models) {
      const model = this._model_engine.models[model_name];
      if (this.gas_containing_modeltypes.includes(model.model_type)) {
        this._gas_components.push(model);
        model.pres_atm = this.pres_atm;
        model.temp = this.temp;
        model.target_temp = this.temp;
      }
    }

    // set the temperatures of the different gas containing components
    Object.keys(this.temp_settings).forEach((model_name) => {
      let temp = this.temp_settings[model_name];
      this._model_engine.models[model_name].temp = temp;
      this._model_engine.models[model_name].target_temp = temp;
    });

    // set the humidity of the different gas containing components
    Object.keys(this.humidity_settings).forEach((model_name) => {
      let humidity = this.humidity_settings[model_name];
      this._model_engine.models[model_name].humidity = humidity;
    });

    // calculate the gas composition of the gas containing model types.
    // only bootstrap composition for freshly-constructed compartments (no gas of any species). A
    // restored/loaded state already carries the per-compartment concentrations, so guarding on the
    // raw concentrations — rather than the derived ctotal, which may not be serialized — preserves
    // the restored composition even when ctotal is missing/0.
    this._gas_components.forEach((model) => {
      const total_gas = model.co2 + model.cco2 + model.cn2 + model.ch2o + model.cother;
      if (total_gas === 0) {
        calc_gas_composition(model, this.fio2, model.temp, model.humidity);
      }
    });

    // flag that the model is initialized
    this._is_initialized = true;
  }

  calc_model() {
    // empty for now
  }

  set_atmospheric_pressure(new_pres_atm) {
    this.pres_atm = new_pres_atm;

    // set the atmospheric pressure in all gas containing models
    this._gas_components.forEach((model) => {
      model.pres_atm = this.pres_atm;
    });
  }

  set_temperature(new_temp, sites = ["OUT", "MOUTH"]) {
    // make sure sites is an array
    sites = Array.isArray(sites) ? sites : [sites];
    
    // adjust the temperature in components stored in the sites parameter
    sites.forEach((site) => {
      this.temp_settings[site] = parseFloat(new_temp);
    });

    // set the temperatures of the different gas containing components
    Object.keys(this.temp_settings).forEach((model_name) => {
      let temp = this.temp_settings[model_name];
      this._model_engine.models[model_name].temp = temp;
      this._model_engine.models[model_name].target_temp = temp;
    });
  }

  set_humidity(new_humidity, sites = ["OUT", "MOUTH"]) {
    
    // make sure sites is an array
    sites = Array.isArray(sites) ? sites : [sites];

    // adjust the humidity in components stored in the sites parameter
    sites.forEach((site) => {
      this.humidity_settings[site] = parseFloat(new_humidity);
    });

    // set the humidities of the different gas containing components
    Object.keys(this.humidity_settings).forEach((model_name) => {
      let humidity = this.humidity_settings[model_name];
      this._model_engine.models[model_name].humidity = humidity;
    });
  }

  set_fio2(new_fio2, sites = ["OUT", "MOUTH"]) {
    // parse to a number (UI values may arrive as strings) to avoid string concatenation in the
    // gas-fraction math (e.g. 1 - (fio2 + fico2)), which would otherwise produce NaN concentrations
    this.fio2 = parseFloat(new_fio2);

    // make sure sites is an array
    sites = Array.isArray(sites) ? sites : [sites];

    // calculate the gas composition for the gas containing models
    sites.forEach((site) => {
      let m = this._model_engine.models[site];
      calc_gas_composition(m, this.fio2, m.temp, m.humidity);
    });
  }
}

```

### FILE: explain/component_models/GasCapacitance.js

```javascript
import { Capacitance } from "../base_models/Capacitance";

// This class represents a gas capacitance model, which is a subclass of the Capacitance class.
// This class adds functionality to handle gas-specific properties such as temperature, humidity ans gas concentrations.

export class GasCapacitance extends Capacitance {
  // static properties
  static model_type = "GasCapacitance";

  constructor(model_ref, name = "") {
    // call the parent constructor
    super(model_ref, name);

    // initialize independent properties unique to a GasCapacitance
    this.pres_atm = 760; // atmospheric pressure (mmHg)
    this.pres_cc = 0.0; // external pressure (mmHg)
    this.pres_mus = 0.0; // muscle pressure (mmHg)
    this.fixed_composition = false; // flag for fixed gas composition
    this.target_temp = 0.0; // target temperature (dgs C)

    // initialize dependent properties unique to a GasCapacitance
    this.ctotal = 0.0; // total gas molecule concentration (mmol/l)
    this.co2 = 0.0; // oxygen concentration (mmol/l)
    this.cco2 = 0.0; // carbon dioxide concentration (mmol/l)
    this.cn2 = 0.0; // nitrogen concentration (mmol/l)
    this.cother = 0.0; // other gases concentration (mmol/l)
    this.ch2o = 0.0; // water vapor concentration (mmol/l)
    this.pres_rel = 0.0; // pressure relative to atmospheric (mmHg)
    this.po2 = 0.0; // partial pressure of oxygen (mmHg)
    this.pco2 = 0.0; // partial pressure of carbon dioxide (mmHg)
    this.pn2 = 0.0; // partial pressure of nitrogen (mmHg)
    this.pother = 0.0; // partial pressure of other gases (mmHg)
    this.ph2o = 0.0; // partial pressure of water vapor (mmHg)
    this.fo2 = 0.0; // fraction of oxygen of total gas volume
    this.fco2 = 0.0; // fraction of carbon dioxide of total gas volume
    this.fn2 = 0.0; // fraction of nitrogen of total gas volume
    this.fother = 0.0; // fraction of other gases of total gas volume
    this.fh2o = 0.0; // fraction of water vapor of total gas volume
    this.temp = 0.0; // gas temperature (dgs C)
    this.humidity = 0.0; // humidity (fraction)
   
    // local properties
    this._gas_constant = 62.36367; // ideal gas law constant (L·mmHg/(mol·K))
  }

  // override the calc_model method from the Capoacitance class
  calc_model() {
    // add heat to the gas
    this.add_heat();
    // add water vapor to the gas
    this.add_watervapour();
    // calculate the elastance and volumes
    this.calc_elastances();
    this.calc_volumes();
    
    // calculate the pressure
    this.calc_pressure();

    // update the gas composition
    this.calc_gas_composition();
  }

  calc_pressure() {
    // call parent method to calculate the elastance
    super.calc_pressure();

    // incorporate the external pressures and atmospheric pressure
    this.pres = this.pres + this.pres_cc + this.pres_mus + this.pres_atm;
    this.pres_rel = this.pres - this.pres_atm

    // reset the external pressure
    this.pres_cc = 0.0;
    this.pres_mus = 0.0;
  }

  // the method overrides the 'volume_in' method of the Capacitance class and 
  volume_in(dvol, comp_from) {
    // call the parent method from the Capacitance class to update the volume
    super.volume_in(dvol, comp_from);

    // a fixed-composition compartment is an infinite reservoir: hold its composition
    // (and temperature) constant, just as the parent already holds its volume constant
    if (this.fixed_composition) return;

    // guard against division by zero on an empty compartment (would produce NaN concentrations)
    if (this.vol <= 0.0) return;

    // process the changes in gas composition
    this.co2 = (this.co2 * this.vol + (comp_from.co2 - this.co2) * dvol) / this.vol;
    this.cco2 = (this.cco2 * this.vol + (comp_from.cco2 - this.cco2) * dvol) / this.vol;
    this.cn2 = (this.cn2 * this.vol + (comp_from.cn2 - this.cn2) * dvol) / this.vol;
    this.ch2o = (this.ch2o * this.vol + (comp_from.ch2o - this.ch2o) * dvol) / this.vol;
    this.cother = (this.cother * this.vol + (comp_from.cother - this.cother) * dvol) / this.vol;

    // adjust temperature due to gas influx
    this.temp = (this.temp * this.vol + (comp_from.temp - this.temp) * dvol) / this.vol;
  }

  add_heat() {
    // calculate the change in temperature based on the target temperature 
    let dT = (this.target_temp - this.temp) * 0.0005;
    // add heat to the gas
    this.temp += dT;

    // calculate the change in volume based on the ideal gas law
    if (this.pres !== 0.0 && !this.fixed_composition) {
      let dV = (this.ctotal * this.vol * this._gas_constant * dT) / this.pres;
      this.vol += dV / 1000.0;
    }

    // ensure the volume does not go below zero
    if (this.vol < 0) this.vol = 0;
  }

  add_watervapour() {
    // calculate the water vapor pressure based on the temperature and pressure
    let pH2Ot = this.calc_watervapour_pressure();

    // calculate the change in water vapor concentration
    let dH2O = 0.00001 * (pH2Ot - this.ph2o) * this._t;

    // calculate the change in water vapor concentration based on the temperature and pressure
    // (skip for a fixed-composition compartment so its water vapor stays constant)
    if (this.vol > 0.0 && !this.fixed_composition) {
      this.ch2o = (this.ch2o * this.vol + dH2O) / this.vol;
    }

    // calculate the change in volume based on the change in water vapor concentration
    if (this.pres !== 0.0 && !this.fixed_composition) {
      this.vol += ((this._gas_constant * (273.15 + this.temp)) / this.pres) * (dH2O / 1000.0);
    }
  }

  calc_watervapour_pressure() {
    // calculate the water vapor pressure based on the temperature
    return Math.exp(20.386 - 5132 / (this.temp + 273.15));
  }

  calc_gas_composition() {
    // calculate the total gas concentration
    this.ctotal = this.ch2o + this.co2 + this.cco2 + this.cn2 + this.cother;

    // calculate the partial pressures and fractions of each gas
    // check if the total gas concentration is zero to avoid division by zero
    if (this.ctotal === 0.0) return;

    // calculate the partial pressures
    this.ph2o = (this.ch2o / this.ctotal) * this.pres;
    this.po2 = (this.co2 / this.ctotal) * this.pres;
    this.pco2 = (this.cco2 / this.ctotal) * this.pres;
    this.pn2 = (this.cn2 / this.ctotal) * this.pres;
    this.pother = (this.cother / this.ctotal) * this.pres;

    // calculate the fractions of each gas
    this.fh2o = this.ch2o / this.ctotal;
    this.fo2 = this.co2 / this.ctotal;
    this.fco2 = this.cco2 / this.ctotal;
    this.fn2 = this.cn2 / this.ctotal;
    this.fother = this.cother / this.ctotal;
  }
}

```

### FILE: explain/component_models/GasComposition.js

```javascript
export function calc_gas_composition(
  gc,
  fio2 = 0.205,
  temp = 37,
  humidity = 1.0,
  fico2 = 0.000392
) {
  const _fo2_dry = 0.205;
  const _fco2_dry = 0.000392;
  const _fn2_dry = 0.794608;
  const _fother_dry = 0.0;
  const _gas_constant = 62.36367;

  // calculate the dry gas composition depending on the supplied fio2
  let new_fo2_dry = fio2;
  let new_fco2_dry = fico2;
  let new_fn2_dry = (_fn2_dry * (1.0 - (fio2 + fico2))) / (1.0 - (_fo2_dry + _fco2_dry));
  let new_fother_dry = (_fother_dry * (1.0 - (fio2 + fico2))) / (1.0 - (_fo2_dry + _fco2_dry));

  // make sure the latest pressure is available
  gc.calc_model();

  // get the gas capacitance pressure
  let pressure = gc.pres;

  // persist the temperature and humidity used to compute the composition so the compartment's
  // own per-step calculations stay consistent with the concentrations set below
  gc.temp = temp;
  gc.humidity = humidity;

  // guard against a non-physical pressure (would otherwise produce Infinity/NaN fractions)
  if (!(pressure > 0)) return;

  // calculate the concentration at this pressure and temperature in mmol/l using the gas law
  gc.ctotal = (pressure / (_gas_constant * (273.15 + temp))) * 1000.0;

  // calculate the water vapor pressure, concentration, and fraction for this temperature and humidity (0 - 1)
  gc.ph2o = Math.exp(20.386 - 5132 / (temp + 273.15)) * humidity;
  gc.fh2o = gc.ph2o / pressure;
  gc.ch2o = gc.fh2o * gc.ctotal;

  // calculate the o2 partial pressure, fraction, and concentration
  gc.po2 = new_fo2_dry * (pressure - gc.ph2o);
  gc.fo2 = gc.po2 / pressure;
  gc.co2 = gc.fo2 * gc.ctotal;

  // calculate the co2 partial pressure, fraction, and concentration
  gc.pco2 = new_fco2_dry * (pressure - gc.ph2o);
  gc.fco2 = gc.pco2 / pressure;
  gc.cco2 = gc.fco2 * gc.ctotal;

  // calculate the n2 partial pressure, fraction, and concentration
  gc.pn2 = new_fn2_dry * (pressure - gc.ph2o);
  gc.fn2 = gc.pn2 / pressure;
  gc.cn2 = gc.fn2 * gc.ctotal;

  // calculate the other gas partial pressure, fraction, and concentration
  gc.pother = new_fother_dry * (pressure - gc.ph2o);
  gc.fother = gc.pother / pressure;
  gc.cother = gc.fother * gc.ctotal;
}
```

### FILE: explain/component_models/Heart.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

export class Heart extends BaseModelClass {
  // static properties
  static model_type = "Heart";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // -----------------------------------------------
    // independent properties
    // -----------------------------------------------
    this.heart_rate_ref = 110.0; // reference heart rate (beats/minute)
    this.pq_time = 0.1; // pq time (s)
    this.qrs_time = 0.075; // qrs time (s)
    this.qt_time = 0.25; // qt time (s)
    this.av_delay = 0.0005; // delay in the AV-node (s)

    // ECG wave amplitudes (mV) — morphology of the synthesized ecg_signal
    this.p_amp = 0.15; // P wave amplitude (mV)
    this.q_amp = -0.1; // Q wave amplitude (mV)
    this.r_amp = 1.0; // R wave amplitude (mV)
    this.s_amp = -0.25; // S wave amplitude (mV)
    this.t_amp = 0.25; // T wave amplitude (mV)
    this.ans_sens = 1.0; // sensitivity of the heart for autonomic nervous system control
    this.ans_activity = 1.0; // ans activity simulating B-adrenergic effect on contractility and relaxation
    this.ans_activity_hr = 1.0; // heart rate factor of the autonomic nervous system
    this.ans_activity_factor = 1.0; // ANS-activity scaler from the Mob myocardial-oxygen-balance hypoxia feedback (1.0 = no effect)
    this.hr_factor = 1.0; // heart rate factor
    this.hr_override = false; // when set to true the heart rate is fixed on the reference heart rate, ignoring the influence of the factors
    this.hr_mob_factor = 1.0; // heart rate factor of the myocardial oxygen balance model
    this.hr_temp_factor = 1.0; // heart rate factor of the temperature (not implemented yet)
    this.hr_drug_factor = 1.0; // heart rate factor of the drug model (not implemented yet)

    this.cont_factor = 1.0; // contractility factor
    this.cont_factor_left = 1.0; // left heart contractility factor
    this.cont_factor_right = 1.0; // right heart contractility factor
    this.cont_mob_factor = 1.0; // contractility factor of myocardial oxygen balance model
    this.cont_drug_factor = 1.0; // contractility factor of drug model (not implemented yet)

    this.relax_factor = 1.0; // relaxation factor (higher is less relaxation!)
    this.relax_factor_left = 1.0; // left heart relaxation factor
    this.relax_factor_right = 1.0; // right heart relaxation factor
    this.relax_mob_factor = 1.0; // relaxation factor of myocardial oxygen balance model
    this.relax_drug_factor = 1.0; // relaxation factor of drug model (not implemented yet)

    this.pc_el_factor = 1.0; // elastance factor of the pericardium
    this.pc_extra_volume = 0.0; // additional volume of the pericardium
  
    // -----------------------------------------------
    // dependent properties
    // -----------------------------------------------
    this.heart_rate = 120.0; // calculated heart rate (beats/minute)
    this.heart_rate_measured = 120; // measured heart rate
    this.cardiac_cycle_state = 0;

    this.ecg_signal = 0.0; // ecg signal (mV)
    this.ncc_ventricular = 0; // ventricular contraction counter
    this.ncc_atrial = 0; // atrial contraction counter
    this.cardiac_cycle_running = 0; // signal whether or not the cardiac cycle is running (0 = not, 1 = running)
    this.cardiac_cycle_time = 0.353; // cardiac cycle time (s)

    this.lv_edv = this.lv_esv = 0.0
    this.lv_edp = 0.0
    this.lv_esp = 0.0
    this.lv_sp = 0.0
    this.lv_sv = 0.0
    this.lv_ef = 0.0

    this.rv_edv = 0.0
    this.rv_esv = 0.0
    this.rv_edp = 0.0
    this.rv_esp = 0.0
    this.rv_sp = 0.0
    this.rv_sv = 0.0
    this.rv_ef = 0.0

    this.ra_edv = 0.0
    this.ra_esv = 0.0
    this.ra_edp = 0.0
    this.ra_esp = 0.0
    this.ra_sp = 0.0

    this.la_edv = 0.0
    this.la_esv = 0.0
    this.la_edp = 0.0
    this.la_esp = 0.0
    this.la_sp = 0.0


    // -----------------------------------------------
    // local properties
    // -----------------------------------------------
    this._kn = 0.579; // constant of the activation curve
    this.prev_cardiac_cycle_running = 0;
    this.prev_cardiac_cycle_state = 0;
    this._temp_cardiac_cycle_time = 0.0;
    this._sa_node_interval = 1.0;
    this._sa_node_timer = 0.0;
    this._av_delay_timer = 0.0;
    this._pq_timer = 0.0;
    this._pq_running = false;
    this._av_delay_running = false;
    this._qrs_timer = 0.0;
    this._qrs_running = false;
    this._ventricle_is_refractory = false;
    this._qt_timer = 0.0;
    this._qt_running = false;
    this._la = null;
    this._lv = null;
    this._ra = null;
    this._ra_rv = null;
    this._raivci = null;
    this._raivci_rv = null;
    this._rasvc = null;
    this._rasvc_rv = null;
    this._rv = null;
    this._la_lv = null;
    this._lv_aa = null;
    this._coronaries = null;

    this._systole_running = false
    this._diastole_running = false

    this.prev_la_lv_flow = 0.0;
    this.prev_lv_aa_flow = 0.0;
    this.prev_cont_factor = 1.0;
    this.prev_cont_factor_left = 1.0;
    this.prev_cont_factor_right = 1.0;

    this.prev_relax_factor = 1.0;
    this.prev_relax_factor_left = 1.0;
    this.prev_relax_factor_right = 1.0;

    this.prev_pc_el_factor = 1.0;
    this._hr_counter = 1;
    this._hr_factor = 1;
    
    this._update_counter_factors = 0.0;
    this._update_interval_factors = 0.015;
  }

  init_model(args = {}) {
    super.init_model(args);

    // left atrial components (atrium and mitral valve)
    this._la = this._model_engine.models["LA"] || null;
    this._la_lv = this._model_engine.models["LA_LV"] || null;

    // right atrial components (atrium and tricuspid valve)
    this._ra = this._model_engine.models["RA"] || null;
    this._ra_rv = this._model_engine.models["RA_RV"] || null;

    // preferential flow models are not always present in the model, so we check for their presence
    this._raivci = this._model_engine.models["RAIVCI"] || null;
    this._raivci_rv = this._model_engine.models["RAIVCI_RV"] || null;
    this._rasvc = this._model_engine.models["RASVC"] || null;
    this._rasvc_rv = this._model_engine.models["RASVC_RV"] || null;
    this._raivci_rasvc = this._model_engine.models["RAIVCI_RASVC"] || null;

    // right ventricular components (ventricle and pulmonary valve)
    this._rv = this._model_engine.models["RV"] || null;
    this._rv_pa = this._model_engine.models["RV_PA"] || null;
    
    // TGA or other congenital heart diseases may not have a normal connection
    this._rv_aa = this._model_engine.models["RV_AA"] || null; 

    // left ventricular components (ventricle and aortic valve)
    this._lv = this._model_engine.models["LV"] || null;
    this._lv_aa = this._model_engine.models["LV_AA"] || null;
    
    // TGA or other congenital heart diseases may not have a normal connection, so we check for the presence of the LV_PA model before trying to access it
    this._lv_pa = this._model_engine.models["LV_PA"] || null; 

    // coronary circulation model (not always present in the model, so we check for its presence)
    this._coronaries = this._model_engine.models["COR"] || this._model_engine.models["CORONARIES"] || null;
    this._aa_cor = this._model_engine.models["AA_COR"] || null;
    
    // preferential flow models are not always present in the model, so we check for their presence
    this._cor_raivci = this._model_engine.models["COR_RAIVCI"] || null;
    this._cor_rasvc = this._model_engine.models["COR_RASVC"] || null;

    // pericardium model (not always present in the model, so we check for its presence)
    this._pc = this._model_engine.models["PERICARDIUM"] || null;
  }

  analyze() {
    // state going from systole to diastole (end systolic)
    if (this.prev_cardiac_cycle_state === 1 && this.cardiac_cycle_state === 0) {
      this.lv_esv = this._lv ? this._lv.vol : 0;
      this.lv_esp = this._lv ? this._lv.pres_in : 0;

      this.la_esv = this._la ? this._la.vol : 0;
      this.la_esp = this._la ? this._la.pres_in : 0;
      
      this.rv_esv = this._rv ? this._rv.vol : 0;
      this.rv_esp = this._rv ? this._rv.pres_in : 0;
      
      this.ra_esv = (this._raivci ? this._raivci.vol : 0) + (this._rasvc ? this._rasvc.vol : 0)
      this.ra_esp = 0.5 * ((this._raivci ? this._raivci.pres_in : 0) + (this._rasvc ? this._rasvc.pres_in : 0) )

      if (this._ra) {
        this.ra_esv = this._ra.vol
        this.ra_esp = this._ra.pres_in
      }
    }

    // state going from diastole to systole (end diastolic)
    if (this.prev_cardiac_cycle_state === 0 && this.cardiac_cycle_state === 1) {
      this.lv_edv = this._lv ? this._lv.vol : 0;
      this.lv_edp = this._lv ? this._lv.pres_in : 0;

      this.la_edv = this._la ? this._la.vol : 0;
      this.la_edp = this._la ? this._la.pres_in : 0;

      this.rv_edv = this._rv ? this._rv.vol : 0;
      this.rv_edp = this._rv ? this._rv.pres_in : 0;

      this.ra_edv = (this._raivci ? this._raivci.vol : 0) + (this._rasvc ? this._rasvc.vol : 0);
      this.ra_edp = 0.5 * ((this._raivci ? this._raivci.pres_in : 0) + (this._rasvc ? this._rasvc.pres_in : 0));

      if (this._ra) {
        this.ra_edv = this._ra.vol
        this.ra_edp = this._ra.pres_in
      }

      // store the other parameters (guard ejection fraction against a zero end-diastolic volume)
      this.lv_sv = this.lv_edv - this.lv_esv
      this.rv_sv = this.rv_edv - this.rv_esv
      this.lv_ef = this.lv_edv > 0 ? this.lv_sv / this.lv_edv : 0
      this.rv_ef = this.rv_edv > 0 ? this.rv_sv / this.rv_edv : 0
    }

  }

  calc_model() {
    // set the factors
    this._update_counter_factors += this._t
    if (this._update_counter_factors > this._update_interval_factors) {
      this._update_counter_factors = 0.0;

      const cont_left = this.cont_factor_left;
      const cont_right = this.cont_factor_right;
      if (
        cont_left !== this.prev_cont_factor_left ||
        cont_right !== this.prev_cont_factor_right
      ) {
        this.set_contractillity(cont_left, cont_right);
      }
      this.prev_cont_factor_left = cont_left;
      this.prev_cont_factor_right = cont_right;

      const relax_left = this.relax_factor_left;
      const relax_right = this.relax_factor_right;
      if (
        relax_left !== this.prev_relax_factor_left ||
        relax_right !== this.prev_relax_factor_right
      ) {
        this.set_relaxation(relax_left, relax_right);
      }
      this.prev_relax_factor_left = relax_left;
      this.prev_relax_factor_right = relax_right;

      const pc_el = this.pc_el_factor;
      if (
        pc_el !== this.prev_pc_el_factor
      ) {
        this.set_pericardium(pc_el, this.pc_extra_volume);
      }
      this.prev_pc_el_factor = pc_el;


      // set the new volume if _pc is not null
      if (this._pc) { 
        this._pc.vol_extra = this.pc_extra_volume;
      }
    }

    // store the previous cardiac cycle state
    this.prev_cardiac_cycle_running = this.cardiac_cycle_running;

    // store the previous state
    this.prev_cardiac_cycle_state = this.cardiac_cycle_state

    // when then mitral valve closes the systole starts
    if (this.prev_la_lv_flow > 0.0 && this._la_lv.flow <= 0.0) {
      // mitral valve closes so the systole starts
      this._systole_running = true
    }
    // store the previous flow
    this.prev_la_lv_flow = this._la_lv.flow

    if (this._systole_running) {
      // check whether the aortic valve closes
      if (this.prev_lv_aa_flow > 0.0 && this._lv_aa.flow <= 0.0) {
        // aortic valve closes so the systole ends
        this._systole_running = false
      }
    }
    // store the previous flow
    this.prev_lv_aa_flow = this._lv_aa.flow

    // set the cardiac cycle
    if (this._systole_running) {
      this.cardiac_cycle_state = 1
      this._diastole_running = false
    } else {
      this.cardiac_cycle_state = 0
      this._diastole_running = true
    }

    // calculate heart rate from the reference value and influencing factors
    this.heart_rate = this.heart_rate_ref +
      (this.ans_activity_hr - 1.0) * this.heart_rate_ref * this.ans_sens +
      (this.hr_factor - 1.0) * this.heart_rate_ref +
      (this.hr_mob_factor - 1.0) * this.heart_rate_ref +
      (this.hr_temp_factor - 1.0) * this.heart_rate_ref +
      (this.hr_drug_factor - 1.0) * this.heart_rate_ref;

    if (this.hr_override) {
      this.heart_rate = this.heart_rate_ref;
    }
    // calculate qtc time depending on heart rate
    this.cqt_time = this.calc_qtc(this.heart_rate);

    // calculate the sinus node interval (in seconds) based on heart rate
    this._sa_node_interval = 60.0 / this.heart_rate;

    // sinus node period check
    if (this._sa_node_timer > this._sa_node_interval) {
      this._sa_node_timer = 0.0; // reset the timer
      this._pq_running = true; // start the pq-time
      this.ncc_atrial = -1; // reset atrial activation counter
      this.cardiac_cycle_running = 1; // cardiac cycle starts
      this._temp_cardiac_cycle_time = 0.0; // reset cardiac cycle time
    }

    // pq time period check
    if (this._pq_timer > this.pq_time) {
      this._pq_timer = 0.0;
      this._pq_running = false;
      this._av_delay_running = true; // start av-delay
    }

    // av delay period check
    if (this._av_delay_timer > this.av_delay) {
      this._av_delay_timer = 0.0;
      this._av_delay_running = false;

      if (!this._ventricle_is_refractory) {
        this._qrs_running = true; // start qrs
        this.ncc_ventricular = -1; // reset ventricular activation
      }
    }

    // qrs time period check
    if (this._qrs_timer > this.qrs_time) {
      this._qrs_timer = 0.0;
      this._qrs_running = false;
      this._qt_running = true; // start qt
      this._ventricle_is_refractory = true;
    }

    // qt time period check
    if (this._qt_timer > this.cqt_time) {
      this._qt_timer = 0.0;
      this._qt_running = false;
      this._ventricle_is_refractory = false; // ventricles leave refractory state
      this.cardiac_cycle_running = 0; // end of cardiac cycle
      this.cardiac_cycle_time = this._temp_cardiac_cycle_time;
    }

    // increment timers with the model's time step
    this._sa_node_timer += this._t;

    if (this.cardiac_cycle_running === 1) {
      this._temp_cardiac_cycle_time += this._t;
    }

    if (this._pq_running) {
      this._pq_timer += this._t;
    }

    if (this._av_delay_running) {
      this._av_delay_timer += this._t;
    }

    if (this._qrs_running) {
      this._qrs_timer += this._t;
    }

    if (this._qt_running) {
      this._qt_timer += this._t;
    }

    // synthesize the ecg signal from the active conduction phase(s)
    this.calc_ecg();

    // measure the heart rate (ventricular contraction)
    if (this.ncc_ventricular == -1) {
      this.heart_rate_measured = 60 / this._hr_counter;
      this._hr_counter = 0.0;
      this._hr_factor = 1.0
    }

    // update the heart frequency even when there's no contraction
    if (this._hr_counter > 1 * this._hr_factor) {
      this.heart_rate_measured = 60 / this._hr_counter;
      this._hr_factor += 1;
    }

    // increase the heartrate counter
    this._hr_counter += this._t

    // increase heart activation function counters
    this.ncc_atrial += 1;
    this.ncc_ventricular += 1;

    // calculate the varying elastance factor
    this.calc_varying_elastance();
  }

  calc_varying_elastance() {
    // calculate atrial activation factor
    let _atrial_duration = this.pq_time / this._t;
    if (this.ncc_atrial >= 0 && this.ncc_atrial < _atrial_duration) {
      this.aaf = Math.sin(Math.PI * (this.ncc_atrial / _atrial_duration));
    } else {
      this.aaf = 0.0;
    }

    // calculate ventricular activation factor
    let _ventricular_duration = (this.qrs_time + this.cqt_time) / this._t;
    if (
      this.ncc_ventricular >= 0 &&
      this.ncc_ventricular < _ventricular_duration
    ) {
      this.vaf =
        (this.ncc_ventricular / (this._kn * _ventricular_duration)) *
        Math.sin(Math.PI * (this.ncc_ventricular / _ventricular_duration));
    } else {
      this.vaf = 0.0;
    }

    // incorporate the ans factors ans sensitivity on the heart function.
    // ans_activity_factor (driven by the Mob myocardial-oxygen-balance hypoxia feedback) scales the
    // sympathetic drive propagated to the chambers; 1.0 = no effect.
    const _eff_ans_activity = this.ans_activity * this.ans_activity_factor;
    if (this._raivci) {
      this._raivci.ans_sens = this.ans_sens
      this._raivci.ans_activity = _eff_ans_activity
      this._raivci.act_factor = this.aaf;
    }
    if (this._rasvc) {
      this._rasvc.ans_sens = this.ans_sens
      this._rasvc.ans_activity = _eff_ans_activity
      this._rasvc.act_factor = this.aaf;
    }

    if (this._rv) {
      this._rv.ans_sens = this.ans_sens
      this._rv.ans_activity = _eff_ans_activity
      this._rv.act_factor = this.vaf;
    }

    if (this._la) {
      this._la.ans_sens = this.ans_sens
      this._la.ans_activity = _eff_ans_activity
      this._la.act_factor = this.aaf;
    }

     if (this._ra) {
      this._ra.ans_sens = this.ans_sens
      this._ra.ans_activity = _eff_ans_activity
      this._ra.act_factor = this.aaf;
    } 

    if (this._lv) {
      this._lv.ans_sens = this.ans_sens
      this._lv.ans_activity = _eff_ans_activity
      this._lv.act_factor = this.vaf;
    }

    if (this._coronaries) {
      this._coronaries.act_factor = this.vaf;
    }

    // analyze current state
    this.analyze()
  }

  calc_qtc(hr) {
    if (hr > 10.0) {
      // Bazett's formula
      return this.qt_time * Math.sqrt(60.0 / hr);
    } else {
      return this.qt_time * 2.449;
    }
  }

  set_pericardium(new_el_factor, new_volume) {
    // skip if no pericardium model is present in this configuration
    if (!this._pc) return;

    // get the current factor from the model
    let f_pc_el = this._pc.el_base_factor_ps;

    // calculate the delta
    let delta = new_el_factor - this.prev_pc_el_factor;

    // guard the extremes
    f_pc_el = Math.max(f_pc_el + delta, 0);

    // set the new factor
    this._pc.el_base_factor_ps = f_pc_el;
  }

  set_contractillity(new_cont_factor_left, new_cont_factor_right) {
    // get the current factors from the model
    let f_ps_la = this._la.el_max_factor_ps;
    let f_ps_lv = this._lv.el_max_factor_ps;
    // add guard rails for th situation when this._raivci or this._rasvc is not present in the model
    let f_ps_raivc = this._raivci ? this._raivci.el_max_factor_ps : 0;
    let f_ps_rasvc = this._rasvc ? this._rasvc.el_max_factor_ps : 0;
    let f_ps_ra = this._ra ? this._ra.el_max_factor_ps : 0;
    let f_ps_rv = this._rv.el_max_factor_ps;

    let delta_left = new_cont_factor_left - this.prev_cont_factor_left;
    let delta_right = new_cont_factor_right - this.prev_cont_factor_right;

    // add the increase/decrease in factor
    f_ps_la = Math.max(f_ps_la + delta_left, 0);
    f_ps_lv = Math.max(f_ps_lv + delta_left, 0);
    f_ps_raivc = Math.max(f_ps_raivc + delta_right, 0);
    f_ps_rasvc = Math.max(f_ps_rasvc + delta_right, 0);
    f_ps_ra = Math.max(f_ps_ra + delta_right, 0);
    f_ps_rv = Math.max(f_ps_rv + delta_right, 0);

    // transfer the factors
    this._la.el_max_factor_ps = f_ps_la
    this._lv.el_max_factor_ps = f_ps_lv
    if (this._raivci) {
      this._raivci.el_max_factor_ps = f_ps_raivc
    }
    if (this._rasvc) {
      this._rasvc.el_max_factor_ps = f_ps_rasvc
    }
    if (this._ra) {
      this._ra.el_max_factor_ps = f_ps_ra
    }
    this._rv.el_max_factor_ps = f_ps_rv

    // store the new factor
    this.cont_factor_left = new_cont_factor_left;
    this.cont_factor_right = new_cont_factor_right;
  }

  set_relaxation(new_relax_factor_left, new_relax_factor_right) {
    // get the current factors from the model
    let f_ps_la = this._la.el_min_factor_ps;
    let f_ps_lv = this._lv.el_min_factor_ps;
    let f_ps_raivc = this._raivci ? this._raivci.el_min_factor_ps : 0;
    let f_ps_rasvc = this._rasvc ? this._rasvc.el_min_factor_ps : 0;
    let f_ps_ra = this._ra ? this._ra.el_min_factor_ps : 0;
    let f_ps_rv = this._rv.el_min_factor_ps;

    let delta_left = new_relax_factor_left - this.prev_relax_factor_left;
    let delta_right = new_relax_factor_right - this.prev_relax_factor_right;

    // add the increase/decrease in factor
    f_ps_la = Math.max(f_ps_la + delta_left, 0);
    f_ps_lv = Math.max(f_ps_lv + delta_left, 0);
    f_ps_raivc = Math.max(f_ps_raivc + delta_right, 0);
    f_ps_rasvc = Math.max(f_ps_rasvc + delta_right, 0);
    f_ps_ra = Math.max(f_ps_ra + delta_right, 0);   
    f_ps_rv = Math.max(f_ps_rv + delta_right, 0);

    // transfer the factors
    this._la.el_min_factor_ps = f_ps_la
    this._lv.el_min_factor_ps = f_ps_lv
    if (this._raivci) {
      this._raivci.el_min_factor_ps = f_ps_raivc
    }
    if (this._rasvc) {
      this._rasvc.el_min_factor_ps = f_ps_rasvc
    }
    if (this._ra) {
      this._ra.el_min_factor_ps = f_ps_ra
    }
    this._rv.el_min_factor_ps = f_ps_rv

    // store the new factor
    this.relax_factor_left = new_relax_factor_left;
    this.relax_factor_right = new_relax_factor_right;
  }

  calc_ecg() {
    // Synthesize a lead-II-like ECG from the active conduction phase using a sum
    // of Gaussians (P, Q, R, S, T). Each wave is positioned relative to its
    // phase duration so the morphology tracks the configured pq/qrs/qt timings.
    // Computed fresh every step (instantaneous value); baseline is isoelectric
    // at 0 mV and the isoelectric PR/ST/TP segments fall out naturally.
    let s = 0.0;

    // P wave during the PQ interval
    if (this._pq_running) {
      s += this.gaussian(this._pq_timer, this.p_amp, 0.4 * this.pq_time, 0.16 * this.pq_time);
    }

    // Q, R and S waves during the QRS complex
    if (this._qrs_running) {
      s += this.gaussian(this._qrs_timer, this.q_amp, 0.2 * this.qrs_time, 0.08 * this.qrs_time);
      s += this.gaussian(this._qrs_timer, this.r_amp, 0.45 * this.qrs_time, 0.1 * this.qrs_time);
      s += this.gaussian(this._qrs_timer, this.s_amp, 0.75 * this.qrs_time, 0.1 * this.qrs_time);
    }

    // T wave during the (corrected) QT interval, after an isoelectric ST segment
    if (this._qt_running) {
      s += this.gaussian(this._qt_timer, this.t_amp, 0.55 * this.cqt_time, 0.14 * this.cqt_time);
    }

    this.ecg_signal = s;
  }

  gaussian(t, amp, center, width) {
    // guard against a zero width (e.g. a timing configured to 0) → avoid NaN
    const w = Math.max(width, 1e-4);
    return amp * Math.exp(-Math.pow(t - center, 2) / (2 * w * w));
  }

}

```

### FILE: explain/component_models/HeartChamber.js

```javascript
import { TimeVaryingElastance } from "../base_models/TimeVaryingElastance";

// This class represents a blood time-varying elastance model, which is a subclass of the TimeVaryingElastance class.
// This class adds functionality to handle blood-specific properties such as temperature, viscosity, solute and drug concentrations.
export class HeartChamber extends TimeVaryingElastance {
  // static properties
  static model_type = "HeartChamber";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // initialize independent properties unique to a HeartChamber
    this.temp = 37.0; // blood temperature (dgs C)
    this.viscosity = 6.0; // blood viscosity (centiPoise = Pa * s)
    this.solutes = {}; // dictionary holding all solutes
    this.drugs = {}; // dictionary holding all drug concentrations
    this.ans_sens = 1.0; // sensitivity of this blood time varying elastance for autonomic control. 0.0 is no effect, 1.0 is full effect
    this.ans_activity = 1.0; // activiaty of the ans
    this.el_max_mob_factor = 1.0; // contractility factor from the myocardial oxygen balance model (Mob); 1.0 = no effect
    this.el_max_drug_factor = 1.0; // contractility (inotropy) factor from the Drugs PK/PD model; 1.0 = no effect

    // load-induced contractility factors written by the HeartFunction model (1.0 = no effect, NOT reset each step)
    this.el_max_load_factor = 1.0; // acute, reversible contractility depression from high wall stress (afterload mismatch / over-dilation)
    this.el_max_remodel_factor = 1.0; // chronic remodeling change in contractility (maladaptive decline)
    this.el_k_remodel_factor = 1.0; // chronic remodeling change in diastolic stiffness (concentric stiffening)
    this.u_vol_remodel_factor = 1.0; // chronic remodeling change in unstressed volume (eccentric cavity dilation)

    // initialize dependent properties unique to a HeartChamber
    this.to2 = 0.0; // total oxygen concentration (mmol/l)
    this.tco2 = 0.0; // total carbon dioxide concentration (mmol/l)
    this.ph = -1.0; // ph (unitless)
    this.pco2 = -1.0; // pco2 (mmHg)
    this.po2 = -1.0; // po2 (mmHg)
    this.so2 = -1.0; // o2 saturation
    this.hco3 = -1.0; // bicarbonate concentration (mmol/l)
    this.be = -1.0; // base excess (mmol/l)
    this.el = 0.0;

    this.elmin_calc = 0.0
    this.elmax_calc = 0.9
  }
  // this method overrides the calc_elastances method of the 
  calc_elastances() {    
    // calculate the elastances and non-linear elastance incorporating the factors
    //  β-adrenergic receptors dominate in the myocardium
    
    // ans influences ANS diastolic function B1 receptor activation -> lusitropic effect
    this.el_min_eff = this.el_min
        + (this.el_min_factor - 1) * this.el_min
        + (this.el_min_factor_ps - 1) * this.el_min
        + (this.el_min_factor_scaling_ps - 1) * this.el_min
        - (this.ans_activity - 1) * this.el_min * this.ans_sens

    // ans influences ANS systolic function B1 receptor activation -> positive intropic effect
    this.el_max_eff = this.el_max
        + (this.el_max_factor - 1) * this.el_max
        + (this.el_max_factor_ps - 1) * this.el_max
        + (this.el_max_factor_scaling_ps - 1) * this.el_max
        + (this.el_max_mob_factor - 1) * this.el_max
        + (this.el_max_drug_factor - 1) * this.el_max    // drug inotropy (Drugs PK/PD model)
        + (this.el_max_load_factor - 1) * this.el_max    // acute load-induced contractility depression (HeartFunction)
        + (this.el_max_remodel_factor - 1) * this.el_max // chronic remodeling contractility change (HeartFunction)
        + (this.ans_activity - 1) * this.el_max * this.ans_sens

    this.el_k_eff = this.el_k
        + (this.el_k_factor - 1) * this.el_k
        + (this.el_k_factor_ps - 1) * this.el_k
        + (this.el_k_factor_scaling_ps - 1) * this.el_k
        + (this.el_k_remodel_factor - 1) * this.el_k     // chronic remodeling diastolic stiffening (HeartFunction)

    // make sure that el_max is not smaller than el_min
    if (this.el_max_eff < this.el_min_eff) {
      this.el_max_eff = this.el_min_eff;
    }

    // reset the non persistent factors
    this.el_min_factor = 1.0;
    this.el_max_factor = 1.0;
    this.el_k_factor = 1.0;
  }

  // override calc_volumes to incorporate the chronic eccentric-dilation remodeling factor (HeartFunction)
  calc_volumes() {
    this.u_vol_eff = this.u_vol
        + (this.u_vol_factor - 1) * this.u_vol
        + (this.u_vol_factor_ps - 1) * this.u_vol
        + (this.u_vol_factor_scaling_ps - 1) * this.u_vol
        + (this.u_vol_remodel_factor - 1) * this.u_vol; // chronic eccentric cavity dilation (HeartFunction)

    // reset the non persistent factors
    this.u_vol_factor = 1.0;
  }

  // the method overrides the 'volume_in' method of the TimeVaryingElastance class and 
  // adds functionality to update the viscosity, temperature and to2, tco2, solutes and drug concentrations
  volume_in(dvol, comp_from) {
    // call the parent method from the TimeVaryingElastance class to update the volume
    super.volume_in(dvol, comp_from);

    // a fixed-composition compartment is an infinite reservoir: hold its composition
    // (and temperature/viscosity) constant
    if (this.fixed_composition) return;

    // guard against division by zero on an empty compartment (would produce NaN concentrations)
    if (this.vol <= 0.0) return;

    // process the gases o2 and co2
    this.to2 += ((comp_from.to2 - this.to2) * dvol) / this.vol;
    this.tco2 += ((comp_from.tco2 - this.tco2) * dvol) / this.vol;

    // process the solutes (default to 0 if the source lacks the solute, to avoid NaN)
    Object.keys(this.solutes).forEach((solute) => {
      let solute_from = 0;
      if (comp_from.solutes[solute]) {
        solute_from = comp_from.solutes[solute];
      }
      this.solutes[solute] += ((solute_from - this.solutes[solute]) * dvol) / this.vol;
    });

    // process the temperature (treat it as a solute)
    this.temp += ((comp_from.temp - this.temp) * dvol) / this.vol;

    // process the viscosity (treat it as a solute)
    this.viscosity += ((comp_from.viscosity - this.viscosity) * dvol) / this.vol;

    // process the drug concentrations (default to 0 if the source lacks the drug, to avoid NaN)
    Object.keys(this.drugs).forEach((drug) => {
      let drug_from = 0.0;
      if (comp_from.drugs[drug]) {
        drug_from = comp_from.drugs[drug];
      }
      this.drugs[drug] += ((drug_from - this.drugs[drug]) * dvol) / this.vol;
    });
  }
}

```

### FILE: explain/component_models/HeartFunction.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

export class HeartFunction extends BaseModelClass {
  // static properties
  static model_type = "HeartFunction";

  /*
  HeartFunction — load-induced ventricular contractility compromise.

  Models how a ventricle becomes compromised when it labors against a very high
  pressure (afterload) or is over-dilated by too much volume (preload). The
  unifying signal is the Laplace wall stress

      sigma = P * r / (2 * h)

  computed per ventricle from the per-beat end-systolic and end-diastolic
  pressures/volumes that Heart.analyze() already provides (lv_esp/lv_esv/
  lv_edp/lv_edv and the rv_* equivalents). A single wall-stress signal captures
  both mechanisms: afterload raises sigma through pressure P, dilation raises it
  through cavity radius r.

  Two timescales, mirroring the structure of the Mob (myocardial oxygen balance)
  model:

    1. ACUTE (reversible, seconds-minutes) — afterload mismatch / over-dilation.
       When end-systolic wall stress (afterload) or end-diastolic wall stress
       (over-dilation) exceeds a setpoint, contractility is depressed via the
       chamber's el_max_load_factor. A first-order lag (cont_tc) smooths it and
       it fully recovers (factor -> 1) when the load normalizes.

    2. CHRONIC (remodeling, slow) — driven by the time-averaged wall stress.
       Concentric remodeling (sustained high end-systolic stress) thickens the
       wall, which lowers sigma (compensation), with a maladaptive tail of
       diastolic stiffening (el_k_remodel_factor) and a mild contractility
       decline. Eccentric remodeling (sustained high end-diastolic stress /
       volume overload) dilates the cavity (u_vol_remodel_factor) with a
       contractility decline (el_max_remodel_factor). Partially reversible.

  Geometry is a thin-walled sphere; wall volume is derived from heart weight
  (reusing Mob's hw relation) split by a configurable LV/RV mass fraction, so it
  scales with body weight automatically. Setpoints auto-calibrate to the resting
  wall stress during an initial warm-up window unless an explicit setpoint > 0 is
  provided in the model definition.

  Writes only factor properties onto the LV and RV HeartChambers; it composes
  additively with the ANS and Mob el_max terms. Atria are left untouched.
  */

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // ---- master switch -------------------------------------------------
    this.hf_active = true;

    // ---- geometry ------------------------------------------------------
    // heart weight (g) from body weight: hw = hw_intercept + hw_slope * weight_kg * 1000 (same relation as Mob)
    this.hw_intercept = 7.799;
    this.hw_slope = 0.004296;
    this.wall_density = 1.05; // g/mL myocardium
    this.wall_frac_lv = 0.35; // fraction of heart mass attributed to the LV free wall
    this.wall_frac_rv = 0.15; // fraction of heart mass attributed to the RV free wall
    this.wall_volume_lv = 0.0; // explicit LV wall volume override (mL); <= 0 => derive from heart weight
    this.wall_volume_rv = 0.0; // explicit RV wall volume override (mL); <= 0 => derive from heart weight

    // ---- acute (afterload mismatch / over-dilation) --------------------
    this.cont_tc = 30.0; // time constant of the acute contractility response (s)
    this.cont_floor = 0.2; // lowest the acute factor may drive el_max (fraction of baseline)
    // gains: contractility depression per unit wall stress above the setpoint
    this.g_es_lv = 0.005; // afterload (end-systolic stress) gain, LV
    this.g_ed_lv = 0.02; // over-dilation (end-diastolic stress) gain, LV
    this.g_es_rv = 0.008; // afterload gain, RV (thinner wall, more load-sensitive)
    this.g_ed_rv = 0.03; // over-dilation gain, RV

    // ---- chronic (remodeling) ------------------------------------------
    this.remodel_active = true;
    this.remodel_tc = 86400.0; // remodeling time constant (s); default ~1 day
    this.stress_avg_tc = 300.0; // time constant of the slow wall-stress average feeding remodeling (s)
    this.k_conc = 0.01; // concentric drive per unit sustained end-systolic stress excess
    this.k_ecc = 0.02; // eccentric drive per unit sustained end-diastolic stress excess
    this.mal_conc = 0.15; // maladaptive contractility loss per unit concentric remodeling
    this.mal_ecc = 0.25; // contractility loss per unit eccentric remodeling
    this.stiff_conc = 0.5; // diastolic stiffening (el_k) per unit concentric remodeling
    this.dil_ecc = 0.4; // cavity dilation (u_vol) per unit eccentric remodeling
    this.remodel_floor = 0.3; // lowest the chronic contractility factor may reach

    // ---- setpoints (auto-calibrated when <= 0) -------------------------
    this.setpoint_warmup = 60.0; // window (s of model time) used to learn resting setpoints
    this.sigma_es_ref_lv = 0.0;
    this.sigma_ed_ref_lv = 0.0;
    this.sigma_es_ref_rv = 0.0;
    this.sigma_ed_ref_rv = 0.0;

    // ---- outputs (per ventricle) ---------------------------------------
    this.hw = 0.0; // heart weight (g)
    this.wall_stress_es_lv = 0.0;
    this.wall_stress_ed_lv = 0.0;
    this.wall_stress_es_rv = 0.0;
    this.wall_stress_ed_rv = 0.0;
    this.radius_es_lv = 0.0;
    this.radius_ed_lv = 0.0;
    this.radius_es_rv = 0.0;
    this.radius_ed_rv = 0.0;
    this.wall_thickness_lv = 0.0;
    this.wall_thickness_rv = 0.0;
    this.el_max_load_factor_lv = 1.0;
    this.el_max_load_factor_rv = 1.0;
    this.remodel_concentric_lv = 0.0;
    this.remodel_eccentric_lv = 0.0;
    this.remodel_concentric_rv = 0.0;
    this.remodel_eccentric_rv = 0.0;

    // ---- local state ---------------------------------------------------
    this._heart = null;
    this._lv = null;
    this._rv = null;
    // slow wall-stress averages feeding the remodeling integrators
    this._sigma_es_slow_lv = 0.0;
    this._sigma_ed_slow_lv = 0.0;
    this._sigma_es_slow_rv = 0.0;
    this._sigma_ed_slow_rv = 0.0;
    this._slow_init = false; // have the slow averages been seeded yet
    this._warmup_elapsed = 0.0; // model time elapsed since this model started running (s)
  }

  calc_model() {
    if (!this.hf_active) return;

    // cache references (cheap, mirrors Mob)
    this._heart = this._model_engine.models["Heart"];
    this._lv = this._model_engine.models["LV"];
    this._rv = this._model_engine.models["RV"];
    if (!this._heart) return;

    // heart weight and per-ventricle wall volumes (mL)
    this.hw = this.hw_intercept + this.hw_slope * this._model_engine.weight * 1000.0;
    const vwall_lv = this.wall_volume_lv > 0.0 ? this.wall_volume_lv : (this.hw * this.wall_frac_lv) / this.wall_density;
    const vwall_rv = this.wall_volume_rv > 0.0 ? this.wall_volume_rv : (this.hw * this.wall_frac_rv) / this.wall_density;

    // are we still learning resting setpoints? (use elapsed time since this model
    // started, NOT the absolute engine clock — scenarios are saved with a non-zero
    // model_time_total)
    this._warmup_elapsed += this._t;
    const warming_up = this._warmup_elapsed < this.setpoint_warmup;

    if (this._lv) {
      this._process_ventricle(
        this._lv, vwall_lv,
        this._heart.lv_esp, this._heart.lv_esv, this._heart.lv_edp, this._heart.lv_edv,
        "lv", warming_up
      );
    }
    if (this._rv) {
      this._process_ventricle(
        this._rv, vwall_rv,
        this._heart.rv_esp, this._heart.rv_esv, this._heart.rv_edp, this._heart.rv_edv,
        "rv", warming_up
      );
    }
  }

  // process one ventricle: compute wall stress, the acute factor, and the chronic remodeling
  _process_ventricle(chamber, vwall, esp, esv, edp, edv, tag, warming_up) {
    // --- geometry & wall stress (thin-walled sphere) ---
    const r_es = this._sphere_radius(esv);
    const r_ed = this._sphere_radius(edv);
    const h_es = this._wall_thickness(esv, vwall);
    const h_ed = this._wall_thickness(edv, vwall);

    const sigma_es = h_es > 0.0 ? (esp * r_es) / (2.0 * h_es) : 0.0;
    const sigma_ed = h_ed > 0.0 ? (edp * r_ed) / (2.0 * h_ed) : 0.0;

    // pull current setpoints for this ventricle
    let ref_es = this[`sigma_es_ref_${tag}`];
    let ref_ed = this[`sigma_ed_ref_${tag}`];

    // auto-calibrate setpoints from resting wall stress during warm-up
    if (warming_up) {
      if (ref_es <= 0.0 || sigma_es > ref_es) this[`sigma_es_ref_${tag}`] = sigma_es;
      if (ref_ed <= 0.0 || sigma_ed > ref_ed) this[`sigma_ed_ref_${tag}`] = sigma_ed;
      ref_es = this[`sigma_es_ref_${tag}`];
      ref_ed = this[`sigma_ed_ref_${tag}`];
    }

    // --- acute layer: afterload mismatch (end-systolic) + over-dilation (end-diastolic) ---
    const g_es = this[`g_es_${tag}`];
    const g_ed = this[`g_ed_${tag}`];
    const excess_es = Math.max(0.0, sigma_es - ref_es);
    const excess_ed = Math.max(0.0, sigma_ed - ref_ed);

    let target = 1.0 - (g_es * excess_es + g_ed * excess_ed);
    if (target < this.cont_floor) target = this.cont_floor;
    if (target > 1.0) target = 1.0;

    // no acute effect while learning setpoints
    if (warming_up) target = 1.0;

    // first-order lag toward the target
    let load_factor = this[`el_max_load_factor_${tag}`];
    load_factor += this._t * ((1.0 / this.cont_tc) * (target - load_factor));
    this[`el_max_load_factor_${tag}`] = load_factor;

    // --- chronic layer: remodeling driven by the slow wall-stress average ---
    if (!this._slow_init) {
      // seed the slow averages so they don't ramp from zero
      this[`_sigma_es_slow_${tag}`] = sigma_es;
      this[`_sigma_ed_slow_${tag}`] = sigma_ed;
    }
    let es_slow = this[`_sigma_es_slow_${tag}`];
    let ed_slow = this[`_sigma_ed_slow_${tag}`];
    es_slow += this._t * ((1.0 / this.stress_avg_tc) * (sigma_es - es_slow));
    ed_slow += this._t * ((1.0 / this.stress_avg_tc) * (sigma_ed - ed_slow));
    this[`_sigma_es_slow_${tag}`] = es_slow;
    this[`_sigma_ed_slow_${tag}`] = ed_slow;

    let rc = this[`remodel_concentric_${tag}`];
    let re = this[`remodel_eccentric_${tag}`];

    if (this.remodel_active && !warming_up) {
      const drive_conc = this.k_conc * Math.max(0.0, es_slow - ref_es);
      const drive_ecc = this.k_ecc * Math.max(0.0, ed_slow - ref_ed);
      rc += this._t * ((1.0 / this.remodel_tc) * (drive_conc - rc));
      re += this._t * ((1.0 / this.remodel_tc) * (drive_ecc - re));
      this[`remodel_concentric_${tag}`] = rc;
      this[`remodel_eccentric_${tag}`] = re;
    }

    // map remodeling state onto chamber factors
    let el_max_remodel = 1.0 - this.mal_conc * rc - this.mal_ecc * re;
    if (el_max_remodel < this.remodel_floor) el_max_remodel = this.remodel_floor;
    const el_k_remodel = 1.0 + this.stiff_conc * rc;
    const u_vol_remodel = 1.0 + this.dil_ecc * re;

    // --- write factors onto the chamber ---
    chamber.el_max_load_factor = load_factor;
    chamber.el_max_remodel_factor = el_max_remodel;
    chamber.el_k_remodel_factor = el_k_remodel;
    chamber.u_vol_remodel_factor = u_vol_remodel;

    // wall thickness is reported at the (larger) end-diastolic cavity for display
    if (tag === "lv") {
      this.wall_stress_es_lv = sigma_es;
      this.wall_stress_ed_lv = sigma_ed;
      this.radius_es_lv = r_es;
      this.radius_ed_lv = r_ed;
      this.wall_thickness_lv = h_ed;
    } else {
      this.wall_stress_es_rv = sigma_es;
      this.wall_stress_ed_rv = sigma_ed;
      this.radius_es_rv = r_es;
      this.radius_ed_rv = r_ed;
      this.wall_thickness_rv = h_ed;
    }

    // the slow averages are seeded after the first ventricle of the first step;
    // flag once both ventricles have been visited at least once
    this._slow_init = true;
  }

  // radius (cm) of a sphere holding cavity volume vol (given in L)
  _sphere_radius(vol_l) {
    const v = vol_l * 1000.0; // L -> mL (== cm^3)
    if (v <= 0.0) return 0.0;
    return Math.cbrt((3.0 * v) / (4.0 * Math.PI));
  }

  // wall thickness (cm) of a spherical shell: outer radius minus cavity radius
  _wall_thickness(vol_l, vwall_ml) {
    const v_cav = vol_l * 1000.0; // mL
    if (v_cav <= 0.0 || vwall_ml <= 0.0) return 0.0;
    const r_in = Math.cbrt((3.0 * v_cav) / (4.0 * Math.PI));
    const r_out = Math.cbrt((3.0 * (v_cav + vwall_ml)) / (4.0 * Math.PI));
    return r_out - r_in;
  }
}

```

### FILE: explain/component_models/HeartValve.js

```javascript
import { Resistor } from "../base_models/Resistor";

export class HeartValve extends Resistor {
  // static properties
  static model_type = "HeartValve";
}
```

### FILE: explain/component_models/Hormones.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

/*
  The Hormones class is the long-loop neuro-hormonal volume / osmolality controller — the slow
  counterpart to the fast `Ans` baroreflex. It models the renin–angiotensin–aldosterone system
  (RAAS) plus ADH (vasopressin) as a small set of named, inspectable hormone ACTIVITY LEVELS
  (1.0 = resting baseline), each driven first-order toward a stimulus-set target and each writing
  effector channels that are independent of the ANS (so they compose, never collide).

  It is a controller/process model (like Kidneys autoregulation): it holds no blood, resolves
  references to other models lazily, runs on an update interval, and owns its effector channels
  while enabled (releasing them once on disable). Default config is NEUTRAL — with setpoints
  anchored to the scenario's resting state every (hormone − 1) ≈ 0, so a scenario that ships a
  Hormones model behaves identically at rest and only diverges when perturbed (hemorrhage,
  hyperosmolality) or when a pathway is clamped (SIADH, ACE-inhibitor, hypoaldosteronism).

  SENSORS (lazy refs):
    perfusion  = KID_ART.pres                 → renin / angiotensin (renal perfusion)
    volume     = Circulation.total_blood_volume → renin + non-osmotic ADH
    plasma Na  = AA.solutes.na  (osm ≈ 2·Na)  → ADH (osmotic) ; also drives nothing else
    plasma K   = AA.solutes.k                 → aldosterone (hyperkalemia)

  HORMONES (readouts, 1.0 = baseline):
    angiotensin ← low perfusion + low volume          (renin = its instantaneous drive)
    aldosterone ← angiotensin (cascade) + hyperkalemia (slow tc)
    adh         ← plasma osmolality + low volume       (osmotic + baroregulated)

  EFFECTORS (owned channels; all default-neutral, all independent of Ans `ans_activity`):
    Circulation.svr_factor_art / svr_factor_ven  → systemic arteriolar / venular constriction
    KID_CAP_KID_VEN.r_factor_ps                  → renal EFFERENT constriction (AngII defends GFR)
    Kidneys.reabsorption_factors.na / .k         → aldosterone Na retention / K wasting
    Kidneys.reabs_factor_adh                     → ADH water retention (antidiuresis)
  NOTE the renal afferent (KID_ART.r_factor_ps) is deliberately NOT touched — it is owned by the
  Kidneys autoregulation loop. AngII acts renally through the efferent instead (physiologic).

  NOT in this version: ANP/natriuretic peptides, thirst/intake, direct osmotic water-follows-Na
  coupling (so aldosterone shows mainly as ↓FENa/↓urine-Na rather than large volume shifts —
  ADH and AngII carry the volume/pressure defense). Aldosterone uses a physiologic (slow) tc, so
  its effect only manifests over long runs unless aldosterone_tc is compressed.
*/

export class Hormones extends BaseModelClass {
  // static properties
  static model_type = "Hormones";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // -----------------------------------------------
    // gating
    this.hormones_running = true; // master gate (false → all channels released to neutral)
    this.raas_enabled = true; // renin/angiotensin + aldosterone pathway
    this.adh_enabled = true; // vasopressin pathway

    // -----------------------------------------------
    // sensor wiring (resolved lazily)
    this.perfusion_model = "KID_ART"; // renal perfusion pressure source (renin driver)
    this.perfusion_prop = "pres";
    this.volume_model = "Circulation"; // circulating volume source (renin + baro-ADH driver)
    this.volume_prop = "total_blood_volume";
    this.plasma_model = "AA"; // representative arterial plasma for solutes (na, k)

    // effector target names (resolved lazily)
    this.circulation_name = "Circulation"; // systemic vasoconstriction fan-out (svr_factor_*)
    this.kidneys_name = "Kidneys"; // renal Na/water reabsorption channels
    this.efferent_name = "KID_CAP_KID_VEN"; // renal efferent arteriole (a Resistor)

    // -----------------------------------------------
    // setpoints — anchor to the scenario's RESTING values so the controller is near-neutral at rest
    this.perfusion_setpoint = 40.0; // mmHg (≈ baseline KID_ART.pres)
    this.volume_setpoint = 0.4; // L   (≈ baseline Circulation.total_blood_volume)
    this.osmo_na_setpoint = 138.0; // mmol/L plasma Na (osmolality proxy setpoint)
    this.k_setpoint = 3.5; // mmol/L plasma K

    // -----------------------------------------------
    // hormone dynamics: input gains, time constants (s), and activity clamps
    this.renin_gain = 3.0; // angiotensin drive per fractional perfusion deficit
    this.renin_vol_gain = 3.0; // angiotensin drive per fractional volume deficit
    this.angiotensin_tc = 30.0; // s — AngII responds over ~tens of seconds

    this.aldo_gain = 1.0; // aldosterone drive per (angiotensin − 1) (cascade)
    this.aldo_k_in_gain = 2.0; // aldosterone drive per fractional hyperkalemia
    this.aldosterone_tc = 1800.0; // s — PHYSIOLOGIC slow (≈30 min); compress for demos

    this.adh_gain_osmo = 4.0; // ADH drive per fractional osmolality (Na) excess
    this.adh_gain_baro = 1.0; // ADH drive per fractional volume deficit (non-osmotic)
    this.adh_tc = 120.0; // s — ADH responds over ~minutes

    this.hormone_min = 0.0; // floor for each hormone activity level
    this.hormone_max = 8.0; // ceiling for each hormone activity level

    // -----------------------------------------------
    // effector sensitivities (map hormone activity → effector factor) + clamps
    this.ang_svr_gain = 0.3; // systemic arteriolar constriction per (ang − 1)
    this.ang_svr_ven_gain = 0.2; // systemic venular constriction per (ang − 1)
    this.ang_efferent_gain = 0.5; // renal efferent constriction per (ang − 1)
    this.aldo_na_gain = 0.01; // Na reabsorption-factor rise per (aldo − 1)
    this.aldo_k_gain = 0.1; // K reabsorption-factor DROP per (aldo − 1) (K wasting)
    this.adh_water_gain = 0.015; // water reabsorption-factor rise per (adh − 1)
    this.adh_svr_gain = 0.05; // mild systemic constriction per (adh − 1) at high ADH

    this.svr_factor_min = 0.5; // clamps on the applied effector factors
    this.svr_factor_max = 5.0;
    this.efferent_factor_min = 0.5;
    this.efferent_factor_max = 5.0;
    this.na_factor_min = 0.95;
    this.na_factor_max = 1.02;
    this.k_factor_min = 0.2;
    this.k_factor_max = 1.5;
    this.water_factor_min = 0.5;
    this.water_factor_max = 1.03;

    // -----------------------------------------------
    // dependent parameters (read-outs, 1.0 = baseline activity)
    this.renin = 1.0; // instantaneous angiotensin DRIVE (un-lagged target)
    this.angiotensin = 1.0; // effective angiotensin II activity (lagged)
    this.aldosterone = 1.0; // aldosterone activity
    this.adh = 1.0; // ADH / vasopressin activity

    // applied effector factors (diagnostic read-outs)
    this.svr_factor = 1.0; // → Circulation.svr_factor_art
    this.svr_ven_factor = 1.0; // → Circulation.svr_factor_ven
    this.efferent_factor = 1.0; // → KID_CAP_KID_VEN.r_factor_ps
    this.na_reabs_factor = 1.0; // → Kidneys.reabsorption_factors.na
    this.k_reabs_factor = 1.0; // → Kidneys.reabsorption_factors.k
    this.water_reabs_factor = 1.0; // → Kidneys.reabs_factor_adh

    // sensed values (diagnostic read-outs)
    this.sensed_perfusion = 0.0;
    this.sensed_volume = 0.0;
    this.sensed_na = 0.0;
    this.sensed_osmolality = 0.0; // ≈ 2 · sensed_na
    this.sensed_k = 0.0;

    // -----------------------------------------------
    // local parameters
    this._update_interval = 1.0; // run the controller every 1 s (hormones are slow)
    this._update_counter = 0.0;
    this._was_active = false; // tracks active→inactive for the one-shot channel release
    this._circ = null;
    this._kidneys = null;
    this._efferent = null;
    this._perf = null;
    this._vol = null;
    this._plasma = null;
  }

  init_model(args) {
    // base applies args (no components on this model)
    super.init_model(args);
  }

  calc_model() {
    // master gate — release owned channels once, then idle
    if (!this.hormones_running) {
      if (this._was_active) this._release_channels();
      this._was_active = false;
      return;
    }

    // run the (slow) control logic on the update interval, not every step
    this._update_counter += this._t;
    if (this._update_counter >= this._update_interval) {
      const u = this._update_counter; // exact elapsed time since the last update
      this._update_counter = 0.0;
      this._update_hormones(u);
      this._apply_effectors();
    }
    this._was_active = true;
  }

  // resolve sensor / effector references lazily (other models may build after Hormones)
  _resolve_refs() {
    if (!this._circ) this._circ = this._model_engine.models[this.circulation_name] ?? null;
    if (!this._kidneys) this._kidneys = this._model_engine.models[this.kidneys_name] ?? null;
    if (!this._efferent) this._efferent = this._model_engine.models[this.efferent_name] ?? null;
    if (!this._perf) this._perf = this._model_engine.models[this.perfusion_model] ?? null;
    if (!this._vol) this._vol = this._model_engine.models[this.volume_model] ?? null;
    if (!this._plasma) this._plasma = this._model_engine.models[this.plasma_model] ?? null;
  }

  // the hormone control math. u = elapsed time since the last controller update (s).
  _update_hormones(u) {
    this._resolve_refs();

    // --- read sensors (keep last good value if a ref/prop is missing) ---
    if (this._perf) this.sensed_perfusion = this._perf[this.perfusion_prop] ?? this.sensed_perfusion;
    if (this._vol) this.sensed_volume = this._vol[this.volume_prop] ?? this.sensed_volume;
    if (this._plasma?.solutes) {
      this.sensed_na = this._plasma.solutes.na ?? this.sensed_na;
      this.sensed_k = this._plasma.solutes.k ?? this.sensed_k;
    }
    this.sensed_osmolality = 2.0 * this.sensed_na;

    // fractional deficits/excesses relative to setpoint (guard divide-by-zero)
    const perf_err = this.perfusion_setpoint > 0 ? (this.perfusion_setpoint - this.sensed_perfusion) / this.perfusion_setpoint : 0.0;
    const vol_err = this.volume_setpoint > 0 ? (this.volume_setpoint - this.sensed_volume) / this.volume_setpoint : 0.0;
    const osmo_err = this.osmo_na_setpoint > 0 ? (this.sensed_na - this.osmo_na_setpoint) / this.osmo_na_setpoint : 0.0;
    const k_err = this.k_setpoint > 0 ? (this.sensed_k - this.k_setpoint) / this.k_setpoint : 0.0;

    // --- renin / angiotensin II (low perfusion and/or low volume → constrict + retain) ---
    if (this.raas_enabled) {
      this.renin = this._clamp(1.0 + this.renin_gain * perf_err + this.renin_vol_gain * vol_err, this.hormone_min, this.hormone_max);
      this.angiotensin = this._lag(this.angiotensin, this.renin, u, this.angiotensin_tc);

      // --- aldosterone (driven by angiotensin cascade + hyperkalemia; slow) ---
      const aldo_target = this._clamp(1.0 + this.aldo_gain * (this.angiotensin - 1.0) + this.aldo_k_in_gain * k_err, this.hormone_min, this.hormone_max);
      this.aldosterone = this._lag(this.aldosterone, aldo_target, u, this.aldosterone_tc);
    } else {
      this.renin = 1.0;
      this.angiotensin = 1.0;
      this.aldosterone = 1.0;
    }

    // --- ADH / vasopressin (high osmolality and/or low volume → retain water + mild constriction) ---
    if (this.adh_enabled) {
      const adh_target = this._clamp(1.0 + this.adh_gain_osmo * osmo_err + this.adh_gain_baro * vol_err, this.hormone_min, this.hormone_max);
      this.adh = this._lag(this.adh, adh_target, u, this.adh_tc);
    } else {
      this.adh = 1.0;
    }
  }

  // map hormone levels → effector factors and write the owned channels
  _apply_effectors() {
    // systemic vasoconstriction (AngII + a little ADH) → Circulation master knobs (fan out to vessels)
    this.svr_factor = this._clamp(1.0 + this.ang_svr_gain * (this.angiotensin - 1.0) + this.adh_svr_gain * (this.adh - 1.0), this.svr_factor_min, this.svr_factor_max);
    this.svr_ven_factor = this._clamp(1.0 + this.ang_svr_ven_gain * (this.angiotensin - 1.0), this.svr_factor_min, this.svr_factor_max);
    if (this._circ) {
      this._circ.svr_factor_art = this.svr_factor;
      this._circ.svr_factor_ven = this.svr_ven_factor;
    }

    // renal efferent constriction (AngII defends glomerular pressure / GFR)
    this.efferent_factor = this._clamp(1.0 + this.ang_efferent_gain * (this.angiotensin - 1.0), this.efferent_factor_min, this.efferent_factor_max);
    if (this._efferent) this._efferent.r_factor_ps = this.efferent_factor;

    // renal reabsorption: aldosterone (Na↑, K↓) and ADH (water↑)
    this.na_reabs_factor = this._clamp(1.0 + this.aldo_na_gain * (this.aldosterone - 1.0), this.na_factor_min, this.na_factor_max);
    this.k_reabs_factor = this._clamp(1.0 - this.aldo_k_gain * (this.aldosterone - 1.0), this.k_factor_min, this.k_factor_max);
    this.water_reabs_factor = this._clamp(1.0 + this.adh_water_gain * (this.adh - 1.0), this.water_factor_min, this.water_factor_max);
    if (this._kidneys) {
      if (this._kidneys.reabsorption_factors) {
        this._kidneys.reabsorption_factors.na = this.na_reabs_factor;
        this._kidneys.reabsorption_factors.k = this.k_reabs_factor;
      }
      this._kidneys.reabs_factor_adh = this.water_reabs_factor;
    }
  }

  // release every owned channel back to neutral exactly once (on disable), so no stale hormonal
  // constriction/retention persists and the model reverts to its un-hormonal behaviour
  _release_channels() {
    this._resolve_refs();
    if (this._circ) {
      this._circ.svr_factor_art = 1.0;
      this._circ.svr_factor_ven = 1.0;
    }
    if (this._efferent) this._efferent.r_factor_ps = 1.0;
    if (this._kidneys) {
      if (this._kidneys.reabsorption_factors) {
        this._kidneys.reabsorption_factors.na = 1.0;
        this._kidneys.reabsorption_factors.k = 1.0;
      }
      this._kidneys.reabs_factor_adh = 1.0;
    }
    this.renin = 1.0;
    this.angiotensin = 1.0;
    this.aldosterone = 1.0;
    this.adh = 1.0;
    this.svr_factor = 1.0;
    this.svr_ven_factor = 1.0;
    this.efferent_factor = 1.0;
    this.na_reabs_factor = 1.0;
    this.k_reabs_factor = 1.0;
    this.water_reabs_factor = 1.0;
  }

  // first-order lag of x toward target over elapsed time u with time constant tc (s)
  _lag(x, target, u, tc) {
    if (tc > 0) return x + u * ((1.0 / tc) * (-x + target));
    return target;
  }

  _clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }
}

```

### FILE: explain/component_models/Kidneys.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass.js";

/*
  The Kidneys class turns the (otherwise passive) renal vascular bed
  (KID_ART -> KID_CAP -> KID_VEN) into an active filtration unit. It is a
  controller/process model (like Placenta): it does not hold blood itself but
  operates on the existing glomerular-capillary compartment (KID_CAP) and a new
  URINE bladder compartment it owns via the `components` mechanism.

  Scope: FLUID BALANCE & URINE OUTPUT, PER-SOLUTE REABSORPTION, plus optional GFR AUTOREGULATION.
    glomerular Starling filtration -> GFR
    per-solute tubular reabsorption (mass balance): water uses reabsorption_fraction; each
       filterable solute uses its own reabsorption_fractions[s] (fallback = water fraction),
       so urine need not be iso-osmotic with plasma. See _transfer.
    net urine water = GFR * (1 - reabsorption_fraction) leaves the blood into URINE,
       slowly lowering the circulating blood volume (diuresis).
    GFR autoregulation (myogenic + tubuloglomerular feedback) modulates the afferent
       arteriole (the KID_ART BloodVessel -> its AD_KID_ART input resistor) to hold GFR
       and renal blood flow ~constant across renal perfusion pressure. Default off; the
       term_neonate and adult_female scenarios ship with it enabled. See _run_autoregulation.

  NOT in this version: hormonal control of reabsorption (RAAS/ADH), clearance/acid-base,
  tubular load / transport maxima. Albumin & hemoglobin are NOT filtered (retained in blood).
*/

export class Kidneys extends BaseModelClass {
  // static properties
  static model_type = "Kidneys";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // -----------------------------------------------
    // independent parameters (config)
    this.kidneys_running = true; // master gate for filtration
    this.kid_cap_name = "KID_CAP"; // glomerular capillary compartment (filtration source)
    this.urine_name = "URINE"; // bladder / urine sink compartment

    this.kf = 6.6e-6; // glomerular filtration coefficient (L/s per mmHg) — SCENARIO-CALIBRATED
    this.p_bowman = 8.0; // Bowman's capsule hydrostatic pressure (mmHg)
    this.oncotic_base = 18.0; // plasma oncotic pressure at reference albumin (mmHg)
    this.albumin_ref = 25.0; // reference plasma albumin the oncotic_base is tied to (g/L)
    this.reabsorption_fraction = 0.985; // WATER reabsorption fraction; urine water = GFR*(1-FR)
    // per-solute reabsorption fractions (fraction of the filtered load reabsorbed). Any solute
    // absent here falls back to the water fraction -> iso-osmotic (identical to single-fraction
    // behaviour). A solute reabsorbed MORE than water concentrates in blood / dilutes in urine;
    // LESS -> concentrates in urine. Modulatable per-key by the scheduler (RAAS-ready).
    this.reabsorption_fractions = {}; // e.g. { na: 0.995, k: 0.92, ... }

    // -----------------------------------------------
    // GFR autoregulation (myogenic + tubuloglomerular feedback). Default OFF so existing
    // scenarios are byte-identical until enabled. A closed-loop controller adjusts the
    // AFFERENT arteriole — the KID_ART BloodVessel — by writing its r_factor_ps; the vessel
    // propagates that to its owned input resistor (AD_KID_ART) each step. Constricting the
    // afferent (r_factor_ps > 1) cuts renal inflow, lowering KID_CAP.pres -> NFP -> GFR, and
    // also lowers KID_ART.pres (more drop upstream): since we SENSE KID_ART.pres, the loop is
    // NEGATIVE feedback (sense high -> constrict -> pressure falls), hence self-correcting.
    this.autoregulation_enabled = false; // master gate for autoregulation
    this.aff_vessel_name = "KID_ART"; // afferent arteriole BloodVessel (the effector)

    // myogenic limb (fast, pressure-sensing). Senses the pressure the afferent feels.
    this.myogenic_input_model = "KID_ART"; // model whose pressure drives the myogenic response
    this.myogenic_input_prop = "pres"; // property read off that model
    this.myogenic_p_set = 35.0; // setpoint pressure -> factor 1.0 (mmHg, SCENARIO-CALIBRATED)
    this.myogenic_p_min = 25.0; // lower edge of the autoregulatory window (mmHg)
    this.myogenic_p_max = 55.0; // upper edge of the autoregulatory window (mmHg)
    this.myogenic_gain_up = 0.06; // resistance gain per mmHg above setpoint
    this.myogenic_gain_down = 0.06; // resistance gain per mmHg below setpoint
    this.myogenic_tc = 4.0; // myogenic time constant (s) — fast

    // tubuloglomerular feedback limb (slow). Senses distal NaCl delivery ~ GFR * plasma Na.
    this.tgf_use_nacl = true; // use GFR*Na as the TGF signal (else GFR alone)
    this.tgf_setpoint = 0.0; // TGF signal setpoint; <= 0 -> auto-seed after a warm-up (see below)
    this.tgf_seed_delay = 30.0; // s of warm-up before the auto-seed fires, so the setpoint
    //                             reflects steady state rather than the startup transient
    this.tgf_gain = 0.8; // resistance gain per fractional deviation of the TGF signal
    this.tgf_tc = 30.0; // TGF time constant (s) — slow

    // applied-factor lag + clamps (stability). The combined factor is low-pass filtered and
    // clamped so the closed loop cannot oscillate or run away / drive r_for_eff to <= 0.
    this.afferent_apply_tc = 6.0; // time constant on the applied afferent factor (s)
    this.afferent_factor_min = 0.5; // min afferent resistance multiplier
    this.afferent_factor_max = 4.0; // max afferent resistance multiplier

    // small solutes that travel into the urine at plasma concentration.
    // albumin & hemoglobin are deliberately EXCLUDED (retained -> hemoconcentration)
    this.filterable_solutes = ["na", "k", "ca", "cl", "lact", "mg", "phosphates", "uma"];

    // factor stack on kf (additive, like Capacitance/Resistor) so it composes with
    // interventions (non-persistent), scenario adjustments (persistent) and ModelScaler
    this.kf_factor = 1.0;
    this.kf_factor_ps = 1.0;
    this.kf_factor_scaling_ps = 1.0;

    // factor stack on the reabsorption fraction (multiplicative, since it is a fraction)
    this.reabs_factor = 1.0;
    this.reabs_factor_ps = 1.0;
    this.reabs_factor_scaling_ps = 1.0;

    // hormonal (ADH) water-reabsorption channel — a DEDICATED factor on the water fraction so the
    // Hormones model can drive antidiuresis without colliding with the user/scenario reabs_factor_ps
    // layer. Default 1.0 -> neutral (scenarios without a Hormones model are byte-identical).
    this.reabs_factor_adh = 1.0;

    // hormonal (aldosterone / drug) PER-SOLUTE reabsorption factors. Multiplicative on each solute's
    // reabsorption fraction in _solute_reabs (e.g. aldosterone: na > 1 retain, k < 1 waste). Absent
    // key -> 1.0 (neutral). Empty by default so existing scenarios are unchanged. Distinct from the
    // absolute per-solute reabsorption_fractions dict (this is a modulating factor on top of it).
    this.reabsorption_factors = {}; // e.g. { na: 1.01, k: 0.95 }

    // -----------------------------------------------
    // dependent parameters (read-outs, clinical units)
    this.nfp = 0.0; // net filtration pressure (mmHg)
    this.gfr = 0.0; // glomerular filtration rate (mL/min)
    this.urine_flow = 0.0; // urine output (mL/min)
    this.urine_volume = 0.0; // total diuresis = URINE.vol (mL)
    this.fe_na = 0.0; // fractional excretion of sodium (%)

    // autoregulation read-outs (clinical/diagnostic)
    this.myogenic_factor = 1.0; // myogenic limb afferent multiplier
    this.tgf_factor = 1.0; // TGF limb afferent multiplier
    this.afferent_factor = 1.0; // applied (lagged, clamped) afferent r_factor_ps
    this.sensed_pressure = 0.0; // pressure currently driving the myogenic limb (mmHg)
    this.tgf_signal = 0.0; // current TGF signal (GFR*Na or GFR)

    // -----------------------------------------------
    // local parameters
    this._gfr_ls = 0.0; // GFR in L/s (used for the transfer math)
    this._urine_ls = 0.0; // urine flow in L/s
    this._kf_eff = 0.0; // effective filtration coefficient after factors
    this._reabs_eff = 0.0; // effective reabsorption fraction after factors
    this._kid_cap = null; // reference to the glomerular capillary (source)
    this._urine = null; // reference to the URINE bladder (sink)

    // autoregulation locals
    this._aff_vessel = null; // reference to the afferent arteriole BloodVessel (effector)
    this._autoreg_update_interval = 0.015; // run the controller every 15 ms (perf)
    this._autoreg_update_counter = 0.0; // accumulator for the update interval
    this._tgf_setpoint_seeded = false; // whether the TGF setpoint has been auto-seeded
    this._tgf_seed_timer = 0.0; // accumulates controller time toward tgf_seed_delay
    this._tgf_signal_ema = 0.0; // smoothed TGF signal (tames pulsatility) used for the seed
    this._tgf_ema_tc = 5.0; // smoothing time constant for the seed EMA (s)
    this._limb_factor_floor = 0.05; // floor for each limb factor (keeps them physically positive
    //                                 under high gain; the combined clamp does the real limiting)
    this._was_autoreg_active = false; // tracks enabled->disabled transition for one-shot reset
  }

  init_model(args) {
    // base applies args and instantiates the URINE component into model.models
    super.init_model(args);

    // URINE is our OWN component (just instantiated by super) — safe to resolve now.
    this._urine = this._model_engine.models[this.urine_name] ?? null;
    // KID_CAP is a component of another model (Circulation) that may be instantiated
    // AFTER us in build order, so it is resolved lazily in calc_model().
  }

  calc_model() {
    // lazy reference resolution: KID_CAP (a Circulation component) may not have existed
    // at init time; by the first step the build is complete and all models are registered
    if (!this._kid_cap) this._kid_cap = this._model_engine.models[this.kid_cap_name] ?? null;
    if (!this._urine) this._urine = this._model_engine.models[this.urine_name] ?? null;

    // gating and wiring guards
    if (!this.kidneys_running) {
      this._zero_outputs();
      return;
    }
    if (!this._kid_cap || !this._urine) return;
    if (this._kid_cap.vol <= 0.0) {
      this._zero_outputs();
      return;
    }

    // effective filtration coefficient (3-layer additive convention)
    this._kf_eff =
      this.kf +
      (this.kf_factor - 1.0) * this.kf +
      (this.kf_factor_ps - 1.0) * this.kf +
      (this.kf_factor_scaling_ps - 1.0) * this.kf;
    this.kf_factor = 1.0; // reset the non-persistent layer

    // effective reabsorption fraction (multiplicative, clamped to a sane fraction)
    this._reabs_eff =
      this.reabsorption_fraction *
      this.reabs_factor *
      this.reabs_factor_ps *
      this.reabs_factor_scaling_ps *
      this.reabs_factor_adh; // hormonal (ADH) antidiuretic channel; 1.0 = neutral
    this.reabs_factor = 1.0;
    if (this._reabs_eff < 0.0) this._reabs_eff = 0.0;
    if (this._reabs_eff > 0.9999) this._reabs_eff = 0.9999;

    // Starling net filtration pressure
    const p_glom = this._kid_cap.pres; // glomerular hydrostatic pressure (mmHg)
    const onc = this._oncotic_pressure(); // plasma oncotic pressure (mmHg)
    this.nfp = p_glom - this.p_bowman - onc;
    if (this.nfp < 0.0) this.nfp = 0.0;

    // GFR and net urine flow (L/s) — only the net leaves the blood. _reabs_eff is the WATER
    // reabsorption fraction; per-solute fractions are handled in _transfer (mass balance).
    this._gfr_ls = this._kf_eff * this.nfp;
    this._urine_ls = this._gfr_ls * (1.0 - this._reabs_eff);

    // conservative per-solute mass transfer this step (filtrate volume Vf, water reabs wr)
    this._transfer(this._gfr_ls * this._t, this._reabs_eff);

    // read-outs in clinical units
    this.gfr = this._gfr_ls * 60000.0; // L/s -> mL/min
    this.urine_flow = this._urine_ls * 60000.0; // L/s -> mL/min
    this.urine_volume = this._urine.vol * 1000.0; // L -> mL (cumulative diuresis)
    // fractional excretion of Na (%) = fraction of filtered Na not reabsorbed
    this.fe_na = (1.0 - this._solute_reabs("na")) * 100.0;

    // GFR autoregulation (adjusts the afferent arteriolar resistance)
    this._run_autoregulation();
  }

  // interval-gated autoregulation controller. Resolves the afferent vessel lazily (like
  // _kid_cap), handles the enabled<->disabled transition, and otherwise runs the myogenic +
  // TGF control logic on a 15 ms tick. Writes only to the afferent vessel's r_factor_ps (the
  // BloodVessel propagates it to its owned input resistor AD_KID_ART each step).
  _run_autoregulation() {
    if (!this._aff_vessel) this._aff_vessel = this._model_engine.models[this.aff_vessel_name] ?? null;

    if (!this.autoregulation_enabled || !this._aff_vessel) {
      // on the enabled->disabled transition, release the afferent factor exactly once so no
      // stale constriction/dilation persists and the model reverts to linear behaviour
      if (this._was_autoreg_active && this._aff_vessel) {
        this._aff_vessel.r_factor_ps = 1.0;
        this.myogenic_factor = 1.0;
        this.tgf_factor = 1.0;
        this.afferent_factor = 1.0;
      }
      this._was_autoreg_active = false;
      return;
    }

    // run the control logic on the update interval, not every step
    this._autoreg_update_counter += this._t;
    if (this._autoreg_update_counter >= this._autoreg_update_interval) {
      this._autoreg_update_counter = 0.0;
      this._update_autoregulation(this._autoreg_update_interval);
    }
    this._was_autoreg_active = true;
  }

  // the actual control math. u = elapsed time since the last controller update (s).
  _update_autoregulation(u) {
    // --- myogenic limb (fast) -----------------------------------------------------------
    // sense the pressure the afferent arteriole feels
    const _in = this._model_engine.models[this.myogenic_input_model];
    if (_in) this.sensed_pressure = _in[this.myogenic_input_prop] ?? this.sensed_pressure;
    const p = this.sensed_pressure;

    // piecewise-linear activation: deviation from setpoint, saturated outside the window
    let act;
    if (p > this.myogenic_p_max) act = this.myogenic_p_max - this.myogenic_p_set;
    else if (p < this.myogenic_p_min) act = this.myogenic_p_min - this.myogenic_p_set;
    else act = p - this.myogenic_p_set;

    // rising pressure -> constrict (factor > 1); falling -> dilate (< 1); at setpoint -> 1.0.
    // floor the target so a large downward deviation x high gain can't drive it negative.
    const gain = p >= this.myogenic_p_set ? this.myogenic_gain_up : this.myogenic_gain_down;
    let myo_target = 1.0 + gain * act;
    if (myo_target < this._limb_factor_floor) myo_target = this._limb_factor_floor;
    this.myogenic_factor =
      this.myogenic_tc > 0
        ? this.myogenic_factor + u * ((1.0 / this.myogenic_tc) * (-this.myogenic_factor + myo_target))
        : myo_target;

    // --- tubuloglomerular feedback limb (slow) ------------------------------------------
    // signal ~ distal NaCl delivery: GFR * plasma Na (fallback to GFR alone)
    const na = this._kid_cap.solutes?.na;
    this.tgf_signal = this.tgf_use_nacl && na !== undefined ? this.gfr * na : this.gfr;

    // smooth the signal so the auto-seed captures a clean (non-pulsatile) value
    if (this._tgf_signal_ema <= 0.0) this._tgf_signal_ema = this.tgf_signal;
    else
      this._tgf_signal_ema +=
        u * ((1.0 / this._tgf_ema_tc) * (-this._tgf_signal_ema + this.tgf_signal));

    // auto-seed the setpoint, but only AFTER a warm-up so it reflects the steady state rather
    // than the startup transient (seeding too early biases it low -> standing constriction)
    if (!this._tgf_setpoint_seeded && this.tgf_setpoint <= 0.0) {
      this._tgf_seed_timer += u;
      if (this._tgf_seed_timer >= this.tgf_seed_delay && this.tgf_signal > 0.0) {
        this.tgf_setpoint = this._tgf_signal_ema;
        this._tgf_setpoint_seeded = true;
      }
    }

    if (this.tgf_setpoint > 0.0) {
      const err = (this.tgf_signal - this.tgf_setpoint) / this.tgf_setpoint;
      let tgf_target = 1.0 + this.tgf_gain * err; // high delivery -> constrict
      if (tgf_target < this._limb_factor_floor) tgf_target = this._limb_factor_floor;
      this.tgf_factor =
        this.tgf_tc > 0
          ? this.tgf_factor + u * ((1.0 / this.tgf_tc) * (-this.tgf_factor + tgf_target))
          : tgf_target;
    }

    // --- combine -> clamp -> lag -> write -----------------------------------------------
    let combined = this.myogenic_factor * this.tgf_factor; // multiplicative
    if (combined < this.afferent_factor_min) combined = this.afferent_factor_min;
    if (combined > this.afferent_factor_max) combined = this.afferent_factor_max;

    // first-order lag on the applied factor so the closed loop can't oscillate
    this.afferent_factor =
      this.afferent_apply_tc > 0
        ? this.afferent_factor + u * ((1.0 / this.afferent_apply_tc) * (-this.afferent_factor + combined))
        : combined;
    if (this.afferent_factor < this.afferent_factor_min) this.afferent_factor = this.afferent_factor_min;
    if (this.afferent_factor > this.afferent_factor_max) this.afferent_factor = this.afferent_factor_max;

    // write to the afferent BloodVessel; it composes r_factor_ps and pushes the resulting
    // resistance to its owned input resistor (AD_KID_ART) on its own step this same cycle
    this._aff_vessel.r_factor_ps = this.afferent_factor;
  }

  // plasma oncotic pressure, simple linear approximation tied to albumin so it both
  // opposes filtration at baseline and rises with hemoconcentration (self-limiting)
  _oncotic_pressure() {
    const alb = this._kid_cap.solutes?.albumin ?? this.albumin_ref;
    return this.oncotic_base * (alb / this.albumin_ref);
  }

  // conservative PER-SOLUTE mass transfer from KID_CAP into the URINE bladder. Each filterable
  // solute is reabsorbed by its own fraction (mass balance), so urine need not be iso-osmotic.
  // NOT BloodCapacitance.volume_in (which would copy ALL solutes incl. albumin/Hb and cause
  // artifactual proteinuria + progressive blood protein loss).
  //   Vf = glomerular filtrate volume this step (L); wr = water reabsorption fraction.
  // The reabsorbed water/solute is simply never removed (it returns to blood); only the net
  // excreted water (Uw) and excreted solute mass (mx) leave KID_CAP for URINE.
  _transfer(Vf, wr) {
    if (Vf <= 0.0) return;

    const src = this._kid_cap;
    const vol_before = src.vol;

    // urine water this step; never drain more than available (keep a tiny floor so vol > 0)
    let Uw = Vf * (1.0 - wr);
    if (Uw <= 0.0) return;
    const max_removable = vol_before - 1e-9;
    if (max_removable <= 0.0) return;
    if (Uw > max_removable) Uw = max_removable;
    const vol_after = vol_before - Uw;

    const old_uvol = this._urine.vol;
    const new_uvol = old_uvol + Uw;

    // per-solute mass balance: filtered mass = Vf*C, excreted = filtered*(1-fr[s]) (clamped to
    // the mass present), reabsorbed = the rest (stays in blood). Recompute blood concentration
    // over the reduced volume, and mix the excreted mass into the urine bladder.
    for (const s of this.filterable_solutes) {
      const c = src.solutes?.[s] ?? 0.0;
      const fr = this._solute_reabs(s);
      let mx = Vf * c * (1.0 - fr); // excreted solute mass
      const mass_avail = c * vol_before;
      if (mx > mass_avail) mx = mass_avail; // never remove more than present
      if (mx < 0.0) mx = 0.0;
      if (vol_after > 0.0) src.solutes[s] = (c * vol_before - mx) / vol_after;
      if (new_uvol > 0.0) {
        const existing = this._urine.solutes?.[s] ?? 0.0;
        this._urine.solutes[s] = (existing * old_uvol + mx) / new_uvol;
      }
    }

    // remove the urine water from the blood, add it to the bladder
    src.vol = vol_after < 0.0 ? 0.0 : vol_after;
    this._urine.vol = new_uvol;

    // hemoconcentration: albumin & hemoglobin are NOT filtered (total amount conserved), so
    // their concentration rises as the plasma volume shrank
    if (vol_after > 0.0) {
      const ratio = vol_before / vol_after;
      for (const s of ["albumin", "hemoglobin"]) {
        if (src.solutes?.[s] !== undefined) src.solutes[s] *= ratio;
      }
    }
  }

  // effective per-solute reabsorption fraction: the configured override if present, else the
  // water reabsorption fraction (-> iso-osmotic for that solute). Clamped to a sane fraction.
  _solute_reabs(s) {
    let fr = this.reabsorption_fractions?.[s];
    if (fr === undefined || fr === null) fr = this._reabs_eff;
    // hormonal (aldosterone / drug) modulation: multiply this solute's reabsorption fraction by its
    // factor (absent -> 1.0). Lets the Hormones model retain Na (na > 1) and waste K (k < 1).
    fr *= this.reabsorption_factors?.[s] ?? 1.0;
    if (fr < 0.0) fr = 0.0;
    if (fr > 0.9999) fr = 0.9999;
    return fr;
  }

  // zero the active read-outs while keeping the accumulated bladder volume
  _zero_outputs() {
    this._gfr_ls = 0.0;
    this._urine_ls = 0.0;
    this.nfp = 0.0;
    this.gfr = 0.0;
    this.urine_flow = 0.0;
    if (this._urine) this.urine_volume = this._urine.vol * 1000.0;
  }
}

```

### FILE: explain/component_models/Metabolism.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

export class Metabolism extends BaseModelClass {
  // static properties
  static model_type = "Metabolism";

  /*
    The Metabolism class models the oxygen use and carbon dioxide production in various blood-containing models.
    It calculates the changes in to2 and tco2 based on the oxygen use and respiratory quotient for metabolic activity.
    */
  constructor(model_ref, name = "") {
    super(model_ref, name);

    // Initialize independent properties
    this.met_active = true; // flag indicating if metabolism is active
    this.vo2 = 8.1; // oxygen use in ml/kg/min
    this.vo2_factor = 1.0; // factor modulating oxygen use by outside models
    this.resp_q = 0.8; // respiratory quotient for CO2 production
    this.metabolic_active_models = {}; // dictionary of models with fractional oxygen use
  }
  set_metabolic_active_model(site, new_fvo2) {
    this.metabolic_active_models[site] = new_fvo2;
  }
  calc_model() {
    if (!this.met_active) {
      // If metabolism is not active, do nothing
      return;
    }
    // Translate the VO2 in ml/kg/min to VO2 in mmol for this step size (assuming 37 degrees temperature and atmospheric pressure)
    const vo2_step =((0.039 * this.vo2 * this.vo2_factor * this._model_engine.weight) / 60.0) * this._t;

    // Iterate over each metabolic active model
    for (const [model, fvo2] of Object.entries(this.metabolic_active_models)) {
      // Get the volume, tco2, and to2 from the blood compartment
      let compartment = this._model_engine.models[model];
      // if the model is a MVU then do the metabolism inside the capillaries
      if (compartment && compartment.model_type == 'MicroVascularUnit') {
        compartment = this._model_engine.models[model + "_CAP"]
      }

      // skip if the compartment (or its capillary) is not present in this configuration
      if (!compartment) {
        continue;
      }

      const vol = compartment.vol;
      let to2 = compartment.to2;
      let tco2 = compartment.tco2;

      // skip an empty compartment to avoid division by zero. Use continue (not return) so the
      // remaining metabolic compartments are still processed this step.
      if (vol <= 0.0) {
        continue;
      }

      // Calculate the change in oxygen concentration in this step
      const dto2 = vo2_step * fvo2;

      // Calculate the new oxygen concentration in blood
      let new_to2 = (to2 * vol - dto2) / vol;

      // Guard against negative values
      if (new_to2 < 0) {
        new_to2 = 0;
      }

      // Calculate the change in CO2 concentration in this step
      const dtco2 = vo2_step * fvo2 * this.resp_q

      // Calculate the new CO2 concentration in blood
      let new_tco2 = (tco2 * vol + dtco2) / vol;

      // Guard against negative values
      if (new_tco2 < 0) {
        new_tco2 = 0;
      }

      // Store the new to2 and tco2 in the compartment
      compartment.to2 = new_to2;
      compartment.tco2 = new_tco2;
    }
  }
}

```

### FILE: explain/component_models/Mob.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

export class Mob extends BaseModelClass {
  // static properties
  static model_type = "Mob";

  /*
  Mob — myocardial oxygen balance.

  Two physiologically explicit terms, both expressed natively in mmol O2 per
  gram of heart tissue:

    1. Basal MVO2:        bm_vo2 = bm_vo2_per_g · hw                [mmol/s]
    2. Stroke-work MVO2:  sw_vo2 = sw_vo2_per_g · hw · (SW_lv + SW_rv) / cycle_time
                                                                    [mmol/s]
       where SW_* is the per-beat ventricular stroke work (mmHg·mL),
       computed as the area of the P-V loop via trapezoidal P·dV
       integration over the cardiac cycle.

  Per-step consumption is mob_vo2 · dt, subtracted from the COR (coronary
  bloodpool) to2 with proportional CO2 added back via resp_q.

  Owns the coronary sub-components (COR, AA_COR, COR_RAIVCI, COR_RASVC) declared
  under its `components` block in the model definition JSON.

  Drives hypoxia feedback to the Heart via hr_mob_factor, el_max_mob_factor,
  and ans_activity_factor.
  */

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // Independent properties
    this.mob_active = true;
    this.to2_min = 0.0002;
    this.to2_ref = 0.2;
    this.resp_q = 0.1;

    // mmol O2 per gram heart tissue per second (basal myocardial VO2)
    this.bm_vo2_per_g = 3.7e-5;

    // mmol O2 per gram heart tissue per (mmHg·mL of stroke work)
    this.sw_vo2_per_g = 2.0e-7;

    // hw [g] = hw_intercept + hw_slope · weight_kg · 1000
    this.hw_intercept = 7.799;
    this.hw_slope = 0.004296;

    this.hr_factor = 1;
    this.hr_factor_max = 1;
    this.hr_factor_min = 0.01;
    this.hr_tc = 5;
    this.cont_factor = 1;
    this.cont_factor_max = 1;
    this.cont_factor_min = 0.01;
    this.cont_tc = 5;
    this.ans_factor = 1;
    this.ans_factor_max = 1;
    this.ans_factor_min = 0.01;
    this.ans_tc = 5;
    this.ans_activity_factor = 1;

    // Dependent / output properties
    this.hw = 0.0;
    this.bm_vo2 = 0.0;
    this.sw_vo2 = 0.0;
    this.mob_vo2 = 0.0;
    this.mvo2_step = 0.0;
    this.stroke_work_lv = 0.0;
    this.stroke_work_rv = 0.0;
    this.stroke_work_total = 0.0;
    this.mob = 0.0;

    // Local references and integration state
    this._aa = null;
    this._aa_cor = null;
    this._cor = null;
    this._heart = null;
    this._lv = null;
    this._rv = null;
    this._a_to2 = 0.0;
    this._d_hr = 0.0;
    this._d_cont = 0.0;
    this._d_ans = 0.0;
    this._sw_vo2_per_beat = 0.0;
    this._prev_lv_vol = 0.0;
    this._prev_lv_pres = 0.0;
    this._prev_rv_vol = 0.0;
    this._prev_rv_pres = 0.0;
    this._pv_area_lv_inc = 0.0;
    this._pv_area_lv_dec = 0.0;
    this._pv_area_rv_inc = 0.0;
    this._pv_area_rv_dec = 0.0;
  }

  calc_model() {
    if (!this.mob_active) return;

    // Heart weight (g) from body weight (kg)
    this.hw = this.hw_intercept + this.hw_slope * this._model_engine.weight * 1000.0;

    // Hypoxia gains (rebuilt each step so changes to *_min/*_max take effect live)
    this.hr_g = (this.hr_factor_max - this.hr_factor_min) / (this.to2_ref - this.to2_min);
    this.cont_g = (this.cont_factor_max - this.cont_factor_min) / (this.to2_ref - this.to2_min);
    this.ans_g = (this.ans_factor_max - this.ans_factor_min) / (this.to2_ref - this.to2_min);

    // Cache model references
    this._aa = this._model_engine.models["AA"];
    this._aa_cor = this._model_engine.models["AA_COR"];
    this._cor = this._model_engine.models["COR"];
    this._heart = this._model_engine.models["Heart"];
    this._lv = this._model_engine.models["LV"];
    this._rv = this._model_engine.models["RV"];

    const to2_cor = this._cor.to2;
    const tco2_cor = this._cor.tco2;
    const vol_cor = this._cor.vol;

    // Hypoxia activation + first-order smoothing
    this._a_to2 = this.activation_function(to2_cor, this.to2_ref, this.to2_ref, this.to2_min);
    this._d_hr = this._t * ((1 / this.hr_tc) * (-this._d_hr + this._a_to2)) + this._d_hr;
    this._d_cont = this._t * ((1 / this.cont_tc) * (-this._d_cont + this._a_to2)) + this._d_cont;
    this._d_ans = this._t * ((1 / this.ans_tc) * (-this._d_ans + this._a_to2)) + this._d_ans;

    // Component MVO2 rates [mmol/s]
    this.bm_vo2 = this.bm_vo2_per_g * this.hw;
    this.sw_vo2 = this.calc_sw_vo2();

    this.mob_vo2 = this.bm_vo2 + this.sw_vo2;

    // Per-step consumption [mmol]
    this.mvo2_step = this.mob_vo2 * this._t;
    const co2_production = this.mvo2_step * this.resp_q;

    // Hypoxia-driven feedback to Heart
    this.calc_hypoxia_effects();

    // Instantaneous oxygen balance reporter
    const o2_inflow = this._aa_cor.flow * this._aa.to2;
    const o2_use = this.mvo2_step / this._t;
    this.mob = o2_inflow - o2_use + to2_cor;

    // Update coronary blood pool
    if (vol_cor > 0) {
      const new_to2_cor = (to2_cor * vol_cor - this.mvo2_step) / vol_cor;
      const new_tco2_cor = (tco2_cor * vol_cor + co2_production) / vol_cor;
      if (new_to2_cor >= 0) {
        this._cor.to2 = new_to2_cor;
        this._cor.tco2 = new_tco2_cor;
      }
    }
  }

  calc_sw_vo2() {
    // Capture stroke work at the rising edge of cardiac_cycle_running
    if (
      this._heart.cardiac_cycle_running &&
      !this._heart._prev_cardiac_cycle_running
    ) {
      this.stroke_work_lv = this._pv_area_lv_dec - this._pv_area_lv_inc;
      this.stroke_work_rv = this._pv_area_rv_dec - this._pv_area_rv_inc;
      this.stroke_work_total = this.stroke_work_lv + this.stroke_work_rv;

      // O2 cost of this beat's stroke work [mmol]
      this._sw_vo2_per_beat = this.sw_vo2_per_g * this.hw * this.stroke_work_total;

      this._pv_area_lv_inc = 0.0;
      this._pv_area_lv_dec = 0.0;
      this._pv_area_rv_inc = 0.0;
      this._pv_area_rv_dec = 0.0;
    }

    // Trapezoidal P·dV integration this step
    const _dV_lv = this._lv.vol - this._prev_lv_vol;
    if (_dV_lv > 0) {
      this._pv_area_lv_inc +=
        _dV_lv * this._prev_lv_pres +
        (_dV_lv * (this._lv.pres - this._prev_lv_pres)) / 2.0;
    } else {
      this._pv_area_lv_dec +=
        -_dV_lv * this._prev_lv_pres +
        (-_dV_lv * (this._lv.pres - this._prev_lv_pres)) / 2.0;
    }

    const _dV_rv = this._rv.vol - this._prev_rv_vol;
    if (_dV_rv > 0) {
      this._pv_area_rv_inc +=
        _dV_rv * this._prev_rv_pres +
        (_dV_rv * (this._rv.pres - this._prev_rv_pres)) / 2.0;
    } else {
      this._pv_area_rv_dec +=
        -_dV_rv * this._prev_rv_pres +
        (-_dV_rv * (this._rv.pres - this._prev_rv_pres)) / 2.0;
    }

    this._prev_lv_vol = this._lv.vol;
    this._prev_lv_pres = this._lv.pres;
    this._prev_rv_vol = this._rv.vol;
    this._prev_rv_pres = this._rv.pres;

    // Amortize per-beat O2 cost across the current cycle duration
    const cc_time = this._heart.cardiac_cycle_time;
    return cc_time > 0 ? this._sw_vo2_per_beat / cc_time : 0.0;
  }

  calc_hypoxia_effects() {
    this.ans_activity_factor = 1.0 + this.ans_g * this._d_ans;
    this._heart.ans_activity_factor = this.ans_activity_factor;

    this.hr_factor = 1.0 + this.hr_g * this._d_hr;
    this._heart.hr_mob_factor = this.hr_factor;

    this.cont_factor = 1.0 + this.cont_g * this._d_cont;
    this._heart._lv.el_max_mob_factor = this.cont_factor;
    this._heart._rv.el_max_mob_factor = this.cont_factor;
    this._heart._la.el_max_mob_factor = this.cont_factor;
    if (this._heart._raivci) this._heart._raivci.el_max_mob_factor = this.cont_factor;
    if (this._heart._rasvc) this._heart._rasvc.el_max_mob_factor = this.cont_factor;
  }

  activation_function(value, max, setpoint, min) {
    if (value >= max) return max - setpoint;
    if (value <= min) return min - setpoint;
    return value - setpoint;
  }
}

```

### FILE: explain/component_models/Pda.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

/*
Anatomy & Embryology

    The ductus arteriosus is a short, conical vessel arising from the distal portion of the left sixth aortic arch.
    It connects the roof of the pulmonary trunk (just downstream of the pulmonary valve) to the descending aorta
    immediately distal to the left subclavian artery.

    Histologically, its wall contains a high proportion of smooth muscle cells arranged circumferentially,
    making it exquisitely sensitive to oxygen tension and vasoactive mediators.

    General Shape

    Conical/funnel-shaped: widest at the aortic (ampullary) end, tapering toward the pulmonary end.

    Anatomic variants (when patent beyond birth) are classified angiographically as:
        Type A (conical)   – classic funnel
        Type B (window)    – short, wide
        Type C (tubular)   – nearly uniform diameter
        Type D (complex)   – multiple constrictions
        Type E (elongated) – long, narrow funnel

    Typical length 2–3 cm; conical, wider at the aortic end and tapering toward the pulmonary end.
        Diameter growth: ≈ 0.0935 mm/week (y = 0.2072 + 0.0935·x)
        Length growth:   ≈ 0.4381 mm/week (y = –3.0726 + 0.4381·x)

    Term neonate:
        Diameter ~2–4 mm (approximating the descending aorta at the same level)
        Length   ~20–30 mm (2–3 cm)
        Ampullary height (at aortic end) often 4–6 mm.

    References:
        StatPearls "Patent Ductus Arteriosus" – conical shape, neonatal dimensions.
        Szpinda M. Morphometric study of the ductus arteriosus, 2007 – fetal diameter/length data.
        ScienceDirect "Ductus Arteriosus" – comparison to descending aorta.

Closure

    Closure always begins at the pulmonary end and proceeds toward the aortic end:

        Anatomic basis – the conical shape gives the pulmonary end a smaller lumen and thinner wall,
        so it constricts faster under rising O2.
        Physiologic triggers – with the first breaths, arterial PO2 rises and PGE2 falls; both effects
        are strongest at the pulmonary junction.
        Clinical correlation – even when closure is incomplete, angiography shows a residual aortic
        ampulla while the pulmonary end is already sealed off.

Elastance

    Passive elastance is measured by slowly changing lumen pressure on an isolated vessel in a
    calcium-free bath (no muscle tone). Active elastance is the additional stiffening from smooth-
    muscle contraction under physiologic conditions.

    The PDA has high SM content and a low elastin ratio, so its passive elastance at baseline is
    higher than the aorta. In utero, PGE2 keeps SM relaxed (low active EE). Postnatally, O2-induced
    SM contraction sharply raises active EE; the P-V curve can shift total elastance by an order
    of magnitude.

    Dynamic phases:
        Fetal (patent):           low active EE, high compliance (PGE2-mediated relaxation)
        Functional closure 12-24h: rising O2 + falling PGE2 → SM contraction → active EE rises
        Anatomic remodeling 2-3wk: fibrosis and intimal cushion coalescence → effective infinity

    Clinical implications:
        Preterm: attenuated active EE rise → persistent patency
        NSAIDs: lower PGE2 → raise active EE → pharmacologic closure
        Largest active-EE jumps correlate with post-closure hypotension and low CO

    See also: docs/Pda-velocity.md for the rationale behind the velocity outputs.
*/

// Hagen-Poiseuille resistance unit conversion: Pa·s/m^3 → mmHg·s/L.
const PA_S_PER_M3_TO_MMHG_S_PER_L = 0.00000750062;
// Pre-multiplied prefactors for the resistance formulas (saves one multiply per call).
//   uniform cylinder: R = (8 / π) · μ · L / r⁴ · [Pa→mmHg]
//   conical taper:    R = (8 / 3π) · μ · L · (r1² + r1·r2 + r2²) / (r1³ · r2³) · [Pa→mmHg]
const RESISTANCE_PREFACTOR = (8.0 / Math.PI) * PA_S_PER_M3_TO_MMHG_S_PER_L;
const CONICAL_RESISTANCE_PREFACTOR = (8.0 / (3.0 * Math.PI)) * PA_S_PER_M3_TO_MMHG_S_PER_L;
// Resistance returned when geometry collapses to zero (sentinel "no flow").
const RESISTANCE_NO_FLOW = 1e8;
// Multiplier on el_base used when the duct is fully closed. The full computation
// yields el ≈ el_base · (R_no_flow / R_open)^alpha ≈ el_base · few-thousand for
// typical neonatal geometry; the exact value doesn't affect DA pressure when the
// capacitance holds u_vol, so a deterministic constant is sufficient.
const CLOSED_EL_SCALE = 5000;

export class Pda extends BaseModelClass {
  // static properties
  static model_type = "Pda";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // -----------------------------------------------
    // independent properties
    // -----------------------------------------------
    this.diameter_ao_max = 3.0;   // max diameter at aortic origin (mm)
    this.diameter_pa_max = 2.0;   // max diameter at pulmonary end (mm)
    this.diameter_relative = 0.0; // relative diameter [0..1], scales both ends together
    this.length = 20;             // length (mm)
    this.el_base = 30000;         // baseline (open-duct) elastance (mmHg/L); scaled by (R/R_open)^alpha as the duct constricts
    // alpha: resistance-elastance coupling exponent (BloodVessel-style). Between the large-artery
    // thin-wall value (0.5, gives the literature "order of magnitude" elastance rise for ~100x R
    // rise during functional closure) and the arteriole value (0.63), with a small bump for the
    // PDA's high SM content.
    this.alpha = 0.55;
    // jet_exponent: exponent n on (R_total / R_open_total)^(n/4) used to amplify the continuity
    // velocity into a jet-corrected end velocity. Same driver as the elastance α-coupling; the /4
    // normalization makes n = 1 behave like a linear diameter correction (matches the original
    // empirical (d_max/d_pa)^1 formula).
    this.jet_exponent = 0.6;

    // -----------------------------------------------
    // dependent properties (recomputed each step)
    // -----------------------------------------------
    this.diameter_ao = 0.0;       // current diameter at aortic origin (mm)
    this.diameter_pa = 0.0;       // current diameter at pulmonary end (mm)
    this.viscosity = 6;           // blood viscosity (cP), pulled from the DA capacitance
    this.vol = 0;                 // duct volume (L), pulled from the DA capacitance
    this.flow_ao = 0;             // flow at the aortic resistor (L/s)
    this.flow_pa = 0;             // flow at the pulmonary resistor (L/s)
    this.res_ao = 1500;           // resistance of the AO-half of the cone (mmHg·s/L)
    this.res_pa = 1500;           // resistance of the PA-half of the cone (mmHg·s/L)
    this.el = 30000;              // current elastance, el_base * (R/R_open)^alpha (mmHg/L)
    this.velocity_ao = 0;         // bulk mean velocity at aortic end, Q/A (m/s)
    this.velocity_pa = 0;         // bulk mean velocity at pulmonary end, Q/A (m/s)
    this.velocity_doppler = 0;    // peak velocity from modified Bernoulli, sign(ΔP)·√(|ΔP|/4) (m/s)
    this.velocity_ao_jet = 0;     // velocity_ao amplified by stenosis factor (m/s)
    this.velocity_pa_jet = 0;     // velocity_pa amplified by stenosis factor (m/s)

    // -----------------------------------------------
    // local references (preceded with _)
    // -----------------------------------------------
    this._da = null;     // BloodCapacitance (DA)
    this._aar_da = null; // Resistor (AA → DA)
    this._da_pa = null;  // Resistor (DA → PA)
  }

  init_model(args = {}) {
    super.init_model(args);

    // cache sub-model references so we don't hash-lookup every step
    this._aar_da = this._model_engine.models["AAR_DA"] || null;
    this._da     = this._model_engine.models["DA"]     || null;
    this._da_pa  = this._model_engine.models["DA_PA"]  || null;
  }

  calc_model() {
    const aar_da = this._aar_da;
    const da_pa = this._da_pa;
    const da = this._da;

    // the duct coordinates all three sub-models; skip if any is missing (e.g. a configuration
    // without a DA capacitance or its connecting resistors) rather than dereferencing null
    if (!da || !aar_da || !da_pa) return;

    // ----- closed-duct fast path -----
    // diameter_relative === 0 is the postnatal steady state. The cone math, the
    // Bernoulli sqrt, and the continuity divisions all degenerate; set sentinel
    // values and skip the rest.
    if (this.diameter_relative === 0) {
      this.diameter_ao = 0;
      this.diameter_pa = 0;
      this.viscosity = da.viscosity;
      this.flow_ao = aar_da.flow;
      this.flow_pa = da_pa.flow;
      aar_da.no_flow = true;
      da_pa.no_flow = true;
      this.res_ao = RESISTANCE_NO_FLOW;
      this.res_pa = RESISTANCE_NO_FLOW;
      aar_da.r_for = RESISTANCE_NO_FLOW;
      aar_da.r_back = RESISTANCE_NO_FLOW;
      da_pa.r_for = RESISTANCE_NO_FLOW;
      da_pa.r_back = RESISTANCE_NO_FLOW;
      this.el = this.el_base * CLOSED_EL_SCALE;
      da.el_base = this.el;
      this.velocity_doppler = 0;
      this.velocity_ao = 0;
      this.velocity_pa = 0;
      this.velocity_ao_jet = 0;
      this.velocity_pa_jet = 0;
      this.vol = da.vol;
      return;
    }

    // ----- geometry: diameters scale together along diameter_relative -----
    const d_ao = Math.min(this.diameter_relative * this.diameter_ao_max, this.diameter_ao_max);
    const d_pa = Math.min(this.diameter_relative * this.diameter_pa_max, this.diameter_pa_max);
    this.diameter_ao = d_ao;
    this.diameter_pa = d_pa;

    // pull current flows and viscosity from the underlying models
    this.flow_ao = aar_da.flow;
    this.flow_pa = da_pa.flow;
    this.viscosity = da.viscosity;

    // when fully constricted, force no flow on both resistors
    aar_da.no_flow = d_ao === 0;
    da_pa.no_flow  = d_pa === 0;

    // ----- resistance: linearly tapered cone, split at the midpoint -----
    const half_length = this.length * 0.5;
    const d_mid = (d_ao + d_pa) * 0.5;
    const res_ao = this.calc_conical_resistance(d_ao, d_mid, half_length, this.viscosity);
    const res_pa = this.calc_conical_resistance(d_mid, d_pa, half_length, this.viscosity);
    this.res_ao = res_ao;
    this.res_pa = res_pa;
    aar_da.r_for = res_ao;
    aar_da.r_back = res_ao;
    da_pa.r_for = res_pa;
    da_pa.r_back = res_pa;

    // ----- resistance-elastance coupling (BloodVessel α-pattern) -----
    // As the duct constricts, R rises as ~1/d^4 and the wall stiffness rises as (R / R_open)^alpha,
    // reproducing the literature-described order-of-magnitude jump in total elastance during
    // functional closure. The result is unbounded — the closed-duct case naturally drives the
    // elastance toward effective infinity.
    const d_mid_max = (this.diameter_ao_max + this.diameter_pa_max) * 0.5;
    const res_open_ao = this.calc_conical_resistance(this.diameter_ao_max, d_mid_max, half_length, this.viscosity);
    const res_open_pa = this.calc_conical_resistance(d_mid_max, this.diameter_pa_max, half_length, this.viscosity);
    const res_open_total = res_open_ao + res_open_pa;
    const res_total = res_ao + res_pa;
    const r_factor = res_open_total > 0 ? res_total / res_open_total : 1.0;
    this.el = this.el_base * Math.pow(r_factor, this.alpha);
    da.el_base = this.el;

    // ----- velocity outputs -----
    // Modified Bernoulli at the trans-ductal gradient:
    //   ΔP (mmHg) = 4 · v²   →   v_jet (m/s) = sign(ΔP) · √(|ΔP|/4)
    // The signed gradient (p_aa − p_pa) keeps the sign of all outputs consistent during flow
    // reversal (PHT / bidirectional shunting); using a local p_da would let the DA capacitance's
    // transient pressure swings flip the sign of one half independently of the other.
    const closed = aar_da.no_flow || da_pa.no_flow;
    let v_doppler = 0.0;
    if (!closed) {
      const p_aa = aar_da._comp_from?.pres ?? 0.0;
      const p_pa = da_pa._comp_to?.pres ?? 0.0;
      const dp = p_aa - p_pa;
      v_doppler = Math.sign(dp) * Math.sqrt(Math.abs(dp) / 4.0);
    }
    this.velocity_doppler = v_doppler;

    // Continuity (Q/A) bulk mean velocities at each end.
    // diameter is in mm; convert to m by *1e-3, then radius = d/2, area = π·r².
    const r_ao_m = d_ao * 0.0005;
    const r_pa_m = d_pa * 0.0005;
    const area_ao = Math.PI * r_ao_m * r_ao_m;
    const area_pa = Math.PI * r_pa_m * r_pa_m;
    // flow is L/s; multiply by 1e-3 to get m³/s so Q/A is in m/s.
    this.velocity_ao = area_ao > 0 ? (aar_da.flow * 0.001) / area_ao : 0.0;
    this.velocity_pa = area_pa > 0 ? (da_pa.flow * 0.001) / area_pa : 0.0;

    // Jet correction: amplify the smooth continuity waveform as the duct constricts.
    const jet_scale = Math.pow(r_factor, this.jet_exponent * 0.25);
    this.velocity_ao_jet = this.velocity_ao * jet_scale;
    this.velocity_pa_jet = this.velocity_pa * jet_scale;

    this.vol = da.vol;
  }

  calc_resistance(diameter, length = 20.0, viscosity = 6.0) {
    // Poiseuille's law for a uniform cylinder: R = (8 · μ · L) / (π · r⁴)
    // diameter (mm), length (mm), viscosity (cP).
    if (diameter <= 0.0 || length <= 0.0) return RESISTANCE_NO_FLOW;

    const n_pas = viscosity * 0.001;      // cP → Pa·s
    const length_m = length * 0.001;       // mm → m
    const r_m = diameter * 0.0005;         // mm/2 → m
    const r2 = r_m * r_m;
    const r4 = r2 * r2;
    return (RESISTANCE_PREFACTOR * n_pas * length_m) / r4;
  }

  calc_conical_resistance(d1, d2, length = 20.0, viscosity = 6.0) {
    // Hagen-Poiseuille integrated over a linearly tapered cone:
    //   R = (8 · μ · L) / (3 · π) · (r1² + r1·r2 + r2²) / (r1³ · r2³)
    // diameters (mm), length (mm), viscosity (cP).
    if (d1 <= 0.0 || d2 <= 0.0 || length <= 0.0) return RESISTANCE_NO_FLOW;

    const n_pas = viscosity * 0.001;     // cP → Pa·s
    const length_m = length * 0.001;     // mm → m
    const r1 = d1 * 0.0005;              // mm/2 → m
    const r2 = d2 * 0.0005;              // mm/2 → m
    const numerator = r1 * r1 + r1 * r2 + r2 * r2;
    const denominator = r1 * r1 * r1 * r2 * r2 * r2;
    return (CONICAL_RESISTANCE_PREFACTOR * n_pas * length_m * numerator) / denominator;
  }
}

```

### FILE: explain/component_models/Placenta.js

```javascript


import { BaseModelClass } from "../base_models/BaseModelClass.js";


export class Placenta extends BaseModelClass {
  // static properties
  static model_type = "Placenta";

  /*
    The Placenta class models the placental circulation and gas exchange using core models of the Explain model.
    The umbilical arteries and veins are modeled by BloodResistors connected to the descending aorta (DA) and
    inferior vena cava (IVCI). The fetal (PLF) and maternal placenta (PLM) are modeled by two BloodCapacitances.
    A BloodDiffusor model instance takes care of the GasExchange between the PLF and PLM.
    */

  constructor(model_ref, name = "") {
    // initialize the base model class setting all the general properties of the model which all models have in common
    
    // Average umbilical cord length at term          : – 55 cm
    // Mean luminal CSA per artery at 37–39 weeks     : – 0.147 cm² (overall mean across 300 normal pregnancies) DOI: http://dx.doi.org/10.18203/2320-1770.ijrcog20183851
    // Mean volume of umbilical artery                : 55 * 0.147 = 8.1 cm3 = 8.1 ml per artery => 16.2 ml for two arteries
    // Mean luminal CSA umbilical vein at 37-39 weeks : - 0.58 cm2
    // Mean volume of umbilical vein                  : 55 * 0.58 = 31.9 cm3 = 31.9 ml  Spurway J, Logan P, Pak S. The development, structure and blood flow within the umbilical cord with particular reference to the venous system. Australas J Ultrasound Med. 2012 Aug;15(3):97-102. doi: 10.1002/j.2205-0140.2012.tb00013.x. Epub 2015 Dec 31. PMID: 28191152; PMCID: PMC5025097.
    // Mean volume of fetal part of placenta          : 427 ml DOI: 10.7863/jum.2008.27.11.1583

    super(model_ref, name);
    // -----------------------------------------------
    // initialize independent parameters
    this.placenta_running = false
    this.umb_clamped = true; // flags whether the umbilical vessels are clamped or not
    this.umb_art_res = 800; // resistance of the umbilical arteries (mmHg*s/L)
    this.umb_art_res_factor = 1.0; // factor for the resistance of the umbilical arteries
    this.umb_ven_res = 100; // resistance of the umbilical vein (mmHg*s/L)
    this.umb_ven_res_factor = 1.0; // factor for the resistance of the umbilical vein
    this.plf_res = 2000; // resistance of the fetal placenta (mmHg*s/L)
    this.plf_res_factor = 1.0; // factor for the resistance of the fetal placenta
    this.mat_to2 = 6.85; // maternal placenta total oxygen content (mmol/L)
    this.mat_tco2 = 23; // maternal placenta total carbon dioxide content (mmol/L)
    this.dif_o2 = 0.0005; // diffusion constant for oxygen (mmol/mmHg * s)
    this.dif_co2 = 0.001; // diffusion constant for carbon dioxide (mmol/mmHg * s)


    // -----------------------------------------------
    // initialize dependent parameters
    this.umb_art_flow = 0.0; // flow in the umbilical artery (L/s)
    this.umb_art_velocity = 0.0; // velocity in the umbilical artery (m/s)
    this.umb_ven_flow = 0.0; // flow in the umbilical vein (L/s)
    this.umb_ven_velocity = 0.0; // velocity in the umbilical vein (m/s)

    // -----------------------------------------------
    // local parameters
    this._update_interval = 0.015; // update interval of the placenta model (s)
    this._update_counter = 0.0; // counter of the update interval (s)
    this._umb_art = null;
    this._umb_ven = null;
    this._plf_art = null;
    this._plf_cap = null;
    this._plf_ven = null;
    this._plm = null;
    this._gas_exchanger = null;
  }

  init_model(args) {
    super.init_model(args);

    this._umb_art = this._model_engine.models["PL_UMB_ART"];
    this._umb_ven = this._model_engine.models["PL_UMB_VEN"];
    this._plf_art = this._model_engine.models["PL_FETAL_ART"];
    this._plf_cap = this._model_engine.models["PL_FETAL_CAP"];
    this._plf_ven = this._model_engine.models["PL_FETAL_VEN"];
    this._plm = this._model_engine.models["PL_MAT"];
    this._gas_exchanger = this._model_engine.models["PL_GASEX"];
  }

  calc_model() {
    this._update_counter += this._t;
    if (this._update_counter > this._update_interval) {
      this._update_counter = 0.0;

      // all sub-models are required; skip if the wiring is incomplete
      if (!this._umb_art || !this._umb_ven || !this._plf_art || !this._plf_cap ||
          !this._plf_ven || !this._plm || !this._gas_exchanger) return;

      // keep all associated models in the same enabled/disabled state as the placenta — done every
      // tick (not only while running) so STOPPING the placenta actually disables flow and gas exchange
      this._umb_art.is_enabled = this.placenta_running;
      this._umb_ven.is_enabled = this.placenta_running;
      this._plf_art.is_enabled = this.placenta_running;
      this._plf_cap.is_enabled = this.placenta_running;
      this._plf_ven.is_enabled = this.placenta_running;
      this._plm.is_enabled = this.placenta_running;
      this._gas_exchanger.is_enabled = this.placenta_running;

      // the settings below are only meaningful while the placenta is running
      if (!this.placenta_running) return;

      // clamp umbilical vessels if set to clamped
      this._umb_art.no_flow = this.umb_clamped;
      this._umb_ven.no_flow = this.umb_clamped;
      this._plf_art.no_flow = this.umb_clamped;
      this._plf_cap.no_flow = this.umb_clamped;
      this._plf_ven.no_flow = this.umb_clamped;

      // set the resistances of the associated models
      const umb_art_r = this.umb_art_res * this.umb_art_res_factor;
      const umb_ven_r = this.umb_ven_res * this.umb_ven_res_factor;
      const plf_r = this.plf_res * this.plf_res_factor;
      this._umb_art.r_for = umb_art_r;
      this._umb_art.r_back = umb_art_r;
      this._umb_ven.r_for = umb_ven_r;
      this._umb_ven.r_back = umb_ven_r;
      this._plf_art.r_for = plf_r;
      this._plf_art.r_back = plf_r;
      this._plf_cap.r_for = plf_r;
      this._plf_cap.r_back = plf_r;
      this._plf_ven.r_for = plf_r;
      this._plf_ven.r_back = plf_r;

      // set the maternal placenta oxygen and carbon dioxide partial pressures in the gas exchanger
      this._plm.to2 = this.mat_to2;
      this._plm.tco2 = this.mat_tco2;

      // set the diffusion constants in the gas exchanger
      this._gas_exchanger.dif_o2 = this.dif_o2;
      this._gas_exchanger.dif_co2 = this.dif_co2;
    }
  }


}

```

### FILE: explain/component_models/Respiration.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

/*
compliance of the chestwall 4.2 ml/cmH2O/kg => 0.00544 L/mmHg/kg => 0.01904 L/mmHg
-> elastance = 52.5 mmHg/L
*/
export class Respiration extends BaseModelClass {
  // static properties
  static model_type = "Respiration";

  /*
    The Respiration class is not a model but houses methods that influence groups of models. 
    These groups contain models related to the respiratory tract. For example, the method 
    `change_lower_airway_resistance` influences the resistance of the lower airways by 
    setting the `r_factor` of the `DS_ALL` and `DS_ALR` gas resistors stored in a list 
    called `lower_airways`.
    */
  constructor(model_ref, name = "") {
    super(model_ref, name);

    // -----------------------------------------------
    // independent properties
    // -----------------------------------------------
    this.upper_airways = ["MOUTH_DS"]
    this.lower_airways = ["DS_ALL", "DS_ALR"]
    this.lower_airways_left = ["DS_ALL"]
    this.lower_airways_right = ["DS_ALR"]
    this.dead_space = ["DS"]
    this.thorax = ["THORAX"]
    this.pleural_space_left = []
    this.pleural_space_right = []
    this.lungs = ["ALL", "ALR"]
    this.left_lung = ["ALL"]
    this.right_lung = ["ALR"]
    this.gas_echangers = ["GASEX_LL", "GASEX_RL"]
    this.gas_exchanger_left_lung = ["GASEX_LL"]
    this.gas_exchanger_right_lung = ["GASEX_RL"]
    this.intrapulmonary_shunt = ["IPS"]

    this.el_lungs_factor = 1.0;
    this.el_thorax_factor = 1.0;
    
    this.res_upper_airways_factor = 1.0;
    this.res_lower_airways_factor = 1.0;

    this.gex_factor = 1.0


    // -----------------------------------------------
    // dependent properties
    // -----------------------------------------------


    // local properties
    this._update_interval = 0.015; // update interval (s)
    this._update_counter = 0.0; // update interval counter (s)
    this._prev_el_lungs_factor = 1.0;
    this._prev_el_thorax_factor = 1.0;
    this._prev_gex_factor = 1.0;
    this._prev_res_upper_airways_factor = 1.0;
    this._prev_res_lower_airways_factor = 1.0;
  }

  calc_model() {
    this._update_counter += this._t;
    if (this._update_counter > this._update_interval) {
      this._update_counter = 0.0;

      if (this._prev_el_lungs_factor !== this.el_lungs_factor) {
        // update the model
        this.set_el_lung_factor(this.el_lungs_factor)
        // store the current value
        this._prev_el_lungs_factor = this.el_lungs_factor
      }

      if (this._prev_el_thorax_factor !== this.el_thorax_factor) {
        // update the model
        this.set_el_thorax_factor(this.el_thorax_factor)
        // store the current value
        this._prev_el_thorax_factor = this.el_thorax_factor
      }

      if (this._prev_res_upper_airways_factor !== this.res_upper_airways_factor) {
        this.set_upper_airway_resistance(this.res_upper_airways_factor)
        this._prev_res_upper_airways_factor = this.res_upper_airways_factor
      }

      if (this._prev_res_lower_airways_factor !== this.res_lower_airways_factor) {
        this.set_lower_airway_resistance(this.res_lower_airways_factor)
        this._prev_res_lower_airways_factor = this.res_lower_airways_factor
      }

      if (this._prev_gex_factor !== this.gex_factor) {
        this.set_gasexchange(this.gex_factor);
        this._prev_gex_factor = this.gex_factor;
      }
    }
  }

  set_el_lung_factor(new_factor) {
    // el_base_factor_ps is a persistent factor accumulating effects from several models, so apply the
    // delta (not the absolute value). Compute it once so every lung gets the same change.
    const delta = new_factor - this._prev_el_lungs_factor;
    this.lungs.forEach(lung_name => {
      const m = this._model_engine.models[lung_name];
      if (!m) return;
      let f_ps = m.el_base_factor_ps + delta;
      if (f_ps < 0) f_ps = 0;
      m.el_base_factor_ps = f_ps;
    });
    this.el_lungs_factor = new_factor;
  }

  set_el_thorax_factor(new_factor) {
    const delta = new_factor - this._prev_el_thorax_factor;
    this.thorax.forEach(thorax_name => {
      const m = this._model_engine.models[thorax_name];
      if (!m) return;
      let f_ps = m.el_base_factor_ps + delta;
      if (f_ps < 0) f_ps = 0;
      m.el_base_factor_ps = f_ps;
    });
    this.el_thorax_factor = new_factor;
  }

  set_upper_airway_resistance(new_factor) {
    const delta = new_factor - this._prev_res_upper_airways_factor;
    this.upper_airways.forEach(uaw_name => {
      const m = this._model_engine.models[uaw_name];
      if (!m) return;
      let f_ps = m.r_factor_ps + delta;
      if (f_ps < 0) f_ps = 0;
      m.r_factor_ps = f_ps;
    });
    this.res_upper_airways_factor = new_factor;
  }

  set_lower_airway_resistance(new_factor) {
    const delta = new_factor - this._prev_res_lower_airways_factor;
    this.lower_airways.forEach(law_name => {
      const m = this._model_engine.models[law_name];
      if (!m) return;
      let f_ps = m.r_factor_ps + delta;
      if (f_ps < 0) f_ps = 0;
      m.r_factor_ps = f_ps;
    });
    this.res_lower_airways_factor = new_factor;
  }

  set_gasexchange(new_factor) {
    const delta = new_factor - this._prev_gex_factor;
    this.gas_echangers.forEach(gex_name => {
      const m = this._model_engine.models[gex_name];
      if (!m) return;
      // the O2 and CO2 diffusion factors track the same target; clamp each at 0 independently
      let f_ps_o2 = m.dif_o2_factor_ps + delta;
      let f_ps_co2 = m.dif_co2_factor_ps + delta;
      if (f_ps_o2 < 0) f_ps_o2 = 0;
      if (f_ps_co2 < 0) f_ps_co2 = 0;
      m.dif_o2_factor_ps = f_ps_o2;
      m.dif_co2_factor_ps = f_ps_co2;
    });
    this.gex_factor = new_factor;
  }

}

```

### FILE: explain/component_models/Shunts.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";

export class Shunts extends BaseModelClass {
  // static properties
  static model_type = "Shunts";

  /*
    The Shunts class calculates the resistances of the shunts (ductus arteriosus, foramen ovale, and ventricular septal defect) from the diameter and length.
    It sets the resistances on the correct models representing the shunts.
    */
  constructor(model_ref, name = "") {
    super(model_ref, name);

    // -----------------------------------------------
    // initialize independent properties
    // -----------------------------------------------
    this.diameter_fo = 2.0; // diameter of the foramen ovale in mm
    this.diameter_fo_max = 10.0; 
    this.diameter_vsd = 2.0;
    this.diameter_vsd_max = 10.0;

    this.atrial_septal_width = 3.0; // width of the atrial septum in mm
    this.ventricular_septal_width = 5.0; // width of the ventricular septum in mm
    this.fo_lr_factor = 10.0;
    this.viscosity = 6.0; 

    this.ips_res = 5000; // resistance of the left intrapulmonary shunt in mmHg * s / L


    // -----------------------------------------------
    // initialize dependent properties
    // -----------------------------------------------
    this.flow_fo = 0.0; // flow through the foramen ovale in L/s
    this.flow_vsd = 0.0; // flow through the muscular ventricular septal defect in L/s

    this.velocity_fo = 0.0; // velocity of flow through the foramen ovale in m/s
    this.velocity_vsd = 0.0; // velocity of flow through the perimembranous ventricular septal defect in m/s
    
    this.res_fo = 500;
    this.res_vsd = 500;

    // -----------------------------------------------
    // initialize local properties (preceded with _)
    // -----------------------------------------------
    this._fo_ivci = null;
    this._fo_svc = null;
    this._vsd = null; // muscular ventricular septal defect
    this._ipsl = null; // left intrapulmonar shunt
    this._ipsr = null; // right intrapulmonar shunt
    this._refs_resolved = false;
    this._refs_warned = false;
  }

  _resolve_refs() {
    // Resolve sub-model references once. Returns true when all required
    // models are present and cached; false otherwise (caller should skip
    // this step). The first unresolved attempt emits a single console
    // warning so missing wiring is visible without flooding the log.
    const models = this._model_engine.models;
    const fo_ivci = models["LA_RAIVCI"];
    const fo_svc = models["LA_RASVC"];
    const vsd = models["VSD"];
    const ipsl = models["IPSL"];
    const ipsr = models["IPSR"];

    if (!fo_ivci || !fo_svc || !vsd || !ipsl || !ipsr) {
      if (!this._refs_warned) {
        const missing = [
          !fo_ivci && "LA_RAIVCI",
          !fo_svc && "LA_RASVC",
          !vsd && "VSD",
          !ipsl && "IPSL",
          !ipsr && "IPSR",
        ].filter(Boolean).join(", ");
        console.warn(`Shunts: required models not found (${missing}); skipping calc_model.`);
        this._refs_warned = true;
      }
      return false;
    }

    this._fo_ivci = fo_ivci;
    this._fo_svc = fo_svc;
    this._vsd = vsd;
    this._ipsl = ipsl;
    this._ipsr = ipsr;
    this._refs_resolved = true;
    return true;
  }

  calc_model() {
    if (!this._refs_resolved && !this._resolve_refs()) return;

    // guard for a too large diameters
    this.diameter_fo = Math.min(this.diameter_fo, this.diameter_fo_max);
    this.diameter_vsd = Math.min(this.diameter_vsd, this.diameter_vsd_max);

    // if the diameter is zero, set the resistance to a very high value to represent no flow
    this._fo_ivci.no_flow = this.diameter_fo === 0;
    this._fo_svc.no_flow = this.diameter_fo === 0;
    this._vsd.no_flow = this.diameter_vsd === 0;

    // calculate the resistance across the FO and VSD
    this.res_fo = this.calc_resistance(this.diameter_fo, this.atrial_septal_width, this.viscosity);
    this.res_vsd = this.calc_resistance(this.diameter_vsd, this.ventricular_septal_width, this.viscosity);

    // transfer the resistances to the models
    this._fo_ivci.r_for = this.res_fo * this.fo_lr_factor;
    this._fo_ivci.r_back = this.res_fo;

    this._fo_svc.r_for = this.res_fo * this.fo_lr_factor;
    this._fo_svc.r_back = this.res_fo;

    this._vsd.r_for = this.res_vsd;
    this._vsd.r_back = this.res_vsd;

    // intrapulmonary shunts are not diameter-driven: they carry a fixed resistance (ips_res)
    this._ipsl.r_for = this.ips_res;
    this._ipsl.r_back = this.ips_res;

    this._ipsr.r_for = this.ips_res;
    this._ipsr.r_back = this.ips_res;

    // get the flows
    this.flow_fo = this._fo_ivci.flow + this._fo_svc.flow;
    this.flow_vsd = this._vsd.flow;

    // calculate the area of the fo and vsd
    let area_fo = Math.pow((this.diameter_fo * 0.001) / 2.0, 2.0) * Math.PI;
    let area_vsd = Math.pow((this.diameter_vsd * 0.001) / 2.0, 2.0) * Math.PI;

    // calculate the velocities over the fo and vsd
    this.velocity_fo = area_fo > 0 ? (this.flow_fo * 0.001) / area_fo: 0.0;
    this.velocity_vsd = area_vsd > 0 ? (this.flow_vsd * 0.001) / area_vsd: 0.0;

  }

  calc_resistance(diameter, length = 2.0, viscosity = 6.0) {
    if (diameter > 0.0 && length > 0.0) {
      // resistance is calculated using Poiseuille's Law: R = (8 * n * L) / (PI * r^4)
      // diameter (mm), length (mm), viscosity (cP)

      // convert viscosity from centiPoise to Pa * s
      const n_pas = viscosity / 1000.0;

      // convert the length to meters
      const length_meters = length / 1000.0;

      // calculate radius in meters
      const radius_meters = diameter / 2 / 1000.0;

      // calculate the resistance Pa * s / m^3
      let res =
        (8.0 * n_pas * length_meters) / (Math.PI * Math.pow(radius_meters, 4));

      // convert resistance from Pa * s / m^3 to mmHg * s / L
      res = res * 0.00000750062;
      return res;
    } else {
      return 100000000; // a very high resistance to represent no flow
    }
  }
}

```

### FILE: explain/device_models/Ecls.js

```javascript


import { BaseModelClass } from "../base_models/BaseModelClass.js";
import { calc_gas_composition } from "../component_models/GasComposition"
import { calc_blood_composition } from "../component_models/BloodComposition";
import RealTimeMovingAverage from "../helpers/RealTimeMovingAverage";

export class Ecls extends BaseModelClass {
  // static properties
  static model_type = "Ecls";

  /*

    */

  constructor(model_ref, name = "") {
    // initialize the base model class setting all the general properties of the model which all models have in common
    
    // Average umbilical cord length at term          : – 55 cm
    // Mean luminal CSA per artery at 37–39 weeks     : – 0.147 cm² (overall mean across 300 normal pregnancies) DOI: http://dx.doi.org/10.18203/2320-1770.ijrcog20183851
    // Mean volume of umbilical artery                : 55 * 0.147 = 8.1 cm3 = 8.1 ml per artery => 16.2 ml for two arteries
    // Mean luminal CSA umbilical vein at 37-39 weeks : - 0.58 cm2
    // Mean volume of umbilical vein                  : 55 * 0.58 = 31.9 cm3 = 31.9 ml  Spurway J, Logan P, Pak S. The development, structure and blood flow within the umbilical cord with particular reference to the venous system. Australas J Ultrasound Med. 2012 Aug;15(3):97-102. doi: 10.1002/j.2205-0140.2012.tb00013.x. Epub 2015 Dec 31. PMID: 28191152; PMCID: PMC5025097.
    // Mean volume of fetal part of placenta          : 427 ml DOI: 10.7863/jum.2008.27.11.1583

    super(model_ref, name);
    // -----------------------------------------------
    // initialize independent parameters
    this.ecls_running = false;
    this.ecls_clamped = true; // flags whether the umbilical vessels are clamped or not
    
    
    this.drainage_res_factor = 1.0; // factor to adjust the drainage resistance
    this.return_res_factor = 1.0; // factor to adjust the return resistance
    this.tubing_res_factor = 1.0; // factor to adjust the tubing in resistance
    this.pump_res_factor = 1.0; // factor to adjust the pump resistance
    this.oxy_res_for = 1500; // resistance of the oxygenator (mmHg/(L/s))
    this.oxy_res_back = 1500; // resistance of the oxygenator (mmHg/(L/s))
    this.oxy_res_factor = 1.0; // factor to adjust the oxygenator resistance
    this.oxy_vol = 0.09; // volume of the oxygenator (L)
    this.gas_flow = 0.5; // gas flow rate through the oxygenator (L/min)
    this.gas_fio2 = 0.205; // fraction of inspired oxygen in the gas flow through the oxygenator
    this.gas_fico2 = 0.000392; // fraction of inspired carbon dioxide in the gas flow through the oxygenator
    this.gas_humidity = 0.5; // humidity of the gas flow through the oxygenator (fraction)
    this.gas_temp = 20.0; // temperature of the gas flow through the oxygenator (dgs C)
    this.dif_o2 = 0.0005; // diffusion constant for oxygen (mmol/mmHg * s)
    this.dif_co2 = 0.001; // diffusion constant for carbon dioxide (mmol/mmHg * s)
    this.pump_rpm = 1500.0; // pump speed in rotations per minute
    this.pump_mode = 0; // pump mode (0=centrifugal, 1=roller pump)
    this.pump_pressure =  0.0
    this.cannula_sizes_single = [6, 8, 10, 12]; // sizes of the drainage and return cannula in Fr
    this.cannula_size_double = [13, 14, 15]; // sizes of the drainage cannula in Fr for double lumen cannula (the return cannula is always 1 Fr larger than the drainage cannula in this case)
    
    this.drainage_site = "RA"; // site of drainage cannula insertion
    this.drainage_cannula_diameter = 0.0027; // diameter of the drainage cannula (m)
    this.drainage_cannula_length = 0.105; // length of the drainage cannula (m)

    this.return_site = "AAR"; // site of return cannula insertion
    this.return_cannula_diameter = 0.0027; // diameter of the return cannula (m)
    this.return_cannula_length = 0.105; // length of the return cannula (m)
    
    this.tubing_in_diameter = 0.00375; // diameter of the tubing (m)
    this.tubing_in_length = 1.0; // length of the tubing (m)

    this.tubing_out_diameter = 0.00375; // diameter of the tubing (m)
    this.tubing_out_length = 1.0; // length of the tubing (m)

    this.pump_res_for = 50; // resistance of the pump (mmHg/(L/s))
    this.pump_res_back = 50; // resistance of the pump (mmHg/(L/s))
    this.pump_vol = 0.031; // volume of the pump (L)


    this.return_cannulas = {
      "Bio-Medicus arterial 8 Fr": {
        "inner_diameter": 0.002, // m
        "length": 0.1, // m
        "resistance": 5500
      },
      "Bio-Medicus arterial 10 Fr": {
        "inner_diameter": 0.00267, // m
        "length": 0.105, // m
        "resistance": 1700
      },
      "Bio-Medicus arterial 12 Fr": {
        "inner_diameter": 0.0032, // m
        "length": 0.11, // m
        "resistance": 650
      },
       "Medtronic Crescent 13 Fr": {
        "inner_diameter": 0.0029, // m
        "length": 0.089, // m
        "resistance": 7000
      },
       "Medtronic Crescent 15 Fr": {
        "inner_diameter": 0.0029, // m
        "length": 0.097, // m
        "resistance": 2700
      },
    }

    this.drainage_cannulas = {
      "Bio-Medicus venous 8 Fr": {
        "inner_diameter": 0.0021, // m
        "length": 0.1, // m
        "resistance": 4600
      },
      "Bio-Medicus venous 10 Fr": {
        "inner_diameter": 0.0027, // m
        "length": 0.105, // m
        "resistance": 1500
      },
      "Bio-Medicus venous 12 Fr": {
        "inner_diameter": 0.0033, // m
        "length": 0.11, // m
        "resistance": 600
      },
      "Bio-Medicus venous 14 Fr": {
        "inner_diameter": 0.0039, // m
        "length": 0.115, // m
        "resistance": 260
      },
      "Medtronic Crescent 13 Fr": {
        "inner_diameter": 0.0028, // m
        "length": 0.089, // m
        "resistance": 2500,
      },
      "Medtronic Crescent 15 Fr": {
        "inner_diameter": 0.0028, // m
        "length": 0.097, // m
        "resistance": 1100,
      },
    }

    this.drainage_cannula_type = "Bio-Medicus venous 12 Fr";
    this.return_cannula_type = "Bio-Medicus arterial 10 Fr";

    if (this.drainage_cannulas[this.drainage_cannula_type]) {
      const selectedDrainageCannula = this.drainage_cannulas[this.drainage_cannula_type];
      this.drainage_cannula_diameter = selectedDrainageCannula.inner_diameter;
      this.drainage_cannula_length = selectedDrainageCannula.length;
    }
    if (this.return_cannulas[this.return_cannula_type]) {
      const selectedReturnCannula = this.return_cannulas[this.return_cannula_type];
      this.return_cannula_diameter = selectedReturnCannula.inner_diameter;
      this.return_cannula_length = selectedReturnCannula.length;
    }

    // -----------------------------------------------
    // initialize dependent parameters
    this.p_ven = 0.0; // filtered venous pressure (mmHg)
    this.p_int = 0.0; // filtered pressure at the interface between the drainage cannula and the tubing (mmHg)
    this.p_art = 0.0; // filtered arterial pressure (mmHg)
    this.flow = 0.0; // blood flow through the ECLS circuit (L/s)
    this.flow_avg = 0.0; // moving average of the blood flow through the ECLS circuit (L/s)
    this.sat_ven_o2 = 0.0; // venous oxygen saturation (%)
    this.sat_postoxy_o2 = 0.0; // post-oxygenator oxygen saturation (%)
    this.pco2_postoxy = 0.0; // post-oxygenator pCO2 (mmHg)
    this.tubing_in_res = 1000; // resistance of the tubing in (mmHg/(L/s))
    this.tubing_in_vol = 0.1; // volume of the tubing in (L)
    this.tubing_out_res = 1000; // resistance of the tubing out (mmHg/(L/s))
    this.tubing_out_vol = 0.1; // volume of the tubing out (L)
    this.drainage_res = this.drainage_cannulas[this.drainage_cannula_type]?.resistance || 1000; // resistance of the drainage cannula (mmHg/(L/s))
    this.return_res = this.return_cannulas[this.return_cannula_type]?.resistance || 1000; // resistance of the return cannula (mmHg/(L/s))

    // -----------------------------------------------
    // local parameters
    this.prev_fio2 = 0.0; // previous fio2 value to detect changes in fio2
    this.prev_fico2 = 0.0; // previous fico2 value to detect changes in fico2
    this.prev_gas_flow = 0.0; // previous gas flow value to detect changes in gas flow
    this.pressure_avg_window = 400; // number of samples used for real-time pressure moving averages
    this.flow_avg_window = 400; // number of samples used for the real-time flow moving average (~0.9 s at 0.015 s updates)
    this._update_interval = 0.015; // update interval of the placenta model (s)
    this._update_counter = 0.0; // counter of the update interval (s)
    this._blood_comp_interval = 1.0; // low-frequency blood composition update interval (s)
    this._blood_comp_counter = 0.0; // counter for low-frequency blood composition updates (s)
    this._flow_avg_calculator = new RealTimeMovingAverage(this.flow_avg_window);
    this._p_ven_avg_calculator = new RealTimeMovingAverage(this.pressure_avg_window);
    this._p_int_avg_calculator = new RealTimeMovingAverage(this.pressure_avg_window);
    this._p_art_avg_calculator = new RealTimeMovingAverage(this.pressure_avg_window);
    

    this._ecls_drainage = null; // reference to the drainage model instance
    this._ecls_tubing_in = null; // reference to the tubing in model instance
    this._ecls_pump = null; // reference to the pump model instance
    this._ecls_oxy = null; // reference to the oxygenator model instance
    this._ecls_tubing_out = null; // reference to the tubing out model instance
    this._ecls_return = null; // reference to the return model instance
    this._ecls_gas_source = null; // reference to the gas source model instance
    this._ecls_gas_oxy = null; // reference to the gas oxygenator model instance
    this._ecls_gas_out = null; // reference to the gas out model instance
    this._ecls_gas_insp_valve = null; // reference to the gas inspiration valve model instance
    this._ecls_gasexchanger = null; // reference to the gas exchanger model instance
  }

  calc_model() {
    if (!this.ecls_running) {
      this.flow = 0.0;
      this.flow_avg = 0.0;
      this.p_ven = 0.0;
      this.p_int = 0.0;
      this.p_art = 0.0;
      this._flow_avg_calculator.reset();
      this._p_ven_avg_calculator.reset();
      this._p_int_avg_calculator.reset();
      this._p_art_avg_calculator.reset();
      this._blood_comp_counter = 0.0;

      // disable the circuit sub-models so a stopped ECLS no longer conducts (refs are cached once the
      // circuit has run; they are null before the first run, when the sub-models are already disabled)
      [this._ecls_drainage, this._ecls_tubing_in, this._ecls_pump, this._ecls_oxy,
       this._ecls_tubing_out, this._ecls_return, this._ecls_gas_source, this._ecls_gas_oxy,
       this._ecls_gas_out, this._ecls_gas_insp_valve, this._ecls_gasex].forEach((m) => {
        if (m) m.is_enabled = false;
      });
      return;
    }

    this._blood_comp_counter += this._t;
    this._update_counter += this._t;
    if (this._update_counter > this._update_interval) {
        this._update_counter = 0.0;

        const newWindow = Math.max(1, Math.trunc(this.flow_avg_window));
        if (newWindow !== this._flow_avg_calculator.windowSize) {
          this._flow_avg_calculator = new RealTimeMovingAverage(newWindow);
        }

        const newPressureWindow = Math.max(1, Math.trunc(this.pressure_avg_window));
        if (newPressureWindow !== this._p_ven_avg_calculator.windowSize) {
          this._p_ven_avg_calculator = new RealTimeMovingAverage(newPressureWindow);
          this._p_int_avg_calculator = new RealTimeMovingAverage(newPressureWindow);
          this._p_art_avg_calculator = new RealTimeMovingAverage(newPressureWindow);
        }

        // get a reference to the associated models
        this._ecls_drainage = this._model_engine.models["ECLS_DRAINAGE"];
        this._ecls_tubing_in = this._model_engine.models["ECLS_TUBING_IN"];
        this._ecls_pump = this._model_engine.models["ECLS_PUMP"];
        this._ecls_oxy = this._model_engine.models["ECLS_OXY"];
        this._ecls_tubing_out = this._model_engine.models["ECLS_TUBING_OUT"];
        this._ecls_return = this._model_engine.models["ECLS_RETURN"];
        this._ecls_gas_source = this._model_engine.models["ECLS_GAS_SOURCE"];
        this._ecls_gas_oxy = this._model_engine.models["ECLS_GAS_OXY"];
        this._ecls_gas_out = this._model_engine.models["ECLS_GAS_OUT"];
        this._ecls_gas_insp_valve = this._model_engine.models["ECLS_GAS_INSP_VALVE"];
        this._ecls_gasex = this._model_engine.models["ECLS_GASEX"];

        // skip this tick if the circuit wiring is incomplete (any sub-model missing) rather than
        // dereferencing undefined below
        if (!this._ecls_drainage || !this._ecls_tubing_in || !this._ecls_pump || !this._ecls_oxy ||
            !this._ecls_tubing_out || !this._ecls_return || !this._ecls_gas_source ||
            !this._ecls_gas_oxy || !this._ecls_gas_out || !this._ecls_gas_insp_valve ||
            !this._ecls_gasex) {
          return;
        }

        // set the drainage and return sites
        this._ecls_drainage.comp_from = this.drainage_site;
        this._ecls_return.comp_to = this.return_site;

        const selectedDrainageCannula = this.drainage_cannulas[this.drainage_cannula_type];
        if (selectedDrainageCannula) {
          this.drainage_res = selectedDrainageCannula.resistance;
          this.drainage_cannula_diameter = selectedDrainageCannula.inner_diameter;
          this.drainage_cannula_length = selectedDrainageCannula.length;
        }

        const selectedReturnCannula = this.return_cannulas[this.return_cannula_type];
        if (selectedReturnCannula) {
          this.return_res = selectedReturnCannula.resistance;
          this.return_cannula_diameter = selectedReturnCannula.inner_diameter;
          this.return_cannula_length = selectedReturnCannula.length;
        }

        // make sure all the associated models are in the same enabled/disabled state as the placenta model
        this._ecls_drainage.is_enabled = this.ecls_running;
        this._ecls_tubing_in.is_enabled = this.ecls_running;
        this._ecls_pump.is_enabled = this.ecls_running;
        this._ecls_oxy.is_enabled = this.ecls_running;
        this._ecls_tubing_out.is_enabled = this.ecls_running;
        this._ecls_return.is_enabled = this.ecls_running;
        this._ecls_gas_source.is_enabled = this.ecls_running;
        this._ecls_gas_oxy.is_enabled = this.ecls_running;
        this._ecls_gas_out.is_enabled = this.ecls_running;
        this._ecls_gas_insp_valve.is_enabled = this.ecls_running;
        this._ecls_gasex.is_enabled = this.ecls_running;

        // clamp umbilical vessels if set to clamped
        this._ecls_drainage.no_flow = this.ecls_clamped;
        this._ecls_tubing_in.no_flow = this.ecls_clamped;
        this._ecls_pump.no_flow = this.ecls_clamped;
        this._ecls_oxy.no_flow = this.ecls_clamped;
        this._ecls_tubing_out.no_flow = this.ecls_clamped;
        this._ecls_return.no_flow = this.ecls_clamped;
        this._ecls_gasex.is_enabled = !this.ecls_clamped;

        // set the resistances of the associated models
        this._ecls_drainage.r_for = this.drainage_res * this.drainage_res_factor; // set the drainage resistance to a high value to simulate the umbilical artery resistance
        this._ecls_drainage.r_back = this.drainage_res * this.drainage_res_factor; // set the drainage resistance to a high value to simulate the umbilical artery resistance
        this._ecls_tubing_in.r_for = this.tubing_in_res * this.tubing_res_factor; // set the tubing resistance to a low value to simulate the tubing resistance
        this._ecls_tubing_in.r_back = this.tubing_in_res * this.tubing_res_factor; // set the tubing resistance to a low value to simulate the tubing resistance
        this._ecls_pump.r_for = this.pump_res_for * this.pump_res_factor; // set the pump resistance to a low value to simulate the pump resistance
        this._ecls_pump.r_back = this.pump_res_back * this.pump_res_factor; // set the pump resistance to a low value to simulate the pump resistance
        this._ecls_oxy.r_for = this.oxy_res_for * this.oxy_res_factor; // set the oxygenator resistance to a medium value to simulate the oxygenator resistance
        this._ecls_oxy.r_back = this.oxy_res_back * this.oxy_res_factor; // set the oxygenator resistance to a medium value to simulate the oxygenator resistance
        this._ecls_tubing_out.r_for = this.tubing_out_res * this.tubing_res_factor; // set the tubing resistance to a low value to simulate the tubing resistance
        this._ecls_tubing_out.r_back = this.tubing_out_res * this.tubing_res_factor; // set the tubing resistance to a low value to simulate the tubing resistance
        this._ecls_return.r_for = this.return_res * this.return_res_factor; // set the return resistance to a high value to simulate the umbilical vein resistance
        this._ecls_return.r_back = this.return_res * this.return_res_factor; // set the return resistance to a high value to simulate the umbilical vein resistance

        // update the gas composition in the gas source model if fio2 or fico2 has changed
        if (this.prev_fio2 !== this.gas_fio2 || this.prev_fico2 !== this.gas_fico2) {
          calc_gas_composition(this._ecls_gas_source, this.gas_fio2, this.gas_temp, this.gas_humidity, this.gas_fico2);
          this.prev_fio2 = this.gas_fio2;
          this.prev_fico2 = this.gas_fico2;
        }

        // update the inspiratory valve position
        if (this.prev_gas_flow !== this.gas_flow) {
          // calculate the resistance of the inspiratory valve. 
          // flow = pressure / resistance => resistance = pressure / flow. Assuming a maximum pressure of 100 mmHg and a maximum flow of 10 L/min, the maximum resistance would be 100 / 10 = 10 mmHg/(L/min). We can then set the opening of the valve based on the gas flow as a fraction of the maximum flow.
          // resistance = pressure / flow => opening = flow / max_flow
          let res = (this._ecls_gas_source.pres - this._ecls_gas_out.pres) / (this.gas_flow / 60.0); // calculate the resistance of the inspiratory valve based on the current pressure and gas flow
          if (res > 60) {
            this._ecls_gas_insp_valve.r_for = res - 50; 
          }
          this.prev_gas_flow = this.gas_flow;
        }

        // update the gasexchanger diffusion constants
        this._ecls_gasex.dif_o2 = this.dif_o2;
        this._ecls_gasex.dif_co2 = this.dif_co2;

        // calculate the pump pressure and apply the pump pressures to the connected resistors
        this.pump_pressure = -this.pump_rpm / 25.0;
        this._ecls_pump.pump_rpm = this.pump_rpm;
        if (this.pump_mode === 0) {
          this._ecls_pump.p1_ext = 0.0;
          this._ecls_pump.p2_ext = this.pump_pressure;
        } else {
          this._ecls_oxy.p1_ext = this.pump_pressure;
          this._ecls_oxy.p2_ext = 0.0;
        }

        // get the measured pressures and flow from the associated models
        const p_ven_raw = this._ecls_tubing_in.pres; // pressure at inlet of drainage cannula
        const p_int_raw = this._ecls_pump.pres; // pressure at pump interface
        const p_art_raw = this._ecls_tubing_out.pres; // pressure at outlet of return cannula
        this.p_ven = this._p_ven_avg_calculator.addValue(p_ven_raw);
        this.p_int = this._p_int_avg_calculator.addValue(p_int_raw);
        this.p_art = this._p_art_avg_calculator.addValue(p_art_raw);
        this.flow = this._ecls_return.flow * 60.0; // blood flow through the ECLS circuit is the flow through the drainage cannula
        this.flow_avg = this._flow_avg_calculator.addValue(this.flow);

        if (this._blood_comp_counter >= this._blood_comp_interval) {
          this._blood_comp_counter -= this._blood_comp_interval;
          calc_blood_composition(this._ecls_tubing_in);
          calc_blood_composition(this._ecls_tubing_out);
          this.sat_ven_o2 = this._ecls_tubing_in.so2;
          this.sat_postoxy_o2 = this._ecls_tubing_out.so2;
          this.pco2_postoxy = this._ecls_tubing_out.pco2;
        }
      }
  }
}

```

### FILE: explain/device_models/Monitor.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass.js";

export class Monitor extends BaseModelClass {
  // static properties
  static model_type = "Monitor";

  constructor(model_ref, name = "") {
    super(model_ref, name);

    // Independent properties
    this.heart_rate = 0.0; // average heart rate over the last hr_avg_beats beats, in bpm
    this.resp_rate = 0.0; // average respiratory rate over the last rr_avg_time seconds, in breaths/min
    this.etco2 = 0.0; // end-tidal CO2, mirrored from the Ventilator
    this.temp = 0.0; // blood temperature (°C), mirrored from the ascending aorta (AA)
    this.sao2_pre = 0.0; // pre-ductal arterial O2 saturation, from the ascending aorta (AA)
    this.sao2_post = 0.0; // post-ductal arterial O2 saturation, from the descending aorta (AD)
    this.svo2 = 0.0; // venous O2 saturation, from the right atrium / IVC (RAIVCI)

    // JSON-configurable flow read-outs: a list of { name, model } where model is a "ModelName.prop"
    // dot-path (prop defaults to "flow"). Each is reported beat-averaged in L/min under flows[name].
    this.flow_targets = [];

    // JSON-configurable per-beat min/max read-outs: a list of { name, model } where model is a
    // compartment name. Each is reported as { pres_min, pres_max, vol_min, vol_max } under minmax[name].
    this.minmax_targets = [];

    // JSON-configurable raw-signal read-outs: a list of { name, model } where model is a
    // "ModelName.prop" dot-path. The raw value is published unprocessed every step under signals[name].
    this.signal_targets = [];

    // Dependent properties
    // flows
    this.flows = {}; // dictionary of beat-averaged flow read-outs in L/min, keyed by name (from flow_targets)

    // minmax
    this.minmax = {}; // dictionary of beat min/max read-outs, keyed by name_field (from minmax_targets)
    
    // signals
    this.signals = {}; // dictionary of JSON-configured raw signal read-outs, keyed by name

    // derived metrics (computed from the flows dict each flow-averaging window)
    this.fo_flow = 0.0; // foramen ovale flow = fo_ivci_flow + fo_svc_flow (L/min)
    this.do2_br = 0.0; // cerebral oxygen delivery from brain_flow × AA O2 content
    this.do2_lb = 0.0; // lower-body oxygen delivery from kid_flow × AD O2 content

    // monitor settings
    this.hr_avg_beats = 12;
    this.flow_avg_beats = 1;
    this.rr_avg_time = 20;
    this.sat_avg_time = 5;

    // local properties
    this._heart = null; // reference to the heart model, for tracking the cardiac cycle
    this._aa = null; // reference to the ascending aorta (O2 content for do2_br)
    this._ad = null; // reference to the descending aorta (O2 content for do2_lb)
    this._ra_ivci = null; // reference to the right atrium / IVC (venous O2 saturation)
    this._breathing = null; // reference to the spontaneous breathing model (breath events)
    this._ventilator = null; // reference to the mechanical ventilator model (breath events)
    this._rr_intervals = []; // rolling window of breath-to-breath intervals spanning ~rr_avg_time s
    this._rr_window_sum = 0.0; // running sum of _rr_intervals (s)
    this._resp_interval_counter = 0.0; // time since the previous breath; reset on each breath
    this._flow_targets = []; // resolved flow_targets: { name, _model, prop, counter }
    this._minmax_targets = []; // resolved minmax_targets: { name, _model, pres/vol running min/max }
    this._signal_targets = []; // resolved signal_targets: { name, _model, prop }
    this._hr_list = []; // rolling window of the last hr_avg_beats beat-to-beat heart rates
    this._hr_sum = 0.0; // running sum of _hr_list
    this._beats_counter = 0; // counts the number of beats since the last flow read-out
    this._beats_time = 0.0; // counts the time since the last flow read-out
    this._qrs_interval_counter = 0.0; // time since the previous beat (beat-to-beat interval); reset on each beat
  }

  init_model(args = {}) {
    // set the values of the independent properties
    args.forEach((arg) => {
      this[arg["key"]] = arg["value"];
    });

    // resolve the JSON-configured flow targets to { name, model ref, prop, counter }, dropping any
    // whose model does not resolve
    this._flow_targets = (Array.isArray(this.flow_targets) ? this.flow_targets : [])
      .map((t) => {
        const path = String(t.model ?? "");
        const dot = path.indexOf(".");
        const model_name = dot >= 0 ? path.slice(0, dot) : path;
        const prop = dot >= 0 ? path.slice(dot + 1) : "flow";
        return { name: t.name, _model: this._model_engine.models[model_name] ?? null, prop, counter: 0.0 };
      })
      .filter((t) => t.name && t._model);

    // seed the output dictionary so the watch paths (Monitor.flows.<name>) exist from the start
    this._flow_targets.forEach((t) => { this.flows[t.name] = 0.0; });

    // resolve the JSON-configured min/max targets (per-beat min/max of pres and vol)
    this._minmax_targets = (Array.isArray(this.minmax_targets) ? this.minmax_targets : [])
      .map((t) => ({
        name: t.name,
        _model: this._model_engine.models[String(t.model ?? "").split(".")[0]] ?? null,
        pres_min: 1000.0, pres_max: -1000.0, vol_min: 1000.0, vol_max: -1000.0,
      }))
      .filter((t) => t.name && t._model);
    // flat keys (name_field) so the watch paths stay 3 levels deep — Monitor.minmax.<name>_<field>
    // (the DataCollector resolves at most model.prop1.prop2)
    this._minmax_targets.forEach((t) => {
      this.minmax[t.name + "_pres_min"] = 0.0;
      this.minmax[t.name + "_pres_max"] = 0.0;
      this.minmax[t.name + "_pres_mean"] = 0.0;
      this.minmax[t.name + "_vol_min"] = 0.0;
      this.minmax[t.name + "_vol_max"] = 0.0;
    });

    // resolve the JSON-configured raw-signal targets (instantaneous "ModelName.prop" reads)
    this._signal_targets = (Array.isArray(this.signal_targets) ? this.signal_targets : [])
      .map((t) => {
        const path = String(t.model ?? "");
        const dot = path.indexOf(".");
        return {
          name: t.name,
          _model: dot >= 0 ? this._model_engine.models[path.slice(0, dot)] ?? null : null,
          prop: dot >= 0 ? path.slice(dot + 1) : "",
        };
      })
      .filter((t) => t.name && t._model && t.prop);
    this._signal_targets.forEach((t) => { this.signals[t.name] = 0.0; });

    // reference the dependency on the heart model for tracking the cardiac cycle (for the per-beat min/max read-outs)
    this._heart = this._model_engine.models["Heart"] ?? null;

    // reference the aortas for the oxygen-delivery derived metrics (do2_br / do2_lb) and the
    // pre-/post-ductal saturations, plus the right atrium / IVC for the venous saturation
    this._aa = this._model_engine.models["AA"] ?? null;
    this._ad = this._model_engine.models["AD"] ?? null;
    this._ra_ivci = this._model_engine.models["RAIVCI"] ?? null;

    // reference the breathing sources for the respiratory-rate read-out (either may be absent)
    this._breathing = this._model_engine.models["Breathing"] ?? null;
    this._ventilator = this._model_engine.models["Ventilator"] ?? null;

    // flag that the model is initialized
    this._is_initialized = true;
  }

  calc_model() {
    // collect the pressure
    this.collect_pressures();

    // collect flows
    this.collect_flows();

    // collect signals
    this.collect_signals();

    // average respiratory rate
    this.calc_resp_rate();

    // mirror the end-tidal CO2 from the ventilator (last value kept if no ventilator is present)
    this.etco2 = this._ventilator ? this._ventilator.etco2 : this.etco2;

    // mirror the blood temperature from the ascending aorta (last value kept if AA is absent)
    this.temp = this._aa ? this._aa.temp : this.temp;

    // mirror the oxygen saturations (pre-/post-ductal arterial and venous); last value kept if absent
    this.sao2_pre = this._aa ? this._aa.so2 : this.sao2_pre;
    this.sao2_post = this._ad ? this._ad.so2 : this.sao2_post;
    this.svo2 = this._ra_ivci ? this._ra_ivci.so2 : this.svo2;

    // determine the begin of the cardiac cycle, this is where the min and max values are latched
    // only do this when _heart is non-null and has the ncc_ventricular property (to avoid hard dependencies on specific heart models)
    if (this._heart && this._heart.ncc_ventricular === 1) {
      // add 1 beat
      this._beats_counter += 1;

      // rolling average heart rate over the last hr_avg_beats beats. The beat-to-beat rate is
      // derived from the interval since the previous beat; keep a moving window and average it,
      // so heart_rate updates every beat.
      const btb_hr = this._qrs_interval_counter > 0 ? 60.0 / this._qrs_interval_counter : 0.0;
      this._qrs_interval_counter = 0.0;
      this._hr_list.push(btb_hr);
      this._hr_sum += btb_hr;
      while (this._hr_list.length > this.hr_avg_beats) {
        this._hr_sum -= this._hr_list.shift();
      }
      this.heart_rate = this._hr_list.length > 0 ? this._hr_sum / this._hr_list.length : 0.0;

      // latch the JSON-configured per-beat min/max read-outs as flat keys (pressure in mmHg,
      // volume in mL) — Monitor.minmax.<name>_pres_max etc.
      this._minmax_targets.forEach((t) => {
        this.minmax[t.name + "_pres_min"] = t.pres_min;
        this.minmax[t.name + "_pres_max"] = t.pres_max;
        this.minmax[t.name + "_pres_mean"] = (2 * t.pres_min + t.pres_max) / 3.0;
        this.minmax[t.name + "_vol_min"] = t.vol_min * 1000.0;
        this.minmax[t.name + "_vol_max"] = t.vol_max * 1000.0;
        t.pres_min = 1000.0; t.pres_max = -1000.0;
        t.vol_min = 1000.0; t.vol_max = -1000.0;
      });
    }

    // determine the end of the beat-averaging window for the flow read-outs, and if so calculate the beat-averaged flows
    if (this._beats_counter > this.flow_avg_beats) {

      // report the JSON-configured flow targets, beat-averaged in L/min
      this._flow_targets.forEach((t) => {
        this.flows[t.name] = this._beats_time > 0 ? (t.counter / this._beats_time) * 60.0 : 0.0;
        t.counter = 0.0;
      });

      // derived metrics read from the configurable flows dict (require flow_targets named
      // brain_flow / kid_flow / fo_ivci_flow / fo_svc_flow)
      this.fo_flow = (this.flows["fo_ivci_flow"] || 0) + (this.flows["fo_svc_flow"] || 0);
      this.do2_br = this._aa ? (this.flows["brain_flow"] || 0) * this._aa.to2 * 22.4 : this.do2_br;
      this.do2_lb = this._ad ? (this.flows["kid_flow"] || 0) * 4 * this._ad.to2 * 22.4 : this.do2_lb;

      // reset the counters
      this._beats_counter = 0;
      this._beats_time = 0.0;
    }
    
    // increase the timers
    this._qrs_interval_counter += this._t;
    this._beats_time += this._t;

  }
  calc_resp_rate() {
    // a breath starts when an ACTIVE breathing source reaches the start of inspiration
    // (ncc_insp === 1); both the spontaneous and the ventilator source are considered
    const spont = this._breathing && this._breathing.breathing_enabled && this._breathing.ncc_insp === 1;
    const vent = this._ventilator && this._ventilator.is_enabled && this._ventilator.ncc_insp === 1;

    if (spont || vent) {
      const interval = this._resp_interval_counter;
      this._resp_interval_counter = 0.0;
      if (interval > 0) {
        // rolling window of breath-to-breath intervals spanning ~rr_avg_time seconds
        this._rr_intervals.push(interval);
        this._rr_window_sum += interval;
        while (this._rr_window_sum > this.rr_avg_time && this._rr_intervals.length > 1) {
          this._rr_window_sum -= this._rr_intervals.shift();
        }
        // average respiratory rate = breaths in window / window time × 60
        this.resp_rate = this._rr_window_sum > 0 ? (this._rr_intervals.length / this._rr_window_sum) * 60.0 : 0.0;
      }
    }

    this._resp_interval_counter += this._t;
  }

  collect_signals() {
    // raw, unprocessed JSON-configured signals (instantaneous, read every step)
    this._signal_targets.forEach((t) => {
      const v = t._model[t.prop];
      if (v !== undefined) this.signals[t.name] = v;
    });
  }

  collect_pressures() {
    // track per-beat min/max of pressure and volume for the JSON-configured targets
    this._minmax_targets.forEach((t) => {
      const p = t._model.pres;
      const v = t._model.vol;
      if (typeof p === "number") { t.pres_max = Math.max(t.pres_max, p); t.pres_min = Math.min(t.pres_min, p); }
      if (typeof v === "number") { t.vol_max = Math.max(t.vol_max, v); t.vol_min = Math.min(t.vol_min, v); }
    });
  }

  collect_flows() {
    // accumulate the JSON-configured flow targets (volume = flow · dt)
    this._flow_targets.forEach((t) => {
      t.counter += (t._model[t.prop] ?? 0.0) * this._t;
    });
  }
}


```

### FILE: explain/device_models/Resuscitation.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass.js";

export class Resuscitation extends BaseModelClass {
  // static properties
  static model_type = "Resuscitation";

  /*
    The Resuscitation class models a resuscitation situation where chest compressions and ventilations are
    performed at various different rates.
    */
  constructor(model_ref, name = "") {
    // initialize the base model class
    super(model_ref, name);

    // -----------------------------------------------
    // initialize independent properties
    this.cpr_enabled = false; // determines whether CPR is enabled or not
    this.chest_comp_freq = 100.0; // chest compressions frequency (compressions / min)
    this.chest_comp_max_pres = 10.0; // maximal pressure of the chest compressions (mmHg)
    this.chest_comp_targets = { THORAX: 0.1 }; // dictionary holding the target models of the chest compressions and the relative force
    this.chest_comp_no = 15; // number of compressions if not continuous
    this.chest_comp_cont = false; // determines whether the chest compressions are continuous

    this.vent_freq = 30.0; // ventilations frequency (breaths / min)
    this.vent_no = 2; // number of ventilations if not continuous
    this.vent_pres_pip = 16.0; // peak pressure of the ventilations (cmH2O)
    this.vent_pres_peep = 5.0; // positive end-expiratory pressure of the ventilations (cmH2O)
    this.vent_insp_time = 1.0; // inspiration time of the ventilations (s)
    this.vent_fio2 = 0.21; // fio2 of the inspired air

    // -----------------------------------------------
    // initialize dependent properties
    this.chest_comp_pres = 0.0; // compression pressure (mmHg)

    // -----------------------------------------------
    // local variables
    this._ventilator = null; // reference to the mechanical ventilator model
    this._breathing = null; // reference to the breathing model
    this._comp_timer = 0.0; // compressions timer (s)
    this._comp_counter = 0; // counter of the number of compressions
    this._comp_pause = false; // determines whether the compressions are paused or not
    this._comp_pause_interval = 2.0; // interval of the compressions pause (s)
    this._comp_pause_counter = 0.0; // compressions pause counter (s)
    this._vent_interval = 0.0; // interval between ventilations (s)
    this._vent_counter = 0.0; // ventilation interval counter (s)
  }

  init_model(args = {}) {
    // set the values of the independent properties
    args.forEach((arg) => {
      this[arg["key"]] = arg["value"];
    });

    // get references to the model on which this model depends
    this._ventilator = this._model_engine.models["Ventilator"] || null;
    this._breathing = this._model_engine.models["Breathing"] || null;

    // set the fio2 on the ventilator (if present)
    if (this._ventilator) this.set_fio2(this.vent_fio2);

    // flag that the model is initialized
    this._is_initialized = true;
  }

  calc_model() {
    // return if cpr is not enabled
    if (!this.cpr_enabled) return;

    // calculate the compression pause (no of ventilations * breath duration)
    this._comp_pause_interval = (60.0 / this.vent_freq) * this.vent_no;
    this._vent_interval = this._comp_pause_interval / this.vent_no + this._t;

    // if the compressions are continuous set the ventilator frequency on the ventilator model;
    // otherwise set an extremely low ventilator rate (breaths are triggered manually during pauses)
    if (this._ventilator) {
      this._ventilator.vent_rate = this.chest_comp_cont ? this.vent_freq : 1.0;
    }

    // handle the pause in compressions
    if (this._comp_pause) {
      this._comp_pause_counter += this._t;

      if (this._comp_pause_counter > this._comp_pause_interval) {
        this._comp_pause = false;
        this._comp_pause_counter = 0.0;
        this._comp_counter = 0;
        this._vent_counter = 0.0;
      }

      this._vent_counter += this._t;

      if (this._vent_counter > this._vent_interval) {
        this._vent_counter = 0.0;
        this._ventilator?.trigger_breath();
      }
    } else {
      // calculate the compression force using y(t) = A sin(2PIft+o)
      const a = this.chest_comp_max_pres / 2.0;
      const f = this.chest_comp_freq / 60.0;
      this.chest_comp_pres =
        a * Math.sin(2 * Math.PI * f * this._comp_timer - 0.5 * Math.PI) + a;

      this._comp_timer += this._t;

      if (this._comp_timer > 60.0 / this.chest_comp_freq) {
        this._comp_timer = 0.0;
        this._comp_counter += 1;
      }
    }

    // pause compressions if necessary
    if (this._comp_counter >= this.chest_comp_no && !this.chest_comp_cont) {
      this._comp_pause = true;
      this._comp_pause_counter = 0.0;
      this._comp_counter = 0;
      this._ventilator?.trigger_breath();
    }

    // apply the compression force to the targets as an external pressure. Every compartment reads
    // pres_ext (Capacitance / TimeVaryingElastance / Container / GasCapacitance) — unlike pres_cc,
    // which only GasCapacitance and BloodPump read. Use += so it composes with other external
    // pressures (e.g. the thorax container) and is reset by each compartment's calc_pressure per step.
    for (const [key, value] of Object.entries(this.chest_comp_targets)) {
      const m = this._model_engine.models[key];
      if (m) m.pres_ext += this.chest_comp_pres * value;
    }
  }

  switch_cpr(state) {
    if (state) {
      this._ventilator?.switch_ventilator(true);
      this._ventilator?.set_pc(
        this.vent_pres_pip,
        this.vent_pres_peep,
        1.0,
        this.vent_insp_time,
        5.0
      );
      this._breathing?.switch_breathing(false);
      this.cpr_enabled = true;
    } else {
      this.cpr_enabled = false;
    }
  }

  set_fio2(new_fio2) {
    this._ventilator?.set_fio2(new_fio2);
  }
}

```

### FILE: explain/device_models/Ventilator.js

```javascript
import { BaseModelClass } from "../base_models/BaseModelClass";
import { calc_gas_composition } from "../component_models/GasComposition";

export class Ventilator extends BaseModelClass {
  // static properties
  static model_type = "Ventilator";

  /**
   * The Ventilator class models a mechanical ventilator.
   */
  constructor(model_ref, name = "") {
    super(model_ref, name);

    // Independent properties
    this.pres_atm = 760;
    this.fio2 = 0.205;
    this.humidity = 1.0;
    this.temp = 37;
    this.ettube_diameter = 4;
    this.ettube_length = 110;
    this.vent_mode = "PRVC";
    this.vent_rate = 40;
    this.tidal_volume = 0.015;
    this.insp_time = 0.4;
    this.insp_flow = 12;
    this.exp_flow = 3;
    this.pip_cmh2o = 14;
    this.pip_cmh2o_max = 14;
    this.peep_cmh2o = 3;
    this.trigger_volume_perc = 6;
    this.synchronized = false;
    this.components = {}

    // Dependent properties
    this.pres = 0.0;
    this.flow = 0.0;
    this.vol = 0.0;
    this.exp_time = 1.0;
    this.trigger_volume = 0.0;
    this.minute_volume = 0.0;
    this.compliance = 0.0;
    this.resistance = 0.0;
    this.exp_tidal_volume = 0.0;
    this.insp_tidal_volume = 0.0;
    this.ncc_insp = 0.0;
    this.ncc_exp = 0.0;
    this.etco2 = 0.0;
    this.co2 = 0.0;
    this.triggered_breath = false;

    // Local properties
    this._vent_gasin = null;
    this._vent_gascircuit = null;
    this._vent_gasout = null;
    this._vent_insp_valve = null;
    this._vent_exp_valve = null;
    this._vent_ettube = null;
    this._ventilator_parts = [];
    this._ettube_length_ref = 110;
    this._pip = 0.0;
    this._pip_max = 0.0;
    this._peep = 0.0;
    this._a = 0.0;
    this._b = 0.0;
    this._insp_time_counter = 0.0;
    this._exp_time_counter = 0.0;
    this._insp_tidal_volume_counter = 0.0;
    this._exp_tidal_volume_counter = 0.0;
    this._trigger_volume_counter = 0.0;
    this._inspiration = false;
    this._expiration = true;
    this._tv_tolerance = 0.0005;
    this._trigger_blocked = false;
    this._trigger_start = false;
    this._breathing_model = null;
    this._peak_flow = 0.0;
    this._prev_et_tube_flow = 0.0;
    this._et_tube_resistance = 40.0;
  }

  init_model(args = {}) {
    // initialize the super class
    super.init_model(args);

    // get a reference to alle relevant models
    this._breathing_model = this._model_engine.models["Breathing"];
    this._vent_gasin = this._model_engine.models["VENT_GASIN"];
    this._vent_gascircuit = this._model_engine.models["VENT_GASCIRCUIT"];
    this._vent_gasout = this._model_engine.models["VENT_GASOUT"];
    this._vent_insp_valve = this._model_engine.models["VENT_INSP_VALVE"];
    this._vent_ettube = this._model_engine.models["VENT_ETTUBE"];
    this._vent_exp_valve = this._model_engine.models["VENT_EXP_VALVE"];

    // store the models inside a list for easy switching.
    this._ventilator_parts = [
      this._vent_gasin,
      this._vent_gascircuit,
      this._vent_gasout,
      this._vent_insp_valve,
      this._vent_ettube,
      this._vent_exp_valve,
    ];

    // calculate the gas composition of the ventilator circuits
    calc_gas_composition(this._vent_gasin, this.fio2, this.temp, this.humidity);
    calc_gas_composition(this._vent_gascircuit, this.fio2, this.temp, this.humidity);
    calc_gas_composition(this._vent_gasout, 0.205, 20.0, 0.5);

    // calculate the et-tube diameter and resistance
    this.set_ettube_diameter(this.ettube_diameter);
    this._et_tube_resistance = this.calc_ettube_resistance(this.flow);
  }

  calc_model() {
    // translate the pressures to mmHg
    this._pip = this.pip_cmh2o / 1.35951;
    this._pip_max = this.pip_cmh2o_max / 1.35951;
    this._peep = this.peep_cmh2o / 1.35951;

    if (this.synchronized) {
      this.triggering();
    }

    // do the cycling and pressure regulation
    if (this.vent_mode === "PC" || this.vent_mode === "PRVC") {
      this.time_cycling();
      this.pressure_control();
    }

    if (this.vent_mode === "PS") {
      this.flow_cycling();
      this.pressure_control();
    }

    this.pres = (this._vent_gascircuit.pres - this.pres_atm) * 1.35951;
    this.flow = this._vent_ettube.flow * 60.0;
    this.vol += this._vent_ettube.flow * 1000 * this._t;
    this.co2 = this._model_engine.models["DS"]?.pco2 ?? this.co2;
    this.minute_volume = this.exp_tidal_volume * this.vent_rate;
    // compliance is measured per breath at end-expiration in time_cycling (mL/cmH2O); it is not
    // recomputed here — the previous every-step formula used inconsistent units (L/mmHg) and
    // overwrote that per-breath value
    this.resistance = null;
    this._et_tube_resistance = this.calc_ettube_resistance(this.flow);
  }

  triggering() {
    this.trigger_volume =
      (this.tidal_volume / 100.0) * this.trigger_volume_perc;

    if (this._breathing_model?.ncc_insp === 1 && !this._trigger_blocked) {
      this._trigger_start = true;
    }

    if (this._trigger_start) {
      this._trigger_volume_counter += this._vent_ettube.flow * this._t;
    }

    if (this._trigger_volume_counter > this.trigger_volume) {
      this._trigger_volume_counter = 0.0;
      this._exp_time_counter = this.exp_time;
      this._trigger_start = false;
      this.triggered_breath = true;
    }
  }

  flow_cycling() {
    if (this._vent_ettube.flow > 0.0 && this.triggered_breath) {
      if (this._vent_ettube.flow > this._prev_et_tube_flow) {
        this._inspiration = true;
        this._expiration = false;
        this.ncc_insp = -1;

        if (this._vent_ettube.flow > this._peak_flow) {
          this._peak_flow = this._vent_ettube.flow;
        }

        this.exp_tidal_volume = -this._exp_tidal_volume_counter;
      } else if (this._vent_ettube.flow < 0.3 * this._peak_flow) {
        this._inspiration = false;
        this._expiration = true;
        this.ncc_exp = -1;
        this._exp_tidal_volume_counter = 0.0;
        this.triggered_breath = false;
      }

      this._prev_et_tube_flow = this._vent_ettube.flow;
    }

    if (this._vent_ettube.flow < 0.0 && !this.triggered_breath) {
      this._peak_flow = 0.0;
      this._prev_et_tube_flow = 0.0;
      this._inspiration = false;
      this._expiration = true;
      this.ncc_exp = -1;
      this._exp_tidal_volume_counter += this._vent_ettube.flow * this._t;
    }

    if (this._inspiration) {
      this.ncc_insp += 1;
      this._trigger_blocked = true;
    }

    if (this._expiration) {
      this.ncc_exp += 1;
      this._trigger_blocked = false;
    }
  }

  time_cycling() {
    this.exp_time = 60.0 / this.vent_rate - this.insp_time;
    if (this._insp_time_counter > this.insp_time) {
      this._insp_time_counter = 0.0;
      this.insp_tidal_volume = this._insp_tidal_volume_counter;
      this._insp_tidal_volume_counter = 0.0;
      this._inspiration = false;
      this._expiration = true;
      this.triggered_breath = false;
      this.ncc_exp = -1;
    }

    if (this._exp_time_counter > this.exp_time) {
      this._exp_time_counter = 0.0;
      this._inspiration = true;
      this._expiration = false;
      this.ncc_insp = -1;
      this.vol = 0.0;
      this.exp_tidal_volume = -this._exp_tidal_volume_counter;
      this.etco2 = this._model_engine.models["DS"]?.pco2 ?? this.etco2;
      this.tv_kg = (this.exp_tidal_volume * 1000.0) / this._model_engine.weight;

      if (this.exp_tidal_volume > 0) {
        this.compliance =
          1 /
          (((this._pip - this._peep) * 1.35951) /
            (this.exp_tidal_volume * 1000.0));
      }

      this._exp_tidal_volume_counter = 0.0;

      if (this.vent_mode === "PRVC") {
        this.pressure_regulated_volume_control();
      }
    }

    if (this._inspiration) {
      this._insp_time_counter += this._t;
      this.ncc_insp += 1;
      this._trigger_blocked = true;
      this._trigger_volume_counter = 0.0;
    }

    if (this._expiration) {
      this._exp_time_counter += this._t;
      this.ncc_exp += 1;
      this._trigger_blocked = false;
    }
  }

  pressure_control() {
    if (this._inspiration) {
      this._vent_exp_valve.no_flow = true;
      this._vent_insp_valve.no_flow = false;
      this._vent_insp_valve.no_back_flow = true;
      this._vent_insp_valve.r_for =
        (this._vent_gasin.pres + this._pip - this.pres_atm - this._peep) /
        (this.insp_flow / 60.0);

      if (this._vent_gascircuit.pres > this._pip + this.pres_atm) {
        this._vent_insp_valve.no_flow = true;
      }

      if (this._vent_ettube.flow > 0) {
        this._insp_tidal_volume_counter += this._vent_ettube.flow * this._t;
      }
    }

    if (this._expiration) {
      this._vent_insp_valve.no_flow = true;
      this._vent_exp_valve.no_flow = false;
      this._vent_exp_valve.no_back_flow = true;
      this._vent_exp_valve.r_for = 10;
      this._vent_gasout.vol =
        this._peep / this._vent_gasout.el_base + this._vent_gasout.u_vol;

      if (this._vent_ettube.flow < 0) {
        this._exp_tidal_volume_counter += this._vent_ettube.flow * this._t;
      }
    }
  }

  pressure_regulated_volume_control() {
    if (this.exp_tidal_volume < this.tidal_volume - this._tv_tolerance) {
      this.pip_cmh2o += 1.0;

      if (this.pip_cmh2o > this.pip_cmh2o_max) {
        this.pip_cmh2o = this.pip_cmh2o_max;
      }
    }

    if (this.exp_tidal_volume > this.tidal_volume + this._tv_tolerance) {
      this.pip_cmh2o -= 1.0;

      if (this.pip_cmh2o < this.peep_cmh2o + 2.0) {
        this.pip_cmh2o = this.peep_cmh2o + 2.0;
      }
    }
  }

  reset_dependent_properties() {
    this.pres = 0.0;
    this.flow = 0.0;
    this.vol = 0.0;
    this.exp_time = 1.0;
    this.trigger_volume = 0.0;
    this.minute_volume = 0.0;
    this.compliance = 0.0;
    this.resistance = 0.0;
    this.exp_tidal_volume = 0.0;
    this.insp_tidal_volume = 0.0;
    this.ncc_insp = 0.0;
    this.ncc_exp = 0.0;
    this.etco2 = 0.0;
    this.co2 = 0.0;
    this.triggered_breath = false;
  }

  switch_ventilator(state) {
    this.is_enabled = state;
    if (!state) {
      this.reset_dependent_properties();
    }

    for (const vp of this._ventilator_parts) {
      vp.is_enabled = state;

      if ("no_flow" in vp) {
        vp.no_flow = !state;
      }
    }

    const mouth_ds = this._model_engine.models["MOUTH_DS"];
    if (mouth_ds) mouth_ds.no_flow = state;
  }

  calc_ettube_resistance(flow) {
    const _ettube_length_ref = 110;
    let res =
      (this._a * flow + this._b) * (this.ettube_length / _ettube_length_ref);
    if (res < 15.0) {
      res = 15;
    }

    this._vent_ettube.r_for = res;
    this._vent_ettube.r_back = res;

    return res;
  }

  set_ettube_length(new_length) {
    if (new_length >= 50) {
      this.ettube_length = new_length;
    }
  }

  set_ettube_diameter(new_diameter) {
    if (new_diameter > 1.5) {
      this.ettube_diameter = new_diameter;
      this._a = -2.375 * new_diameter + 11.9375;
      this._b = -14.375 * new_diameter + 65.9374;
    }
  }

  set_fio2(new_fio2) {
    if (new_fio2 > 20) {
      this.fio2 = new_fio2 / 100.0;
    } else {
      this.fio2 = new_fio2;
    }

    calc_gas_composition(
      this._vent_gasin,
      this.fio2,
      this._vent_gasin.temp,
      this._vent_gasin.humidity
    );
  }

  set_humidity(new_humidity) {
    if (new_humidity >= 0 && new_humidity <= 1.0) {
      this.humidity = new_humidity;
      calc_gas_composition(
        this._vent_gasin,
        this.fio2,
        this._vent_gasin.temp,
        this.humidity
      );
    }
  }

  set_temp(new_temp) {
    this.temp = new_temp;
    calc_gas_composition(
      this._vent_gasin,
      this.fio2,
      this.temp,
      this._vent_gasin.humidity
    );
  }

  set_pc(pip = 14.0, peep = 4.0, rate = 40.0, t_in = 0.4, insp_flow = 10.0) {
    this.pip_cmh2o = pip;
    this.pip_cmh2o_max = pip;
    this.peep_cmh2o = peep;
    this.vent_rate = rate;
    this.insp_time = t_in;
    this.insp_flow = insp_flow;
    this.vent_mode = "PC";
  }

  set_prvc(
    pip_max = 18.0,
    peep = 4.0,
    rate = 40.0,
    tv = 15.0,
    t_in = 0.4,
    insp_flow = 10.0
  ) {
    this.pip_cmh2o_max = pip_max;
    this.peep_cmh2o = peep;
    this.vent_rate = rate;
    this.insp_time = t_in;
    this.tidal_volume = tv / 1000.0;
    this.insp_flow = insp_flow;
    this.vent_mode = "PRVC";
  }

  set_psv(pip = 14.0, peep = 4.0, rate = 40.0, t_in = 0.4, insp_flow = 10.0) {
    this.pip_cmh2o = pip;
    this.pip_cmh2o_max = pip;
    this.peep_cmh2o = peep;
    this.vent_rate = rate;
    this.insp_time = t_in;
    this.insp_flow = insp_flow;
    this.vent_mode = "PS";
  }

  trigger_breath(
    pip = 14.0,
    peep = 4.0,
    rate = 40.0,
    t_in = 0.4,
    insp_flow = 10.0
  ) {
    this._exp_time_counter = this.exp_time + 0.1;
  }
}

```

### FILE: explain/helpers/AnimationPacker.js

```javascript
// AnimationPacker.js  (worker side)
//
// Turns the diagram definition + live model state into the ~per-frame scalar
// stream that drives the sprite diagram. Built once at model build from
// `model.diagram_definition.components`; on every realtime tick it packs each
// animated component's magnitude (volume or flow) and tint source (to2) into a
// fixed-stride Float32 frame and hands it to the ChannelWriter.
//
// Aggregation lives here (in the worker) on purpose: a component may map to
// several engine models (e.g. a lung = ["LL_CAP","LL_ART","LL_VEN"]); summing
// happens against direct model references so the main thread receives ready-to-
// render floats and never needs the model topology — only the AnimRegistry
// (component -> slot) this class emits.

import {
  animStride,
  animMagOffset,
  animTintOffset,
  ANIM_TIME_SLOT,
} from "./RealtimeChannels.js";

export default class AnimationPacker {
  /**
   * @param {Object} model    the engine model object (has .models, .diagram_definition)
   * @param {number} version  registry version (typically the build counter)
   */
  constructor(model, version = 1) {
    this._model = model;
    this.version = version;
    this.enabled = false;
    this._descriptors = []; // precomputed per-component packing descriptors
    this._components = []; // registry entries sent to the main thread
    this.max_to2 = 7.1; // tint normalization hint for the renderer
    this.stride = 0;
    this._frame = null; // reusable Float32 scratch (no per-tick alloc)

    const diagram = model?.diagram_definition;
    if (!diagram || !diagram.components) return;

    if (typeof diagram.settings?.max_to2 === "number") {
      this.max_to2 = diagram.settings.max_to2;
    }

    this._build(diagram.components);
  }

  _build(components) {
    let index = 0;
    for (const [name, comp] of Object.entries(components)) {
      const general = comp?.layout?.general || {};
      const animatedBy = general.animatedBy; // "vol" | "flow" | "none"
      const modelNames = Array.isArray(comp.models) ? comp.models : [];

      // Skip static elements (titles/devices) and anything not data-driven.
      if (animatedBy !== "vol" && animatedBy !== "flow") continue;
      if (modelNames.length === 0) continue;

      const magProp = animatedBy === "vol" ? "vol" : "flow";
      const magRefs = modelNames
        .map((n) => this._model.models[n])
        .filter(Boolean);
      if (magRefs.length === 0) continue;

      const tinting = general.tinting === true;
      const tintRef = tinting ? this._resolveTintRef(comp, magRefs) : null;

      this._descriptors.push({ index, magRefs, magProp, tintRef });
      this._components.push({
        name,
        index,
        kind: magProp,
        models: modelNames,
        tinting,
      });
      index += 1;
    }

    const count = this._descriptors.length;
    this.stride = animStride(count);
    this._frame = new Float32Array(this.stride);
    this.enabled = count > 0;
  }

  /**
   * Pick the model whose `to2` should colour this component. Compartments tint
   * from the first of their own models carrying a `to2`; connectors tint from
   * the upstream (dbcFrom) compartment the blood flows out of.
   */
  _resolveTintRef(comp, magRefs) {
    // Connector: source colour from the upstream compartment.
    const up = comp.dbcFrom || comp.dbcTo;
    if (up && this._model.models[up] && "to2" in this._model.models[up]) {
      return this._model.models[up];
    }
    // Compartment (or connector fallback): first own model exposing to2.
    for (const ref of magRefs) {
      if (ref && "to2" in ref) return ref;
    }
    return null;
  }

  /**
   * Pack the current frame and publish it via the writer. Cheap: one pass over
   * precomputed descriptors, no allocation.
   * @param {import('./ChannelWriter.js').default} writer
   * @param {number} time  model time (seconds)
   */
  pack_and_write(writer, time) {
    if (!this.enabled) return;
    const frame = this._frame;
    frame[ANIM_TIME_SLOT] = time;

    for (let i = 0; i < this._descriptors.length; i++) {
      const d = this._descriptors[i];

      let mag = 0;
      const refs = d.magRefs;
      for (let r = 0; r < refs.length; r++) {
        const v = refs[r][d.magProp];
        if (typeof v === "number") mag += v;
      }
      frame[animMagOffset(d.index)] = mag;

      let tint = 0;
      if (d.tintRef) {
        const t = d.tintRef.to2;
        if (typeof t === "number") tint = t;
      }
      frame[animTintOffset(d.index)] = tint;
    }

    writer.writeAnimFrame(frame);
  }

  /** AnimRegistry for the one-time rt_channels handshake. */
  registry() {
    return {
      version: this.version,
      components: this._components,
      layout: {
        count: this._descriptors.length,
        stride: this.stride,
        max_to2: this.max_to2,
      },
    };
  }
}

```

### FILE: explain/helpers/ChannelWriter.js

```javascript
// ChannelWriter.js  (worker side)
//
// Writes the realtime data plane into the chart ring and anim snapshot, hiding
// the choice of transport behind one interface. Lives in the ModelEngine
// worker; the matching ChannelReader lives on the main thread.
//
// Transport is chosen once at construction:
//   - "shared"       SharedArrayBuffer + Atomics (default when cross-origin
//                    isolated). Worker writes, main reads in its rAF loop; no
//                    per-tick postMessage.
//   - "transferable" one ArrayBuffer transferred per flush() (zero-copy). The
//                    fallback when SharedArrayBuffer is unavailable.
//
// See RealtimeChannels.js for the buffer layout contract shared with the reader.

import {
  RT_MSG,
  RT_TRANSPORT,
  CHART_CTRL,
  ANIM_CTRL,
  CHART_RING_ROWS,
  sharedMemoryAvailable,
} from "./RealtimeChannels.js";

export default class ChannelWriter {
  /**
   * @param {(msg, transferList?) => void} post  postMessage shim from the worker.
   * @param {Object} [opts]
   * @param {string} [opts.transport]  Force "shared" | "transferable". Defaults
   *   to "shared" when available, else "transferable".
   */
  constructor(post, opts = {}) {
    this._post = post;
    this.transport =
      opts.transport ||
      (sharedMemoryAvailable() ? RT_TRANSPORT.SHARED : RT_TRANSPORT.TRANSFERABLE);

    // ---- chart channel state ----
    this._chartStride = 0;
    this._chartVersion = 0;
    this._chartCapacity = CHART_RING_ROWS;
    // shared: control + ring; transferable: a per-tick batch we copy out of.
    this._chartCtrl = null; // Int32Array (shared mode)
    this._chartRing = null; // Float64Array (shared mode)
    this._chartBatch = null; // Float64Array (transferable mode)
    this._chartBatchRows = 0; // rows pending in the batch (transferable mode)
    this._chartBatchCap = 0; // batch capacity in rows (transferable mode)

    // ---- anim channel state ----
    this._animStride = 0;
    this._animVersion = 0;
    this._animCtrl = null; // Int32Array (shared mode)
    this._animFrames = null; // Float32Array length 2*stride (shared mode)
    this._animPending = null; // Float32Array (transferable mode, latest frame)
  }

  // -------------------------------------------------------------------------
  // Chart channel
  // -------------------------------------------------------------------------

  /**
   * (Re)allocate the chart ring for a new column layout. Called at build and
   * whenever the watchlist changes the number of signals. Bumps nothing on its
   * own — pass the registry version so reader-side frames can be matched.
   * @param {number} stride   floats per row (col 0 = time, then signals)
   * @param {number} version  registry version these rows belong to
   * @param {number} [capacityRows]
   */
  acquireChartRing(stride, version, capacityRows = CHART_RING_ROWS) {
    this._chartStride = stride;
    this._chartVersion = version;
    this._chartCapacity = capacityRows;

    if (this.transport === RT_TRANSPORT.SHARED) {
      const ctrl = new Int32Array(
        new SharedArrayBuffer(CHART_CTRL.LEN * Int32Array.BYTES_PER_ELEMENT)
      );
      ctrl[CHART_CTRL.WRITE_IDX] = 0;
      ctrl[CHART_CTRL.READ_HINT] = 0;
      ctrl[CHART_CTRL.VERSION] = version;
      ctrl[CHART_CTRL.CAPACITY] = capacityRows;
      ctrl[CHART_CTRL.STRIDE] = stride;
      this._chartCtrl = ctrl;
      this._chartRing = new Float64Array(
        new SharedArrayBuffer(
          capacityRows * stride * Float64Array.BYTES_PER_ELEMENT
        )
      );
    } else {
      // Generous per-tick batch; the writer copies out exactly the used rows.
      this._chartBatchCap = 1024;
      this._chartBatch = new Float64Array(this._chartBatchCap * stride);
      this._chartBatchRows = 0;
    }
  }

  /**
   * Append one chart row. `values` must have length === stride (col 0 = time).
   */
  appendChartRow(values) {
    const stride = this._chartStride;
    if (stride === 0) return;

    if (this.transport === RT_TRANSPORT.SHARED) {
      const w = Atomics.load(this._chartCtrl, CHART_CTRL.WRITE_IDX);
      const base = (w % this._chartCapacity) * stride;
      this._chartRing.set(values, base);
      // publish the new row last, after the data is in place
      Atomics.store(this._chartCtrl, CHART_CTRL.WRITE_IDX, w + 1);
    } else {
      if (this._chartBatchRows >= this._chartBatchCap) {
        // Batch full within a single tick (very unlikely) — grow once.
        const grown = new Float64Array(this._chartBatch.length * 2);
        grown.set(this._chartBatch);
        this._chartBatch = grown;
        this._chartBatchCap *= 2;
      }
      this._chartBatch.set(values, this._chartBatchRows * stride);
      this._chartBatchRows += 1;
    }
  }

  // -------------------------------------------------------------------------
  // Anim channel
  // -------------------------------------------------------------------------

  /**
   * (Re)allocate the anim snapshot for a scenario's component layout.
   * @param {number} stride   floats per frame (slot 0 = time)
   * @param {number} version  registry version
   */
  acquireAnimSnapshot(stride, version) {
    this._animStride = stride;
    this._animVersion = version;

    if (this.transport === RT_TRANSPORT.SHARED) {
      const ctrl = new Int32Array(
        new SharedArrayBuffer(ANIM_CTRL.LEN * Int32Array.BYTES_PER_ELEMENT)
      );
      ctrl[ANIM_CTRL.ACTIVE] = 0;
      ctrl[ANIM_CTRL.SEQ] = 0;
      ctrl[ANIM_CTRL.VERSION] = version;
      ctrl[ANIM_CTRL.STRIDE] = stride;
      this._animCtrl = ctrl;
      // two physical frames back to back
      this._animFrames = new Float32Array(
        new SharedArrayBuffer(2 * stride * Float32Array.BYTES_PER_ELEMENT)
      );
    } else {
      this._animPending = null;
    }
  }

  /**
   * Publish the latest anim frame. `values` must have length === anim stride.
   */
  writeAnimFrame(values) {
    const stride = this._animStride;
    if (stride === 0) return;

    if (this.transport === RT_TRANSPORT.SHARED) {
      // seqlock write into the inactive frame, then flip + publish.
      const active = Atomics.load(this._animCtrl, ANIM_CTRL.ACTIVE);
      const next = active ^ 1;
      this._animFrames.set(values, next * stride);
      Atomics.store(this._animCtrl, ANIM_CTRL.ACTIVE, next);
      Atomics.add(this._animCtrl, ANIM_CTRL.SEQ, 1);
    } else {
      // Coalesce: only the most recent frame survives until flush().
      const frame = new Float32Array(stride);
      frame.set(values);
      this._animPending = frame;
    }
  }

  // -------------------------------------------------------------------------
  // Flush (transferable transport only; no-op in shared mode)
  // -------------------------------------------------------------------------

  flush() {
    if (this.transport !== RT_TRANSPORT.TRANSFERABLE) return;

    if (this._chartBatchRows > 0) {
      const stride = this._chartStride;
      const count = this._chartBatchRows;
      const out = new Float64Array(count * stride);
      out.set(this._chartBatch.subarray(0, count * stride));
      this._post(
        {
          type: RT_MSG.CHART,
          version: this._chartVersion,
          stride,
          count,
          buffer: out.buffer,
        },
        [out.buffer]
      );
      this._chartBatchRows = 0;
    }

    if (this._animPending) {
      const buf = this._animPending.buffer;
      this._post(
        {
          type: RT_MSG.ANIM,
          version: this._animVersion,
          stride: this._animStride,
          buffer: buf,
        },
        [buf]
      );
      this._animPending = null;
    }
  }

  // -------------------------------------------------------------------------
  // Handshake descriptor — merged by ModelEngine into the rt_channels message
  // -------------------------------------------------------------------------

  /**
   * Transport + (shared mode) SAB handles for the reader to attach to. Posted
   * once per (re)allocation alongside the chart/anim registries.
   */
  descriptor() {
    const d = {
      transport: this.transport,
      chart: { stride: this._chartStride, version: this._chartVersion },
      anim: { stride: this._animStride, version: this._animVersion },
    };
    if (this.transport === RT_TRANSPORT.SHARED) {
      // The .buffer of each typed array is the SharedArrayBuffer; structured
      // clone shares (does not copy) SABs across the worker boundary.
      d.chart.ctrl = this._chartCtrl?.buffer || null;
      d.chart.ring = this._chartRing?.buffer || null;
      d.chart.capacity = this._chartCapacity;
      d.anim.ctrl = this._animCtrl?.buffer || null;
      d.anim.frames = this._animFrames?.buffer || null;
    }
    return d;
  }
}

```

### FILE: explain/helpers/DataCollector.js

```javascript
export default class Datacollector {
  constructor(model) {
    // store a reference to the model instance
    this.model = model;

    // define the watch list
    this.watch_list = [];
    this.watch_list_labels = new Set();

    // define the watch list
    this.watch_list_slow = [];
    this.watch_list_slow_labels = new Set();

    // define the data sample interval
    this.sample_interval = 0.005;
    this.sample_interval_slow = 1.0;

    this._interval_counter = 0;
    this._interval_counter_slow = 0;


    // get the modeling stepsize from the model
    this.modeling_stepsize = this.model.modeling_stepsize;

    // try to add two always-needed ecg properties to the watchlist
    this.ncc_ventricular = {
      label: "Heart.ncc_ventricular",
      model: this.model.models["Heart"],
      prop1: "ncc_ventricular",
      prop2: null,
    };
    this.ncc_atrial = {
      label: "Heart.ncc_atrial",
      model: this.model.models["Heart"],
      prop1: "ncc_atrial",
      prop2: null,
    };

    // add the two always there
    this.watch_list.push(this.ncc_atrial);
    this.watch_list.push(this.ncc_ventricular);
    this.watch_list_labels.add(this.ncc_atrial.label);
    this.watch_list_labels.add(this.ncc_ventricular.label);

    // define the data list
    this.collected_data = [];
    this.collected_data_slow = [];

    // --- realtime typed data-plane (the chart channel) ---
    // When legacy_mode is true the fast stream is collected into the object
    // arrays above (original behavior). When a ChannelWriter is attached via
    // set_channels(), the fast stream is instead packed into a Float64 ring —
    // but only while rt_active (the realtime loop); offline calculate() keeps
    // using the object path so getModelData() still returns rows.
    this.legacy_mode = true;
    this.rt_active = false;
    // _channels (a ChannelWriter, which holds a postMessage function) and
    // _on_chart_registry (a callback) are function-bearing and must NOT be
    // structured-cloned. get_model_state posts the whole model graph, which
    // reaches here via every component's _model_engine back-reference, so these
    // are declared non-enumerable to keep that clone working.
    Object.defineProperty(this, "_channels", { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, "_on_chart_registry", { value: null, writable: true, enumerable: false });
    this.registry_version = 0;
    this.chart_slots = []; // ["time", ...watch_list labels in registry order]
    this._chart_row = null; // reusable Float64 scratch row (no per-sample alloc)
  }

  /**
   * Attach the realtime typed transport. Switches the fast stream off the
   * object path and builds the initial chart signal index.
   * @param {Object} writer ChannelWriter instance
   * @param {Function} on_registry called whenever the chart layout/version changes
   */
  set_channels(writer, on_registry) {
    this._channels = writer;
    this._on_chart_registry = on_registry || null;
    this.legacy_mode = false;
    this._rebuild_chart_index();
  }

  /**
   * Rebuild the fixed slot map (index <-> dot-path) after any watchlist change,
   * bump the registry version, (re)allocate the chart ring, and notify so the
   * handshake is re-posted. No-op without an attached writer.
   */
  _rebuild_chart_index() {
    if (!this._channels) return;
    this.registry_version += 1;
    this.chart_slots = ["time", ...this.watch_list.map((w) => w.label)];
    const stride = this.chart_slots.length;
    this._chart_row = new Float64Array(stride);
    this._channels.acquireChartRing(stride, this.registry_version);
    if (this._on_chart_registry) this._on_chart_registry();
  }

  clear_data() {
    this.collected_data = [];
  }

  clear_data_slow() {
    this.collected_data_slow = [];
  }

  clear_watchlist() {
    // first clear all data
    this.clear_data();

    // empty the watch list
    this.watch_list = [];
    this.watch_list_labels.clear();

    // add the two always present
    this.watch_list.push(this.ncc_atrial);
    this.watch_list.push(this.ncc_ventricular);
    this.watch_list_labels.add(this.ncc_atrial.label);
    this.watch_list_labels.add(this.ncc_ventricular.label);

    if (!this.legacy_mode) this._rebuild_chart_index();
  }

  clear_watchlist_slow() {
    // first clear all data
    this.clear_data_slow();

    // empty the watch list
    this.watch_list_slow = [];
    this.watch_list_slow_labels.clear();
  }

  get_model_data() {
    let data = this.collected_data;
    // clear the current collection
    this.collected_data = [];
    // return the data object
    return data;
  }

  get_model_data_slow() {
    let data = this.collected_data_slow;
    // clear the current collection
    this.collected_data_slow = [];
    // return the data object
    return data;
  }

  set_sample_interval(new_interval = 0.005) {
    this.sample_interval = new_interval;
  }

  set_sample_interval_slow(new_interval = 0.005) {
    this.sample_interval_slow = new_interval;
  }

  add_to_watchlist(properties) {
    // define a return object
    let success = true;

    // first clear all data
    this.clear_data();

    // check whether property is a string
    if (typeof properties === "string") {
      // convert string to a list
      properties = [properties];
    }

    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];

      if (!this.watch_list_labels.has(prop)) {
        const processed_prop = this._find_model_prop(prop);

        if (processed_prop !== null) {
          this.watch_list.push(processed_prop);
          this.watch_list_labels.add(prop);
        } else {
          success = false;
        }
      }
    }

    if (!this.legacy_mode) this._rebuild_chart_index();

    return success;
  }

  add_to_watchlist_slow(properties) {
    // define a return object
    let success = true;

    // first clear all data
    this.clear_data_slow();

    // check whether property is a string
    if (typeof properties === "string") {
      // convert string to a list
      properties = [properties];
    }

    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];

      if (!this.watch_list_slow_labels.has(prop)) {
        const processed_prop = this._find_model_prop(prop);

        if (processed_prop !== null) {
          this.watch_list_slow.push(processed_prop);
          this.watch_list_slow_labels.add(prop);
        } else {
          success = false;
        }
      }
    }

    return success;
  }

  clean_up() {
    this.watch_list = this.watch_list.filter((dc_item) => dc_item.model.is_enabled);
    this.watch_list_labels = new Set(this.watch_list.map((item) => item.label));
    if (!this.legacy_mode) this._rebuild_chart_index();
  }

  clean_up_slow() {
    this.watch_list_slow = this.watch_list_slow.filter((dc_item) => dc_item.model.is_enabled);
    this.watch_list_slow_labels = new Set(this.watch_list_slow.map((item) => item.label));

  }

  collect_data(model_clock) {

    // collect data at specific intervals set by the sample_interval
    if (this._interval_counter >= this.sample_interval) {
      // reset the interval counter
      this._interval_counter = 0;

      const t = Math.round(model_clock * 10000) / 10000;

      if (!this.legacy_mode && this.rt_active && this._channels && this._chart_row) {
        // typed path: pack one fixed-stride row into the chart ring. Every slot
        // is written (0 for disabled models) so columns stay aligned.
        const row = this._chart_row;
        row[0] = t;
        for (let i = 0; i < this.watch_list.length; i++) {
          const parameter = this.watch_list[i];
          let value = 0;
          if (parameter.model.is_enabled) {
            let v = parameter.model[parameter.prop1];
            if (parameter.prop2 !== null) {
              v = v ? v[parameter.prop2] || 0 : 0;
            }
            value = typeof v === "number" ? v : 0;
          }
          row[i + 1] = value;
        }
        this._channels.appendChartRow(row);
      } else {
        // legacy object path (original behavior; also used by offline calculate)
        const data_object = { time: t };
        for (let i = 0; i < this.watch_list.length; i++) {
          const parameter = this.watch_list[i];
          if (parameter.model.is_enabled) {
            let value = parameter.model[parameter.prop1];
            if (parameter.prop2 !== null) {
              value = value[parameter.prop2] || 0;
            }
            data_object[parameter.label] = value;
          }
        }
        this.collected_data.push(data_object);
      }
    }

    if (this._interval_counter_slow >= this.sample_interval_slow) {
      // reset the interval counter
      this._interval_counter_slow = 0;

      // declare a data object holding the current model time
      const data_object_slow = { time: Math.round(model_clock * 10000) / 10000 };

      // process the watch_list
      for (let i = 0; i < this.watch_list_slow.length; i++) {
        const parameter = this.watch_list_slow[i];
        // get the value of the model variable as stated in the watchlist
        let value = parameter.model[parameter.prop1];
        if (parameter.prop2 !== null) {
          value = value[parameter.prop2] || 0;
        }

        // add the value to the data object
        data_object_slow[parameter.label] = value;
      }

      // add the data object to the collected data list
      this.collected_data_slow.push(data_object_slow);
    }

    // increase the interval counter
    this._interval_counter += this.modeling_stepsize;
    this._interval_counter_slow += this.modeling_stepsize;
  }

  _find_model_prop(prop) {
    // split the model from the prop
    const t = prop.split(".");

    // if only 1 property is present
    if (t.length === 2) {
      // try to find the parameter in the model
      if (t[0] in this.model.models) {
        if (t[1] in this.model.models[t[0]]) {
          const r = this.model.models[t[0]][t[1]];
          return {
            label: prop,
            model: this.model.models[t[0]],
            prop1: t[1],
            prop2: null,
            ref: r,
          };
        }
      }
    }

    // if 2 properties are present
    if (t.length === 3) {
      // try to find the parameter in the model
      if (t[0] in this.model.models) {
        if (t[1] in this.model.models[t[0]]) {
          return {
            label: prop,
            model: this.model.models[t[0]],
            prop1: t[1],
            prop2: t[2],
          };
        }
      }
    }

    return null;
  }
}

```

### FILE: explain/helpers/ModelScaler.js

```javascript
// ModelScaler provides granular factor-based controls for scaling
// model parameters by subsystem: blood, heart, lung, and containers.
// A factor of 1.0 means no change, 0.5 means half, 2.0 means double.
//
// Each scaling group targets a predefined list of component names rather
// than scanning all models by type. This makes scaling explicit and
// predictable. The lists can be customized via the config object.

export default class ModelScaler {
  constructor(model, config = null) {
    this._model = model;
    this._config = config

    // tracking previous factor values for delta calculation
    this._prev = {
      blood_vol: 1.0,
      heart_vol: 1.0,
      lung_vol: 1.0,
      thorax_vol: 1.0,
      pericardium_vol: 1.0,
      blood_el: 1.0,
      blood_res: 1.0,
      pulm_el: 1.0,
      pulm_res: 1.0,
      pulm_uvol: 1.0,
      sys_el: 1.0,
      sys_res: 1.0,
      sys_uvol: 1.0,
      airway_el: 1.0,
      airway_uvol: 1.0,
      airway_upper_res: 1.0,
      airway_lower_res: 1.0,
      left_lung_el: 1.0,
      left_lung_res: 1.0,
      left_lung_uvol: 1.0,
      right_lung_el: 1.0,
      right_lung_res: 1.0,
      right_lung_uvol: 1.0,
      heart_el_min: 1.0,
      heart_el_max: 1.0,
      left_heart_el_min: 1.0,
      left_heart_el_max: 1.0,
      left_heart_uvol: 1.0,
      right_heart_el_min: 1.0,
      right_heart_el_max: 1.0,
      right_heart_uvol: 1.0,
      heart_res: 1.0,
      thorax_el: 1.0,
      pericardium_el: 1.0,
    };
  }

  // Apply a scaling delta to a specific factor property on a list of named components
  _apply(names, prop, factor) {
    for (const name of names) {
      const comp = this._model.models[name];
      if (comp && comp[prop] !== undefined) {
        comp[prop] = factor;
      }
    }
  }

  // --- VOLUME SCALING ---

  // Scale vol and u_vol_factor_scaling on a list of named components
  _scale_vol(names, factor, delta) {
    for (const name of names) {
      const comp = this._model.models[name];
      if (!comp) continue;
      if (comp.vol !== undefined) {
        comp.vol *= delta;
        comp.u_vol *= delta;
      }
    }
  }

  // Scale all volumes (blood, heart, lung, thorax, pericardium
  scale_blood_volume(factor) {
    const delta = factor / this._prev.blood_vol;
    this._prev.blood_vol = factor;
    this._scale_vol(this._config.blood.volume, factor, delta);
  }

  scale_heart_volume(factor) {
    const delta = factor / this._prev.heart_vol;
    this._scale_vol(this._config.heart.volume, factor, delta);
    this._prev.heart_vol = factor;
  }

  scale_lung_volume(factor) {
    const delta = factor / this._prev.lung_vol;
    this._scale_vol(this._config.lung.volume, factor, delta);
    this._prev.lung_vol = factor;
  }

  scale_thorax_volume(factor) {
    const delta = factor / this._prev.thorax_vol;
    this._scale_vol(this._config.thorax, factor, delta);
    this._prev.thorax_vol = factor;
  }

  scale_pericardium_volume(factor) {
    const delta = factor / this._prev.pericardium_vol;
    this._scale_vol(this._config.pericardium, factor, delta);
    this._prev.pericardium_vol = factor;
  }

  // --- BLOOD ---

  scale_blood_elastances(factor) {
    this._apply(this._config.blood.el_base, "el_base_factor_scaling_ps", factor);
    this._prev.blood_el = factor;
  }

  scale_blood_resistances(factor) {
    this._apply(this._config.blood.resistance, "r_factor_scaling_ps", factor);
    this._prev.blood_res = factor;
  }

  // --- PULMONARY ---

  scale_pulmonary_elastances(factor) {
    this._apply(this._config.blood_pulmonary.el_base, "el_base_factor_scaling_ps", factor);
    this._prev.pulm_el = factor;
  }

  scale_pulmonary_resistances(factor) {
    this._apply(this._config.blood_pulmonary.resistance, "r_factor_scaling_ps", factor);
    this._prev.pulm_res = factor;
  }

  scale_pulmonary_u_vol(factor) {
    this._apply(this._config.blood_pulmonary.el_base, "u_vol_factor_scaling_ps", factor);
    this._prev.pulm_uvol = factor;
  }

  // --- SYSTEMIC ---

  scale_systemic_elastances(factor) {
    this._apply(this._config.blood_systemic.el_base, "el_base_factor_scaling_ps", factor);
    this._prev.sys_el = factor;
  }

  scale_systemic_resistances(factor) {
    this._apply(this._config.blood_systemic.resistance, "r_factor_scaling_ps", factor);
    this._prev.sys_res = factor;
  }

  scale_systemic_u_vol(factor) {
    this._apply(this._config.blood_systemic.el_base, "u_vol_factor_scaling_ps", factor);
    this._prev.sys_uvol = factor;
  }

  // --- AIRWAY (dead space + conducting airways) ---

  scale_airway_elastances(factor) {
    this._apply(this._config.airway.el_base, "el_base_factor_scaling_ps", factor);
    this._prev.airway_el = factor;
  }

  scale_airway_u_vol(factor) {
    this._apply(this._config.airway.u_vol, "u_vol_factor_scaling_ps", factor);
    this._prev.airway_uvol = factor;
  }

  scale_airway_upper_resistances(factor) {
    this._apply(this._config.airway.resistance_upper, "r_factor_scaling_ps", factor);
    this._prev.airway_upper_res = factor;
  }

  scale_airway_lower_resistances(factor) {
    this._apply(this._config.airway.resistance_lower, "r_factor_scaling_ps", factor);
    this._prev.airway_lower_res = factor;
  }

  // --- LEFT LUNG ---

  scale_left_lung_elastances(factor) {
    this._apply(this._config.left_lung.el_base, "el_base_factor_scaling_ps", factor);
    this._prev.left_lung_el = factor;
  }

  scale_left_lung_resistances(factor) {
    this._apply(this._config.left_lung.resistance, "r_factor_scaling_ps", factor);
    this._prev.left_lung_res = factor;
  }

  scale_left_lung_u_vol(factor) {
    this._apply(this._config.left_lung.u_vol, "u_vol_factor_scaling_ps", factor);
    this._prev.left_lung_uvol = factor;
  }

  // --- RIGHT LUNG ---

  scale_right_lung_elastances(factor) {
    this._apply(this._config.right_lung.el_base, "el_base_factor_scaling_ps", factor);
    this._prev.right_lung_el = factor;
  }

  scale_right_lung_resistances(factor) {
    this._apply(this._config.right_lung.resistance, "r_factor_scaling_ps", factor);
    this._prev.right_lung_res = factor;
  }

  scale_right_lung_u_vol(factor) {
    this._apply(this._config.right_lung.u_vol, "u_vol_factor_scaling_ps", factor);
    this._prev.right_lung_uvol = factor;
  }

  // --- HEART ---

  scale_heart_el_min(factor) {
    this._apply(this._config.heart.el_min, "el_min_factor_scaling_ps", factor);
    this._prev.heart_el_min = factor;
  }

  scale_heart_el_max(factor) {
    this._apply(this._config.heart.el_max, "el_max_factor_scaling_ps", factor);
    this._prev.heart_el_max = factor;
  }

  // --- LEFT HEART ---

  scale_left_heart_el_min(factor) {
    this._apply(this._config.heart_left.el_min, "el_min_factor_scaling_ps", factor);
    this._prev.left_heart_el_min = factor;
  }

  scale_left_heart_el_max(factor) {
    this._apply(this._config.heart_left.el_max, "el_max_factor_scaling_ps", factor);
    this._prev.left_heart_el_max = factor;
  }

  scale_left_heart_u_vol(factor) {
    this._apply(this._config.heart_left.el_min, "u_vol_factor_scaling_ps", factor);
    this._prev.left_heart_uvol = factor;
  }

  // --- RIGHT HEART ---

  scale_right_heart_el_min(factor) {
    this._apply(this._config.heart_right.el_min, "el_min_factor_scaling_ps", factor);
    this._prev.right_heart_el_min = factor;
  }

  scale_right_heart_el_max(factor) {
    this._apply(this._config.heart_right.el_max, "el_max_factor_scaling_ps", factor);
    this._prev.right_heart_el_max = factor;
  }

  scale_right_heart_u_vol(factor) {
    this._apply(this._config.heart_right.el_min, "u_vol_factor_scaling_ps", factor);
    this._prev.right_heart_uvol = factor;
  }

  scale_heart_resistances(factor) {
    this._apply(this._config.heart.resistance, "r_factor_scaling_ps", factor);
    this._prev.heart_res = factor;
  }

  // --- CONTAINERS ---

  scale_thorax_elastances(factor) {
    this._apply(this._config.thorax, "el_base_factor_scaling_ps", factor);
    this._prev.thorax_el = factor;
  }

  scale_pericardium_elastances(factor) {
    this._apply(this._config.pericardium, "el_base_factor_scaling_ps", factor);
    this._prev.pericardium_el = factor;
  }

  // --- INCORPORATE ---

  // Bake all scaling factors into base properties, then reset factors to 1.0
  incorporate() {
    // bake u_vol factors
    const u_vol_groups = [
      ...this._config.blood.volume,
      ...this._config.blood_pulmonary.el_base,
      ...this._config.blood_systemic.el_base,
      ...this._config.heart.volume,
      ...this._config.heart_left.el_min,
      ...this._config.heart_right.el_min,
      ...this._config.lung.volume,
      ...this._config.thorax,
      ...this._config.pericardium,
    ];
    this._bake(u_vol_groups, "u_vol", "u_vol_factor_scaling_ps");

    // bake el_base factors
    const el_base_groups = [
      ...this._config.blood.el_base,
      ...this._config.blood_pulmonary.el_base,
      ...this._config.blood_systemic.el_base,
      ...this._config.lung.el_base,
      ...this._config.thorax,
      ...this._config.pericardium,
    ];
    this._bake(el_base_groups, "el_base", "el_base_factor_scaling_ps");

    // bake heart el_min and el_max factors
    this._bake(this._config.heart.el_min, "el_min", "el_min_factor_scaling_ps");
    this._bake(this._config.heart.el_max, "el_max", "el_max_factor_scaling_ps");

    // bake resistance factors
    const res_groups = [
      ...this._config.blood.resistance,
      ...this._config.blood_pulmonary.resistance,
      ...this._config.blood_systemic.resistance,
      ...this._config.lung.resistance,
      ...this._config.heart.resistance,
    ];
    this._bake_resistance(res_groups);

    // reset all tracking
    for (const key of Object.keys(this._prev)) {
      this._prev[key] = 1.0;
    }
  }

  _bake(names, base_prop, factor_prop) {
    for (const name of names) {
      const comp = this._model.models[name];
      if (!comp) continue;
      const f = comp[factor_prop];
      if (f !== undefined && f !== 1.0) {
        comp[base_prop] *= f;
        comp[factor_prop] = 1.0;
      }
    }
  }

  _bake_resistance(names) {
    for (const name of names) {
      const comp = this._model.models[name];
      if (!comp) continue;
      const f = comp.r_factor_scaling_ps;
      if (f !== undefined && f !== 1.0) {
        if (comp.r_for !== undefined) comp.r_for *= f;
        if (comp.r_back !== undefined) comp.r_back *= f;
        comp.r_factor_scaling_ps = 1.0;
      }
    }
  }

  // --- WEIGHT-BASED SCALING ---

  // Allometric scaling driven by a single new_weight value.
  // Volumes & u_vol scale linearly with weight; elastances & resistances
  // scale inversely with weight, keeping pressures roughly constant across
  // body sizes. Replaces all per-group scaling factors.
  scale_to_weight(new_weight) {
    const baseline = this._model._baseline_weight;
    if (!baseline || baseline <= 0 || !new_weight || new_weight <= 0) return;
    const vol_factor = new_weight / baseline;
    const inv_factor = baseline / new_weight;

    // volumes (linear with weight)
    this.scale_blood_volume(vol_factor);
    this.scale_heart_volume(vol_factor);
    this.scale_lung_volume(vol_factor);
    this.scale_thorax_volume(vol_factor);
    this.scale_pericardium_volume(vol_factor);

    // unstressed volumes (linear with weight)
    // this.scale_pulmonary_u_vol(vol_factor);
    // this.scale_systemic_u_vol(vol_factor);
    // this.scale_airway_u_vol(vol_factor);
    // this.scale_left_lung_u_vol(vol_factor);
    // this.scale_right_lung_u_vol(vol_factor);
    // this.scale_left_heart_u_vol(vol_factor);
    // this.scale_right_heart_u_vol(vol_factor);

    // elastances (inverse with weight)
    // this.scale_blood_elastances(inv_factor);
    // this.scale_pulmonary_elastances(inv_factor);
    // this.scale_systemic_elastances(inv_factor);
    // this.scale_airway_elastances(inv_factor);
    // this.scale_left_lung_elastances(inv_factor);
    // this.scale_right_lung_elastances(inv_factor);
    // this.scale_heart_el_min(inv_factor);
    // this.scale_heart_el_max(inv_factor);
    // this.scale_left_heart_el_min(inv_factor);
    // this.scale_left_heart_el_max(inv_factor);
    // this.scale_right_heart_el_min(inv_factor);
    // this.scale_right_heart_el_max(inv_factor);
    // this.scale_thorax_elastances(inv_factor);
    // this.scale_pericardium_elastances(inv_factor);

    // resistances (inverse with weight)
    // this.scale_blood_resistances(inv_factor);
    // this.scale_pulmonary_resistances(inv_factor);
    // this.scale_systemic_resistances(inv_factor);
    // this.scale_airway_upper_resistances(inv_factor);
    // this.scale_airway_lower_resistances(inv_factor);
    // this.scale_left_lung_resistances(inv_factor);
    // this.scale_right_lung_resistances(inv_factor);
    // this.scale_heart_resistances(inv_factor);

    this._model.weight = new_weight;
  }

  // --- UTILITY ---

  add_volume(vol_liters) {
    const ivci = this._model.models["IVCI"];
    if (ivci && ivci.vol !== undefined) {
      ivci.vol += vol_liters;
    }
  }

  reset() {
    this.scale_blood_volume(1.0);
    this.scale_heart_volume(1.0);
    this.scale_lung_volume(1.0);
    this.scale_thorax_volume(1.0);
    this.scale_pericardium_volume(1.0);

    this.scale_blood_elastances(1.0);
    this.scale_blood_resistances(1.0);

    this.scale_pulmonary_elastances(1.0);
    this.scale_pulmonary_resistances(1.0);
    this.scale_pulmonary_u_vol(1.0);

    this.scale_systemic_elastances(1.0);
    this.scale_systemic_resistances(1.0);
    this.scale_systemic_u_vol(1.0);

    this.scale_airway_elastances(1.0);
    this.scale_airway_u_vol(1.0);
    this.scale_airway_upper_resistances(1.0);
    this.scale_airway_lower_resistances(1.0);

    this.scale_left_lung_elastances(1.0);
    this.scale_left_lung_resistances(1.0);
    this.scale_left_lung_u_vol(1.0);

    this.scale_right_lung_elastances(1.0);
    this.scale_right_lung_resistances(1.0);
    this.scale_right_lung_u_vol(1.0);

    this.scale_heart_el_min(1.0);
    this.scale_heart_el_max(1.0);
    this.scale_left_heart_el_min(1.0);
    this.scale_left_heart_el_max(1.0);
    this.scale_left_heart_u_vol(1.0);
    this.scale_right_heart_el_min(1.0);
    this.scale_right_heart_el_max(1.0);
    this.scale_right_heart_u_vol(1.0);
    this.scale_heart_resistances(1.0);

    this.scale_thorax_elastances(1.0);
    this.scale_pericardium_elastances(1.0);
  }
}

```

### FILE: explain/helpers/RealTimeMovingAverage.js

```javascript
/**
 * Real-time moving average calculator for blood flow signals
 */
export default class RealTimeMovingAverage {
    constructor(windowSize) {
      this.windowSize = Math.max(1, Math.trunc(windowSize));
      this.values = new Array(this.windowSize);
      this.count = 0;
      this.writeIndex = 0;
      this.sum = 0;
      this.currentAverage = 0;
    }
  
    /**
     * Add a new data point and update the average
     * @param {number} newValue - The newest blood flow measurement
     * @return {number} - The updated average flow
     */
    addValue(newValue) {
      if (this.count < this.windowSize) {
        this.values[this.writeIndex] = newValue;
        this.sum += newValue;
        this.count += 1;
      } else {
        const oldestValue = this.values[this.writeIndex];
        this.values[this.writeIndex] = newValue;
        this.sum += newValue - oldestValue;
      }

      this.writeIndex = (this.writeIndex + 1) % this.windowSize;
      
      // Calculate the current average
      this.currentAverage = this.sum / this.count;
      return this.currentAverage;
    }
    
    /**
     * Get the current average without adding a new value
     * @return {number} - The current average flow
     */
    getCurrentAverage() {
      return this.currentAverage;
    }
    
    /**
     * Reset the moving average calculator
     */
    reset() {
      this.values = new Array(this.windowSize);
      this.count = 0;
      this.writeIndex = 0;
      this.sum = 0;
      this.currentAverage = 0;
    }
  }
```

### FILE: explain/helpers/RealtimeChannels.js

```javascript
// RealtimeChannels.js
//
// Shared layout/contract for the realtime DATA PLANE that carries per-frame
// floats from the ModelEngine worker to the main-thread render layer
// (uPlot charts + the PixiJS diagram). This module holds ONLY constants and
// tiny pure helpers so it can be imported by both sides without pulling in any
// worker- or DOM-specific code.
//
// Two independent channels with different drop semantics:
//   - CHART: a ring of fixed-stride rows. The consumer must read EVERY row in
//     order (no dropped samples), so it drains the span [lastRead, writeIdx).
//   - ANIM:  a single "latest frame wins" snapshot. The consumer only ever
//     wants the newest frame; older frames are discarded.
//
// Two transports implement these channels (see ChannelWriter / ChannelReader):
//   - "transferable": one ArrayBuffer posted per flush with an ownership
//     transfer (zero-copy). No special hosting headers required.
//   - "shared": a SharedArrayBuffer written by the worker and read by the main
//     thread in its rAF loop, synchronized with Atomics. Requires COOP/COEP
//     cross-origin isolation (self.crossOriginIsolated === true).

// ---------------------------------------------------------------------------
// Message types (transferable transport, and the one-time registry handshake)
// ---------------------------------------------------------------------------
export const RT_MSG = {
  CHANNELS: "rt_channels", // one-time: registries (+ SAB handles in shared mode)
  CHART: "rt_chart", // transferable: a batch of chart rows
  ANIM: "rt_anim", // transferable: a single latest anim frame
};

export const RT_TRANSPORT = {
  SHARED: "shared",
  TRANSFERABLE: "transferable",
};

// ---------------------------------------------------------------------------
// Shared-memory control headers (Int32Array). One small control array per
// channel sits alongside the data array in shared mode. Indices into it:
// ---------------------------------------------------------------------------

// CHART control: a single-producer / single-consumer ring write cursor.
// WRITE_IDX is the total number of rows ever written (monotonic; the physical
// slot is WRITE_IDX % capacity). READ_HINT lets the writer detect a stalled
// reader. VERSION must match the registry the rows were written under.
export const CHART_CTRL = {
  WRITE_IDX: 0,
  READ_HINT: 1,
  VERSION: 2,
  CAPACITY: 3, // number of rows the data ring holds
  STRIDE: 4, // floats per row (col 0 = time, then signals)
  LEN: 5, // length of the control Int32Array
};

// ANIM control: a seqlock over two physical frames (flip buffer). The writer
// fills the inactive frame, flips ACTIVE, then bumps SEQ. The reader copies the
// ACTIVE frame and retries if SEQ changed mid-copy (torn-read protection).
export const ANIM_CTRL = {
  ACTIVE: 0, // 0 or 1 — which frame slot currently holds the newest data
  SEQ: 1, // bumped on every publish; odd while a write is in progress
  VERSION: 2,
  STRIDE: 3, // floats per frame (slot 0 = time, then component values)
  LEN: 4,
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

// Chart ring capacity in rows. Sized for a comfortable scrolling window even if
// the main thread briefly stalls: ~10 s window at the 0.005 s fast sample rate
// is 2000 rows; ×4 safety headroom.
export const CHART_RING_ROWS = 8192;

// Column 0 of every chart row is the model time (Float64, seconds).
export const CHART_TIME_COL = 0;

// Anim frames are laid out as [time, (mag, tint) * componentCount]. Slot 0 is
// the frame's model time; thereafter two floats per animated component.
export const ANIM_TIME_SLOT = 0;
export const ANIM_FLOATS_PER_COMPONENT = 2; // [magnitude, tintSource]

/**
 * Stride (floats per frame) for an anim snapshot with `componentCount` animated
 * components: 1 time slot + 2 floats each.
 */
export function animStride(componentCount) {
  return ANIM_TIME_SLOT + 1 + componentCount * ANIM_FLOATS_PER_COMPONENT;
}

/** Buffer offset of a component's magnitude value within an anim frame. */
export function animMagOffset(componentIndex) {
  return 1 + componentIndex * ANIM_FLOATS_PER_COMPONENT;
}

/** Buffer offset of a component's tint-source value within an anim frame. */
export function animTintOffset(componentIndex) {
  return 1 + componentIndex * ANIM_FLOATS_PER_COMPONENT + 1;
}

/** True if SharedArrayBuffer + cross-origin isolation are available. */
export function sharedMemoryAvailable() {
  return (
    typeof SharedArrayBuffer !== "undefined" &&
    typeof globalThis !== "undefined" &&
    globalThis.crossOriginIsolated === true
  );
}

```

### FILE: explain/helpers/TaskScheduler.js

```javascript
/**
 * TaskScheduler coordinates deferred mutations on model instances.
 * It supports gradual numeric transitions, immediate primitive swaps,
 * and arbitrary function executions tied to the modeling timestep.
 */
export default class TaskScheduler {
  /**
   * @param {Object} model_ref Reference to the model engine exposing models and modeling_stepsize.
   */
  constructor(model_ref) {
    this._model_engine = model_ref; // object holding a reference to the model engine
    this._t = model_ref.modeling_stepsize; // setting the modeling stepsize
    this._is_initialized = false; // flag whether the model is initialized or not
    this.is_enabled = true; // flag to enable or disable the task scheduler

    // local properties
    this._tasks = {}; // dictionary holding the current tasks
    this._task_interval = 0.015; // interval at which tasks are evaluated
    this._task_interval_counter = 0.0; // counter
  }
  /**
   * Registers a task that simply invokes a model function after the delay.
   * @param {Object} new_function_call { func: "Model.method", args: [...], at: seconds }
   */
  add_function_call(new_function_call) {
    const task_id = Math.floor(Math.random() * 10000)
    const id = "task_" + task_id
    
    new_function_call.id = id
    new_function_call.running = false;
    new_function_call.completed = false;
    new_function_call.type = 2
    new_function_call.stepsize = 0.0;

    let result = new_function_call.func.split(".")
    // get a reference to the function
    new_function_call.model = this._model_engine.models[result[0]]
    new_function_call.func = this._model_engine.models[result[0]][result[1]]

    // add the function call to the task list
    this._tasks[id] = new_function_call;
  }

  /**
   * Registers a property mutation task. Numeric properties tween, primitives swap instantly.
   * @param {Object} new_task { model, prop1, prop2, t, it, at, ... }
   */
  add_task(new_task) {
    // create task id
    const task_id = Math.floor(Math.random() * 10000)
    const id = "task_" + task_id
    new_task.id = id
    new_task.running = false;
    new_task.completed = false;

    new_task.model = this._model_engine.models[new_task.model]

    let current_value = new_task.model[new_task.prop1];
    if (new_task.prop2 !== null) {
      current_value = current_value[new_task.prop2];
    }
    new_task.current_value = current_value;

    if (typeof current_value === "number") {
      new_task.type = 0;
    } else if (typeof current_value === "boolean" || typeof current_value === "string"
    ) {
      new_task.type = 1;
    }

    // calculate the stepsize
    if (new_task.it > 0) {
      const stepsize =
        (new_task.t - current_value) /
        (new_task.it / this._task_interval);
      new_task.stepsize = stepsize;
      if (stepsize !== 0.0) {
        this._tasks[id] = new_task;
      }
    } else {
      new_task.type = 1;
      new_task.stepsize = 0.0;
      this._tasks[id] = new_task;
    }

    if (new_task.type > 0) {
      // calculate the stepsize for boolean or string types
      new_task.stepsize = 0.0;
      this._tasks[id] = new_task;
    }

  }

  /**
   * Removes a scheduled task by its numeric suffix.
   * @param {number} task_id Random id returned when the task was added.
   * @returns {boolean} True if a task was removed.
   */
  remove_task(task_id) {
    const id = "task_" + task_id;
    if (id in this._tasks) {
      delete this._tasks[id];
      return true;
    }
    return false;
  }

  /**
   * Purges every pending task. No-op for already empty scheduler.
   */
  remove_all_tasks() {
    this._tasks = {};
  }

  /**
   * Advances internal timers based on the modeling timestep and executes ready tasks.
   */
  run_tasks() {
    if (this._task_interval_counter > this._task_interval) {
      // reset the counter
      this._task_interval_counter = 0.0;

      // run the tasks
      for (const id in this._tasks) {
        const task = this._tasks[id];
        let remove_task = false;

        // check if the task should be executed
        if (task.at < this._task_interval && !task.running) {
          task.at = 0;
          
          switch (task.type) {
            case 0:
              // start the task
              task.running = true
              break
            case 1:
              // boolean or string type
              task.current_value = task.t;
              this._set_value(task);
              task.completed = true;
              remove_task = true;
              break;
            case 2:
              task.func.apply(task.model, task.args)
              task.completed = true;
              remove_task = true;
              break;
          }

        } else {
          // decrease the time remaining
          task.at -= this._task_interval;
        }

        // for numerical tasks, adjust the value incrementally
        if (task.type < 1 && task.running) {
          if (Math.abs(task.current_value - task.t) < Math.abs(task.stepsize)) {
            task.current_value = task.t;
            this._set_value(task);
            task.stepsize = 0;
            task.completed = true;
            remove_task = true;
          } else {
            task.current_value += task.stepsize;
            this._set_value(task);
          }
        }

        if (remove_task) {
          delete this._tasks[id];
        }
      }
    }

    if (this.is_enabled) {
      this._task_interval_counter += this._t;
    }
  }

  /**
   * Writes the task's current value to the target model property.
   * @param {Object} task Resolved task descriptor.
   * @private
   */
  _set_value(task) {
    if (task.prop2 === null) {
      task.model[task.prop1] = task.current_value;
    } else {
      task.model[task.prop1][task.prop2] = task.current_value;
    }
  }
}

```

### FILE: explain/realtime/ChannelReader.js

```javascript
// ChannelReader.js  (main thread)
//
// The read side of the realtime data plane. Configured once from the worker's
// rt_channels handshake, then read every animation frame by the RealtimeBus:
//   - drainChart(): returns EVERY chart row written since the last drain, in
//     order (no dropped samples). Handles ring wrap and reader-stall overrun.
//   - readAnim(): returns only the NEWEST anim frame (older frames discarded).
//
// Works with both transports. In "shared" mode it attaches typed-array views
// over the worker's SharedArrayBuffers and reads them with Atomics. In
// "transferable" mode the bus feeds it rt_chart / rt_anim messages and it
// queues chart rows / coalesces the latest anim frame.

import {
  RT_TRANSPORT,
  CHART_CTRL,
  ANIM_CTRL,
} from "../helpers/RealtimeChannels.js";

export default class ChannelReader {
  constructor() {
    this.transport = null;

    // chart registry
    this.chartVersion = 0;
    this.chartStride = 0;
    this.chartSlots = [];

    // anim registry
    this.animVersion = 0;
    this.animStride = 0;
    this.animComponents = [];
    this.animLayout = null;

    // shared-mode views
    this._chartCtrl = null;
    this._chartRing = null;
    this._chartCapacity = 0;
    this._chartLastRead = 0;
    this._animCtrl = null;
    this._animFrames = null;
    this._animScratch = null;
    this._animLastSeq = -1;

    // transferable-mode state
    this._chartQueue = []; // [{version, stride, count, data:Float64Array}]
    this._animPending = null; // {version, frame:Float32Array}

    // diagnostics
    this.lastChartGap = false; // set true on a drain that overran the ring
  }

  /**
   * (Re)configure from an rt_channels payload:
   *   { descriptor, chart:{version, slots}, anim:{version, components, layout} }
   * Discards any in-flight data from a previous layout/version.
   */
  configure(payload) {
    const d = payload.descriptor || {};
    this.transport = d.transport;

    this.chartVersion = payload.chart?.version || 0;
    this.chartSlots = payload.chart?.slots || [];
    this.chartStride = d.chart?.stride || this.chartSlots.length;

    if (payload.anim) {
      this.animVersion = payload.anim.version || 0;
      this.animComponents = payload.anim.components || [];
      this.animLayout = payload.anim.layout || null;
      this.animStride = d.anim?.stride || payload.anim.layout?.stride || 0;
    }

    // drop stale in-flight data
    this._chartQueue = [];
    this._animPending = null;

    if (this.transport === RT_TRANSPORT.SHARED) {
      this._attachShared(d);
    }
    if (this.animStride > 0) {
      this._animScratch = new Float32Array(this.animStride);
    }
  }

  _attachShared(d) {
    // reset any previously attached views (a reconfigure may drop a channel)
    this._chartCtrl = null;
    this._chartRing = null;
    this._animCtrl = null;
    this._animFrames = null;

    // chart
    if (d.chart?.ctrl && d.chart?.ring) {
      this._chartCtrl = new Int32Array(d.chart.ctrl);
      this._chartRing = new Float64Array(d.chart.ring);
      this._chartCapacity = d.chart.capacity;
      // begin reading from "now" — don't replay pre-attach history
      this._chartLastRead = Atomics.load(this._chartCtrl, CHART_CTRL.WRITE_IDX);
    }

    // anim
    if (d.anim?.ctrl && d.anim?.frames) {
      this._animCtrl = new Int32Array(d.anim.ctrl);
      this._animFrames = new Float32Array(d.anim.frames);
      this._animLastSeq = -1;
    }
  }

  /** Feed transferable-transport messages (no-op in shared mode). */
  onMessage(msg) {
    if (this.transport !== RT_TRANSPORT.TRANSFERABLE) return;
    if (msg.type === "rt_chart") {
      if (msg.version !== this.chartVersion) return; // stale layout
      this._chartQueue.push({
        version: msg.version,
        stride: msg.stride,
        count: msg.count,
        data: new Float64Array(msg.buffer),
      });
    } else if (msg.type === "rt_anim") {
      if (msg.version !== this.animVersion) return;
      // coalesce: only the newest frame matters
      this._animPending = { version: msg.version, frame: new Float32Array(msg.buffer) };
    }
  }

  /**
   * @returns {null | {version, stride, slots, count, rows:Float64Array}}
   *   `rows` is count*stride Float64 values; null if nothing new.
   */
  drainChart() {
    this.lastChartGap = false;
    if (this.transport === RT_TRANSPORT.SHARED) return this._drainChartShared();
    return this._drainChartTransferable();
  }

  _drainChartShared() {
    const ctrl = this._chartCtrl;
    if (!ctrl) return null;
    const stride = this.chartStride;
    const cap = this._chartCapacity;
    const w = Atomics.load(ctrl, CHART_CTRL.WRITE_IDX);
    let from = this._chartLastRead;
    if (w === from) return null;

    let count = w - from;
    if (count > cap) {
      // reader stalled and the writer lapped us — keep the freshest `cap` rows
      from = w - cap;
      count = cap;
      this.lastChartGap = true;
    }

    const rows = new Float64Array(count * stride);
    for (let k = 0; k < count; k++) {
      const srcRow = (from + k) % cap;
      const srcBase = srcRow * stride;
      rows.set(this._chartRing.subarray(srcBase, srcBase + stride), k * stride);
    }

    this._chartLastRead = w;
    Atomics.store(ctrl, CHART_CTRL.READ_HINT, w);
    return { version: this.chartVersion, stride, slots: this.chartSlots, count, rows };
  }

  _drainChartTransferable() {
    if (this._chartQueue.length === 0) return null;
    const stride = this.chartStride;
    let total = 0;
    for (const b of this._chartQueue) total += b.count;
    const rows = new Float64Array(total * stride);
    let offset = 0;
    for (const b of this._chartQueue) {
      rows.set(b.data.subarray(0, b.count * stride), offset);
      offset += b.count * stride;
    }
    this._chartQueue = [];
    return { version: this.chartVersion, stride, slots: this.chartSlots, count: total, rows };
  }

  /**
   * @returns {null | {version, stride, components, layout, frame:Float32Array}}
   *   `frame` is the newest anim snapshot; null if unchanged since last read.
   */
  readAnim() {
    if (this.animStride === 0) return null;
    if (this.transport === RT_TRANSPORT.SHARED) return this._readAnimShared();
    return this._readAnimTransferable();
  }

  _readAnimShared() {
    const ctrl = this._animCtrl;
    if (!ctrl) return null;
    const stride = this.animStride;
    const scratch = this._animScratch;

    let seq, active;
    do {
      seq = Atomics.load(ctrl, ANIM_CTRL.SEQ);
      active = Atomics.load(ctrl, ANIM_CTRL.ACTIVE);
      const base = active * stride;
      scratch.set(this._animFrames.subarray(base, base + stride));
    } while (seq !== Atomics.load(ctrl, ANIM_CTRL.SEQ));

    if (seq === this._animLastSeq) return null; // nothing new
    this._animLastSeq = seq;
    return {
      version: this.animVersion,
      stride,
      components: this.animComponents,
      layout: this.animLayout,
      frame: scratch,
    };
  }

  _readAnimTransferable() {
    if (!this._animPending) return null;
    const frame = this._animPending.frame;
    this._animPending = null;
    return {
      version: this.animVersion,
      stride: this.animStride,
      components: this.animComponents,
      layout: this.animLayout,
      frame,
    };
  }
}

```

### FILE: explain/realtime/RealtimeBus.js

```javascript
// RealtimeBus.js  (main thread)
//
// Owns the realtime DATA PLANE on the main thread: a single requestAnimationFrame
// loop that drains the chart ring and the latest anim frame from the
// ChannelReader and pushes them to registered renderer adapters (uPlot,
// PixiJS, ...).
//
// This module is deliberately plain — it holds its state in ordinary fields,
// NOT in any framework's reactive system. Per-frame telemetry must never flow
// through Vue refs / React state / Svelte stores; doing so would diff/re-render
// 60×/second. Frameworks own the *shell* (which signals to watch, start/stop,
// layout) and talk to this bus through its imperative API. The control plane
// (status/state/model_ready/errors) stays on Model.js + ModelEmitter.
//
// A renderer adapter is any object with:
//   onRegistry(payload)         // optional: called when channels (re)configure
//   onFrame(chart, anim)        // called each rAF tick with the latest data
// where `chart` is null | {version, stride, slots, count, rows:Float64Array}
// and `anim` is null | {version, stride, components, layout, frame:Float32Array}.

import { RT_MSG } from "../helpers/RealtimeChannels.js";
import ChannelReader from "./ChannelReader.js";

export default class RealtimeBus {
  /**
   * @param {Worker|Object} workerOrModel  the ModelEngine Worker, or a Model
   *   instance exposing `.modelEngine`.
   */
  constructor(workerOrModel) {
    this.worker = workerOrModel?.modelEngine || workerOrModel;
    this.reader = new ChannelReader();
    this.renderers = [];
    this._running = false;
    this._rafId = null;
    this._lastRegistry = null;

    // The bus listens alongside Model's own onmessage handler (both receive
    // every message; each ignores what it doesn't handle). This keeps the data
    // plane self-contained without touching Model.receive().
    this._onMessage = (e) => this._handleMessage(e);
    this.worker.addEventListener("message", this._onMessage);
  }

  /** Register a renderer adapter; replays the current registry if present. */
  addRenderer(renderer) {
    this.renderers.push(renderer);
    if (this._lastRegistry && renderer.onRegistry) {
      renderer.onRegistry(this._lastRegistry);
    }
    return renderer;
  }

  removeRenderer(renderer) {
    const i = this.renderers.indexOf(renderer);
    if (i >= 0) this.renderers.splice(i, 1);
  }

  _handleMessage(e) {
    const d = e.data;
    if (!d || !d.type) return;
    if (d.type === RT_MSG.CHANNELS) {
      this.reader.configure(d.payload);
      this._lastRegistry = d.payload;
      // guard each renderer so one bad adapter can't block the others
      for (const r of this.renderers) {
        if (!r.onRegistry) continue;
        try {
          r.onRegistry(d.payload);
        } catch (err) {
          console.error("RealtimeBus: renderer onRegistry failed", err);
        }
      }
    } else if (d.type === RT_MSG.CHART || d.type === RT_MSG.ANIM) {
      // transferable transport: hand the message to the reader
      this.reader.onMessage(d);
    }
  }

  /** Start the rAF loop. Idempotent. */
  start() {
    if (this._running) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      // never let a tick error kill the loop — always reschedule
      try {
        this._tick();
      } catch (err) {
        console.error("RealtimeBus: tick failed", err);
      }
      this._rafId = globalThis.requestAnimationFrame(loop);
    };
    this._rafId = globalThis.requestAnimationFrame(loop);
  }

  /** Stop the rAF loop. Safe to call when not running. */
  stop() {
    this._running = false;
    if (this._rafId != null) {
      globalThis.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick() {
    const chart = this.reader.drainChart(); // every new row, in order, or null
    const anim = this.reader.readAnim(); // newest frame only, or null
    if (chart == null && anim == null) return;
    // guard each renderer so one throwing adapter can't starve the others
    for (const r of this.renderers) {
      if (!r.onFrame) continue;
      try {
        r.onFrame(chart, anim);
      } catch (err) {
        console.error("RealtimeBus: renderer onFrame failed", err);
      }
    }
  }

  /** Tear down: stop the loop and detach the message listener. */
  dispose() {
    this.stop();
    if (this.worker) this.worker.removeEventListener("message", this._onMessage);
    this.renderers = [];
  }
}

```


## 5. UI / integration layer

### FILE: src/model-interface/registry.ts

```typescript
// AUTO-RELOCATED from the engine model classes' former `static model_interface`
// arrays (verbatim, inheritance resolved). Keyed by model_type. UI presentation
// metadata lives here, not in the physics engine. To regenerate after a model
// gains/changes a tunable parameter, dump each class's effective interface from
// explain/ModelIndex.js and replace MODEL_INTERFACES below.

import type { InterfaceField } from "./types";

export const MODEL_INTERFACES: Record<string, InterfaceField[]> = {
  "Drugs": [
    {
      "target": "description",
      "type": "string",
      "caption": "description",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "caption": "enabled",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false
    },
    {
      "target": "drugs_running",
      "type": "boolean",
      "caption": "drugs running",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "target": "administer_bolus",
      "type": "function",
      "caption": "administer IV bolus",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "target": "drug",
          "caption": "drug",
          "type": "list",
          "custom_options": true,
          "choices": ["adrenaline", "noradrenaline"]
        },
        {
          "target": "dose",
          "caption": "dose (mcg)",
          "type": "number",
          "factor": 1,
          "default": 1,
          "delta": 0.5,
          "rounding": 2,
          "ll": 0,
          "ul": 1000
        }
      ]
    },
    {
      "target": "set_infusion",
      "type": "function",
      "caption": "set infusion",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "target": "drug",
          "caption": "drug",
          "type": "list",
          "custom_options": true,
          "choices": ["adrenaline", "noradrenaline"]
        },
        {
          "target": "rate",
          "caption": "rate (mcg/kg/min)",
          "type": "number",
          "factor": 1,
          "default": 0,
          "delta": 0.05,
          "rounding": 3,
          "ll": 0,
          "ul": 100
        }
      ]
    },
    {
      "target": "injection_site",
      "type": "string",
      "caption": "injection site (IV)",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "target": "effect_site",
      "type": "string",
      "caption": "effect site",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "target": "conc_eff",
      "type": "number",
      "caption": "adrenaline effect-site conc (ng/mL)",
      "factor": 1,
      "rounding": 3,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "target": "hr_drug_factor",
      "type": "number",
      "caption": "applied HR factor",
      "factor": 1,
      "rounding": 3,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "target": "cont_drug_factor",
      "type": "number",
      "caption": "applied contractility factor",
      "factor": 1,
      "rounding": 3,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "target": "svr_drug_factor",
      "type": "number",
      "caption": "applied SVR factor",
      "factor": 1,
      "rounding": 3,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "target": "set_drug_param",
      "type": "function",
      "caption": "set PK/PD parameter",
      "build_prop": false,
      "edit_mode": "advanced",
      "readonly": false,
      "args": [
        {
          "target": "drug",
          "caption": "drug",
          "type": "list",
          "custom_options": true,
          "choices": ["adrenaline", "noradrenaline"]
        },
        {
          "target": "param",
          "caption": "parameter",
          "type": "list",
          "custom_options": true,
          "choices": [
            "ke0",
            "clearance.global",
            "hr_ec50", "hr_emax", "hr_hill",
            "cont_ec50", "cont_emax", "cont_hill",
            "svr_ec50", "svr_emax", "svr_hill"
          ]
        },
        {
          "target": "value",
          "caption": "value",
          "type": "number",
          "factor": 1,
          "default": 0,
          "delta": 0.01,
          "rounding": 4,
          "ll": 0,
          "ul": 1000
        }
      ]
    }
  ],
  "Ans": [
    {
      "target": "description",
      "type": "string",
      "caption": "description",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "caption": "enabled",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false
    },
    {
      "target": "ans_active",
      "type": "boolean",
      "caption": "ANS active",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "target": "BR_MAP",
      "type": "reference",
      "caption": "Baroreceptor",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "target": "CR_PCO2",
      "type": "reference",
      "caption": "Chemoreceptor pCO2",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    }
  ],
  "AnsAfferent": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "input_prop",
      "target_prop": "input_prop",
      "target_model": "input_model",
      "type": "prop-list",
      "build_prop": true,
      "readonly": false,
      "edit_mode": "extra",
      "caption": "input model property",
      "caption_model": "input model",
      "caption_prop": "input property",
      "options": []
    },
    {
      "target": "min_value",
      "type": "number",
      "build_prop": true,
      "readonly": false,
      "edit_mode": "basic",
      "caption": "minimum of the input (firing rate is 0.0)",
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "maximum of the input (firing rate is 1.0)",
      "target": "max_value",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "setpoint of the input (firing rate is 0.5)",
      "target": "set_value",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "timeconstant (s)",
      "target": "tc",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    },
    {
      "caption": "efferents",
      "target": "efferents",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "AnsEfferent"
      ]
    },
    {
      "caption": "effect weight",
      "target": "effect_weight",
      "type": "number",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    }
  ],
  "AnsEfferent": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "target_prop",
      "target_model": "target_model",
      "target_prop": "target_prop",
      "type": "prop-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "caption": "target model property",
      "caption_model": "target model",
      "caption_prop": "target property",
      "options": []
    },
    {
      "caption": "effect size at max firing_rate of 1",
      "target": "effect_at_max_firing_rate",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    },
    {
      "caption": "effect size at min firing_rate of 0",
      "target": "effect_at_min_firing_rate",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    },
    {
      "caption": "timeconstant (s)",
      "target": "tc",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    }
  ],
  "Blood": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "set temperature (C)",
      "edit_mode": "basic",
      "target": "set_temperature",
      "type": "function",
      "args": [
        {
          "caption": "new temperature",
          "target": "temp",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 45,
          "ll": 25
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    },
    {
      "caption": "set viscosity (cP)",
      "edit_mode": "basic",
      "target": "set_viscosity",
      "type": "function",
      "args": [
        {
          "caption": "new new viscosity",
          "target": "viscosity",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 12,
          "ll": 0.1
        }
      ]
    },
    {
      "caption": "set Haldane coefficient",
      "edit_mode": "advanced",
      "target": "set_haldane_coeff",
      "type": "function",
      "args": [
        {
          "caption": "Haldane coefficient (0 = off)",
          "target": "new_coeff",
          "type": "number",
          "factor": 1,
          "delta": 0.05,
          "rounding": 2,
          "ul": 5,
          "ll": 0
        }
      ]
    },
    {
      "caption": "set total oxygen concentration (mmol/l)",
      "target": "set_to2",
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new total oxygen concentration",
          "target": "to2",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 20,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    },
    {
      "caption": "set total carbon dioxide concentration (mmol/l)",
      "target": "set_tco2",
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new total carbon dioxide concentration",
          "target": "tco2",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 20,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    },
    {
      "caption": "set solute concentration",
      "target": "set_solute",
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "target": "solute_name",
          "caption": "solute name",
          "type": "list",
          "custom_options": true,
          "choices": [
            "na",
            "k",
            "ca",
            "cl",
            "lact",
            "mg",
            "albumin",
            "phosphates",
            "uma",
            "hemoglobin"
          ]
        },
        {
          "target": "solute_value",
          "caption": "solute value",
          "type": "number",
          "default": 0,
          "factor": 1,
          "delta": 1,
          "rounding": 0,
          "ul": 1000,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    }
  ],
  "BloodCapacitance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "edit_mode": "basic",
      "caption": "fixed composition",
      "target": "fixed_composition",
      "type": "boolean",
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "extra",
      "caption": "blood temperature (°C)",
      "target": "temp",
      "type": "number",
      "factor": 1,
      "delta": 0.1,
      "rounding": 1,
      "build_prop": true
    },
    {
      "edit_mode": "extra",
      "caption": "blood viscosity (cP)",
      "target": "viscosity",
      "type": "number",
      "factor": 1,
      "delta": 0.1,
      "rounding": 2,
      "build_prop": true
    },
    {
      "edit_mode": "factors",
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor",
      "build_prop": false
    }
  ],
  "BloodDiffusor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygen diffusion constant",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "carbon dioxide diffusion constant",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "target": "dif_solutes",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "solute diffusion constant",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "target": "comp_blood1",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "blood component 1",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber"
      ]
    },
    {
      "target": "comp_blood2",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "blood component 2",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber"
      ]
    },
    {
      "target": "dif_o2_factor_ps",
      "type": "factor",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygen diffusion factor"
    },
    {
      "caption": "carbon dioxide diffusion factor",
      "target": "dif_co2_factor_ps",
      "type": "factor",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "solute diffusion factor",
      "target": "dif_solutes_factor_ps",
      "type": "factor",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false
    }
  ],
  "BloodPump": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance pump (mmHg/L)",
      "target": "el_base",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "type": "number"
    },
    {
      "caption": "pump rpm",
      "target": "pump_rpm",
      "delta": 10,
      "factor": 1,
      "rounding": 1,
      "type": "number"
    },
    {
      "caption": "non linear elastance factor",
      "target": "el_k",
      "delta": 0.1,
      "factor": 0.001,
      "rounding": 3,
      "type": "number"
    },
    {
      "caption": "inlet blood resistor",
      "target": "inlet",
      "type": "list",
      "options": [
        "BloodResistor",
        "BloodVesselResistor",
        "HeartValve"
      ]
    },
    {
      "caption": "outlet blood resistor",
      "target": "outlet",
      "type": "list",
      "options": [
        "BloodResistor",
        "BloodVesselResistor",
        "HeartValve"
      ]
    }
  ],
  "BloodTimeVaryingElastance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance minimum (mmHg/L)",
      "target": "el_min",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance maximum (mmHg/L)",
      "target": "el_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance minimum baseline factor",
      "target": "el_min_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance maximum baseline factor",
      "target": "el_max_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    }
  ],
  "BloodVessel": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "edit_mode": "basic",
      "caption": "no flow allowed",
      "target": "no_flow",
      "type": "boolean",
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "no back flow allowed",
      "target": "no_back_flow",
      "type": "boolean",
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "advanced",
      "build_prop": true,
      "caption": "inputs",
      "target": "inputs",
      "type": "multiple-list",
      "options": [
        "BloodVessel",
        "BloodTimeVaryingElastance",
        "BloodCapacitance",
        "BloodPump"
      ]
    },
    {
      "edit_mode": "basic",
      "caption": "r_for (mmHg/L/s)",
      "target": "r_for",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "r_back (mmHg/L/s)",
      "target": "r_back",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "advanced",
      "caption": "resistance-elastance coupling (0-1)",
      "target": "alpha",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "build_prop": true
    },
    {
      "edit_mode": "advanced",
      "caption": "ans sensitivity (0-1)",
      "target": "ans_sens",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "build_prop": true
    },
    {
      "edit_mode": "factors",
      "caption": "resistance factor",
      "target": "r_factor_ps",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor",
      "build_prop": false
    }
  ],
  "Breathing": [
    {
      "target": "description",
      "type": "string",
      "edit_mode": "caption",
      "build_prop": true,
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "edit_mode": "all",
      "build_prop": true,
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "spont breathing enabled",
      "target": "breathing_enabled",
      "type": "boolean",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "reference minute volume (L/kg/min)",
      "target": "minute_volume_ref",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2,
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "tidal volume - resp rate ratio",
      "target": "vt_rr_ratio",
      "type": "number",
      "delta": 0.001,
      "factor": 1000,
      "rounding": 4,
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "insp/exp ratio",
      "target": "ie_ratio",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2,
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "rmp gain max",
      "target": "rmp_gain_max",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false
    }
  ],
  "Capacitance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "fixed_composition",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "fixed composition"
    },
    {
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "unstressed volume (L)",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "target": "el_base",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "elastance baseline (mmHg/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "elastance non linear k",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "target": "u_vol_factor_ps",
      "type": "factor",
      "edit_mode": "factors",
      "caption": "unstressed volume factor"
    },
    {
      "target": "el_base_factor_ps",
      "type": "factor",
      "edit_mode": "factors",
      "caption": "elastance baseline factor"
    },
    {
      "target": "el_k_factor_ps",
      "type": "factor",
      "edit_mode": "factors",
      "caption": "elastance non linear  factor"
    }
  ],
  "Circulation": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "heart chambers",
      "target": "heart_chambers",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "HeartChamber",
        "BloodTimeVaryingElastance"
      ]
    },
    {
      "caption": "systemic arteries",
      "target": "systemic_arteries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic arterioles",
      "target": "systemic_arterioles",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic capillaries",
      "target": "systemic_capillaries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic venules",
      "target": "systemic_venules",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic veins",
      "target": "systemic_veins",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary arteries",
      "target": "pulmonary_arteries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary arterioles",
      "target": "pulmonary_arterioles",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary capillaries",
      "target": "pulmonary_capillaries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary venules",
      "target": "pulmonary_venules",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary veins",
      "target": "pulmonary_veins",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "svr factor (arterioles)",
      "target": "svr_factor_art",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "svr factor (venules)",
      "target": "svr_factor_ven",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "pvr factor (arterioles)",
      "target": "pvr_factor_art",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "pvr factor (venules)",
      "target": "pvr_factor_ven",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    }
  ],
  "Container": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear  factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    },
    {
      "caption": "contained compartments",
      "target": "contained_components",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "multiple-list",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "HeartChamber",
        "GasCapacitance"
      ]
    }
  ],
  "Ecls": [
    {
      "target": "ecls_clamped",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "ECLS clamped"
    },
    {
      "caption": "drainage cannula resistance factor",
      "target": "drainage_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "return cannula resistance factor",
      "target": "return_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "tubing resistance factor",
      "target": "tubing_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "pump resistance factor",
      "target": "pump_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "oxygenator resistance factor",
      "target": "oxy_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "target": "drainage_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "drainage cannula resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "return_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "return cannula res (mmHg/(L/s))",
      "slider": true,
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "tubing_in_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tubing in resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "tubing_out_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tubing out resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "pump_res_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "pump forward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "pump_res_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "pump backward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "oxy_res_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygenator forward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "oxy_res_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygenator backward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "caption": "o2 diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    },
    {
      "caption": "co2 dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    }
  ],
  "Fluids": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "add_volume",
      "caption": "Adminster fluid",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "volume (ml)",
          "target": "",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1
        },
        {
          "caption": "in time (s)",
          "target": "_default_time",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1
        },
        {
          "caption": "fluid type",
          "target": "fluid type",
          "type": "list",
          "default": "normal_saline",
          "choices": [
            "normal_saline",
            "ringers_lactate",
            "packed_cells",
            "albumin_20%"
          ]
        }
      ]
    }
  ],
  "Gas": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "atmospheric pressure (mmHg)",
      "target": "set_atmospheric_pressure",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new atmospheric pressure",
          "target": "pres_atm",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 5000,
          "ll": 100
        }
      ]
    },
    {
      "caption": "temperature (C)",
      "target": "set_temperature",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new temperature",
          "target": "temp",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 100,
          "ll": -100
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "GasCapacitance"
          ]
        }
      ]
    },
    {
      "caption": "humidity factor",
      "target": "set_humidity",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new humidity",
          "target": "humidity",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 1,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "GasCapacitance"
          ]
        }
      ]
    },
    {
      "caption": "fio2",
      "target": "set_fio2",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new fio2",
          "target": "fio2",
          "type": "number",
          "factor": 1,
          "delta": 0.01,
          "rounding": 2,
          "ul": 1,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "GasCapacitance"
          ]
        }
      ]
    }
  ],
  "GasCapacitance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "fixed gas composition",
      "target": "fixed_composition",
      "type": "boolean"
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "target temperature (dgs C)",
      "target": "target_temp",
      "type": "number",
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    },
    {
      "caption": "atmospheric pressure (mmHg)",
      "target": "pres_atm",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    }
  ],
  "GasDiffusor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "oxygen diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "carbon dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "nitric oxide diffusion constant",
      "target": "dif_n2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "other gasses diffusion constant",
      "target": "dif_other",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "gas component 1",
      "target": "comp_gas1",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "list",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "gas component 2",
      "target": "comp_gas2",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "oxygen diffusion factor",
      "target": "dif_o2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "carbon dioxide diffusion factor",
      "target": "dif_co2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "nitric oxide diffusion factor",
      "target": "dif_n2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "other gasses diffusion factor",
      "target": "dif_other_factor_ps",
      "type": "factor"
    }
  ],
  "GasExchanger": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "oxygen diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "caption": "carbon dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "caption": "gas component",
      "target": "comp_gas",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "blood component",
      "target": "comp_blood",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber"
      ]
    },
    {
      "caption": "oxygen diffusion factor",
      "target": "dif_o2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "carbon dioxide diffusion factor",
      "target": "dif_co2_factor_ps",
      "type": "factor"
    }
  ],
  "HeadUpTilt": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "is_active",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tilt active"
    },
    {
      "target": "tilt_angle",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tilt angle (deg)",
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 90
    },
    {
      "target": "upper_column_cm",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "upper-body column height (cm)",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "target": "lower_column_cm",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "lower-body column height (cm)",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "target": "set_tilt_angle",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "set tilt angle",
      "args": [
        {
          "target": "angle",
          "caption": "angle (deg)",
          "type": "number",
          "factor": 1,
          "default": 0,
          "delta": 1,
          "rounding": 0,
          "ll": 0,
          "ul": 90
        }
      ]
    }
  ],
  "Heart": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "reference heart rate (bpm)",
      "target": "heart_rate_ref",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 10,
      "ul": 300,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "pq time (ms)",
      "target": "pq_time",
      "type": "number",
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 50,
      "ul": 1000,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "qrs time (ms)",
      "target": "qrs_time",
      "type": "number",
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 50,
      "ul": 500,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "qt time (ms)",
      "target": "qt_time",
      "type": "number",
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 50,
      "ul": 1000,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "av delay time (ms)",
      "target": "av_delay",
      "type": "number",
      "delta": 0.1,
      "factor": 1000,
      "rounding": 1,
      "ll": 0.5,
      "ul": 10,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG P amplitude (mV)",
      "target": "p_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG Q amplitude (mV)",
      "target": "q_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG R amplitude (mV)",
      "target": "r_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG S amplitude (mV)",
      "target": "s_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG T amplitude (mV)",
      "target": "t_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "heartrate factor",
      "target": "hr_factor",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 1000000
    },
    {
      "caption": "ans sensitivity",
      "target": "ans_sens",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 1
    },
    {
      "caption": "systolic function factor left",
      "target": "cont_factor_left",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "systolic function factor right",
      "target": "cont_factor_right",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "diastolic function factor left",
      "target": "relax_factor_left",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "diastolic function factor right",
      "target": "relax_factor_right",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "pericardial stiffness factor",
      "target": "pc_el_factor",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.1,
      "rounding": 2,
      "ll": 0,
      "ul": 200
    },
    {
      "caption": "pericardial fluid volume (mL)",
      "target": "pc_extra_volume",
      "type": "number",
      "edit_mode": "basic",
      "factor": 1000,
      "delta": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 1000
    }
  ],
  "HeartChamber": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance minimum (mmHg/L)",
      "target": "el_min",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance maximum (mmHg/L)",
      "target": "el_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance minimum baseline factor",
      "target": "el_min_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance maximum baseline factor",
      "target": "el_max_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    },
    {
      "caption": "acute load contractility factor (HeartFunction)",
      "target": "el_max_load_factor",
      "type": "factor",
      "edit_mode": "factors",
      "readonly": true
    },
    {
      "caption": "remodeling contractility factor (HeartFunction)",
      "target": "el_max_remodel_factor",
      "type": "factor",
      "edit_mode": "factors",
      "readonly": true
    },
    {
      "caption": "remodeling stiffness factor (HeartFunction)",
      "target": "el_k_remodel_factor",
      "type": "factor",
      "edit_mode": "factors",
      "readonly": true
    },
    {
      "caption": "remodeling dilation factor (HeartFunction)",
      "target": "u_vol_remodel_factor",
      "type": "factor",
      "edit_mode": "factors",
      "readonly": true
    }
  ],
  "HeartValve": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "no flow allowed",
      "target": "no_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "no back flow allowed",
      "target": "no_back_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "forward resistance",
      "target": "r_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "backward resistance",
      "target": "r_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "non linear resistance coefficient",
      "target": "r_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "type": "list",
      "caption": "comp from",
      "target": "comp_from",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "type": "list",
      "caption": "comp to",
      "target": "comp_to",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "caption": "resistance factor",
      "target": "r_factor_ps",
      "type": "factor"
    },
    {
      "caption": "non linear resistance coefficient factor",
      "target": "r_k_factor_ps",
      "type": "factor"
    },
    {
      "target": "is_externally_managed",
      "type": "boolean",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "externally managed"
    }
  ],
  "Kidneys": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "kidneys running",
      "target": "kidneys_running",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "filtration coeff (L/s/mmHg)",
      "target": "kf",
      "type": "number",
      "delta": 0.0000001,
      "factor": 1,
      "rounding": 8,
      "ll": 0,
      "ul": 0.001,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "bowman pressure (mmHg)",
      "target": "p_bowman",
      "type": "number",
      "delta": 0.5,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 40,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "oncotic pressure (mmHg)",
      "target": "oncotic_base",
      "type": "number",
      "delta": 0.5,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 40,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "water reabsorption fraction",
      "target": "reabsorption_fraction",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "ll": 0,
      "ul": 0.9999,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "reabsorption fractions (by solute)",
      "target": "reabsorption_fractions",
      "type": "dict",
      "dict_value_type": "number",
      "dict_keys": ["na", "k", "ca", "cl", "lact", "mg", "phosphates", "uma"],
      "delta": 0.001,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 0.9999,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "reference albumin (g/L)",
      "target": "albumin_ref",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 1,
      "ul": 60,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "edit_mode": "factors",
      "caption": "filtration coeff factor",
      "target": "kf_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "reabsorption fraction factor",
      "target": "reabs_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "caption": "GFR (mL/min)",
      "target": "gfr",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "urine output (mL/min)",
      "target": "urine_flow",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "net filtration pressure (mmHg)",
      "target": "nfp",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "diuresis (mL)",
      "target": "urine_volume",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "fractional excretion Na (%)",
      "target": "fe_na",
      "type": "number",
      "factor": 1,
      "rounding": 2,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "GFR autoregulation",
      "target": "autoregulation_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "afferent vessel name",
      "target": "aff_vessel_name",
      "type": "string",
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic input model",
      "target": "myogenic_input_model",
      "type": "string",
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic input prop",
      "target": "myogenic_input_prop",
      "type": "string",
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic setpoint (mmHg)",
      "target": "myogenic_p_set",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 250,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic window min (mmHg)",
      "target": "myogenic_p_min",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 250,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic window max (mmHg)",
      "target": "myogenic_p_max",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 250,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic gain up (/mmHg)",
      "target": "myogenic_gain_up",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 1,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic gain down (/mmHg)",
      "target": "myogenic_gain_down",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 1,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic time constant (s)",
      "target": "myogenic_tc",
      "type": "number",
      "delta": 0.5,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 120,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "TGF use NaCl signal",
      "target": "tgf_use_nacl",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "TGF setpoint (0=auto)",
      "target": "tgf_setpoint",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 100000,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "TGF auto-seed delay (s)",
      "target": "tgf_seed_delay",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 600,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "TGF gain",
      "target": "tgf_gain",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 10,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "TGF time constant (s)",
      "target": "tgf_tc",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 600,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "afferent apply time constant (s)",
      "target": "afferent_apply_tc",
      "type": "number",
      "delta": 0.5,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 120,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "afferent factor min",
      "target": "afferent_factor_min",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0.01,
      "ul": 1,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "afferent factor max",
      "target": "afferent_factor_max",
      "type": "number",
      "delta": 0.5,
      "factor": 1,
      "rounding": 2,
      "ll": 1,
      "ul": 20,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "myogenic factor",
      "target": "myogenic_factor",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "TGF factor",
      "target": "tgf_factor",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "afferent factor (applied)",
      "target": "afferent_factor",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "sensed pressure (mmHg)",
      "target": "sensed_pressure",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "TGF signal",
      "target": "tgf_signal",
      "type": "number",
      "factor": 1,
      "rounding": 2,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "ADH water reabsorption factor",
      "target": "reabs_factor_adh",
      "type": "factor",
      "build_prop": false,
      "edit_mode": "factors"
    },
    {
      "caption": "hormonal reabsorption factors (by solute)",
      "target": "reabsorption_factors",
      "type": "dict",
      "dict_value_type": "number",
      "dict_keys": ["na", "k", "ca", "cl", "lact", "mg", "phosphates", "uma"],
      "delta": 0.001,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 2,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    }
  ],
  "Hormones": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "hormones running",
      "target": "hormones_running",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "RAAS enabled",
      "target": "raas_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "ADH enabled",
      "target": "adh_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "angiotensin II (activity)",
      "target": "angiotensin",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true
    },
    {
      "caption": "aldosterone (activity)",
      "target": "aldosterone",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true
    },
    {
      "caption": "ADH (activity)",
      "target": "adh",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true
    },
    {
      "caption": "renin drive",
      "target": "renin",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "perfusion setpoint (mmHg)",
      "target": "perfusion_setpoint",
      "type": "number",
      "delta": 0.5,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 200,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "volume setpoint (L)",
      "target": "volume_setpoint",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 4,
      "ll": 0,
      "ul": 20,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "Na/osmolality setpoint (mmol/L)",
      "target": "osmo_na_setpoint",
      "type": "number",
      "delta": 0.5,
      "factor": 1,
      "rounding": 1,
      "ll": 100,
      "ul": 170,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "K setpoint (mmol/L)",
      "target": "k_setpoint",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 1,
      "ul": 8,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "angiotensin time constant (s)",
      "target": "angiotensin_tc",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 36000,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "aldosterone time constant (s)",
      "target": "aldosterone_tc",
      "type": "number",
      "delta": 10,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 36000,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "ADH time constant (s)",
      "target": "adh_tc",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 36000,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "renin gain (perfusion)",
      "target": "renin_gain",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 50,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "renin gain (volume)",
      "target": "renin_vol_gain",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 50,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "aldosterone gain (AngII)",
      "target": "aldo_gain",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 50,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "aldosterone gain (K)",
      "target": "aldo_k_in_gain",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 50,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "ADH gain (osmotic)",
      "target": "adh_gain_osmo",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 50,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "ADH gain (baroreg)",
      "target": "adh_gain_baro",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ll": 0,
      "ul": 50,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "AngII → arteriolar SVR gain",
      "target": "ang_svr_gain",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 5,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "AngII → venular SVR gain",
      "target": "ang_svr_ven_gain",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 5,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "AngII → renal efferent gain",
      "target": "ang_efferent_gain",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 5,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "aldosterone → Na reabs gain",
      "target": "aldo_na_gain",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "ll": 0,
      "ul": 1,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "aldosterone → K waste gain",
      "target": "aldo_k_gain",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 1,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "ADH → water reabs gain",
      "target": "adh_water_gain",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "ll": 0,
      "ul": 1,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "ADH → SVR gain",
      "target": "adh_svr_gain",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 3,
      "ll": 0,
      "ul": 5,
      "build_prop": true,
      "edit_mode": "advanced",
      "readonly": false
    },
    {
      "caption": "SVR factor (applied)",
      "target": "svr_factor",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "renal efferent factor (applied)",
      "target": "efferent_factor",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "Na reabs factor (applied)",
      "target": "na_reabs_factor",
      "type": "number",
      "factor": 1,
      "rounding": 4,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "water reabs factor (applied)",
      "target": "water_reabs_factor",
      "type": "number",
      "factor": 1,
      "rounding": 4,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "sensed perfusion (mmHg)",
      "target": "sensed_perfusion",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "sensed volume (L)",
      "target": "sensed_volume",
      "type": "number",
      "factor": 1,
      "rounding": 4,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    },
    {
      "caption": "sensed osmolality (mOsm/kg)",
      "target": "sensed_osmolality",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "build_prop": false,
      "edit_mode": "extra",
      "readonly": true
    }
  ],
  "Metabolism": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "metabolism enabled",
      "target": "met_active",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "vo2 (ml/kg/min)",
      "target": "vo2",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "respiratory quotient",
      "target": "resp_q",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "set local fractional vo2",
      "target": "set_metabolic_active_model",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "type": "function",
      "args": [
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance"
          ]
        },
        {
          "caption": "new fvo2",
          "target": "fvo2",
          "type": "number",
          "factor": 1,
          "default": 0,
          "delta": 0.01,
          "rounding": 2,
          "ul": 1,
          "ll": 0
        }
      ]
    }
  ],
  "Mob": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "myocardial oxygen balance",
      "target": "mob_active",
      "type": "boolean"
    },
    {
      "caption": "minimal to2 (mmol/l)",
      "target": "to2_min",
      "type": "number",
      "delta": 0.0001,
      "factor": 1,
      "rounding": 4
    },
    {
      "caption": "reference to2 (mmol/l)",
      "target": "to2_ref",
      "type": "number",
      "delta": 0.0001,
      "factor": 1,
      "rounding": 4
    },
    {
      "caption": "respiratory quotient",
      "target": "resp_q",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "basal mvo2 (mmol O2/g/s)",
      "target": "bm_vo2_per_g",
      "type": "number",
      "delta": 0.000001,
      "factor": 1,
      "rounding": 8
    },
    {
      "caption": "stroke-work mvo2 (mmol O2/g/(mmHg·mL))",
      "target": "sw_vo2_per_g",
      "type": "number",
      "delta": 1e-8,
      "factor": 1,
      "rounding": 10
    },
    {
      "caption": "heart weight intercept (g)",
      "target": "hw_intercept",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "heart weight slope (g per g body weight)",
      "target": "hw_slope",
      "type": "number",
      "delta": 0.000001,
      "factor": 1,
      "rounding": 6
    },
    {
      "caption": "heartrate factor min",
      "target": "hr_factor_min",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "heartrate factor max",
      "target": "hr_factor_max",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "heartrate time constant",
      "target": "hr_tc",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    },
    {
      "caption": "contractility factor min",
      "target": "cont_factor_min",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "contractility factor max",
      "target": "cont_factor_max",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "contractility time constant",
      "target": "cont_tc",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    },
    {
      "caption": "ans factor min",
      "target": "ans_factor_min",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "ans factor max",
      "target": "ans_factor_max",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "ans time constant",
      "target": "ans_tc",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    }
  ],
  "HeartFunction": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "load-induced compromise active",
      "target": "hf_active",
      "type": "boolean"
    },
    {
      "caption": "remodeling active",
      "target": "remodel_active",
      "type": "boolean"
    },
    {
      "caption": "acute contractility time constant (s)",
      "target": "cont_tc",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1
    },
    {
      "caption": "acute contractility floor",
      "target": "cont_floor",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "afterload gain LV",
      "target": "g_es_lv",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "edit_mode": "advanced"
    },
    {
      "caption": "over-dilation gain LV",
      "target": "g_ed_lv",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "edit_mode": "advanced"
    },
    {
      "caption": "afterload gain RV",
      "target": "g_es_rv",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "edit_mode": "advanced"
    },
    {
      "caption": "over-dilation gain RV",
      "target": "g_ed_rv",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "edit_mode": "advanced"
    },
    {
      "caption": "remodeling time constant (s)",
      "target": "remodel_tc",
      "type": "number",
      "delta": 60,
      "factor": 1,
      "rounding": 0,
      "edit_mode": "advanced"
    },
    {
      "caption": "wall-stress averaging time constant (s)",
      "target": "stress_avg_tc",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 1,
      "edit_mode": "advanced"
    },
    {
      "caption": "concentric remodeling drive",
      "target": "k_conc",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "edit_mode": "advanced"
    },
    {
      "caption": "eccentric remodeling drive",
      "target": "k_ecc",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 4,
      "edit_mode": "advanced"
    },
    {
      "caption": "setpoint warm-up window (s)",
      "target": "setpoint_warmup",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "edit_mode": "advanced"
    },
    {
      "caption": "LV end-systolic wall stress",
      "target": "wall_stress_es_lv",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "readonly": true
    },
    {
      "caption": "LV end-diastolic wall stress",
      "target": "wall_stress_ed_lv",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "readonly": true
    },
    {
      "caption": "RV end-systolic wall stress",
      "target": "wall_stress_es_rv",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "readonly": true
    },
    {
      "caption": "RV end-diastolic wall stress",
      "target": "wall_stress_ed_rv",
      "type": "number",
      "factor": 1,
      "rounding": 1,
      "readonly": true
    },
    {
      "caption": "LV acute load factor",
      "target": "el_max_load_factor_lv",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "readonly": true
    },
    {
      "caption": "RV acute load factor",
      "target": "el_max_load_factor_rv",
      "type": "number",
      "factor": 1,
      "rounding": 3,
      "readonly": true
    }
  ],
  "Monitor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    }
  ],
  "Pda": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "ductus diameter (%)",
      "target": "diameter_relative",
      "type": "number",
      "delta": 1,
      "factor": 100,
      "rounding": 0,
      "ul": 100,
      "ll": 0,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "slider": true
    },
    {
      "caption": "max diameter aortic ampulla (mm)",
      "target": "diameter_ao_max",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "max diameter pulmonary end (mm)",
      "target": "diameter_pa_max",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "ductus arteriosus length (mm)",
      "target": "length",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "baseline elastance (open duct, mmHg/L)",
      "target": "el_base",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "elastance-resistance coupling alpha",
      "target": "alpha",
      "type": "number",
      "delta": 0.05,
      "factor": 1,
      "rounding": 2,
      "ul": 1.5,
      "ll": 0,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "jet velocity exponent",
      "target": "jet_exponent",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ul": 3,
      "ll": 0,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    }
  ],
  "Placenta": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "placenta_running",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": false,
      "caption": "placenta model running"
    },
    {
      "target": "umb_clamped",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": false,
      "caption": "umbilical vessels clamped"
    },
    {
      "caption": "umb artery resistance factor",
      "target": "umb_art_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "umb vein resistance factor",
      "target": "umb_ven_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "fetal placenta resistance factor",
      "target": "plf_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 10
    },
    {
      "target": "umb_art_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "umb artery resistance (mmHg*s/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "umb_ven_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "umb vein resistance (mmHg*s/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "plf_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "fetal plac resistance (mmHg*s/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "caption": "o2 diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    },
    {
      "caption": "co2 dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    },
    {
      "target": "mat_to2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "mat plac o2 content (mmol/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 10
    },
    {
      "target": "mat_tco2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "mat plac co2 content (mmol/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 20,
      "ul": 30
    }
  ],
  "Resistor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "no flow allowed",
      "target": "no_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "no back flow allowed",
      "target": "no_back_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "forward resistance",
      "target": "r_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "backward resistance",
      "target": "r_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "non linear resistance coefficient",
      "target": "r_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "type": "list",
      "caption": "comp from",
      "target": "comp_from",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "type": "list",
      "caption": "comp to",
      "target": "comp_to",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "caption": "resistance factor",
      "target": "r_factor_ps",
      "type": "factor"
    },
    {
      "caption": "non linear resistance coefficient factor",
      "target": "r_k_factor_ps",
      "type": "factor"
    },
    {
      "target": "is_externally_managed",
      "type": "boolean",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "externally managed"
    }
  ],
  "Respiration": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "lungs",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "target": "lungs",
      "type": "multiple-list",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "thorax",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "target": "thorax",
      "type": "multiple-list",
      "options": [
        "Container"
      ]
    },
    {
      "caption": "lung elastance factor",
      "target": "el_lungs_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "thorax elastance factor",
      "target": "el_thorax_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "upper airway resistance factor",
      "target": "res_upper_airways_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -100,
      "ul": 100
    },
    {
      "caption": "lower airway resistance factor",
      "target": "res_lower_airways_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -100,
      "ul": 100
    },
    {
      "caption": "gasexchange factor",
      "target": "gex_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -100,
      "ul": 100
    }
  ],
  "Resuscitation": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "switch cpr on/off",
      "target": "switch_cpr",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "state",
          "target": "cpr_enabled",
          "type": "boolean"
        }
      ]
    },
    {
      "caption": "chest compressions frequency (/min)",
      "target": "chest_comp_freq",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 10,
      "ul": 150
    },
    {
      "caption": "chest compressions pressure (mmHg)",
      "target": "chest_comp_max_pres",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 500
    },
    {
      "caption": "no of chest compressions (/cycle)",
      "target": "chest_comp_no",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "continuous compressions",
      "target": "chest_comp_cont",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "ventilation frequency (/min)",
      "target": "vent_freq",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "no of ventilation (/cycle)",
      "target": "vent_no",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "ventilation peak pressure (cmH2O)",
      "target": "vent_pres_pip",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 50
    },
    {
      "caption": "ventilation peep (cmH2O)",
      "target": "vent_pres_peep",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "ventilation inspiration time (s)",
      "target": "vent_insp_time",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0.1,
      "ul": 5
    },
    {
      "caption": "set cpr fio2",
      "target": "set_fio2",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "new fio2",
          "target": "vent_fio2",
          "type": "number",
          "delta": 0.01,
          "factor": 1,
          "ul": 1,
          "ll": 0,
          "rounding": 2
        }
      ]
    }
  ],
  "Shunts": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "foramen ovale diameter (mm)",
      "target": "diameter_fo",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "slider": true,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "ventricular septal defect diameter (mm)",
      "target": "diameter_vsd",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "slider": true,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "intrapulmonary shunt resistance",
      "target": "ips_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "slider": true,
      "ll": 10,
      "ul": 50000
    },
    {
      "caption": "atrial septum width (mm)",
      "target": "atrial_septal_width",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "ventricular septum width (mm)",
      "target": "ventricular_septal_width",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "foramen ovale L-R resistance factor",
      "target": "fo_lr_factor",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "intrapulmonary shunt resistance (mmHg*s/L)",
      "target": "ips_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 100,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100000000
    }
  ],
  "TimeVaryingElastance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance minimum (mmHg/L)",
      "target": "el_min",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance maximum (mmHg/L)",
      "target": "el_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance minimum baseline factor",
      "target": "el_min_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance maximum baseline factor",
      "target": "el_max_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    }
  ],
  "Ventilator": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "switch ventilator on/off",
      "target": "switch_ventilator",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "state",
          "target": "is_enabled",
          "type": "boolean"
        }
      ]
    },
    {
      "caption": "endotracheal tube diameter (mm)",
      "target": "set_ettube_diameter",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "new diameter (mm)",
          "target": "ettube_diameter",
          "type": "number",
          "factor": 1,
          "delta": 0.5,
          "rounding": 1
        }
      ]
    },
    {
      "caption": "endotracheal tube length (mm)",
      "target": "set_ettube_length",
      "type": "function",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "args": [
        {
          "caption": "new length (mm)",
          "target": "ettube_length",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1
        }
      ]
    },
    {
      "caption": "fio2",
      "target": "set_fio2",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "new fio2",
          "target": "fio2",
          "type": "number",
          "factor": 1,
          "delta": 0.01,
          "rounding": 2,
          "ll": 0.21,
          "ul": 1
        }
      ]
    },
    {
      "caption": "humidity",
      "target": "set_humidity",
      "type": "function",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "args": [
        {
          "caption": "new humidity",
          "target": "humidity",
          "type": "number",
          "factor": 1,
          "delta": 0.01,
          "rounding": 2,
          "ll": 0,
          "ul": 1
        }
      ]
    },
    {
      "caption": "temperature (C)",
      "target": "set_temp",
      "type": "function",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "args": [
        {
          "caption": "new temp (C)",
          "target": "temp",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ll": 0,
          "ul": 1
        }
      ]
    },
    {
      "caption": "ventilator mode",
      "target": "vent_mode",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "options": [],
      "choices": [
        "PC",
        "PRVC",
        "PS"
      ]
    },
    {
      "caption": "ventilator rate (/min)",
      "target": "vent_rate",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "inspiration time (s)",
      "target": "insp_time",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0.1,
      "ul": 5
    },
    {
      "caption": "inspiratory flow (l/min)",
      "target": "insp_flow",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "expiratory flow (l/min)",
      "target": "exp_flow",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "tidal volume (mL)",
      "target": "tidal_volume",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 1,
      "ul": 500
    },
    {
      "caption": "peak inspiratory pressure (cmH2O)",
      "target": "pip_cmh2o",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 5,
      "ul": 50
    },
    {
      "caption": "max peak inspiratory pressure (cmH2O)",
      "target": "pip_cmh2o_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 5,
      "ul": 50
    },
    {
      "caption": "positive end expiratory pressure (cmH2O)",
      "target": "peep_cmh2o",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "trigger volume percentage (%)",
      "target": "trigger_volume_perc",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 5,
      "ul": 20
    },
    {
      "caption": "synchronized ventilation",
      "target": "synchronized",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    }
  ]
};

// Resolve the editable interface for a given model_type (empty if unknown).
export function getInterfaceForType(modelType: string): InterfaceField[] {
  return MODEL_INTERFACES[modelType] ?? [];
}

```

### FILE: src/model-interface/types.ts

```typescript
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
  // dict controls (object keyed by name → value; one control per key)
  dict_keys?: string[]; // keys to render (so an empty instance dict still shows all entries)
  dict_value_type?: "number"; // value control kind (number is the only case for now)
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

```

### FILE: src/stores/chat.ts

````typescript
import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useExplain } from "@/composables/useExplain";
import { useDiagramStore } from "@/stores/diagram";
import { useEventsStore } from "@/stores/events";
import {
  parseCommands,
  validateCommand,
  executeCommand,
  executeDiagramCommand,
  type BotCommand,
  type NormalizedCommand,
  type DiagramHandle,
  type CommandScope,
} from "@/services/botCommands";

// Chat with the "explain-labs_claude" bot (built specifically for this project).
// Talks to the dev-server proxy at /api/chat (see vite.config.ts), which injects
// the API key server-side. Each turn carries a compact snapshot of the current
// simulated patient so the bot can answer about "this patient".
//
// The bot can also propose ACTIONS on the model by embedding fenced
// ```explain-command``` JSON blocks in its reply. We parse + validate those here
// (see services/botCommands.ts) and attach them to the assistant message as
// PendingCommands; the user applies them with a click (confirm-before-apply).

// A bot-proposed action attached to an assistant message.
export interface PendingCommand {
  cmd: BotCommand;
  status: "pending" | "applied" | "dismissed" | "invalid";
  description: string;
  error?: string;
  normalized?: NormalizedCommand;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
  commands?: PendingCommand[];
}

interface MonitorParam {
  label: string;
  unit?: string;
  factor?: number;
  rounding?: number;
  props?: string[];
  weight_based?: boolean;
}

export const useChatStore = defineStore("chat", () => {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const conversationId = ref<string | null>(null);
  // Audit of actions the user applied from the bot's suggestions, echoed back
  // into the next context block so the bot knows its proposals took effect.
  const appliedLog = ref<{ description: string; ts: number }[]>([]);

  // When on, valid bot commands execute the moment the reply arrives (no click).
  // Off by default (confirm-before-apply); persisted so a trusted session sticks.
  const autoApply = ref(localStorage.getItem("explain.chat.autoApply") === "1");
  watch(autoApply, (v) => localStorage.setItem("explain.chat.autoApply", v ? "1" : "0"));

  // Command surface: "full" = any settable registry field; "guided" = the curated
  // 26-command allowlist (safe demos). Default full; persisted.
  const commandScope = ref<CommandScope>(
    localStorage.getItem("explain.chat.scope") === "guided" ? "guided" : "full",
  );
  watch(commandScope, (v) => localStorage.setItem("explain.chat.scope", v));

  // Pull the same monitor groups the right-column panel shows, format the latest
  // slow-stream sample exactly like NumericReadoutPanel, and return a plain-text
  // block. Returns "" when nothing is loaded yet.
  function buildContext(): string {
    const { model, modelState, slowValues, watchSlow } = useExplain();
    const lines: string[] = [];

    const state = modelState.value as any;
    if (state) {
      const bits: string[] = [];
      if (typeof state.weight === "number") bits.push(`weight ${state.weight.toFixed(3)} kg`);
      if (typeof state.gestational_age === "number")
        bits.push(`gestational age ${state.gestational_age} wk`);
      if (typeof state.age === "number") bits.push(`age ${state.age} d`);
      if (bits.length) lines.push(bits.join(", "));
    }

    const monitors = (model as any).loadedFileData?.configuration?.monitors ?? {};
    const groups = Object.entries<any>(monitors).filter(([, m]) => m?.enabled !== false);

    // make sure every path we want is on the slow watchlist (engine dedups)
    const paths = new Set<string>();
    for (const [, m] of groups)
      for (const p of (m.parameters ?? []) as MonitorParam[])
        for (const path of p.props ?? []) paths.add(path);
    if (paths.size) watchSlow([...paths]);

    const arr = slowValues.value as any[];
    const latest = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
    const weight =
      typeof state?.weight === "number" && state.weight > 0 ? state.weight : 1;

    const fmt = (p: MonitorParam): string | null => {
      const ps = p.props ?? [];
      if (!ps.length || !latest) return null;
      const vals = ps.map((path) => {
        let v = latest[path];
        if (typeof v !== "number") return "—";
        v *= p.factor ?? 1;
        if (p.weight_based) v /= weight;
        return v.toFixed(p.rounding ?? 0);
      });
      if (vals.every((v) => v === "—")) return null;
      return `${p.label}: ${vals.join("/")}${p.unit ? " " + p.unit : ""}`;
    };

    for (const [key, m] of groups) {
      const rows = ((m.parameters ?? []) as MonitorParam[])
        .map(fmt)
        .filter((s): s is string => !!s);
      if (rows.length) lines.push(`${m.title ?? key}: ${rows.join(", ")}`);
    }

    // Live model map: every instance grouped by model_type, so the bot can map a
    // natural-language target onto the right instance name (then look up its
    // settable fields in the command catalog). Only changes on scenario load.
    if (state?.models) {
      const byType = new Map<string, string[]>();
      for (const [name, m] of Object.entries<any>(state.models)) {
        const t = m?.model_type ?? "?";
        (byType.get(t) ?? byType.set(t, []).get(t)!).push(name);
      }
      if (byType.size) {
        lines.push("Models in scenario (instance names by model_type), targetable by commands:");
        for (const t of [...byType.keys()].sort())
          lines.push(`- ${t}: ${byType.get(t)!.sort().join(", ")}`);
      }
    }

    // Current diagram: component names + their model bindings + connections, so
    // the bot can reference existing components when asked to modify the diagram
    // (op:"diagram"). Only present while the Diagram editor is mounted.
    const dd = useDiagramStore().getDiagram();
    const comps = dd?.components as Record<string, any> | undefined;
    if (comps && Object.keys(comps).length) {
      lines.push("Current diagram (editable via op:\"diagram\"; names below are the component ids):");
      for (const [name, c] of Object.entries(comps)) {
        const models = Array.isArray(c.models) && c.models.length ? ` → [${c.models.join(", ")}]` : "";
        if (c.type === "Connector") lines.push(`- ${name} (Connector ${c.dbcFrom}→${c.dbcTo})${models}`);
        else lines.push(`- ${name} (Compartment, ${c.picto})${models}`);
      }
    } else {
      lines.push("Diagram editor not open — open the Diagram tab to enable op:\"diagram\" edits.");
    }

    // Tell the bot which of its proposed actions the user has actually applied
    // (most recent first), so it can reason about cause/effect across turns.
    const recent = appliedLog.value.slice(-8).reverse();
    if (recent.length) {
      const now = Date.now();
      lines.push("Applied from your suggestions:");
      for (const a of recent) lines.push(`- ${a.description} (${ago(now - a.ts)} ago)`);
    }

    return lines.join("\n");
  }

  // compact relative-time label: 12s / 3m / 1h
  function ago(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    return `${Math.round(m / 60)}h`;
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading.value) return;
    error.value = null;
    messages.value.push({ role: "user", text: trimmed });
    isLoading.value = true;

    try {
      const context = buildContext();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          context,
          conversation_id: conversationId.value,
        }),
      });
      // a missing endpoint (stale dev server) falls through to the SPA → HTML,
      // so guard against a non-JSON body before trusting res.ok.
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || typeof body.answer !== "string") {
        throw new Error(
          body?.error ||
            `chat endpoint unavailable (status ${res.status}) — restart the dev server (npm run dev)`,
        );
      }
      conversationId.value = body.conversation_id ?? conversationId.value;
      pushAssistantReply(body.answer);
    } catch (e) {
      error.value = (e as Error).message;
      messages.value.push({
        role: "assistant",
        text: `⚠️ ${(e as Error).message}`,
        failed: true,
      });
    } finally {
      isLoading.value = false;
    }
  }

  // Turn a raw bot reply into an assistant message: strip out any command
  // blocks, validate each against the live model, and attach them as
  // PendingCommands. The visible text is the prose with the blocks removed.
  function pushAssistantReply(answer: string) {
    const { modelState } = useExplain();
    const { clean, commands, parseErrors } = parseCommands(answer);

    // Diagram validation is batch-aware: a `connect` may reference a component a
    // prior `addComponent` in the same reply introduces. Seed the known-name set
    // from the live diagram, then update it as we validate each command in order.
    const dd = useDiagramStore().getDiagram();
    const names: Set<string> | null = dd?.components
      ? new Set(Object.keys(dd.components))
      : null;

    const pending: PendingCommand[] = commands.map((cmd) => {
      const v = validateCommand(cmd, modelState.value, commandScope.value, { names });
      // keep the known-name set in sync so later commands in this batch validate
      // against the predicted post-edit diagram
      if (v.ok && cmd.op === "diagram" && names) {
        if (cmd.action === "addComponent" && cmd.name) names.add(cmd.name.trim());
        else if (cmd.action === "delete" && cmd.name) names.delete(cmd.name.trim());
      }
      return {
        cmd,
        description: v.description,
        normalized: v.normalized,
        error: v.error,
        status: v.ok ? ("pending" as const) : ("invalid" as const),
      };
    });

    if (parseErrors.length) error.value = `bot sent a malformed command block (${parseErrors.length})`;

    messages.value.push({
      role: "assistant",
      text: clean || (commands.length ? "" : answer),
      commands: pending.length ? pending : undefined,
    });

    // Auto-apply mode: run every valid command immediately (invalid ones are
    // skipped by applyCommand and stay visible with their reason).
    if (autoApply.value && pending.length) applyAll(messages.value.length - 1);
  }

  // Build a renderer-backed DiagramHandle over the live DiagramRenderer +
  // Model.updateDiagram, or null when no Diagram editor is mounted.
  function diagramHandle(): DiagramHandle | null {
    const r = useDiagramStore().activeRenderer;
    if (!r) return null;
    const { model } = useExplain();
    return {
      add: (name, picto) => r.addCompartment(name, picto).then((n) => n ?? name),
      setLayout: (name, patch) => r.applyLayoutPatch(name, patch),
      setLabel: (name, text) => r.setLabel(name, text),
      setModels: (name, models) => r.setModels(name, models),
      setPicto: (name, picto) => r.setPicto(name, picto),
      connect: (from, to, opts) => r.connect(from, to, opts),
      remove: (name) => r.removeByName(name),
      push: () => (model as any).updateDiagram?.(r.getDiagram()),
    };
  }

  // Apply a single pending command to the live engine/diagram (confirm-before-apply).
  async function applyCommand(messageIndex: number, cmdIndex: number) {
    const pc = messages.value[messageIndex]?.commands?.[cmdIndex];
    if (!pc || pc.status !== "pending" || !pc.normalized) return;
    try {
      if (pc.normalized.kind === "diagram") {
        const h = diagramHandle();
        if (!h) throw new Error("open the Diagram tab to apply this edit");
        await executeDiagramCommand(pc.normalized, h);
      } else if (pc.normalized.kind === "event") {
        // a bot event is SAVED into the Event Scheduler panel (not fired here);
        // the user applies/arms it there. persist() best-effort writes it into
        // the scenario JSON (no-op fallback in prod, like the panel's own save).
        const n = pc.normalized;
        const store = useEventsStore();
        store.upsert({
          id: crypto.randomUUID?.() ?? `ev_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
          name: n.name,
          changes: n.changes,
          fire_at: n.fire_at,
          armed: false,
        });
        await store.persist();
      } else {
        executeCommand(pc.normalized, useExplain());
      }
      pc.status = "applied";
      appliedLog.value.push({ description: pc.description, ts: Date.now() });
    } catch (e) {
      pc.status = "invalid";
      pc.error = (e as Error).message;
    }
  }

  function dismissCommand(messageIndex: number, cmdIndex: number) {
    const pc = messages.value[messageIndex]?.commands?.[cmdIndex];
    if (pc && pc.status === "pending") pc.status = "dismissed";
  }

  // Apply in order and await each — diagram edits can depend on earlier ones in
  // the same reply (a `connect` needs its `addComponent` to have landed first).
  async function applyAll(messageIndex: number) {
    const cmds = messages.value[messageIndex]?.commands ?? [];
    for (let i = 0; i < cmds.length; i++) await applyCommand(messageIndex, i);
  }

  function newConversation() {
    messages.value = [];
    conversationId.value = null;
    error.value = null;
    appliedLog.value = [];
  }

  return {
    messages,
    isLoading,
    error,
    conversationId,
    autoApply,
    commandScope,
    sendMessage,
    newConversation,
    applyCommand,
    dismissCommand,
    applyAll,
  };
});

````


### Acting on the simulation (command protocol)

### FILE: knowledge-pack/command-protocol.md

`````markdown
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

`````

### FILE: knowledge-pack/command-catalog.md

````markdown
# Explain — command catalog (bot-facing)

What you may propose as `explain-command` actions. See `command-protocol.md` for HOW to
emit them and the rules. Resolve a target like this: read the **`Models in scenario:`**
map in the live context to pick the right *instance name*, find that instance's
*model_type* in the map, then use the fields listed under that model_type here.

**Envelope** (one JSON object per fenced block):

```json
{"op":"setProp","model":"<instance name>","target":"<field>","value":<value>,"it":<ramp s?>,"at":<delay s?>,"reason":"<short label>"}
{"op":"call","model":"<instance name>","target":"<function>","args":[...],"reason":"<short label>"}
{"op":"event","name":"<event name>","changes":[{"model":"..","target":"..","value":..,"it":<s?>,"at":<s?>}],"reason":"<short label>"}
{"op":"start"}   {"op":"stop"}
```

Rules of thumb:
- **Values are in the displayed unit** shown per field; stay within the stated range.
- **Timing (optional):** `it` ramps a numeric value to the target over N simulated seconds;
  `at` delays the change N seconds. `op:"event"` bundles several timed `changes[]` into a
  named event saved to the Event Scheduler panel — see `command-protocol.md` (Scheduling).
- **To tune a physiological property, prefer its `*_factor_ps` knob** (a `factor` field,
  1.0 = baseline, >1 increases, <1 decreases) over editing the raw base value — factors
  compose with interventions and weight-scaling. E.g. stiffer LV → `LV.el_max_factor_ps` 1.3.
- Only fields listed here are accepted; readonly measured-outputs and structural wiring are omitted.

Snapshot: **38 model_types**, **345 settable params**, **24 functions**
(+ 26 Guided commands, 7 diagram actions). Regenerate with `node scripts/build_command_catalog.mjs`.

---
## Guided mode — curated safe set

Active when the user selects **Guided** scope in the chat panel. Only these commands apply;
anything else is rejected (the app suggests switching to Full). Full mode (below) is the default.

- `call` `Ventilator.switch_ventilator` — turn mechanical ventilation on/off (arg: boolean)
- `call` `Ventilator.set_fio2` — set inspired O2 fraction (0.21–1.0)
- `call` `Ventilator.set_ettube_diameter` — set endotracheal tube diameter (mm)
- `call` `Ventilator.set_ettube_length` — set endotracheal tube length (mm)
- `setProp` `Ventilator.vent_mode` — ventilation mode (PC/PRVC/PS)
- `setProp` `Ventilator.vent_rate` — ventilator rate (/min)
- `setProp` `Ventilator.insp_time` — inspiration time (s)
- `setProp` `Ventilator.tidal_volume` — target tidal volume (mL)
- `setProp` `Ventilator.pip_cmh2o` — peak inspiratory pressure (cmH2O)
- `setProp` `Ventilator.pip_cmh2o_max` — max peak inspiratory pressure, PRVC (cmH2O)
- `setProp` `Ventilator.peep_cmh2o` — positive end-expiratory pressure (cmH2O)
- `setProp` `Heart.heart_rate_ref` — reference heart rate (bpm)
- `setProp` `Heart.ans_sens` — autonomic sensitivity of the heart (0–1)
- `setProp` `Ans.ans_active` — autonomic nervous system on/off
- `setProp` `Breathing.breathing_enabled` — spontaneous breathing on/off
- `setProp` `Breathing.minute_volume_ref` — reference minute volume (L/kg/min)
- `setProp` `Metabolism.met_active` — metabolism on/off
- `setProp` `Metabolism.vo2` — oxygen consumption VO2 (mL/kg/min)
- `call` `Drugs.administer_bolus` — IV bolus (args: drug name, dose in mcg 0–1000)
- `call` `Drugs.set_infusion` — continuous infusion (args: drug name, rate mcg/kg/min)
- `setProp` `Drugs.drugs_running` — drug engine on/off
- `call` `Resuscitation.switch_cpr` — start/stop CPR (arg: boolean)
- `call` `Resuscitation.set_fio2` — set CPR ventilation FiO2 (0–1)
- `setProp` `Resuscitation.chest_comp_freq` — chest compression frequency (/min)
- `start`  — start the realtime simulation loop
- `stop`  — stop the realtime simulation loop

---

## Full mode — all settable fields by model_type

### Ans

_setProp_:
- `ans_active` — ANS active (boolean)
- `is_enabled` — enabled (boolean) _(all)_

### AnsAfferent

_setProp_:
- `min_value` — minimum of the input (firing rate is 0.0) (number, firing rate is 0.0)
- `max_value` — maximum of the input (firing rate is 1.0) (number, firing rate is 1.0)
- `set_value` — setpoint of the input (firing rate is 0.5) (number, firing rate is 0.5)
- `tc` — timeconstant (s) (number, s)
- `effect_weight` — effect weight (number) _(extra)_
- `is_enabled` — enabled (boolean) _(all)_

### AnsEfferent

_setProp_:
- `effect_at_max_firing_rate` — effect size at max firing_rate of 1 (number)
- `effect_at_min_firing_rate` — effect size at min firing_rate of 0 (number)
- `tc` — timeconstant (s) (number, s)
- `is_enabled` — enabled (boolean) _(all)_

### Blood

_setProp_:
- `is_enabled` — enabled (boolean) _(all)_

_call_:
- `set_temperature(temp (number, range 25–45); site (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodVessel/HeartChamber/MicroVascularUnit/BloodPump))` — set temperature (C)
- `set_viscosity(viscosity (number, range 0.1–12))` — set viscosity (cP)
- `set_haldane_coeff(new_coeff (number, 0 = off, range 0–5))` — set Haldane coefficient
- `set_to2(to2 (number, range 0–20); site (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodVessel/HeartChamber/MicroVascularUnit/BloodPump))` — set total oxygen concentration (mmol/l)
- `set_tco2(tco2 (number, range 0–20); site (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodVessel/HeartChamber/MicroVascularUnit/BloodPump))` — set total carbon dioxide concentration (mmol/l)
- `set_solute(solute_name (list, one of na/k/ca/cl/lact/mg/albumin/phosphates/uma/hemoglobin); solute_value (number, range 0–1000); site (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodVessel/HeartChamber/MicroVascularUnit/BloodPump))` — set solute concentration

### BloodCapacitance

_setProp_:
- `is_enabled` — enabled (boolean)
- `fixed_composition` — fixed composition (boolean)
- `vol` — volume (L) (number, L)
- `u_vol` — unstressed volume (L) (number, L)
- `el_base` — elastance baseline (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `temp` — blood temperature (°C) (number, °C) _(extra)_
- `viscosity` — blood viscosity (cP) (number, cP) _(extra)_
- `u_vol_factor_ps` — unstressed volume factor (factor) _(factors)_
- `el_base_factor_ps` — elastance baseline factor (factor) _(factors)_
- `el_k_factor_ps` — elastance non linear factor (factor) _(factors)_

### BloodDiffusor

_setProp_:
- `is_enabled` — enabled (boolean)
- `dif_o2` — oxygen diffusion constant (number)
- `dif_co2` — carbon dioxide diffusion constant (number)
- `dif_solutes` — solute diffusion constant (number)
- `comp_blood1` — blood component 1 (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodPump/BloodVessel/MicroVascularUnit/HeartChamber)
- `comp_blood2` — blood component 2 (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodPump/BloodVessel/MicroVascularUnit/HeartChamber)
- `dif_o2_factor_ps` — oxygen diffusion factor (factor)
- `dif_co2_factor_ps` — carbon dioxide diffusion factor (factor)
- `dif_solutes_factor_ps` — solute diffusion factor (factor)

### BloodPump

_setProp_:
- `is_enabled` — enabled (boolean)
- `u_vol` — unstressed volume (L) (number, L)
- `el_base` — elastance pump (mmHg/L) (number, mmHg/L)
- `pump_rpm` — pump rpm (number)
- `el_k` — non linear elastance factor (number)
- `inlet` — inlet blood resistor (list, one of BloodResistor/BloodVesselResistor/HeartValve)
- `outlet` — outlet blood resistor (list, one of BloodResistor/BloodVesselResistor/HeartValve)

### BloodTimeVaryingElastance

_setProp_:
- `is_enabled` — enabled (boolean)
- `vol` — volume (L) (number, L)
- `u_vol` — unstressed volume (L) (number, L)
- `el_min` — elastance minimum (mmHg/L) (number, mmHg/L)
- `el_max` — elastance maximum (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `u_vol_factor_ps` — unstressed volume factor (factor)
- `el_min_factor_ps` — elastance minimum baseline factor (factor)
- `el_max_factor_ps` — elastance maximum baseline factor (factor)
- `el_k_factor_ps` — elastance non linear factor (factor)

### BloodVessel

_setProp_:
- `is_enabled` — enabled (boolean)
- `no_flow` — no flow allowed (boolean)
- `no_back_flow` — no back flow allowed (boolean)
- `vol` — volume (L) (number, L)
- `u_vol` — unstressed volume (L) (number, L)
- `el_base` — elastance baseline (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `r_for` — r_for (mmHg/L/s) (number, mmHg/L/s)
- `r_back` — r_back (mmHg/L/s) (number, mmHg/L/s)
- `r_factor_ps` — resistance factor (number) _(factors)_
- `u_vol_factor_ps` — unstressed volume factor (factor) _(factors)_
- `el_base_factor_ps` — elastance baseline factor (factor) _(factors)_
- `el_k_factor_ps` — elastance non linear factor (factor) _(factors)_
- `alpha` — resistance-elastance coupling (0-1) (number, 0-1) _(advanced)_
- `ans_sens` — ans sensitivity (0-1) (number, 0-1) _(advanced)_

### Breathing

_setProp_:
- `breathing_enabled` — spont breathing enabled (boolean)
- `minute_volume_ref` — reference minute volume (L/kg/min) (number, L/kg/min)
- `vt_rr_ratio` — tidal volume - resp rate ratio (number)
- `ie_ratio` — insp/exp ratio (number)
- `rmp_gain_max` — rmp gain max (number) _(extra)_
- `is_enabled` — enabled (boolean) _(all)_

### Capacitance

_setProp_:
- `is_enabled` — enabled (boolean)
- `fixed_composition` — fixed composition (boolean)
- `u_vol` — unstressed volume (L) (number, L)
- `el_base` — elastance baseline (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `u_vol_factor_ps` — unstressed volume factor (factor) _(factors)_
- `el_base_factor_ps` — elastance baseline factor (factor) _(factors)_
- `el_k_factor_ps` — elastance non linear  factor (factor) _(factors)_

### Circulation

_setProp_:
- `is_enabled` — enabled (boolean) _(all)_
- `svr_factor_art` — svr factor (arterioles) (factor, arterioles, range -10–10)
- `svr_factor_ven` — svr factor (venules) (factor, venules, range -10–10)
- `pvr_factor_art` — pvr factor (arterioles) (factor, arterioles, range -10–10)
- `pvr_factor_ven` — pvr factor (venules) (factor, venules, range -10–10)

### Container

_setProp_:
- `is_enabled` — enabled (boolean)
- `u_vol` — unstressed volume (L) (number, L)
- `el_base` — elastance baseline (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `u_vol_factor_ps` — unstressed volume factor (factor)
- `el_base_factor_ps` — elastance baseline factor (factor)
- `el_k_factor_ps` — elastance non linear  factor (factor)

### Drugs

_setProp_:
- `drugs_running` — drugs running (boolean)
- `is_enabled` — enabled (boolean) _(all)_

_call_:
- `administer_bolus(drug (list, one of adrenaline/noradrenaline); dose (number, mcg, range 0–1000))` — administer IV bolus
- `set_infusion(drug (list, one of adrenaline/noradrenaline); rate (number, mcg/kg/min, range 0–100))` — set infusion
- `set_drug_param(drug (list, one of adrenaline/noradrenaline); param (list, one of ke0/clearance.global/hr_ec50/hr_emax/hr_hill/cont_ec50/cont_emax/cont_hill/svr_ec50/svr_emax/svr_hill); value (number, range 0–1000))` — set PK/PD parameter

### Ecls

_setProp_:
- `drainage_res` — drainage cannula resistance (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `return_res` — return cannula res (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `tubing_in_res` — tubing in resistance (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `tubing_out_res` — tubing out resistance (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `pump_res_for` — pump forward resistance (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `pump_res_back` — pump backward resistance (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `oxy_res_for` — oxygenator forward resistance (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `oxy_res_back` — oxygenator backward resistance (mmHg/(L/s)) (number, mmHg/(L/s, range 100–100000)
- `dif_o2` — o2 diffusion constant (number, range 0–0.1)
- `dif_co2` — co2 dioxide diffusion constant (number, range 0–0.1)
- `drainage_res_factor` — drainage cannula resistance factor (factor, range 0–100)
- `return_res_factor` — return cannula resistance factor (factor, range 0–100)
- `tubing_res_factor` — tubing resistance factor (factor, range 0–100)
- `pump_res_factor` — pump resistance factor (factor, range 0–100)
- `oxy_res_factor` — oxygenator resistance factor (factor, range 0–100)

### Fluids

_setProp_:
- `is_enabled` — enabled (boolean) _(all)_

_call_:
- `add_volume( (number, ml); _default_time (number, s); fluid type (list, one of normal_saline/ringers_lactate/packed_cells/albumin_20%))` — Adminster fluid

### Gas

_setProp_:
- `is_enabled` — enabled (boolean) _(extra)_

_call_:
- `set_atmospheric_pressure(pres_atm (number, range 100–5000))` — atmospheric pressure (mmHg)
- `set_temperature(temp (number, range -100–100); site (list, one of GasCapacitance))` — temperature (C)
- `set_humidity(humidity (number, range 0–1); site (list, one of GasCapacitance))` — humidity factor
- `set_fio2(fio2 (number, range 0–1); site (list, one of GasCapacitance))` — fio2

### GasCapacitance

_setProp_:
- `is_enabled` — enabled (boolean)
- `fixed_composition` — fixed gas composition (boolean)
- `u_vol` — unstressed volume (L) (number, L)
- `el_base` — elastance baseline (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `target_temp` — target temperature (dgs C) (number, dgs C)
- `pres_atm` — atmospheric pressure (mmHg) (number, mmHg)
- `u_vol_factor_ps` — unstressed volume factor (factor)
- `el_base_factor_ps` — elastance baseline factor (factor)
- `el_k_factor_ps` — elastance non linear factor (factor)

### GasDiffusor

_setProp_:
- `is_enabled` — enabled (boolean)
- `dif_o2` — oxygen diffusion constant (number)
- `dif_co2` — carbon dioxide diffusion constant (number)
- `dif_n2` — nitric oxide diffusion constant (number)
- `dif_other` — other gasses diffusion constant (number)
- `comp_gas1` — gas component 1 (list, one of GasCapacitance)
- `comp_gas2` — gas component 2 (list, one of GasCapacitance)
- `dif_o2_factor_ps` — oxygen diffusion factor (factor)
- `dif_co2_factor_ps` — carbon dioxide diffusion factor (factor)
- `dif_n2_factor_ps` — nitric oxide diffusion factor (factor)
- `dif_other_factor_ps` — other gasses diffusion factor (factor)

### GasExchanger

_setProp_:
- `is_enabled` — enabled (boolean)
- `dif_o2` — oxygen diffusion constant (number)
- `dif_co2` — carbon dioxide diffusion constant (number)
- `comp_gas` — gas component (list, one of GasCapacitance)
- `comp_blood` — blood component (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodPump/BloodVessel/MicroVascularUnit/HeartChamber)
- `dif_o2_factor_ps` — oxygen diffusion factor (factor)
- `dif_co2_factor_ps` — carbon dioxide diffusion factor (factor)

### HeadUpTilt

_setProp_:
- `is_active` — tilt active (boolean)
- `tilt_angle` — tilt angle (deg) (number, deg, range 0–90)
- `upper_column_cm` — upper-body column height (cm) (number, cm)
- `lower_column_cm` — lower-body column height (cm) (number, cm)
- `is_enabled` — enabled (boolean) _(all)_

_call_:
- `set_tilt_angle(angle (number, deg, range 0–90))` — set tilt angle

### Heart

_setProp_:
- `heart_rate_ref` — reference heart rate (bpm) (number, bpm, range 10–300)
- `pq_time` — pq time (ms) (number, ms, range 50–1000)
- `qrs_time` — qrs time (ms) (number, ms, range 50–500)
- `qt_time` — qt time (ms) (number, ms, range 50–1000)
- `ans_sens` — ans sensitivity (number, range 0–1)
- `pc_extra_volume` — pericardial fluid volume (mL) (number, mL, range 0–1000)
- `av_delay` — av delay time (ms) (number, ms, range 0.5–10) _(extra)_
- `p_amp` — ECG P amplitude (mV) (number, mV, range -5–5) _(extra)_
- `q_amp` — ECG Q amplitude (mV) (number, mV, range -5–5) _(extra)_
- `r_amp` — ECG R amplitude (mV) (number, mV, range -5–5) _(extra)_
- `s_amp` — ECG S amplitude (mV) (number, mV, range -5–5) _(extra)_
- `t_amp` — ECG T amplitude (mV) (number, mV, range -5–5) _(extra)_
- `cont_factor_left` — systolic function factor left (factor, range -20–20) _(factors)_
- `cont_factor_right` — systolic function factor right (factor, range -20–20) _(factors)_
- `relax_factor_left` — diastolic function factor left (factor, range -20–20) _(factors)_
- `relax_factor_right` — diastolic function factor right (factor, range -20–20) _(factors)_
- `pc_el_factor` — pericardial stiffness factor (factor, range 0–200) _(factors)_
- `is_enabled` — enabled (boolean) _(all)_
- `hr_factor` — heartrate factor (number, range 0–1000000)

### HeartChamber

_setProp_:
- `is_enabled` — enabled (boolean)
- `vol` — volume (L) (number, L)
- `u_vol` — unstressed volume (L) (number, L)
- `el_min` — elastance minimum (mmHg/L) (number, mmHg/L)
- `el_max` — elastance maximum (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `u_vol_factor_ps` — unstressed volume factor (factor)
- `el_min_factor_ps` — elastance minimum baseline factor (factor)
- `el_max_factor_ps` — elastance maximum baseline factor (factor)
- `el_k_factor_ps` — elastance non linear factor (factor)

### HeartFunction

_setProp_:
- `is_enabled` — enabled (boolean)
- `g_es_lv` — afterload gain LV (number) _(advanced)_
- `g_ed_lv` — over-dilation gain LV (number) _(advanced)_
- `g_es_rv` — afterload gain RV (number) _(advanced)_
- `g_ed_rv` — over-dilation gain RV (number) _(advanced)_
- `remodel_tc` — remodeling time constant (s) (number, s) _(advanced)_
- `stress_avg_tc` — wall-stress averaging time constant (s) (number, s) _(advanced)_
- `k_conc` — concentric remodeling drive (number) _(advanced)_
- `k_ecc` — eccentric remodeling drive (number) _(advanced)_
- `setpoint_warmup` — setpoint warm-up window (s) (number, s) _(advanced)_
- `hf_active` — load-induced compromise active (boolean)
- `remodel_active` — remodeling active (boolean)
- `cont_tc` — acute contractility time constant (s) (number, s)
- `cont_floor` — acute contractility floor (number)

### HeartValve

_setProp_:
- `is_enabled` — enabled (boolean)
- `no_flow` — no flow allowed (boolean)
- `no_back_flow` — no back flow allowed (boolean)
- `r_for` — forward resistance (number)
- `r_back` — backward resistance (number)
- `r_k` — non linear resistance coefficient (number)
- `comp_from` — comp from (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodPump/BloodVessel/MicroVascularUnit/HeartChamber/GasCapacitance)
- `comp_to` — comp to (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodPump/BloodVessel/MicroVascularUnit/HeartChamber/GasCapacitance)
- `r_factor_ps` — resistance factor (factor)
- `r_k_factor_ps` — non linear resistance coefficient factor (factor)

### Hormones

_setProp_:
- `hormones_running` — hormones running (boolean)
- `raas_enabled` — RAAS enabled (boolean)
- `adh_enabled` — ADH enabled (boolean)
- `perfusion_setpoint` — perfusion setpoint (mmHg) (number, mmHg, range 0–200) _(extra)_
- `volume_setpoint` — volume setpoint (L) (number, L, range 0–20) _(extra)_
- `osmo_na_setpoint` — Na/osmolality setpoint (mmol/L) (number, mmol/L, range 100–170) _(extra)_
- `k_setpoint` — K setpoint (mmol/L) (number, mmol/L, range 1–8) _(extra)_
- `angiotensin_tc` — angiotensin time constant (s) (number, s, range 0–36000) _(advanced)_
- `aldosterone_tc` — aldosterone time constant (s) (number, s, range 0–36000) _(advanced)_
- `adh_tc` — ADH time constant (s) (number, s, range 0–36000) _(advanced)_
- `renin_gain` — renin gain (perfusion) (number, perfusion, range 0–50) _(advanced)_
- `renin_vol_gain` — renin gain (volume) (number, volume, range 0–50) _(advanced)_
- `aldo_gain` — aldosterone gain (AngII) (number, AngII, range 0–50) _(advanced)_
- `aldo_k_in_gain` — aldosterone gain (K) (number, K, range 0–50) _(advanced)_
- `adh_gain_osmo` — ADH gain (osmotic) (number, osmotic, range 0–50) _(advanced)_
- `adh_gain_baro` — ADH gain (baroreg) (number, baroreg, range 0–50) _(advanced)_
- `ang_svr_gain` — AngII → arteriolar SVR gain (number, range 0–5) _(advanced)_
- `ang_svr_ven_gain` — AngII → venular SVR gain (number, range 0–5) _(advanced)_
- `ang_efferent_gain` — AngII → renal efferent gain (number, range 0–5) _(advanced)_
- `aldo_na_gain` — aldosterone → Na reabs gain (number, range 0–1) _(advanced)_
- `aldo_k_gain` — aldosterone → K waste gain (number, range 0–1) _(advanced)_
- `adh_water_gain` — ADH → water reabs gain (number, range 0–1) _(advanced)_
- `adh_svr_gain` — ADH → SVR gain (number, range 0–5) _(advanced)_
- `is_enabled` — enabled (boolean) _(all)_

### Kidneys

_setProp_:
- `kidneys_running` — kidneys running (boolean)
- `kf` — filtration coeff (L/s/mmHg) (number, L/s/mmHg, range 0–0.001)
- `p_bowman` — bowman pressure (mmHg) (number, mmHg, range 0–40)
- `oncotic_base` — oncotic pressure (mmHg) (number, mmHg, range 0–40)
- `reabsorption_fraction` — water reabsorption fraction (number, range 0–0.9999)
- `autoregulation_enabled` — GFR autoregulation (boolean)
- `kf_factor_ps` — filtration coeff factor (factor) _(factors)_
- `reabs_factor_ps` — reabsorption fraction factor (factor) _(factors)_
- `reabs_factor_adh` — ADH water reabsorption factor (factor) _(factors)_
- `albumin_ref` — reference albumin (g/L) (number, g/L, range 1–60) _(advanced)_
- `myogenic_p_set` — myogenic setpoint (mmHg) (number, mmHg, range 0–250) _(advanced)_
- `myogenic_p_min` — myogenic window min (mmHg) (number, mmHg, range 0–250) _(advanced)_
- `myogenic_p_max` — myogenic window max (mmHg) (number, mmHg, range 0–250) _(advanced)_
- `myogenic_gain_up` — myogenic gain up (/mmHg) (number, /mmHg, range 0–1) _(advanced)_
- `myogenic_gain_down` — myogenic gain down (/mmHg) (number, /mmHg, range 0–1) _(advanced)_
- `myogenic_tc` — myogenic time constant (s) (number, s, range 0–120) _(advanced)_
- `tgf_use_nacl` — TGF use NaCl signal (boolean) _(advanced)_
- `tgf_setpoint` — TGF setpoint (0=auto) (number, 0=auto, range 0–100000) _(advanced)_
- `tgf_seed_delay` — TGF auto-seed delay (s) (number, s, range 0–600) _(advanced)_
- `tgf_gain` — TGF gain (number, range 0–10) _(advanced)_
- `tgf_tc` — TGF time constant (s) (number, s, range 0–600) _(advanced)_
- `afferent_apply_tc` — afferent apply time constant (s) (number, s, range 0–120) _(advanced)_
- `afferent_factor_min` — afferent factor min (number, range 0.01–1) _(advanced)_
- `afferent_factor_max` — afferent factor max (number, range 1–20) _(advanced)_
- `is_enabled` — enabled (boolean) _(all)_

### Metabolism

_setProp_:
- `met_active` — metabolism enabled (boolean)
- `vo2` — vo2 (ml/kg/min) (number, ml/kg/min)
- `resp_q` — respiratory quotient (number)
- `is_enabled` — enabled (boolean) _(all)_

_call_:
- `set_metabolic_active_model(site (list, one of BloodCapacitance/BloodTimeVaryingElastance); fvo2 (number, range 0–1))` — set local fractional vo2

### Mob

_setProp_:
- `is_enabled` — enabled (boolean)
- `mob_active` — myocardial oxygen balance (boolean)
- `to2_min` — minimal to2 (mmol/l) (number, mmol/l)
- `to2_ref` — reference to2 (mmol/l) (number, mmol/l)
- `resp_q` — respiratory quotient (number)
- `bm_vo2_per_g` — basal mvo2 (mmol O2/g/s) (number, mmol O2/g/s)
- `sw_vo2_per_g` — stroke-work mvo2 (mmol O2/g/(mmHg·mL)) (number, mmol O2/g/(mmHg·mL)
- `hw_intercept` — heart weight intercept (g) (number, g)
- `hw_slope` — heart weight slope (g per g body weight) (number, g per g body weight)
- `hr_factor_min` — heartrate factor min (number)
- `hr_factor_max` — heartrate factor max (number)
- `hr_tc` — heartrate time constant (number)
- `cont_factor_min` — contractility factor min (number)
- `cont_factor_max` — contractility factor max (number)
- `cont_tc` — contractility time constant (number)
- `ans_factor_min` — ans factor min (number)
- `ans_factor_max` — ans factor max (number)
- `ans_tc` — ans time constant (number)

### Monitor

_setProp_:
- `is_enabled` — enabled (boolean)

### Pda

_setProp_:
- `diameter_relative` — ductus diameter (%) (number, %, range 0–100)
- `diameter_ao_max` — max diameter aortic ampulla (mm) (number, mm) _(extra)_
- `diameter_pa_max` — max diameter pulmonary end (mm) (number, mm) _(extra)_
- `length` — ductus arteriosus length (mm) (number, mm) _(extra)_
- `el_base` — baseline elastance (open duct, mmHg/L) (number, open duct, mmHg/L) _(extra)_
- `alpha` — elastance-resistance coupling alpha (number, range 0–1.5) _(extra)_
- `jet_exponent` — jet velocity exponent (number, range 0–3) _(extra)_
- `is_enabled` — enabled (boolean) _(all)_

### Placenta

_setProp_:
- `umb_art_res` — umb artery resistance (mmHg*s/L) (number, mmHg*s/L, range 100–100000)
- `umb_ven_res` — umb vein resistance (mmHg*s/L) (number, mmHg*s/L, range 100–100000)
- `plf_res` — fetal plac resistance (mmHg*s/L) (number, mmHg*s/L, range 100–100000)
- `dif_o2` — o2 diffusion constant (number, range 0–0.1)
- `dif_co2` — co2 dioxide diffusion constant (number, range 0–0.1)
- `mat_to2` — mat plac o2 content (mmol/L) (number, mmol/L, range 0–10)
- `mat_tco2` — mat plac co2 content (mmol/L) (number, mmol/L, range 20–30)
- `is_enabled` — enabled (boolean) _(all)_
- `placenta_running` — placenta model running (boolean) _(caption)_
- `umb_clamped` — umbilical vessels clamped (boolean) _(caption)_
- `umb_art_res_factor` — umb artery resistance factor (factor, range 0–100)
- `umb_ven_res_factor` — umb vein resistance factor (factor, range 0–100)
- `plf_res_factor` — fetal placenta resistance factor (factor, range 0–10)

### Resistor

_setProp_:
- `is_enabled` — enabled (boolean)
- `no_flow` — no flow allowed (boolean)
- `no_back_flow` — no back flow allowed (boolean)
- `r_for` — forward resistance (number)
- `r_back` — backward resistance (number)
- `r_k` — non linear resistance coefficient (number)
- `comp_from` — comp from (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodPump/BloodVessel/MicroVascularUnit/HeartChamber/GasCapacitance)
- `comp_to` — comp to (list, one of BloodCapacitance/BloodTimeVaryingElastance/BloodPump/BloodVessel/MicroVascularUnit/HeartChamber/GasCapacitance)
- `r_factor_ps` — resistance factor (factor)
- `r_k_factor_ps` — non linear resistance coefficient factor (factor)

### Respiration

_setProp_:
- `el_lungs_factor` — lung elastance factor (factor, range -10–10) _(factors)_
- `el_thorax_factor` — thorax elastance factor (factor, range -10–10) _(factors)_
- `res_upper_airways_factor` — upper airway resistance factor (factor, range -100–100) _(factors)_
- `res_lower_airways_factor` — lower airway resistance factor (factor, range -100–100) _(factors)_
- `gex_factor` — gasexchange factor (factor, range -100–100) _(factors)_
- `is_enabled` — enabled (boolean) _(all)_

### Resuscitation

_setProp_:
- `chest_comp_freq` — chest compressions frequency (/min) (number, /min, range 10–150)
- `chest_comp_no` — no of chest compressions (/cycle) (number, /cycle, range 0–10)
- `chest_comp_cont` — continuous compressions (boolean)
- `vent_freq` — ventilation frequency (/min) (number, /min, range 0–100)
- `vent_no` — no of ventilation (/cycle) (number, /cycle, range 0–100)
- `chest_comp_max_pres` — chest compressions pressure (mmHg) (number, mmHg, range 0–500) _(extra)_
- `vent_pres_pip` — ventilation peak pressure (cmH2O) (number, cmH2O, range 0–50) _(extra)_
- `vent_pres_peep` — ventilation peep (cmH2O) (number, cmH2O, range 0–10) _(extra)_
- `vent_insp_time` — ventilation inspiration time (s) (number, s, range 0.1–5) _(extra)_
- `is_enabled` — enabled (boolean) _(all)_

_call_:
- `switch_cpr(cpr_enabled (boolean))` — switch cpr on/off
- `set_fio2(vent_fio2 (number, range 0–1))` — set cpr fio2

### Shunts

_setProp_:
- `diameter_fo` — foramen ovale diameter (mm) (number, mm, range 0–20)
- `diameter_vsd` — ventricular septal defect diameter (mm) (number, mm, range 0–20)
- `ips_res` — intrapulmonary shunt resistance (number, range 10–50000)
- `atrial_septal_width` — atrial septum width (mm) (number, mm, range 0–10) _(extra)_
- `ventricular_septal_width` — ventricular septum width (mm) (number, mm, range 0–10) _(extra)_
- `fo_lr_factor` — foramen ovale L-R resistance factor (number, range 0–100) _(extra)_
- `ips_res` — intrapulmonary shunt resistance (mmHg*s/L) (number, mmHg*s/L, range 0–100000000) _(extra)_
- `is_enabled` — enabled (boolean) _(all)_

### TimeVaryingElastance

_setProp_:
- `is_enabled` — enabled (boolean)
- `vol` — volume (L) (number, L)
- `u_vol` — unstressed volume (L) (number, L)
- `el_min` — elastance minimum (mmHg/L) (number, mmHg/L)
- `el_max` — elastance maximum (mmHg/L) (number, mmHg/L)
- `el_k` — elastance non linear k (number)
- `u_vol_factor_ps` — unstressed volume factor (factor)
- `el_min_factor_ps` — elastance minimum baseline factor (factor)
- `el_max_factor_ps` — elastance maximum baseline factor (factor)
- `el_k_factor_ps` — elastance non linear factor (factor)

### Ventilator

_setProp_:
- `vent_mode` — ventilator mode (list, one of PC/PRVC/PS)
- `vent_rate` — ventilator rate (/min) (number, /min, range 0–100)
- `insp_time` — inspiration time (s) (number, s, range 0.1–5)
- `insp_flow` — inspiratory flow (l/min) (number, l/min, range 0–20)
- `tidal_volume` — tidal volume (mL) (number, mL, range 1–500)
- `pip_cmh2o` — peak inspiratory pressure (cmH2O) (number, cmH2O, range 5–50)
- `pip_cmh2o_max` — max peak inspiratory pressure (cmH2O) (number, cmH2O, range 5–50)
- `peep_cmh2o` — positive end expiratory pressure (cmH2O) (number, cmH2O, range 0–20)
- `exp_flow` — expiratory flow (l/min) (number, l/min, range 0–20) _(extra)_
- `trigger_volume_perc` — trigger volume percentage (%) (number, %, range 5–20) _(extra)_
- `synchronized` — synchronized ventilation (boolean) _(extra)_
- `is_enabled` — enabled (boolean) _(all)_

_call_:
- `switch_ventilator(is_enabled (boolean))` — switch ventilator on/off
- `set_ettube_diameter(ettube_diameter (number, mm))` — endotracheal tube diameter (mm)
- `set_ettube_length(ettube_length (number, mm))` — endotracheal tube length (mm)
- `set_fio2(fio2 (number, range 0.21–1))` — fio2
- `set_humidity(humidity (number, range 0–1))` — humidity
- `set_temp(temp (number, C, range 0–1))` — temperature (C)

---

## Events & scheduling — `op:"event"`

Bundle several property changes into one **named event** the user can replay. Each entry
in `changes[]` is a `setProp`-style `{model, target, value}` with two optional timing
fields (simulated seconds, only advancing while the sim runs):

- `it` — ramp the numeric value to the target over N seconds (numbers only; booleans/lists swap instantly).
- `at` — delay the change N seconds before it starts.

Each change is validated against the same fields/bounds/units as a `setProp` (Full vs Guided
scope applies per change). Applying the card **saves the event into the Event Scheduler
panel** — it does not fire it; the user applies or arms it there. Optional `fire_at` (absolute
sim-clock auto-fire) is a panel feature; omit unless asked.

Envelope: `{"op":"event","name":"<name>","changes":[{"model","target","value","it"?,"at"?}, …],"fire_at":<s?>,"reason":"<label>"}`

Example — drive a tachycardia then drop spontaneous breathing 30 s later:
```json
{"op":"event","name":"induce tachy","changes":[{"model":"Heart","target":"heart_rate_ref","value":200,"it":15},{"model":"Breathing","target":"breathing_enabled","value":false,"at":30}],"reason":"ramp HR to 200 over 15s, apnea at +30s"}
```

---

## Diagram editing — `op:"diagram"`

Edit the diagram the user sees (compartments = sprites bound to engine models,
connectors = paths between them). Requires the **Diagram tab** to be open; each
turn's context lists the **Current diagram** (component ids + their model bindings),
and the **`Models in scenario:`** map gives the engine instance names you bind to.
Use existing component ids verbatim; give every new component a unique `name`.

Envelope: `{"op":"diagram","action":"<action>", ...fields, "reason":"<label>"}`

Actions:
- `addComponent` — fields: name (unique), models[] (engine instance names), picto, label?, pos?. add a compartment bound to engine model(s); pos is {type:'arc',dgs} or {type:'rel',x,y}
- `connect` — fields: from, to (existing component names), models?[], path?{type,width}. draw a connector between two existing components, optionally bound to a Resistor model
- `setLayout` — fields: name, patch (cosmetic layout keys only). restyle a component/connector: alpha, z_index, tinting, sprite color/scale/rotation/pos, label, path
- `setLabel` — fields: name, text. set a component's caption text
- `setModels` — fields: name, models[]. rebind which engine model(s) a component/connector represents
- `setPicto` — fields: name, picto. swap a compartment's sprite image
- `delete` — fields: name. remove a component (and its attached connectors) or a connector

- **picto** must be one of: container.png, vessel.png, lung.png, pump.png, blood.png, exchanger.png, gas_container.png, general.png, placenta.png, trachea.png
- **path.type** must be one of: straight, arc, arc_r
- **setLayout patch** keys (cosmetic only): general.alpha, general.z_index, general.tinting, sprite.color, sprite.scale.x, sprite.scale.y, sprite.rotation, sprite.pos, label.size, label.color, label.pos_x, label.pos_y, path.type, path.width
- **pos**: `{"type":"arc","dgs":<0-360>}` to sit on the layout ring, or
  `{"type":"rel","x":<-1..1>,"y":<-1..1>}` relative to centre.

Example — add a kidney compartment and connect it to the aorta:
```json
{"op":"diagram","action":"addComponent","name":"Kidney","models":["Kidneys"],"picto":"general.png","label":"Kidney","pos":{"type":"arc","dgs":210},"reason":"add kidney"}
{"op":"diagram","action":"connect","from":"AA","to":"Kidney","models":["AA_Kidney"],"path":{"type":"arc"},"reason":"renal artery"}
```

````


## 6. Scenario format

Scenarios in `model_definitions/*.json` are full app documents (`animation_definition`,
`diagram_definition`, `configuration`, and **`model_definition`**). `Model.load()` fetches
`/model_definitions/<name>.json` and unwraps `jsonData.model_definition || jsonData` before
`build()`. Inside `model_definition`: engine settings plus **`models`** — a map of
`name → { name, model_type, …params }` wired together by Resistor `comp_from`/`comp_to`.
Available scenarios are listed in `public/model_definitions/index.json`.

### FILE: public/model_definitions/index.json

```json
[
  "adult_female",
  "term_neonate"
]
```

### EXCERPT: model_definition (trimmed)

```json
{
  "//": "model_definition excerpt from explain/model_definitions/term_neonate_clean.json. Top-level wrapper keys present in the full file: explain_version, user, name, description, protected, shared, shared_category, animation_definition, diagram_definition, model_definition, configuration. The engine consumes only model_definition (Model.load unwraps it). This excerpt shows 3 of 18 entries in models{}.",
  "scaler_config": {
    "blood": {
      "volume": [
        "PA",
        "PAAL",
        "PAAR",
        "LL_ART",
        "RL_ART",
        "LL_CAP",
        "RL_CAP",
        "LL_VEN",
        "RL_VEN",
        "PV",
        "AA",
        "AAR",
        "AD",
        "INT_ART",
        "KID_ART",
        "LS_ART",
        "BR_ART",
        "INT_CAP",
        "KID_CAP",
        "LS_CAP",
        "BR_CAP",
        "INT_VEN",
        "KID_VEN",
        "LS_VEN",
        "BR_VEN",
        "IVCI",
        "SVC",
        "VLB",
        "VUB",
        "RLB",
        "RUB",
        "DA",
        "COR"
      ],
      "el_base": [
        "PA",
        "PAAL",
        "PAAR",
        "LL_ART",
        "RL_ART",
        "LL_CAP",
        "RL_CAP",
        "LL_VEN",
        "RL_VEN",
        "PV",
        "AA",
        "AAR",
        "AD",
        "INT_ART",
        "KID_ART",
        "LS_ART",
        "BR_ART",
        "INT_CAP",
        "KID_CAP",
        "LS_CAP",
        "BR_CAP",
        "INT_VEN",
        "KID_VEN",
        "LS_VEN",
        "BR_VEN",
        "IVCI",
        "SVC",
        "VLB",
        "VUB",
        "RLB",
        "RUB",
        "DA",
        "COR"
      ],
      "resistance": [
        "PA",
        "PAAL",
        "PAAR",
        "LL_ART",
        "RL_ART",
        "LL_CAP",
        "RL_CAP",
        "LL_VEN",
        "RL_VEN",
        "PV",
        "AA",
        "AAR",
        "AD",
        "INT_ART",
        "KID_ART",
        "LS_ART",
        "BR_ART",
        "INT_CAP",
        "KID_CAP",
        "LS_CAP",
        "BR_CAP",
        "INT_VEN",
        "KID_VEN",
        "LS_VEN",
        "BR_VEN",
        "IVCI",
        "SVC",
        "VLB",
        "VUB",
        "RLB",
        "RUB",
        "DA",
        "IVCI_RAIVC",
        "SVC_RASVC",
        "PV_LA",
        "PV_RAIVC",
        "PV_RASVC"
      ]
    },
    "blood_pulmonary": {
      "el_base": [
        "PA",
        "PAAL",
        "PAAR",
        "LL_ART",
        "RL_ART",
        "LL_CAP",
        "RL_CAP",
        "LL_VEN",
        "RL_VEN",
        "PV"
      ],
      "resistance": [
        "PA",
        "PAAL",
        "PAAR",
        "LL_ART",
        "RL_ART",
        "LL_CAP",
        "RL_CAP",
        "LL_VEN",
        "RL_VEN",
        "PV",
        "PV_LA",
        "PV_RAIVC",
        "PV_RASVC"
      ]
    },
    "blood_systemic": {
      "el_base": [
        "AA",
        "AAR",
        "AD",
        "INT_ART",
        "KID_ART",
        "LS_ART",
        "BR_ART",
        "INT_CAP",
        "KID_CAP",
        "LS_CAP",
        "BR_CAP",
        "INT_VEN",
        "KID_VEN",
        "LS_VEN",
        "BR_VEN",
        "IVCI",
        "SVC",
        "VLB",
        "VUB",
        "RLB",
        "RUB",
        "DA",
        "COR"
      ],
      "resistance": [
        "AA",
        "AAR",
        "AD",
        "INT_ART",
        "KID_ART",
        "LS_ART",
        "BR_ART",
        "INT_CAP",
        "KID_CAP",
        "LS_CAP",
        "BR_CAP",
        "INT_VEN",
        "KID_VEN",
        "LS_VEN",
        "BR_VEN",
        "IVCI",
        "SVC",
        "VLB",
        "VUB",
        "RLB",
        "RUB",
        "DA",
        "IVCI_RAIVC",
        "SVC_RASVC"
      ]
    },
    "heart": {
      "volume": [
        "LA",
        "LV",
        "RAIVCI",
        "RASVC",
        "RV",
        "COR"
      ],
      "el_min": [
        "LA",
        "LV",
        "RAIVCI",
        "RASVC",
        "RV",
        "COR"
      ],
      "el_max": [
        "LA",
        "LV",
        "RAIVCI",
        "RASVC",
        "RV",
        "COR"
      ],
      "resistance": [
        "LA_LV",
        "LV_AA",
        "RV_PA",
        "RAIVCI_RV",
        "RASVC_RV",
        "LV_PA",
        "RV_AA",
        "COR_RA"
      ]
    },
    "heart_left": {
      "el_min": [
        "LA",
        "LV"
      ],
      "el_max": [
        "LA",
        "LV"
      ]
    },
    "heart_right": {
      "el_min": [
        "RAIVCI",
        "RASVC",
        "RV"
      ],
      "el_max": [
        "RAIVCI",
        "RASVC",
        "RV"
      ]
    },
    "lung": {
      "volume": [
        "ALL",
        "ALR",
        "DS"
      ],
      "el_base": [
        "ALL",
        "ALR",
        "DS"
      ],
      "resistance": [
        "MOUTH_DS",
        "DS_ALL",
        "DS_ALR"
      ]
    },
    "thorax": [
      "THORAX"
    ],
    "pericardium": [
      "PERICARDIUM"
    ]
  },
  "weight": 3.545,
  "height": 0.519,
  "gestational_age": 40,
  "age": 0,
  "modeling_stepsize": 0.0005,
  "model_time_total": 0,
  "models": {
    "//": "18 models total in this scenario; full list of names: Heart, Breathing, Metabolism, Ans, Mob, HeartFunction, Ventilator, Fluids, Circulation, Placenta, Ecls, Respiration, Pda, Shunts, Blood, Gas, Resuscitation, Monitor",
    "Heart": {
      "name": "Heart",
      "description": "heart contraction model",
      "is_enabled": true,
      "model_type": "Heart",
      "components": {
        "LA": {
          "name": "LA",
          "description": "timevarying elastance model of the left atrium",
          "is_enabled": true,
          "model_type": "HeartChamber",
          "vol": 0.004792942755716486,
          "u_vol": 0,
          "el_min": 1173,
          "el_max": 3053,
          "el_k": 0,
          "ans_sens": 1
        },
        "RAIVCI": {
          "name": "RAIVCI",
          "description": "timevarying elastance model of the right atrium",
          "is_enabled": true,
          "model_type": "HeartChamber",
          "vol": 0.00237336192360594,
          "u_vol": 0,
          "el_min": 2346,
          "el_max": 6104,
          "el_k": 0,
          "ans_sens": 1
        },
        "RASVC": {
          "name": "RASVC",
          "description": "timevarying elastance model of the right atrium",
          "is_enabled": true,
          "model_type": "HeartChamber",
          "vol": 0.0022062124318543135,
          "u_vol": 0,
          "el_min": 2346,
          "el_max": 6104,
          "el_k": 0,
          "ans_sens": 1
        },
        "LV": {
          "name": "LV",
          "description": "timevarying elastance model of the left ventricle",
          "is_enabled": true,
          "model_type": "HeartChamber",
          "components": {},
          "vol": 0.006758873195717388,
          "u_vol": 0.000733,
          "el_min": 1137,
          "el_max": 27200,
          "el_k": 0,
          "ans_sens": 1
        },
        "RV": {
          "name": "RV",
          "description": "timevarying elastance model of the right ventricle",
          "is_enabled": true,
          "model_type": "HeartChamber",
          "components": {},
          "vol": 0.008308104276082626,
          "u_vol": 0.004,
          "el_min": 1079,
          "el_max": 22200,
          "el_k": 0,
          "ans_sens": 1
        },
        "LA_LV": {
          "name": "LA_LV",
          "description": "mitral valve",
          "is_enabled": true,
          "model_type": "HeartValve",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "LA",
          "comp_to": "LV",
          "no_flow": false,
          "no_back_flow": true
        },
        "RAIVCI_RV": {
          "name": "RAIVCI_RV",
          "description": "tricuspid valve",
          "is_enabled": true,
          "model_type": "Resistor",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "RAIVCI",
          "comp_to": "RV",
          "no_flow": false,
          "no_back_flow": true
        },
        "RASVC_RV": {
          "name": "RASVC_RV",
          "description": "tricuspid valve",
          "is_enabled": true,
          "model_type": "Resistor",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "RASVC",
          "comp_to": "RV",
          "no_flow": false,
          "no_back_flow": true
        },
        "RV_PA": {
          "name": "RV_PA",
          "description": "pulmonary valve",
          "is_enabled": true,
          "model_type": "HeartValve",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "RV",
          "comp_to": "PA",
          "no_flow": false,
          "no_back_flow": true
        },
        "RV_AA": {
          "name": "RV_AA",
          "description": "pulmonary valve TGA or TOF",
          "is_enabled": false,
          "model_type": "HeartValve",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "RV",
          "comp_to": "AA",
          "no_flow": true,
          "no_back_flow": true
        },
        "LV_AA": {
          "name": "LV_AA",
          "description": "aortic valve",
          "is_enabled": true,
          "model_type": "HeartValve",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "LV",
          "comp_to": "AA",
          "no_flow": false,
          "no_back_flow": true
        },
        "LV_PA": {
          "name": "LV_PA",
          "description": "aortic valve TGA",
          "is_enabled": false,
          "model_type": "HeartValve",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "LV",
          "comp_to": "PA",
          "no_flow": true,
          "no_back_flow": true
        },
        "RAIVCI_RASVC": {
          "name": "RAIVCI_RASVC",
          "description": "intra-atrial shunt",
          "is_enabled": true,
          "model_type": "Resistor",
          "r_for": 55,
          "r_back": 55,
          "r_k": 0,
          "comp_from": "RAIVCI",
          "comp_to": "RASVC",
          "no_flow": true,
          "no_back_flow": true
        },
        "PERICARDIUM": {
          "name": "PERICARDIUM",
          "description": "container model of the pericardium",
          "is_enabled": true,
          "model_type": "Container",
          "vol": 0.0250517965311343,
          "u_vol": 0,
          "el_base": 10,
          "el_k": 1,
          "contained_components": [
            "RAIVCI",
            "RASVC",
            "RV",
            "LA",
            "LV",
            "COR"
          ]
        }
      },
      "heart_rate_ref": 125,
      "pq_time": 0.1,
      "qrs_time": 0.075,
      "qt_time": 0.25,
      "av_delay": 0.0005,
      "ans_sens": 1
    },
    "Breathing": {
      "name": "Breathing",
      "description": "spontaneous breathing model",
      "is_enabled": true,
      "model_type": "Breathing",
      "breathing_enabled": true,
      "minute_volume_ref": 0.2,
      "vt_rr_ratio": 0.00012,
      "rmp_gain_max": 100,
      "ie_ratio": 0.3,
      "thorax": [
        "THORAX"
      ]
    },
    "Metabolism": {
      "name": "Metabolism",
      "description": "Metabolism model",
      "is_enabled": true,
      "model_type": "Metabolism",
      "components": {},
      "met_active": true,
      "vo2": 8.1,
      "vo2_factor": 1,
      "resp_q": 0.8,
      "metabolic_active_models": {
        "RLB": 0.15,
        "INT_CAP": 0.15,
        "LS_CAP": 0.1,
        "KID_CAP": 0.1,
        "RUB": 0.1,
        "AA": 0.005,
        "AD": 0.01,
        "BR_CAP": 0.453
      }
    }
  }
}
```
