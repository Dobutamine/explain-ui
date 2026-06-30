# ModelInterface

The **parameter-edit schema** for every engine model lives in the UI layer, not the engine. `src/model-interface/` owns a `Record<model_type, InterfaceField[]>` (`MODEL_INTERFACES`) describing how each tunable property/method of a model class should be rendered, bounded, and unit-converted. It was relocated out of `explain/` (where it used to be a `static model_interface` array on each class) so the physics engine stays pure — UI presentation is not the model's concern. The same schema drives **two** consumers: the human `ModelEditor.vue` and the bot command validator (`validateCommand` in [ChatAndBot](./ChatAndBot.md)), so a bot-issued edit is bounded and unit-converted exactly like a hand edit.

## What lives here

| File | Responsibility |
|---|---|
| `src/model-interface/types.ts` | The `InterfaceField` shape, the `FieldGroup`/`GROUP_ORDER` buckets, and `groupByEditMode()` |
| `src/model-interface/registry.ts` | `MODEL_INTERFACES` (the per-`model_type` field arrays, ~6400 lines) + `getInterfaceForType()` |
| `src/composables/useModelInterface.ts` | Resolves a live model instance → its `model_type` → the registry entry |

## The `InterfaceField` shape

One `InterfaceField` describes a single editable property (or, for `type: "function"`, a callable method). Defined in `types.ts`:

| Field | Type | Meaning |
|---|---|---|
| `target` | `string` | Property name — or method name when `type` is `function`. The registry key inside a model. |
| `type` | `string` | Control kind (see table below). Branched on in `ModelEditor.vue` and `botCommands.ts`. |
| `caption` | `string?` | Human label. Unit is parsed from a trailing `(…)` (e.g. `tidal volume (mL)`). |
| `readonly` | `boolean?` | Display-only (measured outputs). The bot's `isSettableField` rejects these. |
| `edit_mode` | `string?` | Section bucket: `basic` \| `extra` \| `factors` \| `advanced` \| `all` \| `caption`. |
| `build_prop` | `boolean?` | Property is part of the build-time definition (vs. a runtime-only/derived value). |
| `factor` | `number?` | Display/raw conversion: `display = raw * factor`; `write = uiValue / factor`. |
| `delta` | `number?` | Spinner step. |
| `rounding` | `number?` | Decimal places shown. |
| `ll` / `ul` | `number?` | Lower / upper limit, in **display** units (e.g. tidal volume 1–500 mL). |
| `slider` | `boolean?` | Render as a slider instead of a spinner. |
| `options` | `string[]?` | List values that are model-type names (`list` / `multiple-list`). |
| `choices` | `string[]?` | Literal string choices, used when `custom_options` is set. |
| `custom_options` | `boolean?` | Selects `choices` over `options` as the source of allowed values. |
| `args` | `InterfaceField[]?` | Positional argument descriptors for a `function` field. |
| `default` | `any?` | Initial value for a function arg. |
| `target_model` / `target_prop` | `string?` | `prop-list`: the two-level model + property reference. |
| `caption_model` / `caption_prop` | `string?` | `prop-list`: captions for the two levels. |
| `dict_keys` | `string[]?` | `dict`: keys to render so an empty instance dict still shows all entries. |
| `dict_value_type` | `"number"?` | `dict`: value-control kind (number is the only case today). |

### `type` values

| `type` | Rendered as | Notes |
|---|---|---|
| `number` | Spinner (or slider) | Uses `factor`/`delta`/`rounding`/`ll`/`ul`. Bot-settable. |
| `factor` | Spinner over a `*_factor_ps` knob | A persistent multiplier (1.0 = baseline). Bot-settable. |
| `boolean` | Toggle | Bot-settable (`it` forced to 0). |
| `string` | Text field | Almost always `readonly` (descriptions). Not bot-settable. |
| `list` | Single-select | Choices via `resolveChoices` (`options`/`choices`). Bot-settable. |
| `multiple-list` | Multi-select | Structural wiring; rebuild-only, **not** bot-settable. |
| `function` | Method-call control | `args[]` describe positional inputs. Bot op = `call`. |
| `prop-list` | Two-level model+prop picker | Structural reference; rebuild-only. |
| `reference` | Model reference | Structural wiring; rebuild-only. |
| `dict` | One control per `dict_keys` entry | `dict_value_type` controls the value editor. |

The bot's `SETTABLE_PROP_TYPES` set is exactly `{number, factor, boolean, list}`; `function` is reachable only via the `call` op. Everything else (`multiple-list`, `prop-list`, `reference`, `dict`, `string`) is structural or read-only and excluded at runtime.

## `groupByEditMode()`

`types.ts` exports `groupByEditMode(fields)` → ordered, non-empty `FieldGroup[]` for sectioned UI. `resolveMode()` keeps only `extra` / `factors` / `advanced` as distinct buckets; **everything else (`basic`, `caption`, `all`, `undefined`, unknown) folds into `basic`** so the common description/enabled fields surface first. `GROUP_ORDER` fixes the section order: Basic → Extra → Factors → Advanced. Empty buckets are dropped.

## `MODEL_INTERFACES` / `getInterfaceForType`

`registry.ts` is auto-generated: each class's effective (inheritance-resolved) `static model_interface` array was dumped from `explain/ModelIndex.js` and keyed by `model_type`. `getInterfaceForType(modelType)` is the only accessor — it returns `MODEL_INTERFACES[modelType]` or `[]` for an unknown type. To regenerate after a model gains or changes a tunable parameter, re-dump the class interfaces and replace `MODEL_INTERFACES`.

## `useModelInterface()`

The composable maps an instance **name** → schema. `getInterface(name)` looks up `model.modelState.models[name].model_type` from the latest engine state snapshot (refreshed on `model_ready`) and forwards to `getInterfaceForType`. It re-exports `InterfaceField` and `groupByEditMode` so `ModelEditor.vue` imports both from one place.

## Wiring

```
explain/ (pure physics, no UI metadata)
        │  model_type  (static on each class)
        ▼
registry.ts  MODEL_INTERFACES[model_type] = InterfaceField[]
        │
        ├── useModelInterface().getInterface(name)
        │        → ModelEditor.vue / ParameterPanel.vue   (human edits)
        │
        └── getInterfaceForType(model_type)
                 → botCommands.validateCommand            (bot edits, see ChatAndBot)
```

Both paths read the **same** `InterfaceField`: `ModelEditor` for rendering + its own `toRaw` conversion; the bot validator for `ll`/`ul` bounds, `resolveChoices`, function-arg checks, and the display→raw `factor` (mirrored as `toRaw(f, ui) = ui / (f.factor ?? 1)`).

## Gotchas

- **Add a field or it's invisible.** A new tunable parameter is not editable in the app — and not bot-settable — until a matching `InterfaceField` is added to that `model_type`'s array in `registry.ts`. The engine does not advertise it.
- **`ll`/`ul` are in display units**, not raw engine units. Bounds are checked before the `factor` conversion.
- **Unit string comes from the caption.** The bot derives a value's unit by regex-matching the first `(…)` in `caption`; a caption with no parenthesised unit yields no unit label.
- **Empty `options: []` is a trap.** `resolveChoices` deliberately walks a candidate chain (`custom_options ? choices : options`, then `choices`, then `options`) and picks the first **non-empty** array, because the registry mixes `options`/`choices` and doesn't always set `custom_options`.
- **`caption`/`all`/unknown `edit_mode` all land in Basic.** Only `extra`/`factors`/`advanced` get their own section.
- **`getInterfaceForType` never throws** — an unknown `model_type` returns `[]`, which the validator surfaces as "model not found / not editable" rather than a crash.
