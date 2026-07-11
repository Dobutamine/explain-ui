# AI-assisted parameterization of a mechanistic neonatal physiology model

*Fourth paper in the EXPLAIN series (companion to the cardiovascular, respiratory and
other-systems papers). Target journal: Pediatric Research. Markdown working draft — equations to be
re-keyed as native Word (OMML) objects. Every algorithmic claim is transcribed from and checked
against the implementation: `explain/helpers/Calibrator.js` (the shared closed-loop calibrator),
`scripts/build_patient.mjs` (offline patient construction), `explain/ModelEngine.js` `tune_model`
(live in-place tuning), and `src/services/botCommands.ts` / `botCommandAllowlist.ts` /
`bot-host/api.py` (the LLM command pipeline). The condensed form of this method already appears as
§2.4 of the cardiovascular paper (Eqs. 13–15, Table X); this paper is its full treatment.*

---

## Abstract

*(Draft — tighten to journal word limit.)*

Lumped-parameter models of physiology expose many free parameters but are constrained by only a
handful of directly measured clinical quantities, so fitting such a model to an individual patient
has traditionally required slow, irreproducible expert hand-tuning — a central obstacle to their
clinical use. We describe the method by which EXPLAIN, a real-time whole-body neonatal physiology
simulator, is parameterized for an individual patient. The method separates two roles that are
usually conflated. An interpretation layer — a large language model (Claude, driven through the
Claude Agent SDK) — reads the available clinical description (free text, monitor values or an
attached report) and emits a validated, machine-checkable specification of a baseline scenario, a
set of target values and named pathophysiological modifiers, expressed entirely as commands drawn
from a fixed allowlist and checked against the same parameter schema, unit conversions and
physiological bounds as the interactive editor; it never edits equations or state directly. A
deterministic calibration layer then fits the mechanistic model to those targets by assigning one
physiologically interpretable lever to each measured quantity and driving that quantity to its
target with a per-target one-dimensional root-finder — a proportional seed followed by the secant
method — run together in a relaxation loop that advances the model to steady state, measures each
quantity as a beat-averaged mean, nudges every lever and repeats until all residuals fall within
clinician-meaningful tolerances. Body size is handled first by allometric scaling, gestational-age
seeds place the model near the target before iteration, and the baroreflex set-point is aligned to
the target mean arterial pressure so the model's own control loops defend rather than oppose the
calibrated operating point. The same calibrator serves both offline construction of a new,
fully calibrated patient and live in-place retuning of a running simulation. We show that the
method converges to within tolerance for representative neonatal and preterm targets, and we discuss
the conditions under which convergence of strongly coupled targets is and is not guaranteed. By
turning an ill-posed high-dimensional inverse problem into a set of well-posed one-dimensional
root-finds chosen to respect the model's active regulation, and by delegating only interpretation —
never numerical adjustment — to the language model, the method makes patient-specific instantiation
both rapid and reproducible.

---

## 1. Introduction

Mechanistic, lumped-parameter models represent the circulation, the respiratory system and their
regulation as networks of compartments whose behaviour is governed by physical parameters —
elastances, resistances, unstressed volumes, diffusion constants, shunt geometries. Such models are
valued precisely because their parameters are interpretable: each corresponds to a physiological
property a clinician can reason about. But this interpretability comes with a well-known cost. A
whole-body neonatal model of the kind described in the companion papers has of order a hundred
components and several hundred free parameters, while the clinic supplies only a handful of directly
measured quantities for any given patient — typically a heart rate, a mean arterial pressure, a
central venous pressure, a cardiac output or its surrogate, an oxygen saturation and an arterial
blood gas. Fitting the model to a patient is therefore a severely underdetermined inverse problem:
many parameter combinations reproduce the same few measurements, and most of the parameter space is
unconstrained by data.

The conventional remedy is expert hand-tuning. A modeller who knows the system adjusts parameters by
trial and error until the simulated monitor matches the clinical picture. This works, but it is slow,
it is difficult to reproduce, it is hard to audit, and it scales poorly — every new patient is a
fresh manual fitting exercise. The difficulty of parameterization has been a persistent barrier to
using lumped-parameter models at the bedside, where an individualized model would have to be
produced quickly and reliably from the data at hand.

This paper describes how EXPLAIN addresses that barrier. The method rests on two observations. First,
although the full inverse problem is ill-posed, much of the modeller's expertise can be encoded as a
structural fact about the model: for each clinically measured quantity there is usually one dominant,
monotone parameter — one lever — that is the natural controller of that quantity, provided the lever
is chosen to act with, rather than against, the model's own active control loops. Choosing that
observable-to-controllable pairing turns the coupled high-dimensional fit into a set of nearly
independent one-dimensional root-finding problems, each solvable by a robust, derivative-free
numerical method. Second, the part of the task that genuinely requires judgement — reading a messy
clinical description and deciding what the targets and the pathophysiology are — is exactly what a
modern large language model does well, and is exactly the part that should never be allowed to touch
the model's equations or state directly.

EXPLAIN accordingly parameterizes a patient with a two-layer pipeline. An interpretation layer, a
large language model, translates the available clinical information into a validated, bounded
specification. A deterministic calibration layer fits the mechanistic model to that specification by
a closed-loop, one-lever-per-target root-finder. The two roles are strictly separated: the language
model performs no numerical fitting, and the calibrator performs no interpretation. The same
calibrator supports both the offline construction of a new, fully calibrated patient scenario and the
live retuning of an already-running simulation to new targets. In what follows we state the problem
precisely (Section 2.2), describe the interpretation layer (Section 2.3) and the calibration layer
(Section 2.4), and demonstrate convergence on representative neonatal targets (Section 3).

---

## 2. Methods

### 2.1 Overview

The pipeline has two layers with a single, narrow interface between them: a **specification** — a
baseline scenario, a set of target values *x\** for named measured quantities, optional
pathophysiological modifiers, and optional per-target tolerances. The **interpretation layer** (a
large language model) produces the specification from clinical inputs; the **calibration layer** (a
deterministic root-finder) consumes it and fits the mechanistic model. Because the interface is an
explicit, machine-checkable object rather than a stream of parameter writes, every action the
language model can take is validated against the same schema, unit conversions and physiological
bounds as a manual edit in the interactive application, and the calibrator receives only clean
numerical targets. The composability substrate that makes this possible — the three-layer
effective-value decomposition of every physical parameter — is shared with the other papers in the
series and summarized in Eq. 1.

**Eq. 1** (effective-value composition; see shared Methods S2). Every physical parameter *p* is used
through an effective value

> *p*_eff = *p* + (*k* − 1)·*p* + (*k*ₚ − 1)·*p* + (*k*ₛ − 1)·*p*

with a non-persistent layer *k* (transient interventions), a persistent user/scenario layer *k*ₚ, and
a scaling layer *k*ₛ written only by the allometric scaler. Calibration writes the persistent layer
*k*ₚ (or, offline, the scaling layer through the scaler), so that a calibration step composes on top
of — rather than overwrites — whatever body-size or pathophysiological scaling a patient already
carries. This is what allows the live tuner to retune a loaded, already-scaled patient without
discarding its scaling.

### 2.2 Problem statement

Let the model have a parameter vector **p** and let **x**(**p**) be the vector of measured quantities
the model produces at steady state (mean arterial pressure, cardiac output, and so on). Given a small
set of target values **x\*** for a subset of these quantities, patient-specific parameterization is
the inverse problem of finding **p** such that **x**(**p**) = **x\*** to within tolerance. With
dim(**p**) ≫ dim(**x\***) the problem is underdetermined and, because the compartments interact
through the shared circulation, the map **x**(**p**) is nonlinear and coupled.

The method makes the problem tractable by imposing structure a priori. For each target quantity
*x*ᵢ it designates a single lever *l*ᵢ — one scalar parameter (or a coordinated group of parameters,
such as left and right ventricular contractility) — chosen so that *x*ᵢ is a dominant, monotone
function of *l*ᵢ in the operating region, with a known sign *s*ᵢ = ±1 (Table 1). Crucially, the lever
is chosen to respect the model's active control loops rather than to fight them: for example, arterial
carbon dioxide is driven by the central ventilatory drive and not by alveolar diffusion, because the
chemoreflex defends a carbon-dioxide set-point and would otherwise cancel any change made to
diffusion (Section 2.4.3). With this pairing the inverse problem reduces to a set of one-dimensional
root-finding problems, *f*ᵢ(*l*ᵢ) = *x*ᵢ(*l*ᵢ) − *x*ᵢ\* = 0, coupled only weakly through the shared
physiology, which the relaxation loop of Section 2.4.2 resolves.

### 2.3 Interpretation layer (large language model)

The interpretation layer is a large language model agent (Claude, Anthropic, driven through the
Claude Agent SDK). It reads the clinical description of the patient — free text, a list of monitor
values, or an attached report (PDF or CSV) — and produces the specification: a baseline scenario name,
a set of target values, named pathophysiological modifiers (for example a respiratory-distress
severity or a pulmonary-vascular-resistance scaling), and optional tolerance overrides. Structurally
this is a small JSON object (the `baseline`, `targets`, `pathophysiology` and `tolerance` fields of
the builder's specification schema).

Two properties make this safe to automate. First, every model-facing action the agent can emit is
drawn from a fixed allowlist of commands and is validated before execution against the *same*
parameter schema, unit conversions and physiological bounds used by the interactive parameter editor;
an automatically generated command therefore behaves exactly like a vetted manual edit, and the agent
cannot reach a parameter, or a value, that the interface itself would refuse. Second, the two entry
points the agent can invoke are deliberately coarse-grained and auditable: a **build** command, which
carries a full specification and constructs a new calibrated patient offline, and a **tune** command,
which carries a set of live targets and retunes the running model. The build command is executed as a
fixed subprocess invocation of the calibration builder with the specification supplied on standard
input — not as a shell string — with the baseline scenario name validated against a restrictive
pattern; the resulting calibrated scenario is returned to the application as an artifact and loaded.
The tune command is restricted to the canonical list of live-tunable targets and to numeric values,
and is gated to the application's full-control scope. The language model never edits an equation, a
state variable or a parameter directly; it only emits validated specifications and allowlisted
commands. All numerical fitting is done by the deterministic layer described next. (The use of the
language model as a component of the research method, not as an author or a generator of scientific
content, is disclosed in Section 2.5 in accordance with journal policy.)

### 2.4 Calibration layer (deterministic closed-loop root-finder)

#### 2.4.1 One-dimensional controllers

The calibrator assigns one controller to each target. A controller couples a lever *l* (a model
parameter, written through a setter that respects Eq. 1) to a measured quantity *x* read from the
monitor, and updates *l* to drive *x* toward its target *x\**. When fewer than two samples are
available the update is a proportional seed,

> **Eq. 2** &nbsp; *l*_{k+1} = clamp( *l*_k + *s*·*g*·(*x\** − *x*_k),  *l*_lo,  *l*_hi )

where *s* = ±1 is the known sign of the lever→measurement relationship, *g* a seed gain (in lever
units per measured unit) and [*l*_lo, *l*_hi] the lever's physiological bounds. Once two samples
(*l*_{k−1}, *x*_{k−1}) and (*l*_k, *x*_k) exist, the controller switches to the secant method — a
derivative-free quasi-Newton root-find in which the local sensitivity of the measurement to the lever
is estimated from the last two evaluations:

> **Eq. 3** &nbsp; *m*_k = (*x*_k − *x*_{k−1}) / (*l*_k − *l*_{k−1}),  &nbsp; *l*_{k+1} = clamp( *l*_k + (*x\** − *x*_k)/*m*_k,  *l*_lo,  *l*_hi )

A controller reports that it has converged, and makes no move, when its residual is within tolerance:

> **Eq. 4** &nbsp; | *x\** − *x*_k | ≤ τ

with τ a per-quantity, clinician-meaningful tolerance band (Table 2). Equations 2–4 are the
proportional-seed, secant and convergence rules that appear as Eqs. 13–15 of the cardiovascular
paper.

Measured quantities are read as short-window means to suppress the residual pulsatility of the
beat-averaged monitor:

> **Eq. 5** &nbsp; *x̄* = (1/N)·Σ_{i=1..N} *x*(*t*ᵢ),  &nbsp; N = window / Δt_s

sampled at a sub-cardiac-cycle step Δt_s = 0.02 s over a window of order ten seconds.

#### 2.4.2 The relaxation loop

The controllers are run together in a single loop. After any structural changes the model is first
advanced to steady state (a *settle* interval); then, on each iteration, every measured quantity is
read (Eq. 5), every controller nudges its lever (Eqs. 2–3), and the model is advanced again (a *warm*
interval) before the next measurement. Iteration stops when no controller moves — that is, when every
target satisfies Eq. 4 — or when a maximum iteration count is reached; a final undisturbed interval
then bakes the equilibrium state. Because all controllers act each iteration and the model is
re-measured between iterations, the coupled multi-target problem is solved by Gauss–Seidel–style
simultaneous relaxation: the per-controller secant slopes adapt to the couplings as the joint state
settles. Default intervals are longer for offline construction (settle 90 s, warm 45 s, up to 12
iterations, final bake 200 s) and shorter for live tuning (settle 20 s, warm 15 s, no final bake, so
the running simulation resumes promptly).

#### 2.4.3 Lever selection that respects the model's control loops

The observable-to-controllable pairing is hand-authored physiological knowledge, not something the
calibrator discovers. Each lever is the dominant monotone driver of one target, with a pre-specified
sign and seed gain, and — decisively — is chosen so that the model's own regulation defends the
calibrated point. Two cases make the principle concrete. Mean arterial pressure is driven by systemic
arteriolar resistance, but the baroreflex set-point is simultaneously aligned to the target pressure
(Section 2.4.4) so the autonomic loop does not oppose the fit. Arterial carbon dioxide is driven by
the central ventilatory drive, not by alveolar CO₂ diffusion: the chemoreflex regulates toward a
carbon-dioxide set-point, so a change in diffusion is fought back to baseline and only a change in
drive shifts the regulated steady state. The full pairing is given in Table 1.

**Table 1. Calibration levers.** Each measured target is driven to its value by a single lever, with
the sign of the lever→target relationship. Parameters are defined in the companion cardiovascular and
respiratory papers. The live tuner writes the composable persistent (`*_factor_ps`) or direct-setter
layer; the offline builder may instead use the allometric-scaler groups (Section 2.4.5).

| Target | Lever | Sign |
|---|---|:--:|
| Mean arterial pressure (MAP) | systemic (arteriolar) resistance | + |
| Cardiac output (CO) | ventricular contractility, E_max (LV, RV) | + |
| Heart rate (HR) | heart-rate reference (SA-node set-point) | + |
| Central venous pressure (CVP) | systemic venous unstressed volume (VLB, VUB) | − |
| Mean pulmonary artery pressure (PAP) | pulmonary vascular resistance | + |
| Arterial PO₂ / SpO₂ | alveolar O₂ diffusion (GASEX_LL, GASEX_RL) | + |
| Arterial PCO₂ | central ventilatory drive (minute-volume reference) | − |
| Base excess / pH | Stewart unmeasured strong anions (UMA) | − |
| Total blood volume | proportional rescale of all blood-compartment volumes | (direct) |

**Table 2. Default tolerance bands** (overridable per target).

| Quantity | Tolerance |
|---|---|
| MAP | ± 3 mmHg |
| CVP | ± 1.5 mmHg |
| Mean PAP | ± 3 mmHg |
| Heart rate | ± 6 min⁻¹ |
| Cardiac output | ± 0.03–0.05 L·min⁻¹ |
| SpO₂ | ± 2 % |
| PO₂ | ± 6 mmHg |
| PCO₂ | ± 4 mmHg |
| pH | ± 0.03 |
| Base excess | ± 1.5 mmol·L⁻¹ |
| Total blood volume | ± 2 % |

Total blood volume is handled by a non-secant controller: because the circulation redistributes an
injected or withdrawn volume and a fraction leaves the stressed compartment, each iteration simply
rescales every blood compartment's volume by the ratio of target to measured,

> **Eq. 6** &nbsp; *V*_j ← *V*_j · (*x\** / *x̄*),  &nbsp; *V*ᵤ,j ← *V*ᵤ,j · (*x\** / *x̄*)

which converges in one or two iterations.

#### 2.4.4 Structural seeding and set-point alignment

Two preparatory steps, applied once before iteration, keep the joint problem well conditioned. First,
body-size differences are removed by allometric scaling: blood volumes, elastances and resistances are
scaled to the target weight in a single structural pass (the scaler writes only the *k*ₛ layer of
Eq. 1). Second, for a preterm patient a gestational-age–indexed seed table sets the starting lever
values and the associated structural features — reduced contractility, stiffer diastole, immature
lung mechanics (raised alveolar elastance, lowered functional residual capacity, reduced diffusion),
intrapulmonary shunt and ductal patency — so that calibration begins near the target manifold rather
than at the term baseline. A named respiratory-distress modifier applies an analogous lung-stiffness/
FRC/diffusion/shunt bundle. Finally, the baroreflex arterial-pressure set-point is aligned to the
requested mean arterial pressure, so that the autonomic control loop of the cardiovascular model
defends — rather than opposes — the calibrated operating point. The iterative controllers of
Section 2.4.1 then resolve only the residual mismatch.

#### 2.4.5 Two entry points

The same calibrator serves two uses. **Offline patient construction** starts from a fresh baseline,
applies the structural pass and the iterative controllers, bakes the converged equilibrium state, and
emits a complete, runnable scenario that the application loads immediately; because it starts from a
clean baseline it may drive the size/resistance levers through the allometric-scaler groups. **Live
in-place tuning** drives an already-running simulation to new targets without a reload: it pauses the
real-time clock, runs the same relaxation loop synchronously against the live model, and resumes from
the new operating point. The live path deliberately uses the composable persistent (`*_factor_ps`) and
direct-setter levers rather than the scaler groups, because the scaler sets its layer absolutely and
would overwrite the body-size and pathophysiological scaling already baked into the loaded patient;
writing the persistent layer instead (Eq. 1) makes each tuning step compose on top of that scaling.
Because the levers interact through the shared circulation (blood volume, venous tone and MAP, or
contractility and CO), convergence of the joint problem is not guaranteed for arbitrary target
combinations; in practice the physiological seeds and set-point alignment of the construction path
keep the joint problem well conditioned (Section 4).

### 2.5 Software implementation, reproducibility and AI disclosure

The calibrator is a single environment-agnostic module shared by both entry points; each caller
injects a callback to advance the model and a callback to read the averaged vitals, so the loop itself
is identical offline and live. The offline builder runs headlessly in Node; the live tuner runs inside
the simulation Web Worker (shared Methods S5). The full pipeline — the specification schema, the
command allowlist and the subprocess invocation of the builder — is described above and is reproduced
by the scripts named at the head of this paper.

**Use of AI in this study.** A large language model (Claude, Anthropic) is used as a component of the
parameterization *method*: it interprets clinical inputs and emits validated, allowlisted
specifications and commands. It does not modify the model's equations or state, it performs no
numerical fitting, and it is not used to generate the scientific content or text of this study. No
authorship is attributed to the AI. This disclosure is provided in the Methods in accordance with the
journal's policy on the use of AI tools in research methods.

---

## 3. Results

A calibrated patient was constructed offline from the term-neonate baseline with the specification
`{ weight: 1.0 kg, gestational age: 28 wk, HR: 152 min⁻¹, MAP: 33 mmHg, CO: 0.30 L·min⁻¹, SpO₂:
90 %, PCO₂: 52 mmHg }` (`scripts/build_patient.mjs`). The trace and residuals below are the actual
output of that run.

### 3.1 Convergence of a preterm construction

The structural pass first scaled the model allometrically to 1.0 kg, applied the 28-week seed
(immature lung mechanics — alveolar elastance ×3, functional residual capacity ×0.5, diffusion ×0.45
— a patent ductus, and reduced contractility/stiffer diastole), and aligned the baroreflex set-point
to the target MAP of 33 mmHg. The five iterative controllers (HR, MAP, CO, SpO₂, PCO₂) then converged
in two iterations. The per-iteration trace, each target shown as measured/target with ✓ when within
tolerance, was:

```
iter 0:  map 29.4/33    hr 178.8/152    co 0.27/0.30 ✓   spo2 91.7/90 ✓   pco2 40.5/52
iter 1:  map 30.2/33 ✓  hr 148.5/152 ✓  co 0.27/0.30 ✓   spo2 91.4/90 ✓   pco2 42.4/52
iter 2:  map 30.2/33 ✓  hr 148.5/152 ✓  co 0.27/0.30 ✓   spo2 89.5/90 ✓   pco2 51.9/52 ✓
→ converged at iteration 2 — all targets within tolerance
```

Two features of the trace illustrate the method. The seed placed cardiac output, SpO₂ and (nearly)
heart rate within tolerance from the first measurement, so those controllers had little to do;
carbon dioxide, which starts far from its target because ventilatory drive was not seeded, was
carried from 40.5 to 51.9 mmHg over the two iterations by the drive lever — precisely the lever
chosen to shift the chemoreflex-regulated set-point (Section 2.4.3). All targets were met within
their tolerance bands (Table 3), and the untargeted vitals — central venous pressure 0.9 mmHg, mean
pulmonary artery pressure 19.8 mmHg, arterial PO₂ 55.9 mmHg, pH 7.25 and base excess −5.4 mmol·L⁻¹ —
all fell within the 28-week preterm reference ranges, confirming that fitting the specified targets
did not push the unspecified quantities out of range.

**Table 3. Worked-example convergence** (28-week, 1.0 kg preterm construction; `build_patient.mjs`).

| Target | Value | Achieved | Δ | Within tol. |
|---|---|---|---|:--:|
| Heart rate (min⁻¹) | 152 | 148.5 | −3.5 | ✓ (±6) |
| MAP (mmHg) | 33 | 30.2 | −2.8 | ✓ (±3) |
| Cardiac output (L·min⁻¹) | 0.30 | 0.27 | −0.03 | ✓ (±0.05) |
| SpO₂ (%) | 90 | 90.0 | 0.0 | ✓ (±2) |
| PCO₂ (mmHg) | 52 | 52.7 | +0.7 | ✓ (±4) |

### 3.2 Live retuning of a running patient

The same calibrator retunes an already-running simulation in place, composing on top of the loaded
model without a reload and without resetting its scaling layer (`scripts/probe_tune.mjs`, which
drives the identical worker-side path). Starting from the running term-neonate baseline (HR 131
min⁻¹, SpO₂ 97 %, PCO₂ 40 mmHg), a live tune to HR 150 min⁻¹, SpO₂ 92 % and PCO₂ 48 mmHg — a heart
rate, an oxygenation and a ventilation lever acting on three different subsystems — converged in
three iterations:

```
iter 0:  hr 130.9/150    spo2 96.9/92     pco2 39.8/48
iter 1:  hr 142.5/150    spo2 96.5/92     pco2 41.4/48
iter 2:  hr 150.3/150 ✓  spo2 86.8/92     pco2 44.1/48 ✓
iter 3:  hr 150.5/150 ✓  spo2 91.7/92 ✓   pco2 50.1/48 ✓
→ converged at iteration 3  (HR 151.2, Δ +1.2; SpO₂ 91.3, Δ −0.7; PCO₂ 50.2, Δ +2.2 — all within tolerance)
```

The heart-rate set-point lever reached its target immediately, and the diffusion and drive levers
were carried to their targets by the secant updates over the following iterations, with the model
re-equilibrating between each. This retune used the composable persistent (`*_factor_ps`) and
direct-setter levers, so the adjustments stacked on the loaded patient's state rather than replacing
it — the property that lets the live path resume the running simulation from the new operating point.

The live MAP lever is bidirectional: because it drives systemic resistance through the persistent
vessel layer (which composes with, rather than being overwritten by, the model's humoral and
autonomic contributions to the same layer) and simultaneously aligns the baroreflex set-point to the
target (Section 2.4.4), a live tune converges whether MAP must rise or fall — for example a lone
target of 72 mmHg converged in one iteration and a target of 50 mmHg (below the baseline of 59 mmHg)
in two, and a feasible joint MAP + cardiac-output tune converged in two iterations.

**On coupled and infeasible targets.** Not every target combination converges, and the calibrator
reports rather than masks this (Section 4.3). The clearest case is physiological infeasibility: when
cardiac output is targeted well above baseline through the contractility lever alone, it plateaus
below the target, because raising contractility raises afterload and cardiac output is ultimately
preload-limited — a single contractility lever cannot drive output to an arbitrary value. More
generally, because the levers interact through the shared circulation (systemic resistance affects
both MAP and, through afterload, cardiac output; contractility affects both cardiac output and MAP), a
pair of strongly coupled targets can make the decoupled per-lever secant oscillate rather than
converge. These are limitations of infeasible or strongly coupled targets, not of the calibration
loop itself, and are the subject of the sensitivity-analysis and joint-optimization future work
(Section 4.4).

---

## 4. Discussion

### 4.1 Originality

The contribution is a parameterization method for mechanistic physiological models that is at once
automated and disciplined. Its novelty lies less in either layer alone than in their separation and
in the structure imposed between them. The numerical core is a standard, robust idea — a bank of
one-dimensional secant root-finders with proportional seeding and box constraints — but the leverage
comes from the encoded physiology around it: the choice of one dominant, monotone lever per target,
selected to act with the model's active control loops rather than against them, which converts an
ill-posed high-dimensional inverse problem into a set of well-posed one-dimensional problems. The
language model contributes exactly the capability the numerical layer lacks — interpreting an
unstructured clinical description into targets and pathophysiology — while being prevented, by
construction, from touching the model's equations or state. Because every automated action passes
through the same bounded, schema-checked interface as a manual edit, patient-specific instantiation
becomes both fast and reproducible, which is the property that has been missing from hand-tuned
lumped-parameter models.

### 4.2 Validity and convergence

The worked example (Section 3) shows the method driving a multi-target preterm construction to within
clinician-meaningful tolerances, with the untargeted vitals remaining physiological. The structural
seeding is what makes this reliable: by placing the model near the target manifold before iteration
and aligning the baroreflex set-point to the target pressure, it presents the iterative controllers
with a nearly decoupled, nearly linear residual problem, which the secant method resolves in few
iterations. Convergence is declared when no controller moves, and per-target success is defined by the
tolerance bands of Table 2, so a converged fit is one in which every specified quantity is
clinically indistinguishable from its target.

### 4.3 Limitations

The method does not guarantee convergence for arbitrary target combinations. The levers interact
through the shared circulation — blood volume, venous tone and mean arterial pressure are coupled, as
are contractility and cardiac output — so a set of mutually inconsistent targets, or targets far from
any physiological operating point, may leave one or more residuals outside tolerance; the calibrator
reports this rather than masking it. The pairing is one lever per target, which is deliberately simple
and interpretable but cannot exploit the full Jacobian of the coupled system; strongly coupled or
conflicting specifications would be better served by a joint multi-target optimizer (Section 4.4). The
seed tables are specific to the neonatal and preterm range for which they were built. And the secant
slope estimate, like any finite-difference derivative, can be poorly conditioned if two successive
lever values produce nearly identical measurements, which the bounds and the proportional-seed
fallback mitigate but do not eliminate.

### 4.4 Future work

Several extensions follow. A systematic sensitivity analysis would identify, for each target, the
most informative lever and the operating regions where the one-lever-per-target assumption is
weakest. Calibration could then be extended from the present decoupled scheme to a joint multi-target
optimization for the strongly coupled configurations where cross-effects dominate, for example by
estimating the local multi-input Jacobian rather than per-lever slopes. On the interpretation side,
the specifications the language model produces could be validated against a broader range of source
formats and against inter-rater agreement with clinicians. Finally, prospective validation — fitting
the model to real patients from their bedside data and testing the fit against subsequently observed
physiology — would establish the clinical accuracy of the individualized models the pipeline produces.

---

## Conclusion

Parameterizing a lumped-parameter physiological model for an individual patient has long required slow
and irreproducible hand-tuning. EXPLAIN replaces this with an AI-assisted, closed-loop pipeline in
which a large language model interprets the available clinical targets into a validated specification
and a deterministic calibrator drives the mechanistic model onto those targets by a bank of
one-dimensional secant root-finders — one physiologically interpretable lever per target, chosen to
respect the model's own regulation, seeded near the target by allometric and gestational-age scaling.
By separating interpretation from numerical fitting and confining every automated adjustment to the
same bounds as a manual edit, the method makes patient-specific instantiation of a mechanistic model
rapid, auditable and reproducible, and supports both offline construction of new patients and live
retuning of running simulations.

---

## References

See `articles/_references.md`. Core citations for this paper: Anthropic Claude (large language model)
and the Claude Agent SDK (software); Burden & Faires or van Meurs for the secant/root-finding method;
the cardiovascular and respiratory companion papers for the model and lever definitions. Reuse the
already-drafted software/AI citations of `articles/circ-paper-additions.md` Block G, and confirm the
exact Claude model/version and access date, and the AI-disclosure placement, against the journal's
current policy before submission.
