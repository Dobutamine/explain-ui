# EXPLAIN paper series — shared Methods blocks

**Purpose.** Reusable, verified Methods text common to every paper in the EXPLAIN series
(circulatory, respiratory, other systems, AI parameterization, devices). Each paper imports
the blocks it needs and adapts wording; the goal is that identical machinery is described
identically across the series and cross-referenced rather than re-derived. Every claim here
is taken directly from the engine source (paths given). Draft in Markdown; authors re-key
equations as native Word (OMML) objects for submission, matching Eqs. 1–12 of the
cardiovascular paper.

Paper-1 anchor for style/notation: `thesis/ExplainCircPaper(27012026)_WPdB_TA_WvM.docx`
(+ working copy with AI-parameterization additions). Insert-ready source blocks:
`thesis/circ-paper-additions.md`.

---

## S1. Notation and units (match cardiovascular paper Table 1)

| Quantity | Symbol | Unit |
|---|---|---|
| Time (continuous) | *t* | s |
| Cardiac / breath cycle index | *n* | — |
| Model step size | Δt | s (default 0.0005 s) |
| Volume | *V* | L |
| Unstressed (dead) volume | *V*ᵤ (`u_vol`) | L |
| Pressure | *P* | mmHg |
| Elastance | *E* (`el`) | mmHg·L⁻¹ |
| Resistance | *R* (`r`) | mmHg·s·L⁻¹ |
| Flow | *f* | L·s⁻¹ |
| Gas partial pressure | *P*g | mmHg |
| Gas fraction / concentration | *F*, *c* | fraction, mmol·L⁻¹ |
| O₂ / CO₂ blood content | *t*O₂, *t*CO₂ | mmol·L⁻¹ |
| Diffusion constant | *D* (`dif_*`) | mmol·mmHg⁻¹·s⁻¹ |
| Temperature | *T* | °C |

Compartment abbreviations (LA, LV, RA, RV, AA, PA, DS, ALV, …) are uppercase and defined at
first use and in each figure caption, as in the cardiovascular paper. Equations are numbered
per paper; the cardiovascular paper uses 1–15 (12 model + 3 AI-parameterization), so
companion papers start their own sequence.

---

## S2. The factor / effective-value pattern (the composability substrate)

Source: `docs/engine/ARCHITECTURE.md §7a`; `explain/base_models/{Capacitance,Resistor}.js`.

Every tunable physical parameter *p* (elastances, resistances, unstressed volumes, diffusion
constants, …) is never used raw. Its **effective value** *p*_eff combines the base value with
three multiplicative layers, each entering **additively** relative to the base:

> **(S1)**  *p*_eff = *p* + (*k* − 1)·*p* + (*k*ₚ − 1)·*p* + (*k*ₛ − 1)·*p*
> = *p* · (*k* + *k*ₚ + *k*ₛ − 2)

where
- *k* (`<p>_factor`) — **non-persistent**; reset to 1.0 at the end of every step. Carries
  transient interventions.
- *k*ₚ (`<p>_factor_ps`) — **persistent**; user/scenario adjustments (survives steps).
- *k*ₛ (scaling layer) — **persistent**; written **only** by the allometric scaler
  (`ModelScaler`), never by the user layer.

This three-layer decomposition is what lets a scenario, a transient intervention, an
allometric body-size scaling, and an AI-driven calibration step all act on the same
parameter **without overwriting one another** — the property that the parameterization
method (companion "AI parameterization" paper) exploits: calibration writes the *k*ₚ layer
and composes on top of whatever *k*ₛ scaling a patient was built with.

**Caveat on the scaling-layer name (verify before citing):** the capacitance / resistor /
time-varying-elastance family names the scaling layer `*_factor_scaling_ps`, whereas the
diffusor / exchanger family (`GasExchanger`, `GasDiffusor`, `BloodDiffusor`) names it
`*_factor_scaling` (no `_ps`). Same role in Eq. (S1); different suffix.

---

## S3. Composition transport by advective mixing (no global solver)

Source: `docs/engine/ARCHITECTURE.md §7c`; `explain/component_models/BloodCapacitance.js`.

There is no global transport solver. Substances ride the volume flow. When a resistor moves
a volume Δ*V* from compartment *A* into compartment *B*, *B* updates each carried
concentration *c* by the incoming-volume fraction:

> **(S2)**  *c* ← *c* + (*c*ₐ − *c*)·Δ*V* / *V*

applied to *t*O₂, *t*CO₂, every strong-ion/solute, every drug, and to temperature and
viscosity (treated as solutes). Gas compartments propagate analogously via partial-
pressure-driven diffusion (companion respiratory paper). Eq. (S2) is how blood gases,
electrolytes, drugs and heat distribute through the circuit as a consequence of flow.

---

## S4. Cycle counters live on the engine object

Source: `docs/engine/ARCHITECTURE.md §7b`. Cardiac, breathing and ventilator timing use
integer counters held on the engine `model` object, not on the components:
`ncc_atrial`, `ncc_ventricular`, `ncc_breathing_insp/exp`, `ncc_ventilator_insp/exp`. The
`Heart`, `Breathing` and `Ventilator` models read/advance them through the shared engine
reference, which is how the cardiac, spontaneous-breathing and mechanical-ventilation cycles
stay phase-locked to a single clock.

---

## S5. Software implementation (reuse verbatim; from circ-paper Block E)

> EXPLAIN is implemented as a framework-agnostic simulation engine written in
> JavaScript/TypeScript. The engine runs inside a Web Worker — a background execution thread
> separate from the user interface — and communicates with the application through a simple
> message-passing protocol, so that the physics loop advances independently of rendering and
> user interaction and the model can run in real time in a standard web browser. Each
> physiological component is a small, self-contained module that implements the equations of
> the Methods; complete scenarios (baseline anatomy, parameters and initial state) are
> defined declaratively as JSON model definitions, which makes patient profiles and
> structural variants straightforward to inspect, share and modify. The interactive
> application, built on the Vue framework, presents the animated model, parameter editors and
> clinical monitors, and is freely available at https://explain-modeling.com. The engine source
> code is extensively annotated and available upon request.

Structure of one step (all papers): each model's `step_model()` runs in insertion order
(gated on `is_enabled` and initialization), executing its `calc_model()`; a data collector
then samples watched signals, deferred tasks run, and model time advances by Δt. `calc(s)`
runs *s*/Δt steps synchronously; real-time mode batches steps on a wall-clock interval.

---

## S6. AI-parameterization cross-reference (short pointer for companion papers)

Each companion paper carries **one short paragraph** pointing to the dedicated
AI-parameterization paper, plus its own lever rows (the targets its models drive). Do **not**
restate the full method. Seed text:

> Patient-specific parameter values in EXPLAIN are not tuned by hand but are set by an
> AI-assisted, closed-loop calibration pipeline described in [companion paper / Section]: a
> large language model interprets the available clinical targets and emits a validated
> specification, and a deterministic calibrator drives one physiologically interpretable
> lever per target to within a clinician-meaningful tolerance. For the models of this paper
> the relevant levers are [list], which set [targets] (see Table X of the cardiovascular
> paper for the full lever set).

Respiratory / acid–base levers to list where relevant (from `explain/helpers/Calibrator.js`):
alveolar O₂ diffusion `dif_o2` → PO₂ / SpO₂ (+); central ventilatory drive
`minute_volume_ref` → PCO₂ (−); Stewart unmeasured anions `uma` → base excess / pH (−).

---

## S7. Reproducibility / verification convention (all papers)

Every quantitative claim in Results is reproduced from the engine, not asserted: the headless
harness (`scripts/_harness.mjs`, `scripts/headless.mjs`) loads a scenario and advances it;
`scripts/probe_*.mjs` scripts drive a specific intervention and print the measured response.
Each figure/number cites the script that produced it. Equations in the Methods are transcribed
from and checked against the named source file before being stated.
