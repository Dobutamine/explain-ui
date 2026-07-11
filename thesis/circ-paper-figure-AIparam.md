# New figure — AI-assisted parameterization closed loop

**Rendered.** The figure has been produced and is embedded as **Fig. 6** in
`ExplainCircPaper_WORKING_with_AIparam.docx`:
- `thesis/Fig6_AI_parameterization.png` — 300 dpi raster (embedded in the working docx).
- `thesis/Fig6_AI_parameterization.svg` — editable vector.

The SVG can be opened/tweaked in any vector editor; if you prefer to keep all figures in
the OmniGraffle set, redraw it as `AIParameterization.umdx` in `../explain-papers/Graphs/`
and export to `Graphs/SVG/` like the others. The ASCII mockup and caption below document
the intended content.

**Where it goes.** With §2.4 (Block A of `circ-paper-additions.md`), after the existing
Fig. 5 (PDA Doppler).

**What it shows.** A single closed loop with the interpretation layer feeding the
calibration layer, and the two exit paths. Two-tone styling consistent with Fig. 1/2
(e.g. the LLM/interpretation block in one colour, the deterministic engine/calibrator
blocks in another).

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  Clinical inputs                                                  │
   │  free text · monitor values · report (PDF/CSV)                    │
   └───────────────┬───────────────────────────────────────────────── ┘
                   │
                   ▼
   ┌───────────────────────────────┐      INTERPRETATION LAYER (LLM)
   │  LLM agent (Claude)            │      interprets targets;
   │  → validated build SPEC /      │      emits allowlisted, unit-
   │    allowlisted commands        │      checked commands only
   └───────────────┬───────────────┘
                   │  targets  x*  +  baseline + pathophysiology
                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  DETERMINISTIC CALIBRATOR (secant closed loop)                  │
   │                                                                 │
   │   structural pass (once): allometric weight scaling,            │
   │   GA/RDS seeds, baroreflex set-point ← MAP*                     │
   │                        │                                        │
   │                        ▼                                        │
   │        ┌────────► advance model (settle / warm) ──────┐         │
   │        │                                              ▼         │
   │   nudge levers                              beat-averaged       │
   │   (Eq. 13 seed →                            measurement  x      │
   │    Eq. 14 secant)                                    │          │
   │        ▲                                             ▼          │
   │        │                 residual  |x* − x|  vs  τ  (Eq. 15)    │
   │        └───────────── no ◄──── within tolerance? ────► yes ─┐   │
   │                                                            │   │
   └────────────────────────────────────────────────────────── │ ──┘
                                                                │
                        ┌───────────────────────────────────────┘
                        ▼
        ┌───────────────────────────┐     ┌───────────────────────────┐
        │  (i) patient construction  │     │  (ii) live in-place tuning │
        │  bake equilibrium state →  │     │  resume real-time sim from │
        │  runnable scenario JSON    │     │  the new operating point   │
        └───────────────────────────┘     └───────────────────────────┘
```

**Draft caption.**

> **Fig. 6. AI-assisted patient-specific parameterization.** An LLM agent interprets the
> available clinical targets (x\*) and emits a validated specification and allowlisted
> commands; it does not modify equations or state directly. A deterministic calibrator
> then fits the mechanistic model: a single structural pass scales the model to body
> size and aligns the baroreflex set-point to the target mean arterial pressure, after
> which one lever per target (Table X) is nudged — a proportional seed (Eq. 13) then the
> secant method (Eq. 14) — as the model is advanced and each quantity is re-measured as a
> beat-averaged mean, until every residual falls within its clinician-meaningful
> tolerance (Eq. 15). The same loop supports offline construction of a new calibrated
> patient and live retuning of a running simulation.
