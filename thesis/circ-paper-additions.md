# EXPLAIN cardiovascular paper — insert-ready additions

**Purpose.** These are drop-in content blocks for the master manuscript
`thesis/ExplainCircPaper(27012026)_WPdB_TA_WvM.docx`. Each block names its exact
target location in the paper and whether it is an **insert** or a **replacement**.
The `.docx` remains the master — paste these into Word and re-key the equations as
native (OMML) objects, matching the style of Eqs. 1–12. New references (Block G) are
given as EndNote-ready strings; renumber to follow the existing 23.

Every quantitative claim below (tolerances, lever→target mappings, the seed/secant
update rules, the structural-pass steps, the two entry points) is taken directly from
the implementation:
- `explain/helpers/Calibrator.js` — the shared closed-loop calibrator (controllers, `runCalibration`, `DEFAULT_TOL`, live levers).
- `scripts/build_patient.mjs` — offline patient construction (SPEC schema, structural pass, offline levers, `BR_MAP.set_value = MAP_target`).
- `explain/ModelEngine.js` (`tune_model`) — live in-place tuning.
- `src/services/botCommands.ts`, `src/services/botCommandAllowlist.ts`, `bot-host/api.py` — the LLM command/validation pipeline.
- `docs/engine/Calibrator.md` — authoritative prose reference (incl. caveats).

A worked convergence example (real output) is included in Block A's callout and can
seed a supplementary table/figure.

---

## Block A — NEW Methods subsection §2.4 (insert immediately after §2.3)

> **2.4 AI-assisted patient-specific parameterization**
>
> A recurring difficulty with lumped-parameter cardiovascular models is that they
> expose many free parameters (elastances, resistances, unstressed volumes, shunt
> geometry) while the clinic provides only a handful of directly measured targets —
> typically heart rate (HR), mean arterial pressure (MAP), central venous pressure
> (CVP), mean pulmonary artery pressure (PAP), cardiac output (CO), arterial oxygen
> saturation (SpO₂) and an arterial blood gas. To instantiate EXPLAIN for an
> individual patient we therefore combine a large language model (LLM), which
> interprets the clinical inputs, with a deterministic closed-loop calibrator, which
> fits the mechanistic model to the resulting targets. The two roles are strictly
> separated: the LLM never edits equations or state directly, and the calibrator
> performs no interpretation.
>
> **Interpretation layer.** An LLM agent (Claude, Anthropic; driven through the Claude
> Agent SDK) reads the case description — free text, monitor values, or an attached
> report (PDF/CSV) — and emits a structured build specification: a baseline scenario
> plus a set of target values and named pathophysiological modifiers. All model-facing
> actions are expressed as validated commands drawn from a fixed allowlist, checked
> against the *same* parameter schema, unit conversions and physiological bounds used
> by the interactive editor. An automatically generated command behaves exactly like a
> vetted manual edit, and the agent cannot reach a parameter the interface itself would
> refuse.
>
> **Calibration layer.** Given the targets, the calibrator assigns one physiologically
> interpretable lever to each measured quantity (Table X) and drives that quantity to
> its target with a per-target one-dimensional root-finder. The lever value *l* is
> updated from the measured value *x* toward the target *x\**. Before two samples exist
> the update is a proportional seed,
>
> > **Eq. 13** &nbsp; l₍ₖ₊₁₎ = clamp( lₖ + s · g · (x\* − xₖ) , l₍lo₎ , l₍hi₎ )
>
> where *s* = ±1 is the sign of the lever→measurement relationship and *g* a seed gain.
> Once two samples are available the calibrator switches to the secant method,
>
> > **Eq. 14** &nbsp; mₖ = (xₖ − x₍ₖ₋₁₎) / (lₖ − l₍ₖ₋₁₎) , &nbsp; l₍ₖ₊₁₎ = clamp( lₖ + (x\* − xₖ) / mₖ , l₍lo₎ , l₍hi₎ )
>
> in which *mₖ* is the locally estimated sensitivity of the measurement to the lever.
> Each lever is bounded to a physiological interval [l₍lo₎, l₍hi₎]. The levers are run
> together inside one loop: the model is advanced to steady state (settle), every
> measured quantity is read as a beat-averaged mean over a short window, each lever is
> nudged, and the model is advanced again (warm) before re-measuring. Iteration stops
> when no lever moves — i.e. when every target satisfies the convergence criterion
>
> > **Eq. 15** &nbsp; | x\* − xₖ | ≤ τ
>
> with τ a clinician-meaningful tolerance band per quantity (MAP ±3 mmHg, CVP ±1.5
> mmHg, mean PAP ±3 mmHg, HR ±6 min⁻¹, CO ±0.05 L·min⁻¹, SpO₂ ±2 %, PO₂ ±6 mmHg, PCO₂
> ±4 mmHg, pH ±0.03, base excess ±1.5 mmol·L⁻¹). A final undisturbed interval bakes the
> equilibrium state.
>
> **Levers.** For the cardiovascular targets each lever acts on a parameter already
> defined in Sections 2.1–2.2: MAP is driven by systemic (arteriolar) resistance; CO by
> ventricular maximum elastance (contractility, Eₘₐₓ); HR by the heart-rate reference of
> the cardiac-rhythm model; CVP by systemic venous unstressed volume; and mean PAP by
> pulmonary vascular resistance. Blood-gas targets are handled by the corresponding
> respiratory and acid–base levers (alveolar O₂ diffusion for PO₂/SpO₂; central
> ventilatory drive for PCO₂; Stewart unmeasured strong-ion difference for base excess
> and pH) and are described with those models in the companion papers.
>
> **Body size and initial guess.** Body-size differences are handled first, once, by
> allometric scaling of blood volumes, elastances and resistances to the target weight.
> For preterm patients a gestational-age–indexed seed sets the starting lever values
> (and structural features such as reduced contractility, stiffer diastole, lung
> immaturity and ductal patency) so that calibration begins close to convergence. The
> iterative levers above then resolve the residual mismatch. Crucially, the baroreflex
> arterial-pressure set-point is aligned to the requested MAP, so that the autonomic
> control loop of Sections 2.1–2.2 defends — rather than opposes — the calibrated
> operating point.
>
> **Two entry points.** The same calibrator serves (i) offline *patient construction*,
> which builds and bakes a new, fully calibrated scenario that the application loads
> immediately, and (ii) live *in-place tuning*, which drives an already-running
> simulation to new targets without a reload. The live path deliberately uses composable,
> persistent multiplier levers so that a tuning step stacks on top of any body-size or
> pathophysiological scaling already baked into the loaded patient rather than
> overwriting it. Because the levers interact through the shared circulation (for
> example blood volume, venous tone and MAP, or contractility and CO), convergence of
> the joint problem is not guaranteed for arbitrary target combinations; in practice the
> physiological seeds and set-point alignment of the construction path keep the joint
> problem well conditioned.

> **[Callout for reviewers — worked example (real output; move to Results/Supplement or
> drop as preferred).]** Constructing a 1.0 kg, 28-week preterm patient from the term
> baseline with targets HR = 152 min⁻¹, MAP = 33 mmHg and CO = 0.30 L·min⁻¹, the pipeline
> converged in a single iteration with all targets within tolerance (final HR 148,
> Δ −3.6; MAP 30.3, Δ −2.7; CO within band), and the untargeted vitals (CVP 0.8 mmHg,
> mean PAP 20 mmHg, SpO₂ 92 %, pH 7.36, base excess −3.2) fell within the preterm normal
> reference ranges.

**Also add Table X (new), placed with §2.4:**

> **Table X. Calibration levers.** Each measured cardiovascular target is driven to its
> value by a single physiologically interpretable lever (parameters defined in Sections
> 2.1–2.2). Sign indicates the direction of the lever→target relationship.
>
> | Target | Lever | Sign |
> |---|---|:--:|
> | Mean arterial pressure (MAP) | systemic (arteriolar) resistance | + |
> | Cardiac output (CO) | ventricular contractility, Eₘₐₓ | + |
> | Heart rate (HR) | heart-rate reference (SA-node rate) | + |
> | Central venous pressure (CVP) | systemic venous unstressed volume | − |
> | Mean pulmonary artery pressure (PAP) | pulmonary vascular resistance | + |
> | PO₂ / SpO₂ | alveolar O₂ diffusion | + |
> | PCO₂ | central ventilatory drive | − |
> | Base excess / pH | Stewart unmeasured anions | − |

---

## Block B — Abstract (insert one–two sentences; suggested placement after the
"multiple neonatal-specific features" sentence, before the demonstration sentence)

> To instantiate the model for an individual patient, EXPLAIN is parameterized by an
> AI-assisted, closed-loop pipeline in which a large language model interprets the
> available clinical targets and a deterministic calibrator fits the mechanistic model
> to within clinician-meaningful tolerances; this pipeline was used to generate the
> patient-specific configurations validated here.

---

## Block C — Introduction (insert one sentence near the end of the introduction,
after "…validated at baseline, and for the PDA and aPH conditions.")

> A second contribution is a method for patient-specific parameterization of the model:
> an AI-assisted, closed-loop calibration pipeline that maps a small set of measured
> clinical targets onto the model's parameters, and which we use to construct the
> validation cases presented below.

---

## Block D — Results reframe (replacements; keep every reported number unchanged)

**D1 — §3.1.2 (PDA).** Replace the sentence:

> ~~EXPLAIN's model parameters were rescaled to match the baseline premature infant
> physiology reported by Bischoff et al. by adjusting blood volume, unstressed volumes,
> elastances, and resistances proportional to weight, with minor additional tuning of
> arterial resistances.~~

with:

> The baseline premature-infant configuration reported by Bischoff et al. was produced
> with the AI-assisted closed-loop parameterization pipeline of Section 2.4: blood
> volumes, unstressed volumes, elastances and resistances were first scaled
> allometrically to the reported weight, after which the iterative levers (Table X)
> calibrated the model to the reported baseline hemodynamic targets.

(The subsequent sentences describing the bidirectional shunt at a 2.2 mm ductus diameter
and the significant left-to-right shunt achieving an LVO/RVO of 1.55 stay as written —
they describe the pathophysiological modifiers applied on top of the calibrated
baseline.)

**D2 — §3.1.3 (PH).** After the existing sentence describing how PH is simulated
("…by increasing the resistance in the pathways connecting the left and right pulmonary
artery capacitance (PAAL, PAAR) … and by modifying the baseline elastance of the
pulmonary arteries capacitance…"), add:

> As in the PDA case, the underlying patient baseline was established with the
> parameterization pipeline of Section 2.4; the pulmonary-resistance and
> pulmonary-artery-elastance changes representing each PH stage were then applied on
> top of that calibrated baseline.

---

## Block E — §2.3 Software implementation (replacement of the Python-specific text)

Replace the paragraph that begins *"The model developer environment is implemented in
an interactive Python notebook…"* (and adjust the earlier "source code of the Python
implementation … available upon request" sentence) with:

> EXPLAIN is implemented as a framework-agnostic simulation engine written in
> JavaScript/TypeScript. The engine runs inside a Web Worker — a background execution
> thread separate from the user interface — and communicates with the application
> through a simple message-passing protocol, so that the physics loop advances
> independently of rendering and user interaction and the model can run in real time in
> a standard web browser. Each physiological component is a small, self-contained module
> that implements the equations of Section 2.2; complete scenarios (baseline anatomy,
> parameters and initial state) are defined declaratively as JSON model definitions,
> which makes patient profiles and structural variants straightforward to inspect, share
> and modify. The interactive application, built on the Vue framework, presents the
> animated model, parameter editors and clinical monitors, and is freely available at
> https://explain-modeling.com. The engine source code is extensively annotated and
> available upon request.

The bulleted lists of what "developers should be able to" do can be retained; only
replace "Python"/"notebook" phrasing to match the description above (e.g. "modify a
model definition to create a hypotensive patient", "add a component module").

**E-consistency — remove the two remaining "Python" claims elsewhere:**
- **Abstract:** replace *"annotated Python source code is provided for researchers,
  ensuring transparency and extensibility"* with *"annotated source code is available to
  researchers, ensuring transparency and extensibility."*
- **Introduction:** replace *"The complete source code in Python is available upon
  request."* with *"The complete source code is available upon request."*
- The two availability statements (abstract, §4.3) and the URL https://explain-modeling.com
  remain consistent with Block E — no other change needed.

---

## Block F — Discussion edits

**F1 — §4.1 Model originality.** Append:

> A further element of originality is the parameterization method: rather than tuning
> parameters by hand, EXPLAIN is fitted to a patient by an AI-assisted closed-loop
> pipeline in which a large language model translates clinical targets into a validated
> specification and a deterministic secant-based calibrator drives the mechanistic
> model onto those targets. This makes patient-specific instantiation reproducible and
> keeps every automated adjustment within the same bounds as a manual edit.

**F2 — §4.5 Future work.** Replace the sentence:

> ~~Following a systematic sensitivity analysis, future work will focus on the
> development of parameter-optimization pipelines for patient-specific model fitting,
> using machine-learning and other artificial-intelligence–based approaches.~~

with:

> Building on the AI-assisted parameterization pipeline described here (Section 2.4),
> future work will pursue a systematic sensitivity analysis to identify the most
> informative parameters, extend calibration from the current one-lever-per-target
> scheme to joint multi-target optimization for strongly coupled configurations, and
> undertake prospective validation of patient-specific model fits against clinical data.

(The remaining sentence on ventilation strategies, pulmonary vasodilators and
transitional failure stays as written.)

---

## Block G — New references (EndNote-ready; renumber after existing [23])

Cite Block A/F for the LLM agent and the calibration method:

> **24.** Anthropic. Claude (Opus) [large language model]. Anthropic PBC; 2025. Available from: https://claude.com/product/overview.

> **25.** Anthropic. Claude Agent SDK [software]. 2025. Available from: https://platform.claude.com/docs/en/api/agent-sdk.

> **26.** Burden RL, Faires JD. Numerical Analysis. 9th ed. Boston: Brooks/Cole, Cengage Learning; 2011. [secant method]

Notes for the authors:
- If van Meurs [10] already presents the numerical-methods background you prefer to
  cite for root-finding, ref 26 can be dropped and Eqs. 13–14 cited to [10] instead.
- Confirm the exact Claude model name/version and access date you wish to state before
  finalizing refs 24–25 (these are software citations; adjust to the journal's format
  for citing software and AI tools, which Pediatric Research/Springer Nature now
  requires to be disclosed in Methods).
- Springer Nature policy: the use of an AI tool in the *research method* (as opposed to
  text generation) should be described in Methods — Block A satisfies this; no
  authorship is attributed to the AI.

---

## Equation-numbering note

Blocks A introduces **Eq. 13–15**. The existing manuscript ends at **Eq. 12** (the PDA
Doppler velocity transform), so 13–15 are free. If the companion respiratory/acid–base
levers are cross-referenced with their own equation numbers, keep those in the companion
papers and refer to them by name here.
