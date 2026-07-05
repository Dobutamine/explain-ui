# An integrated model for simulation of neonatal physiology — THE respiratory system, gas exchange and metabolism

*Companion to the cardiovascular paper (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP).
Target journal: Pediatric Research. Markdown working draft — equations to be re-keyed as native
Word (OMML) objects, matching the style of the cardiovascular paper. Every equation is
transcribed from and checked against the named engine source file. Numbers in Results marked
`[SIM: …]` are to be filled from the reproducible simulation runs of Section 3; do not state a
value until its probe has produced it.*

---

## Abstract

*(Draft — tighten to journal word limit.)*

Mechanistic, explanatory models of neonatal physiology can make the invisible couplings of
intensive-care medicine visible and manipulable in real time. We describe the respiratory
subsystem of EXPLAIN, an integrated, real-time neonatal physiology simulator whose
cardiovascular system is presented in a companion paper. The respiratory model comprises a set
of interconnected lumped compartments: gas-filled elastic compartments for the airways and
alveoli enclosed by an elastic thorax; a spontaneous respiratory-drive model that converts a
target minute ventilation into rate, tidal volume and a respiratory-muscle pressure waveform;
partial-pressure-driven alveolar gas exchange; a physicochemical (Stewart strong-ion) blood
acid–base and oxygen-transport solver coupling O₂ and CO₂ carriage to pH, temperature and
haemoglobin; whole-body oxygen consumption and carbon-dioxide production distributed across
tissue compartments; a hypoxia-driven lactate model that closes the loop from tissue oxygen debt
to metabolic acidosis; and a dynamic surfactant/alveolar-recruitment model with hysteresis that
reproduces respiratory distress syndrome and its response to surfactant therapy. Each component
is expressed as a small set of governing equations with physiologically interpretable parameters.
Patient-specific parameter values are set by an AI-assisted closed-loop calibration pipeline
(companion paper). We demonstrate that the model reproduces the expected qualitative and
quantitative behaviour of neonatal gas exchange and acid–base physiology — the dependence of
arterial oxygenation on inspired oxygen fraction and alveolar diffusion, of arterial carbon
dioxide on ventilatory drive, of pH and base excess on metabolic and respiratory perturbations,
and of pulmonary compliance and oxygenation on surfactant — and that the whole subsystem runs
in real time in a standard web browser. Annotated source code is available to researchers,
ensuring transparency and extensibility.

---

## 1. Introduction

The respiratory care of the sick newborn is an exercise in reasoning about quantities that cannot
be seen. A clinician at the incubator observes a pulse-oximeter saturation, an end-tidal carbon
dioxide trace and, intermittently, an arterial blood gas; from these few outputs they must infer
the state of a tightly coupled system in which alveolar ventilation, the inspired oxygen fraction,
the diffusing capacity of an immature lung, the distribution of pulmonary blood flow, tissue oxygen
consumption and the buffering chemistry of the blood all interact. A fall in oxygen saturation may
reflect atelectasis, right-to-left shunting, hypoventilation or a fall in cardiac output; a rising
carbon dioxide may be a problem of drive, of dead space or of lung compliance; a metabolic acidosis
may be the footprint of tissue hypoxia several steps removed from the airway. The couplings that
link the measured outputs to their mechanistic causes are precisely what the monitor does not show,
and precisely what the trainee must learn to reconstruct.

Computer models of physiology can make these hidden couplings explicit. Where a monitor displays an
output, a mechanistic model exposes the chain of intermediate variables that produced it, and — if
it runs in real time and responds to intervention — allows the learner or investigator to perturb
one part of the system and watch the consequences propagate through the rest. EXPLAIN is an
integrated, real-time, whole-body simulator of neonatal physiology built for exactly this
explanatory purpose: every physiological quantity is computed from interpretable lumped-parameter
compartments and is available for inspection and manipulation as the simulation advances. The
cardiovascular subsystem — the heart, the systemic and pulmonary circulations and their autonomic
control — is described in a companion paper. The present paper describes the respiratory subsystem
and the physiological processes that are inseparable from it: alveolar gas exchange, the transport
of oxygen and carbon dioxide in the blood, acid–base chemistry, and tissue metabolism. These are not
separable modules bolted onto the circulation but processes that unfold in the same blood
compartments, so that the arterial blood gas the model reports is not a prescribed number but an
emergent consequence of ventilation, perfusion, diffusion and metabolism solved together.

The respiratory physiology of the newborn, and especially of the preterm newborn, gives this
integration particular clinical weight. Surfactant deficiency stiffens the lung, lowers its
functional residual capacity and opens intrapulmonary shunts, so that respiratory distress syndrome
presents as a coupled failure of compliance, oxygenation and carbon-dioxide clearance that responds,
over minutes, to surfactant replacement and to recruiting pressure. Fetal haemoglobin shifts the
oxygen–dissociation curve; permissive hypercapnia and the narrow buffering margins of the immature
kidney shape acid–base management; and metabolic rate, thermoregulation and lactate production
couple the respiratory state to the whole-body oxygen economy. A model intended to teach or to
investigate neonatal respiratory care must therefore represent gas exchange, blood-gas transport,
acid–base chemistry, metabolism and surfactant-dependent lung mechanics as one system.

The primary contribution of this paper is a compact but complete mathematical description of that
system: a set of governing equations, each with physiologically interpretable parameters, for
neonatal ventilation, alveolar gas exchange, physicochemical (strong-ion) blood-gas and acid–base
transport, oxygen consumption and carbon-dioxide production, hypoxia-driven lactate metabolism, and
dynamic surfactant-dependent alveolar recruitment — integrated into a single model that runs in real
time in a standard web browser and shares its blood substrate with the circulation. A second,
cross-cutting contribution of the EXPLAIN series is the method by which the model is fitted to an
individual patient. Rather than tuning parameters by hand — the traditional bottleneck of
lumped-parameter modelling — EXPLAIN is parameterized by an AI-assisted, closed-loop calibration
pipeline in which a large language model interprets the available clinical targets and a
deterministic calibrator drives the mechanistic model onto them to within clinician-meaningful
tolerances. For the respiratory system the relevant targets are the arterial oxygen tension and
saturation, the carbon-dioxide tension, the pH and the base excess; the method is summarized in
Section 2.4 and described in full in the companion parameterization paper. Below we specify the
respiratory model (Section 2), and demonstrate that it reproduces the expected quantitative
behaviour of neonatal gas exchange and acid–base physiology (Section 3).

---

## 2. Methods

### 2.1 Conceptual model

The respiratory subsystem is a chain of lumped compartments (Fig. 1). Inspired gas enters at the
airway opening (`MOUTH`, held at atmospheric composition), passes through the conducting
airways and anatomical dead space (`DS`) and reaches the left and right alveolar compartments
(`ALL`, `ALR`). All gas compartments are elastic and are enclosed by a single elastic thorax
(`THORAX`) that couples chest-wall mechanics to the lungs. Spontaneous breathing is generated by
a respiratory-drive model (`Breathing`) that sets respiratory rate and tidal volume from a target
minute ventilation and produces a respiratory-muscle pressure applied to the thorax; mechanical
ventilation (companion devices paper) acts through the same airway.

At the alveolar–capillary interface, two gas-exchange units (`GASEX_LL`, `GASEX_RL`) move O₂ and
CO₂ between the alveolar gas and the pulmonary-capillary blood down their partial-pressure
gradients. The blood carries O₂ and CO₂ as total contents (*t*O₂, *t*CO₂); a physicochemical
acid–base and oxygen-transport solver (`BloodComposition`) converts these contents, together with
the plasma strong ions, into partial pressures, pH, bicarbonate, base excess and haemoglobin
saturation everywhere blood exists. As blood circulates, tissue metabolism (`Metabolism`) removes
O₂ and adds CO₂ in proportion to each organ's share of whole-body oxygen consumption, and — when
tissue oxygenation falls below an anaerobic threshold — a lactate model (`Lactate`) produces
lactate, which the same acid–base solver reads as a strong anion, producing a lactic metabolic
acidosis. Finally, a surfactant/recruitment model (`Surfactant`) makes alveolar compliance,
functional residual capacity, diffusion and intrapulmonary shunt depend dynamically on
transpulmonary pressure and surfactant maturity, reproducing respiratory distress syndrome (RDS)
and its treatment.

Shared modelling conventions — the factor/effective-value composition of every tunable parameter,
advective transport of dissolved substances by flow, the cycle counters, and the software
implementation — are described once in the series' shared Methods (see `_shared-methods.md`,
Sections S2–S5) and are not repeated here.

**Fig. 1** (`articles/Fig1_respiratory_subsystem.svg`, editable vector source; PNG export
`Fig1_respiratory_subsystem.png` for the manuscript). Schematic of the neonatal respiratory
subsystem and its couplings. Inspired gas passes from the airway opening (`MOUTH`, fixed at
atmospheric composition and FiO₂) through the anatomical dead space (`DS`) — with upper- and
lower-airway resistances — into the left and right alveolar gas compartments (`ALL`, `ALR`) enclosed
by the elastic thorax. The `Breathing` model generates the respiratory-muscle pressure applied to
the thorax; the `Surfactant` model senses the mean transpulmonary pressure and drives lung
elastance, functional residual capacity, alveolar diffusion and intrapulmonary shunt (dashed).
Gas-exchange units (`GASEX_LL`, `GASEX_RL`) move O₂ and CO₂ down their partial-pressure gradients
between the alveolar gas and the pulmonary-capillary blood; an intrapulmonary shunt (dashed red)
allows venous admixture. The blood — carrying total O₂ and CO₂ contents — circulates through the
shared circulation of the companion cardiovascular paper to the systemic tissue capillary beds,
where the `Metabolism` and `Lactate` models consume O₂, produce CO₂ and, under oxygen debt,
generate lactate. The physicochemical acid–base and oxygen solver (`BloodComposition`; Stewart
strong-ion balance, Hill oxygen dissociation, Van Slyke base excess) converts the blood contents and
strong ions into pH, PCO₂, PO₂, saturation, bicarbonate and base excess in every blood compartment
(dashed purple). Colour key: gas and mechanics (blue), blood and transport (red), gas exchange and
acid–base (purple), control and metabolic models (green). Styling is consistent with Figs 1–2 of the
cardiovascular paper.

### 2.2 Mathematical model

Notation and units follow the cardiovascular paper (see `_shared-methods.md` S1). Throughout, Δt
is the integration step (`modeling_stepsize`, default 5×10⁻⁴ s); all `x ← x + (…)·Δt` updates are
explicit forward-Euler steps. Every physical parameter *p* enters through its effective value
*p*_eff (Eq. S1); for brevity we write the base symbol and note where a factor layer is used.

#### 2.2.1 Gas compartments and thoracic mechanics

*Source: `explain/base_models/Capacitance.js`, `explain/component_models/GasCapacitance.js`,
`explain/base_models/Container.js`.*

A gas compartment is an elastic chamber (a `Capacitance`) extended to carry temperature, humidity
and the molar concentrations of O₂, CO₂, N₂, H₂O and a lumped "other" species. Its recoil pressure
is a linear-plus-quadratic function of the volume above its unstressed volume:

> **Eq. 1** &nbsp; *p*_in = *E*_eff·(*V* − *V*ᵤ,eff) + *K*₂,eff·(*V* − *V*ᵤ,eff)²

where *E*_eff (mmHg·L⁻¹) is the effective elastance, *K*₂,eff (mmHg·L⁻²) the non-linear elastance
coefficient, *V* the compartment gas volume (L) and *V*ᵤ,eff the effective unstressed volume (L).
*E*, *K*₂ and *V*ᵤ each carry the three-layer factor composition of Eq. S1. The total compartment
pressure adds the external pressures and the atmospheric reference:

> **Eq. 2** &nbsp; *P* = *p*_in + *p*_ext + *p*_cc + *p*_mus + *P*_atm,  &nbsp;&nbsp; *P*_rel = *P* − *P*_atm

with *P*_atm = 760 mmHg, *p*_cc the pressure imposed by the enclosing thorax, and *p*_mus the
respiratory-muscle pressure (Section 2.2.2); *p*_ext, *p*_cc and *p*_mus are additive perturbations
reset to zero each step.

The thorax is a `Container`: an elastic shell whose volume is the sum of the (enabled) contained
compartment volumes and which transmits its own recoil pressure back onto each contained
compartment as external pressure,

> **Eq. 3** &nbsp; *V*_thorax = *V*_extra + Σ_c *V*_c,  &nbsp;&nbsp; *p*_ext^(c) ← *p*_ext^(c) + *P*_thorax

so a rise in thoracic elastance or a respiratory-muscle effort is felt by every lung compartment.
The chest-wall elastance is derived from a neonatal chest-wall compliance of 4.2 mL·cmH₂O⁻¹·kg⁻¹
(≈ 52.5 mmHg·L⁻¹ for the modelled weight; source comment in `Respiration.js`).

**Gas state.** Total molar concentration follows the ideal-gas law and partial pressures follow
Dalton's law:

> **Eq. 4** &nbsp; *c*_total = (*P* / (*R*·(273.15 + *T*)))·10³  &nbsp;[mmol·L⁻¹],  &nbsp; *R* = 62.36367 L·mmHg·mol⁻¹·K⁻¹

> **Eq. 5** &nbsp; *P*_X = (*c*_X / *c*_total)·*P*,  &nbsp;&nbsp; *F*_X = *c*_X / *c*_total   (X ∈ {O₂, CO₂, N₂, H₂O, other})

Each compartment is warmed toward its target temperature and humidified toward the saturated
water-vapour pressure, with the accompanying ideal-gas volume changes:

> **Eq. 6** &nbsp; *P*_H₂O^sat(*T*) = exp(20.386 − 5132/(*T* + 273.15))  &nbsp;[mmHg]

> **Eq. 7** &nbsp; d*T* = 0.0005·(*T*_target − *T*);  &nbsp; d*V*_thermal = *c*_total·*V*·*R*·d*T* / *P*

> **Eq. 8** &nbsp; d(H₂O) = 10⁻⁵·(*P*_H₂O^sat − *P*_H₂O)·Δt;  &nbsp; *c*_H₂O ← (*c*_H₂O·*V* + d(H₂O))/*V*

(the humidification adds a corresponding gas volume *R*(273.15+*T*)/*P* · d(H₂O)/10³). Substances
carried by an inflowing gas volume mix by the incoming-volume fraction, identically to the blood
mixing rule (Eq. S2). A compartment flagged `fixed_composition` (the atmosphere) holds its
composition and temperature constant, acting as an infinite reservoir.

#### 2.2.2 Ventilation: the spontaneous breathing drive

*Source: `explain/component_models/Breathing.js`, `explain/component_models/Respiration.js`.*

Spontaneous ventilation is generated from a target minute ventilation scaled to body weight and
modulated by autonomic drive:

> **Eq. 9** &nbsp; V̇_E,target = *m*_ref·*W*·(1 + (*a*_chemo − 1))·*a*_ans

where *m*_ref is the reference minute volume (0.2 L·kg⁻¹·min⁻¹), *W* body weight (kg), *a*_chemo
the chemoreflex factor (`mv_ans_factor`, written by the autonomic model of the companion paper)
and *a*_ans a tonic activity factor. Rate and tidal volume are partitioned by an inverted
Mecklenburgh relation (rate rises as the square root of ventilatory demand):

> **Eq. 10** &nbsp; RR = √(V̇_E,target / (*k*_vt·*W*)),  &nbsp;&nbsp; *V*_T,target = V̇_E,target / RR

with *k*_vt the tidal-volume/rate ratio (1.212×10⁻⁴). The breath is divided into inspiratory and
expiratory intervals by the inspiratory:expiratory ratio IE:

> **Eq. 11** &nbsp; *T*_breath = 60/RR,  &nbsp; *T*_i = IE·*T*_breath,  &nbsp; *T*_e = *T*_breath − *T*_i

A respiratory-muscle pressure waveform is generated over the cycle: a linear ramp during
inspiration and a normalized exponential (Mecklenburgh) decay during expiration,

> **Eq. 12** &nbsp; *p*_mus = φ_i·*G*  (inspiration),  &nbsp; *p*_mus = *G*·(e^(−4φ_e) − e^(−4))/(1 − e^(−4))  (expiration)

where φ_i, φ_e ∈ [0,1] are the fractional phase positions (step counter ÷ steps-per-phase) and
*G* is the muscle-pressure gain. *p*_mus is applied to the thorax (as an additive perturbation to
its elastance factor, Eq. 3), and the resulting airway flow is integrated to a measured tidal
volume. A slow integral controller adjusts *G* by ±0.1 per breath so that the measured expiratory
tidal volume tracks *V*_T,target (bounded to [0, *G*_max]); this closes the loop that lets the same
drive model work under spontaneous breathing, CPAP and mechanical support. The measured expiratory
volume drives the airway-opening flow summed across the natural (`MOUTH_DS`) and, when intubated,
the endotracheal (`VENT_ETTUBE`) inlets, so the tidal-volume feedback is airway-route-agnostic.

The `Respiration` model is a grouping controller (no physics of its own) that maps five clinical
"dials" — lung elastance, thoracic elastance, upper- and lower-airway resistance, and gas-exchange
capacity — onto the persistent factor layers of the corresponding compartments, applying changes
as deltas so that multiple controllers (e.g. Respiration and Surfactant) compose additively on the
same parameter.

#### 2.2.3 Alveolar gas exchange and diffusion

*Source: `explain/base_models/GasExchanger.js`, `explain/base_models/GasDiffusor.js`,
`explain/base_models/BloodDiffusor.js`.*

Gas exchange across the alveolar–capillary barrier is partial-pressure-driven (a Fick flux). For
each gas the molar flux from blood to alveolar gas over one step is

> **Eq. 13** &nbsp; Φ_X = (*P*_X,blood − *P*_X,gas)·*D*_X·Δt  &nbsp;[mmol]   (X ∈ {O₂, CO₂})

where *D*_X (mmol·mmHg⁻¹·s⁻¹) is the diffusion constant (carrying the factor composition of Eq. S1
via `dif_X_factor(_ps/_scaling)`). The exchanged moles update both compartments by conservation of
mass on their volumes:

> **Eq. 14** &nbsp; *t*O₂,blood ← (*t*O₂,blood·*V*_b − Φ_O₂)/*V*_b,  &nbsp; *c*_O₂,gas ← (*c*_O₂,gas·*V*_g + Φ_O₂)/*V*_g

and analogously for CO₂ (with the sign appropriate to its gradient). Before each exchange the blood
partial pressures are refreshed by the acid–base/oxygen solver of Section 2.2.4. Conducting-airway
gas transport (`GasDiffusor`) and blood–blood diffusion — used for the placenta in the companion
"other systems" paper (`BloodDiffusor`) — use the identical partial-pressure-driven flux and
mass-conserving update (Eqs. 13–14); the blood diffusor additionally moves arbitrary solutes down
their concentration gradients with the same form.

The alveolar O₂ diffusion constant `dif_o2` is the primary calibration lever for arterial PO₂/SpO₂
(Section 2.4).

#### 2.2.4 Blood-gas transport and acid–base chemistry (keystone)

*Source: `explain/component_models/BloodComposition.js`. This solver is shared with the
circulation (companion cardiovascular paper) and every organ that carries blood; it is derived in
full here.*

Blood carries oxygen and carbon dioxide as total contents *t*O₂ and *t*CO₂ (mmol·L⁻¹) and a set of
plasma strong ions and buffers. The solver converts these, at the compartment temperature *T* and
haemoglobin concentration, into pH, PCO₂, bicarbonate, base excess, PO₂ and haemoglobin saturation.
It follows the Stewart physicochemical approach: the independent variables are the strong-ion
difference, the total CO₂, the total weak-acid buffers and the total O₂; the dependent variables
(pH, PCO₂, PO₂, SO₂) are found by imposing chemical equilibrium and electroneutrality.

**Strong-ion difference.** The apparent strong-ion difference is

> **Eq. 15** &nbsp; SID = [Na⁺] + [K⁺] + 2[Ca²⁺] + 2[Mg²⁺] − [Cl⁻] − [lactate⁻]

so lactate enters directly as a strong anion — the coupling exploited by the metabolic-acidosis
model (Section 2.2.5).

**CO₂ speciation and buffering.** For a trial hydrogen-ion concentration [H⁺], dissolved CO₂ is
partitioned among CO₂(aq), bicarbonate and carbonate, with an additional Haldane term by which a
lower haemoglobin saturation raises CO₂-carrying capacity:

> **Eq. 16** &nbsp; [CO₂(aq)] = *t*CO₂ / (1 + *K*_c/[H⁺] + *K*_c*K*_d/[H⁺]² + λ·(1 − S_O₂,prev))

> **Eq. 17** &nbsp; [HCO₃⁻] = *K*_c·[CO₂(aq)]/[H⁺],  [CO₃²⁻] = *K*_d·[HCO₃⁻]/[H⁺],  [OH⁻] = *K*_w/[H⁺],  PCO₂ = [CO₂(aq)]/α_CO₂

with dissociation constants *K*_w = 2.5119×10⁻¹¹, *K*_c = 7.943×10⁻⁴, *K*_d = 6.026×10⁻⁸, CO₂
solubility α_CO₂ = 0.03067 mmol·L⁻¹·mmHg⁻¹, Haldane coefficient λ (default 1.0) and S_O₂,prev the
saturation from the previous step (used to break the O₂↔CO₂ circular dependence; at steady state it
equals the current saturation). Non-bicarbonate buffering by albumin and phosphate contributes a
pH-dependent charge:

> **Eq. 18** &nbsp; *A*⁻ = [albumin]·(0.123·pH − 0.631) + [phosphate]·(0.309·pH − 0.469)

**Electroneutrality.** pH is found as the [H⁺] that makes plasma electrically neutral:

> **Eq. 19** &nbsp; *g*([H⁺]) = [H⁺] + SID − [HCO₃⁻] − 2[CO₃²⁻] − [OH⁻] − *A*⁻ − [UMA] = 0

where UMA is the concentration of unmeasured/unidentified strong anions — the calibration lever for
base excess and pH (Section 2.4). Equation 19 is solved by a bounded Brent root-finder over [H⁺]
(≤ 60 iterations, tolerance 10⁻⁶), with the search interval seeded from the previous step's pH
±0.1 for speed and robustness. From the converged solution the base excess is computed by the Van
Slyke expression

> **Eq. 20** &nbsp; BE = ([HCO₃⁻] − 25.1 + (2.3·Hb + 7.7)·(pH − 7.4))·(1 − 0.023·Hb)

(Hb in mmol·L⁻¹).

**Oxygen transport.** The oxygen–haemoglobin dissociation curve is a Hill relation whose half-
saturation tension P₅₀ shifts with pH (Bohr effect), PCO₂, temperature and 2,3-DPG:

> **Eq. 21** &nbsp; log₁₀ P₅₀ = log₁₀ P₅₀,₀ − 0.48·ΔpH + 0.0015·ΔPCO₂ + 0.024·Δ*T* + 0.051·ΔDPG

> **Eq. 22** &nbsp; S_O₂ = *P*_O₂ⁿ / (*P*_O₂ⁿ + P₅₀ⁿ),  &nbsp; *n* = 2.7

where ΔpH = pH − 7.40, ΔPCO₂ = PCO₂ − 40, Δ*T* = *T* − 37, ΔDPG = DPG − 5, and P₅₀,₀ is the
compartment's intrinsic O₂-haemoglobin affinity baseline (fetal haemoglobin 18.8, neonatal 20.0,
adult 26.7 mmHg — the mechanism by which fetal blood's higher affinity is represented). Total
oxygen content combines dissolved and haemoglobin-bound O₂,

> **Eq. 23** &nbsp; *t*O₂ = (0.0031·*P*_O₂ + 1.36·Hb_gdl·S_O₂)·10·(760/(*R*·(273.15+*T*)))

with Hb_gdl = Hb/0.6206 the haemoglobin in g·dL⁻¹. For known *t*O₂ the arterial *P*_O₂ (and hence
S_O₂) is found by a second Brent root-find of Eq. 23, seeded from the previous *P*_O₂ ±10 mmHg.

This single solver is what makes gas transport a whole-body property: the same equations run in the
pulmonary capillaries (loading O₂, unloading CO₂), in the systemic tissues (the reverse), and in
every monitored blood compartment, so the arterial blood gas the model reports is an emergent
consequence of ventilation, perfusion, diffusion and metabolism rather than a prescribed output.

#### 2.2.5 Metabolism and lactate

*Source: `explain/component_models/Metabolism.js`, `explain/component_models/Lactate.js`.*

Whole-body oxygen consumption V̇O₂ (default 8.1 mL·kg⁻¹·min⁻¹) is converted to a molar demand per
step and distributed across tissue compartments by each site's fractional share *f*_VO₂ (the
fractions sum to one across metabolically active sites):

> **Eq. 24** &nbsp; ΔO₂ = (0.039·V̇O₂·*a*_VO₂·*Q*₁₀·*W* / 60)·Δt  &nbsp;[mmol]

where 0.039 mmol·mL⁻¹ is the molar O₂ content at 37 °C and atmospheric pressure, *a*_VO₂ an external
demand factor and *Q*₁₀ the temperature factor written by the thermoregulation model (companion
paper; 1.0 at 37 °C). Each site's O₂ is decremented and its CO₂ incremented by the respiratory
quotient RQ (default 0.8):

> **Eq. 25** &nbsp; *t*O₂ ← (*t*O₂·*V* − *f*_VO₂·ΔO₂)/*V*,  &nbsp; *t*CO₂ ← (*t*CO₂·*V* + RQ·*f*_VO₂·ΔO₂)/*V*

When tissue oxygenation falls below an anaerobic threshold, lactate is produced in proportion to the
local oxygen debt. For each tissue an anaerobic fraction is computed relative to a threshold set at a
fraction of the site's resting-minimum oxygen content *t*O₂,rest (captured over a 90 s warm-up so the
model is neutral even in chronically hypoxaemic scenarios):

> **Eq. 26** &nbsp; Θ = *τ*_frac·*t*O₂,rest,  &nbsp; *a* = clamp((Θ − *t*O₂)/Θ, 0, 1)

> **Eq. 27** &nbsp; *L* = *a*·*D*_O₂,site·*Y*·*g*,  &nbsp; [lactate] ← [lactate] + *L*/*V*

where *τ*_frac = 0.5, *D*_O₂,site is the site's molar O₂ demand over the update interval, *Y* = 0.33
mmol lactate per mmol O₂ deficit (≈ 2 lactate/glucose over 6 O₂/glucose) and *g* a production gain.
Lactate is cleared from every blood compartment by first-order relaxation toward a baseline
(Cori-cycle/hepatic–renal handling):

> **Eq. 28** &nbsp; [lactate] ← [lactate] + (*L*_base − [lactate])·*k*_cl·*u*

with *L*_base = 1.0 mmol·L⁻¹, *k*_cl = 2×10⁻³ s⁻¹ (t½ ≈ 6 min) and *u* the update interval.
Because lactate is a strong anion (Eq. 15), a rise lowers SID and hence pH, HCO₃⁻ and base excess:
the tissue-oxygen-debt → lactate → metabolic-acidosis loop is closed with no change to the acid–base
solver itself. The models run in the fixed order Metabolism → Lactate → blood-composition so that
each step's oxygen extraction, lactate production and acid–base consequence are consistent.

#### 2.2.6 Surfactant and dynamic alveolar recruitment (RDS)

*Source: `explain/component_models/Surfactant.js`.*

Respiratory distress syndrome is modelled as a dynamic, pressure-driven balance between alveolar
recruitment and derecruitment with hysteresis, modulated by surfactant maturity *s* ∈ [0,1]
(0 = severe RDS, 1 = mature/treated). Surfactant therapy relaxes *s* toward its target with a time
constant τ_surf (180 s, the acute recruitment response). The transpulmonary pressure signal is the
mean alveolar recoil pressure over both lungs, low-pass-filtered to remove tidal swings:

> **Eq. 29** &nbsp; *P̄*_tp ← *P̄*_tp + (Δt/τ_p)·(*P*_tp − *P̄*_tp),  &nbsp; *P*_tp = mean_lungs(*p*_in)

Opening and closing pressure thresholds are auto-centred on a baseline transpulmonary pressure *P*₀
(captured over a 30 s warm-up) and shifted down by surfactant, so that therapy lowers the pressure
needed to recruit alveoli:

> **Eq. 30** &nbsp; TOP = *P*₀ + *m*_open − *g*_open·(*s* − *s*₀),  &nbsp; TCP = *P*₀ − *m*_close − *g*_close·(*s* − *s*₀)

with margins *m*_open = *m*_close = 2 mmHg and gains *g*_open = 14, *g*_close = 12 mmHg per unit
surfactant. The open fraction evolves by a recruitment/derecruitment ODE with a hysteresis dead
zone (for TCP ≤ *P̄*_tp ≤ TOP both terms vanish and the open fraction holds):

> **Eq. 31** &nbsp; d(open)/d*t* = *k*_open·max(0, *P̄*_tp − TOP)·(1 − open) − *k*_close·max(0, TCP − *P̄*_tp)·open

(*k*_open = *k*_close = 0.5 mmHg⁻¹·s⁻¹). The deviation of the open fraction from its baseline,
*r* = open − *f*₀, drives four effector channels — lung elastance, functional residual capacity
(unstressed volume), alveolar diffusion and intrapulmonary shunt — as bounded linear factors:

> **Eq. 32** &nbsp; *f*_el = 1 − 0.7*r*,  *f*_uvol = 1 + 1.5*r*,  *f*_dif = 1 + 2.0*r*,  *f*_ips = 1 + 6.0*r*

so that derecruitment (negative *r*) simultaneously stiffens the lung, lowers FRC, impairs
diffusion and increases intrapulmonary shunt — the coupled signature of RDS — while surfactant
therapy or recruiting pressure reverses all four. The elastance, FRC and diffusion factors are
written to the non-persistent factor layer (composing with the Respiration controller's persistent
layer); the shunt uses the persistent resistance layer, released to unity when the model is
disabled.

### 2.3 Software implementation and code verification

See shared Methods S5 (reuse verbatim): framework-agnostic JavaScript/TypeScript engine running in
a Web Worker, declarative JSON model definitions, real-time step loop, freely available at
https://explain-user.com; source annotated and available upon request. The respiratory models run
in the same insertion-ordered step loop as the circulation, sharing the blood compartments so that
gas exchange, transport, metabolism and acid–base are solved together each step.

### 2.4 AI-assisted patient-specific parameterization (pointer)

Patient-specific respiratory and acid–base parameters are not tuned by hand but are set by the
AI-assisted, closed-loop calibration pipeline described in the companion parameterization paper
(and summarized in Section 2.4 of the cardiovascular paper): a large language model interprets the
available clinical targets and emits a validated specification, and a deterministic calibrator
drives one physiologically interpretable lever per target to within a clinician-meaningful
tolerance. For the models of this paper the levers are: **alveolar O₂ diffusion** *D*_O₂
(`dif_o2`) → arterial PO₂/SpO₂ (positive); **central ventilatory drive** *m*_ref
(`minute_volume_ref`) → arterial PCO₂ (negative — lowering drive raises PCO₂ because the chemoreflex
otherwise defends the setpoint); and **Stewart unmeasured anions** UMA (`uma`) → base excess and pH
(negative). Default tolerances are PO₂ ±6 mmHg, PCO₂ ±4 mmHg, pH ±0.03 and base excess
±1.5 mmol·L⁻¹.

---

## 3. Results — illustrative simulations

Each experiment was run headlessly against the calibrated term-neonate baseline
(`term_neonate.json`; and, for surfactant, the preterm 28-week RDS scenario `preterm_28wk.json`)
using the reproducible harness and probe scripts of the shared Methods (S7). The baseline was warmed
to steady state and pulsatile signals were cycle-averaged over the reporting window. All values are
produced by the engine's own acid–base/oxygen solver (`BloodComposition.js`), not prescribed.
Mechanism sweeps (§3.2–3.4) were run with the autonomic chemoreflex disabled so that each relation
shows the pure respiratory/acid–base mechanism; in the closed loop the chemoreflex attenuates the
CO₂ response (this is exactly why ventilatory drive, not diffusion, is the PCO₂ calibration lever —
Section 2.4). Scripts: `scripts/probe_vitals.mjs` (§3.1), `scripts/probe_respiratory.mjs`
(§3.2–3.4), `scripts/probe_surfactant.mjs` (§3.5).

### 3.1 Baseline gas exchange and acid–base status

The calibrated term neonate (3.5 kg, autonomic control active) reproduces a normal neonatal
respiratory and acid–base state (Table 1): a physiological respiratory rate and a normal arterial
blood gas, all within neonatal reference ranges.

**Table 1. Baseline term-neonate respiratory and acid–base state.** *(`probe_vitals.mjs
term_neonate --seconds 120`.)*

| Quantity | Value | Reference (neonate) |
|---|---|---|
| Respiratory rate | 41 min⁻¹ | 30–60 |
| SpO₂ (pre-ductal) | 96.9 % | 93–100 |
| End-tidal CO₂ | 35.8 mmHg | 35–45 |
| Arterial pH | 7.36 | 7.30–7.42 |
| Arterial PCO₂ | 39.8 mmHg | 35–45 |
| Arterial PO₂ | 74.8 mmHg | 50–85 |
| Bicarbonate | 22.4 mmol·L⁻¹ | 18–24 |
| Base excess | −3.0 mmol·L⁻¹ | −6 to +2 |

### 3.2 Oxygenation vs inspired oxygen fraction and alveolar diffusion

Stepping the inspired oxygen fraction raised arterial PO₂ monotonically with the expected
saturating rise of SpO₂ (Table 2a), while arterial PCO₂ was essentially unchanged — the model
correctly makes oxygenation, but not CO₂ clearance, respond to FiO₂ (Eqs. 5, 13, 21–23).
Independently scaling the alveolar O₂ diffusion constant produced a saturating rise in PO₂ from a
diffusion-limited regime toward a perfusion/ventilation-limited ceiling (Table 2b), demonstrating
the *D*_O₂ → PO₂/SpO₂ calibration lever (Section 2.4).

**Table 2a. Arterial oxygenation vs FiO₂** (alveolar diffusion at baseline). PCO₂ held ≈ 39.8 mmHg
throughout.

| FiO₂ | PO₂ (mmHg) | SpO₂ (%) |
|---|---|---|
| 0.21 | 74.9 | 96.9 |
| 0.30 | 98.7 | 98.5 |
| 0.40 | 132.2 | 99.3 |
| 0.60 | 250.3 | 99.9 |
| 0.90 | 472.1 | 100.0 |

**Table 2b. Arterial oxygenation vs alveolar O₂ diffusion** (FiO₂ = 0.21; diffusion as a multiple
of baseline).

| *D*_O₂ (×base) | PO₂ (mmHg) | SpO₂ (%) |
|---|---|---|
| 0.25 | 59.3 | 94.5 |
| 0.50 | 69.9 | 96.4 |
| 1.0 | 74.3 | 97.0 |
| 2.0 | 76.3 | 97.2 |
| 4.0 | 77.3 | 97.3 |

### 3.3 Carbon dioxide vs ventilatory drive

Scaling the reference minute ventilation produced the expected inverse PCO₂–ventilation relation and
the accompanying respiratory pH shift (Table 3): halving the drive raised PCO₂ toward a respiratory
acidosis, and increasing it lowered PCO₂ into a respiratory alkalosis, with respiratory rate moving
in the same direction as ventilation (Eqs. 9–11 with 13–17).

**Table 3. Arterial CO₂ and pH vs ventilatory drive** (minute-ventilation reference as a multiple of
baseline).

| Ventilation (×base) | PCO₂ (mmHg) | pH | RR (min⁻¹) |
|---|---|---|---|
| 0.6 | 42.2 | 7.35 | 39.6 |
| 0.8 | 40.7 | 7.36 | 40.2 |
| 1.0 | 39.6 | 7.38 | 40.4 |
| 1.3 | 35.6 | 7.42 | 42.7 |
| 1.7 | 32.1 | 7.46 | 45.0 |

### 3.4 Metabolic acid–base perturbation

Adding unmeasured strong anions (Eq. 15, the base-excess/pH lever) produced a graded metabolic
acidosis — falling bicarbonate, base excess and pH — with the appropriate secondary respiratory
compensation (falling PCO₂) as the open-loop ventilation responded to the acidaemia (Table 4). This
demonstrates the Stewart solver's separation of the metabolic component (SID/UMA → HCO₃⁻, BE) from
the respiratory component (ventilation → PCO₂). The same acidosis arises spontaneously from tissue
oxygen debt through the lactate pathway (Eqs. 26–28), lactate entering Eq. 15 as a strong anion.

**Table 4. Metabolic acidosis from added unmeasured anions** (UMA increment above baseline,
mmol·L⁻¹).

| ΔUMA | pH | HCO₃⁻ (mmol·L⁻¹) | Base excess (mmol·L⁻¹) | PCO₂ (mmHg) |
|---|---|---|---|---|
| 0 (base) | 7.38 | 23.0 | −2.1 | 39.6 |
| +3 | 7.36 | 20.2 | −4.6 | 35.8 |
| +6 | 7.28 | 14.6 | −10.9 | 31.2 |

*(At increments beyond ≈ +6 mmol·L⁻¹ the pH falls outside the solver's dynamic root-finding window
and the reported value becomes unreliable; the clinically relevant range is well within the
converging envelope — see §4.4.)*

### 3.5 Respiratory distress and surfactant therapy

In the preterm 28-week RDS scenario, administering surfactant (`administer_surfactant`, target
maturity 0.9) drove progressive alveolar recruitment with the expected coupled improvement in
every downstream variable (Table 5): the open fraction rose from 0.50 to 1.0, effective lung
elastance fell (compliance rose) from 558 to 363 mmHg·L⁻¹, the diffusion factor rose and the
intrapulmonary-shunt factor rose (shunt fell), and arterial PO₂ rose from 54.6 to 74.3 mmHg with
SpO₂ from 90.7 to 96.1 % (Eqs. 29–32). The response developed over minutes (τ_surf = 180 s) and
the recruitment showed the intended hysteresis. At baseline all four effector factors sat at unity,
confirming the model is neutral in the untreated calibrated state.

**Table 5. Surfactant therapy time course** (preterm 28-week RDS; `probe_surfactant.mjs
--scenario preterm_28wk --target 0.9`).

| Phase | Surfactant | Open frac. | Lung elastance (mmHg·L⁻¹) | PaO₂ (mmHg) | PaCO₂ (mmHg) | SpO₂ (%) |
|---|---|---|---|---|---|---|
| Baseline RDS | 0.25 | 0.50 | 558 | 54.6 | 49.5 | 90.7 |
| + 60 s | 0.45 | 0.95 | 394 | 65.8 | 46.9 | 95.2 |
| + 180 s | 0.68 | 1.00 | 363 | 74.3 | 48.2 | 96.1 |
| + 420 s | 0.84 | 1.00 | 363 | 74.3 | 48.3 | 96.1 |

*(Non-invasive and mechanical ventilatory support of the RDS lung — CPAP, pressure support and the
ventilator interaction with spontaneous breathing — are demonstrated in the companion devices paper,
which owns the ventilator model.)*

---

## 4. Discussion

### 4.1 Model originality

The respiratory subsystem described here is, to our knowledge, distinctive less in any single
component than in their integration. Its individual elements are grounded in established physiology
— an elastance-based description of gas compartments and chest-wall mechanics, a Fick description of
alveolar–capillary diffusion, a physicochemical (Stewart) treatment of acid–base equilibrium, a
Hill oxygen-dissociation curve with the classical P₅₀-shifting factors, and a recruitment model of
surfactant-dependent lung mechanics. What the model adds is to solve all of these together, in real
time, on a single shared blood substrate that it also shares with the circulation of the companion
paper. Because oxygen and carbon dioxide are carried as total contents that circulate with the blood
and are converted to partial pressures, pH, bicarbonate and saturation everywhere blood exists, the
arterial blood gas the model reports is not an assigned output but an emergent property of the
coupled system: it moves only when ventilation, perfusion, diffusion or metabolism moves. This is
what makes the model explanatory rather than merely descriptive — a change made anywhere propagates
to the monitored quantities through the same mechanistic pathways a clinician would reason along.

A second, cross-cutting element of originality, shared with the other papers in the series, is the
way the model is fitted to a patient. Lumped-parameter models expose many free parameters against
few measurements, and the traditional remedy — expert hand-tuning — is slow, irreproducible and
hard to audit. Here the respiratory and acid–base parameters are set by the AI-assisted closed-loop
pipeline of the companion parameterization paper: a large language model interprets the available
clinical targets and a deterministic calibrator drives one physiologically interpretable lever per
target onto its value. The lever structure is itself a piece of encoded physiology — alveolar
diffusion drives oxygenation, ventilatory drive drives carbon dioxide, and unmeasured strong anions
drive base excess and pH — chosen to respect the model's own active control loops rather than to
fight them (Section 2.4). Because every automated adjustment is expressed through the same bounded,
schema-checked parameters as a manual edit, patient-specific instantiation is both rapid and
reproducible.

### 4.2 Model validity

The simulations of Section 3 show that the model reproduces the expected qualitative and
quantitative behaviour of neonatal respiratory and acid–base physiology. The calibrated baseline
sits within neonatal reference ranges across the full blood gas (Table 1). Arterial oxygenation
rises monotonically with inspired oxygen fraction and with alveolar diffusing capacity, with the
saturating approach of oxygen saturation toward 100 % that the sigmoid dissociation curve dictates,
while carbon-dioxide tension is appropriately insensitive to inspired oxygen (Tables 2a–b). Carbon
dioxide varies inversely with ventilation, carrying pH into a respiratory acidosis or alkalosis as
expected (Table 3). Added unmeasured anions produce a graded metabolic acidosis — falling
bicarbonate, base excess and pH — cleanly separated by the Stewart formulation from the respiratory
axis, with the appropriate secondary respiratory compensation (Table 4). And in the preterm RDS
scenario, surfactant administration recruits the lung over minutes, simultaneously improving
compliance, diffusion, shunt and oxygenation — the coupled signature of the syndrome resolving as a
single physiological process (Table 5). The parameter values that produce these behaviours are
traceable to standard physiological sources (see `_references.md`); where an engine constant departs
from a common textbook value — for example the base-excess offset (25.1 rather than 24.4) or the
compartment-specific P₅₀ baselines representing fetal, neonatal and adult haemoglobin affinity
(18.8, 20.0, 26.7 mmHg) — we state the value used and cite the source it was adapted from rather
than silently normalizing it.

We emphasize that these are demonstrations of mechanistic behaviour, not a formal clinical
validation. The purpose of this paper is to specify the model and to show that it behaves
physiologically across its operating range; prospective validation of patient-specific fits against
neonatal blood-gas data is future work (Section 4.5).

### 4.3 Reproducibility and model expansion

Every quantitative result in this paper is reproduced from the engine by a named script — the
baseline blood gas by `probe_vitals.mjs`, the oxygenation, ventilation and acid–base sweeps by
`probe_respiratory.mjs`, and the surfactant time course by `probe_surfactant.mjs` — so that each
figure and table can be regenerated and audited. The model itself is defined declaratively: complete
scenarios, including the respiratory anatomy and its parameters, are JSON model definitions, and
each physiological process is a small self-contained module implementing the equations of Section 2.
New components — additional metabolic sites, alternative dissociation chemistry, further lung
pathologies — are added as modules without modifying the engine, which is what allowed the
respiratory subsystem to be built on the same substrate as the circulation.

### 4.4 Limitations

The model makes the simplifications characteristic of a real-time lumped-parameter approach. Gas
exchange is represented by paired alveolar compartments rather than a continuous distribution of
ventilation-to-perfusion ratios, so V/Q mismatch is captured only in aggregate (through
intrapulmonary shunt and the two-lung split) and cannot reproduce the full shape of a shunt or
dead-space curve. Dead-space and alveolar ventilation are not separately partitioned. Time
integration is explicit forward-Euler at a fixed step, chosen for real-time performance; the
acid–base and oxygen equilibria are, by contrast, solved to convergence each step by a bounded Brent
root-finder, but that solver has a finite operating envelope — at extreme acid loads the pH can fall
outside its dynamic search window and the reported value becomes unreliable, as noted for the most
severe unmeasured-anion perturbation in Section 3.4; the clinically relevant range lies well within
the converging envelope. The Haldane/Bohr coupling between oxygen saturation and carbon-dioxide
carriage uses the previous step's saturation to break the circular dependence, which is exact at
steady state and introduces only a one-step lag during transients. Metabolism distributes a single
whole-body oxygen-consumption figure across tissues by fixed fractional shares rather than deriving
each organ's consumption from its own work and perfusion.

### 4.5 Future work

Several extensions follow naturally. Regional ventilation-to-perfusion heterogeneity and an explicit
dead-space/alveolar-ventilation partition would let the model reproduce the quantitative gas-exchange
abnormalities of specific lung pathologies more faithfully. Coupling the respiratory model to the
mechanical ventilator and to extracorporeal membrane oxygenation — described in the companion devices
paper, which reuses the gas-exchange equations derived here — will support closed-loop simulation of
respiratory support and its weaning. Building on the AI-assisted parameterization pipeline, a
systematic sensitivity analysis would identify the most informative respiratory targets, and
calibration could be extended from the present one-lever-per-target scheme toward joint optimization
for strongly coupled respiratory–circulatory configurations. Finally, prospective validation of
patient-specific respiratory fits against clinical neonatal blood-gas data would test the model's
quantitative accuracy beyond the mechanistic demonstrations presented here.

---

## Conclusion

The respiratory subsystem of EXPLAIN provides a transparent, real-time, mechanistic account of
neonatal ventilation, alveolar gas exchange, blood-gas transport, acid–base chemistry, metabolism
and surfactant-dependent lung recruitment. By solving these processes together on a blood substrate
shared with the circulation, the model makes the arterial blood gas an emergent consequence of the
underlying physiology rather than a prescribed output, and by fitting the model to individual
patients through an AI-assisted closed-loop calibration pipeline it removes the hand-tuning
bottleneck that has limited the individualization of lumped-parameter models. Together with its
cardiovascular companion, it offers an integrated, interpretable and freely available platform for
teaching and investigating neonatal cardiorespiratory physiology.

---

## References

See `articles/_references.md` (running series bibliography). Paper-2 core sources to confirm via
PubMed before submission: Stewart (strong-ion acid–base), Figge/Fencl (albumin–phosphate buffering),
Siggaard-Andersen (Van Slyke base excess), Kelman/Severinghaus/Dash–Bassingthwaighte (O₂–Hb
dissociation and P₅₀ shifts), Fick (diffusion), Mecklenburgh (rate/tidal-volume relation),
neonatal V̇O₂/RQ and Q₁₀ sources, and surfactant recruitment-hysteresis sources. Reuse the
cardiovascular paper's shared citations (Beneken, van Meurs) for the circuit primitives and the
AI/software citations (Block G of `circ-paper-additions.md`) for the parameterization pointer.
