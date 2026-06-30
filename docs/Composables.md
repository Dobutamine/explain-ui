# Composables

The composables in `src/composables/` are the Vue layer's bridge to the simulation engine. They enforce the app's **two-plane split**: the **control plane** — engine status, `model_ready`, errors, whole-model state, and the ~1 Hz slow stream (`rts`) — flows through `useExplain.ts` (a singleton wrapping `@explain/Model`) into Vue reactivity and Pinia; the **data plane** — the ~60 Hz per-frame stream — is owned by `useRealtimeBus.ts` → [RealtimeBus](../explain/docs/RealtimeBus.md), which runs one `requestAnimationFrame` loop, drains a [ChannelReader](../explain/docs/ChannelReader.md), and pushes frames to renderer adapters, **never through Vue reactivity**. Everything visible lives inside `src/pages/MainPage.vue`.

## What lives here

| File | Responsibility |
|---|---|
| `src/composables/useExplain.ts` | Singleton control-plane wrapper around `@explain/Model`; mirrors engine events into refs + exposes the imperative API |
| `src/composables/useRealtimeBus.ts` | Singleton data-plane wrapper around `@explain/realtime/RealtimeBus`; registers renderer adapters |
| `src/composables/useChartParams.ts` | Model/numeric-prop catalog + chart preset store (scenario + session presets) |
| `src/composables/useSlowHistory.ts` | Singleton ring-buffer accumulator over the slow stream for sparklines/stats/trend |
| `src/composables/useMonitorPrefs.ts` | localStorage-persisted view prefs for the monitoring panel |
| `src/composables/useModelInterface.ts` | Resolves a model instance → its UI-owned parameter-edit schema |

## `useExplain` (singleton)

The control-plane facade. A module-level `_model` (one `@explain/Model` for the whole app) is created lazily by `ensure()`, which subscribes module-level refs to engine events. `useExplain()` returns those refs plus an imperative API.

### Reactive state

| Name | Type | Description |
|---|---|---|
| `status` | `Ref<string>` | Latest engine status message (`model._model.statusMessage`) from the `status` event |
| `modelReady` | `Ref<boolean>` | True after a successful build (`model_ready`); reset to `false` on `load`/`loadFromObject`/`revert` |
| `isRunning` | `Ref<boolean>` | Realtime loop active — set by `rt_start`/`rt_stop` |
| `error` | `Ref<string \| null>` | Last engine error message |
| `modelState` | `ShallowRef<any>` | Whole-model state snapshot (`state` event → `model.modelState`) |
| `slowValues` | `ShallowRef<any>` | Latest drained `rts` slow-stream batch (`model.modelDataSlow`) |
| `savedState` | `ShallowRef<any>` | Last saved state snapshot (`state_saved` event) |
| `tuning` | `Ref<boolean>` | A live closed-loop tune is running in the worker |
| `tuneResult` | `ShallowRef<any>` | Last tune outcome `{ converged, residuals, iters }` (`tuned` event) |

### Imperative API

| Method | Signature | Description |
|---|---|---|
| `model` | `Model` | The raw engine wrapper (escape hatch; used by sibling composables/stores) |
| `load` | `(name: string) => void` | Fetch + build `/model_definitions/<name>.json`; resets readiness/running/error |
| `loadFromObject` | `(obj: any) => void` | Build from a parsed scenario/state object; sets `model.loadedFileData`, lifts `diagram_definition`/`animation_definition` into the definition, calls `model.build(def)` |
| `revert` | `() => void` | Rebuild from the untouched `loadedFileData` — a clean "undo all live changes" |
| `start` / `stop` | `() => void` | Start/stop the realtime loop |
| `calculate` | `(seconds: number) => void` | Run `seconds` of simulation synchronously (fast-forward) |
| `setProp` | `(prop, value, it=1, at=0) => void` | `model.setPropValue` — tween/swap a model prop via the engine [TaskScheduler](../explain/docs/TaskScheduler.md) |
| `call` | `(fn, args=[], at=0) => void` | Schedule a model method call (`model.callModelFunction`) |
| `scale` | `(group, factor=1.0) => void` | Allometric/group scaling via `model.scaleModel` → [ModelScaler](../explain/docs/ModelScaler.md) |
| `tune` | `(targets, opts={}) => void` | Closed-loop live tune; sets `tuning=true`, resolved by `tuned` |
| `refreshState` | `() => void` | Request a fresh whole-model `state` snapshot (`model.getModelState`) |
| `watchSlow` | `(paths) => void` | Add dot-paths to the slow ~1 Hz watchlist (`model.watchModelPropsSlow`) |
| `watch` | `(paths) => void` | Add dot-paths to the fast watchlist (`model.watchModelProps`) |
| `saveState` | `() => void` | Snapshot whole-model state (`model.saveModelState` → `state_saved`) |
| `bloodComposition` | `(name) => void` | Request blood-gas composition for a model (`model.getBloodComposition`) |

`disposeExplain()` calls `model.dispose()`, nulls `_model`, and resets `modelReady`.

## `useRealtimeBus` (singleton)

Owns the data plane. A module-level `_bus` (`new RealtimeBus(model)`) is created once, wired so the engine's `rt_start`/`rt_stop` events drive `_bus.start()`/`_bus.stop()` — the rAF loop runs only while the engine streams.

| Method | Signature | Description |
|---|---|---|
| `addRenderer` | `(a: RendererAdapter) => void` | Register a renderer adapter (`@/render/types`) — uPlot charts, PixiJS diagram |
| `removeRenderer` | `(a: RendererAdapter) => void` | Unregister an adapter |

`disposeRealtimeBus()` calls `_bus.dispose()` and nulls `_bus`.

## `useChartParams(presetKey)`

Shared model/parameter catalog + preset store for the realtime time-chart (`presetKey: "RealTimeCharts"`) and the PV loop chart (`"LoopCharts"`); both keys index `loadedFileData.configuration.presets`.

| Name | Type | Description |
|---|---|---|
| `modelNames` | `ComputedRef<string[]>` | Sorted instance names from `modelState.value.models` |
| `numericProps` | `(modelName) => string[]` | Sorted numeric-valued prop names of a model instance |
| `pathToSel` | `(path) => [string\|null, string\|null]` | Split a `"Model.prop"` dot-path into `[model, prop]` |
| `presets` | `ComputedRef<Record<string, any>>` | Scenario presets merged under session-saved ones |
| `presetNames` | `ComputedRef<string[]>` | Keys of `presets` |
| `savePreset` | `(name, paths) => void` | Store a session preset `{ paths }` (lives until chart remount/scenario reload) |
| `deletePreset` | `(name) => void` | Remove a session preset, or splice a scenario preset out of `configuration.presets` |

## `useSlowHistory` (singleton)

Module-level ring-buffer accumulator (one shared `reactive` `Map<string, number[]>`, `MAX_LEN = 300` ≈ 5 min at 1 Hz). `install()` attaches one `watch(slowValues, …)` that ingests every row of each drained batch — so `calculate()` fast-forward bursts populate history too. Time going backwards (sim restart/reload) clears the buffer.

| Method | Signature | Description |
|---|---|---|
| `history` | `(path, windowSec?) => number[]` | Buffer (oldest → newest), optionally last `windowSec` samples |
| `stats` | `(path, windowSec?) => {min,max,mean,last,n} \| null` | Aggregate over the window; `null` until a sample exists |
| `delta` | `(path, n=10) => number \| null` | Signed change over the last `n` samples (last − n-ago) |

## `useMonitorPrefs` (singleton)

Module-level `reactive` `MonitorPrefs` (`{ compact, sparkWindowSec }`) loaded from `localStorage["explain.monitors.prefs"]` and auto-persisted by a deep `watch`. `SparkWindow` is `30 | 60 | 300`. Purely a per-browser display choice — never written into scenario JSON. `useMonitorPrefs()` returns the shared object.

## `useModelInterface`

Resolves a model instance's editable schema. `getInterface(name)` reads the instance's `model_type` from `model.modelState.models[name]` and looks it up in `MODEL_INTERFACES` via `getInterfaceForType()` (`@/model-interface/registry`). Re-exports `InterfaceField` and `groupByEditMode` from `@/model-interface/types` so `ModelEditor.vue` imports them from here.

| Method | Signature | Description |
|---|---|---|
| `getInterface` | `(name: string) => InterfaceField[]` | Editable-field schema for the named instance's `model_type`, or `[]` |

## Wiring

- `useExplain.ensure()` does `new Model()` (`@explain/Model`) and subscribes refs to the `Model`/`ModelEmitter` event set: `status`, `model_ready` (→ `getModelState()`), `error`, `state`, `rts`, `rt_start`, `rt_stop`, `state_saved`, `tuned`. The control-plane events are the ones described in [RealtimeBus](../explain/docs/RealtimeBus.md) as handled by `Model.receive()`; the fast `rtf`/`data` plane is deliberately **not** subscribed here.
- `useRealtimeBus` constructs `RealtimeBus(model)` over the same `Model`; the bus attaches its own worker `"message"` listener for `RT_MSG.*` only and feeds its [ChannelReader](../explain/docs/ChannelReader.md) — independent of `useExplain`'s reactivity.
- `useSlowHistory` and `useChartParams` consume `useExplain.slowValues` / `modelState`; the slow stream originates from the worker's [DataCollector](../explain/docs/DataCollector.md) slow watchlist (`watchSlow` → `watchModelPropsSlow`).
- `useModelInterface` joins the engine state (`model_type` per instance) to the UI-owned schema in `src/model-interface/`.
- Pinia stores (`src/stores/`) consume `useExplain` for control-plane reads/commands; see [Stores](./Stores.md).

## Gotchas

- **`useExplain` is a hidden singleton**, not a fresh per-call instance: `ensure()` guards `_model`, and all reactive state is module-level. Every `useExplain()` caller shares the same engine and refs.
- **`modelState`/`slowValues`/`savedState`/`tuneResult` are `shallowRef`** — only whole-object replacement is reactive, never deep mutation. They carry large snapshots/batches that must not be deep-diffed 60×/s.
- **Never subscribe the fast plane into a ref.** `rtf`/`data` must flow through `useRealtimeBus` → renderer adapters; routing them into reactivity would re-render every frame (the explicit reason the planes are split).
- **The slow stream keeps no history** — `slowValues` is overwritten with the latest drained batch each `rts` (engine clears its buffer on drain). `useSlowHistory` exists precisely because of this; it watches the ref and keeps its own bounded history.
- **`load`/`loadFromObject`/`revert` stop the realtime loop** (set `isRunning=false`, `modelReady=false`) because rebuilding tears down the running sim.
- **`loadedFileData` is the untouched originally-loaded object** — live tunes/scales/setProps never mutate it, which is what makes `revert()` a clean undo and what stores read for scenario config.
- `useSlowHistory`/`useMonitorPrefs` install their module-level `watch`/persistence exactly once; they are shared across all consumers and not torn down between component mounts.
