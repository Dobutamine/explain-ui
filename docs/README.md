# Explain — Documentation

This is the documentation home for the Explain project. It is split into two clearly separated sets,
mirroring the two halves of the system:

| Set | Covers | Source it documents | Start here |
|---|---|---|---|
| **[`ui/`](./ui/README.md)** | The Vue 3 + Vite + TypeScript **app** layer | `src/` | [`ui/UI_ARCHITECTURE.md`](./ui/UI_ARCHITECTURE.md) |
| **[`engine/`](./engine/README.md)** | The framework-agnostic **physiological simulation engine** (per-class reference) | `explain/` | [`engine/ARCHITECTURE.md`](./engine/ARCHITECTURE.md) |

The boundary between the two is real and worth keeping in mind: the **engine** (`engine/`) knows nothing
about Vue and runs inside a Web Worker; the **UI** (`ui/`) wraps it on the main thread. The UI docs link
*into* the engine docs (via `../engine/X.md`) where the app touches engine internals; the engine docs stay
UI-agnostic. The conceptual spine of both sets is the **two-plane split** — a reactive ~1 Hz control plane
(`useExplain` over `@explain/Model`) and a non-reactive ~60 Hz data plane (`useRealtimeBus` over the
worker's shared-memory channels).

> **Note on layout:** the documentation was centralized here, but the **code was not** — the engine still
> lives under `explain/` (and keeps its own in-folder entry point, [`explain/README.md`](../explain/README.md),
> for onboarding). Only the reference docs moved into `docs/engine/`.

## See also

- [`../CLAUDE.md`](../CLAUDE.md) — repo quick reference (alias, npm scripts, schema field list).
- [`../INSTALL.md`](../INSTALL.md) — setup / install guide.
- [`../explain/README.md`](../explain/README.md) — the engine's in-folder onboarding walkthrough.
