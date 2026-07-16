# An integrated model for simulation of neonatal physiology — THE mechanical support devices: ventilation and ECMO

*Fourth paper in the EXPLAIN series (companion to the cardiovascular, respiratory, other-systems and
AI-parameterization papers). Target journal: Pediatric Research. Markdown working draft — equations to
be re-keyed as native Word (OMML) objects. Every equation is transcribed from and checked against the
engine source: `explain/device_models/Ventilator.js`, `explain/device_models/Ecls.js` (and, where
included, `Resuscitation.js`, `Monitor.js`). This paper builds directly on the gas-exchange and
respiratory mechanics of the respiratory companion paper, which it cross-references rather than
repeats.*

---

## Abstract

*(Structured abstract — Pediatric Research Basic Science format. Prior long-form draft superseded.)*

**Background:** Sick newborns are frequently supported by devices that act on the physiology — the mechanical ventilator, which drives gas into the lungs, and extracorporeal membrane oxygenation (ECMO), which takes over gas exchange and circulation. We model these devices in the EXPLAIN neonatal simulator.

**Methods:** Each device is a physical source wired into the same compartments as the native physiology, so its effects emerge rather than being prescribed. The ventilator is a gas circuit connected through a resistive endotracheal tube, implementing the clinical modes (pressure control, PRVC, pressure support, CPAP) with triggering and volume-targeting, composing with spontaneous breathing. ECMO is a blood pump and a membrane oxygenator that reuses the native lung's gas-exchange law, with cannulae to named compartments (veno-arterial or veno-venous).

**Results:** In a surfactant-deficient lung, ventilation restored oxygenation with inspired oxygen and pressure and cleared carbon dioxide with rate, the servo holding tidal volume fixed. Veno-arterial ECMO rescued profound hypoxaemia (arterial PO₂ 11→95 mmHg) as pump flow rose, with carbon-dioxide removal set by sweep-gas flow. All blood gases were emergent, not prescribed.

**Conclusion:** Because the devices act through shared compartments, delivered volumes, blood gases and device–patient interactions are emergent and interpretable, completing the simulator.

---

## 1. Introduction

Much of neonatal intensive care consists of supporting, or temporarily replacing, cardiorespiratory
function with machines. A mechanical ventilator delivers gas to the lungs under clinician-set
pressures, volumes and timing when an infant cannot breathe adequately alone; extracorporeal membrane
oxygenation (ECMO) diverts blood through an artificial lung and pump when the native lung, or the
heart, cannot sustain gas exchange or the circulation at all. These are among the most consequential
interventions in the newborn intensive care unit, and among the hardest to teach, precisely because
their effect on the patient is never the setting itself but the interaction between the machine and a
particular physiology.

That interaction is the crux. A set peak inspiratory pressure does not fix a tidal volume — it
produces one that depends on the lung's compliance and the resistance of the endotracheal tube, and
that changes as the lung stiffens or recruits. A pressure-support or synchronized breath is
meaningful only in relation to the infant's own respiratory effort, which it must detect and augment
rather than fight. Continuous positive airway pressure holds the lung open but ventilates only a
patient who is breathing. On ECMO, pump flow and sweep-gas flow partition oxygenation and
carbon-dioxide clearance between the artificial and the native lung, and in the veno-arterial
configuration the returning flow interacts with the heart's own output. In each case the clinically
relevant quantity — the delivered volume, the arterial blood gas, the systemic oxygen delivery — is
an emergent property of the coupled device–patient system, not a number the device sets.

A model intended to teach or investigate neonatal respiratory and circulatory support must therefore
represent the devices not as generators of prescribed outputs but as physical sources — of gas
pressure, or of blood flow — wired into the same compartments as the native physiology, so that the
resulting mechanics, gas exchange and haemodynamics fall out of the same equations that govern the
unsupported patient. That is the approach taken here. This paper describes the device layer of
EXPLAIN — the mechanical ventilator, extracorporeal membrane oxygenation, and, more briefly,
cardiopulmonary resuscitation and the bedside monitor — and, crucially, its coupling to the
respiratory and circulatory models of the companion papers. The ventilator is a gas circuit connected
to the airway through an endotracheal tube; ECMO is a blood circuit connected between two circulatory
compartments whose oxygenator reuses the very same gas-exchange law as the native lung. Because the
devices act through shared compartments, their effects, and their interactions with the patient's own
physiology, are emergent and interpretable. The scientific contribution is a compact, fully specified
model of neonatal mechanical ventilation and ECMO and their coupling to the patient, completing the
integrated simulator of the series; as throughout, device settings and patient parameters can be set
by the AI-assisted calibration pipeline of the parameterization companion paper. Below we specify the
devices (Section 2) and demonstrate that ventilation and ECMO restore oxygenation and carbon-dioxide
clearance in a failing lung as a function of their clinical controls (Section 3).

---

## 2. Methods

Notation and units follow the series convention (respiratory paper §S1). Ventilator pressures are
given in the clinical unit cmH₂O and converted to the engine's mmHg by

> **Eq. 1** &nbsp; *P*[mmHg] = *P*[cmH₂O] / 1.35951

Throughout, Δt is the integration step and *x* ← *x* + (…)·Δt denotes forward-Euler integration. The
gas compartments, valves (directional resistors), gas composition and the alveolar gas exchange that
the devices act upon are defined in the respiratory paper and are referenced here by name.

### 2.1 The mechanical ventilator

*Source: `explain/device_models/Ventilator.js`.*

**Conceptual model.** The ventilator is a small gas circuit wired in series to the patient's airway:
a fresh-gas inlet compartment (`VENT_GASIN`) at the set inspired oxygen fraction, temperature and
humidity; a compliant circuit compartment (`VENT_GASCIRCUIT`); an inspiratory valve
(`VENT_INSP_VALVE`) and an expiratory valve (`VENT_EXP_VALVE`) (directional resistors); an expiratory
reservoir (`VENT_GASOUT`) that sets the positive end-expiratory pressure (PEEP); and an endotracheal
tube (`VENT_ETTUBE`) connecting the circuit to the patient's dead space. Enabling the ventilator
(`switch_ventilator`) opens this network and blocks the natural airway inlet (`MOUTH_DS`), i.e.
intubates the patient; the alveolar gas exchange downstream is unchanged (respiratory paper).

**Endotracheal-tube resistance.** The tube is a resistor whose resistance rises with gas flow and
falls with bore, following a diameter- and length-dependent law:

> **Eq. 2** &nbsp; *R*_ETT = max( 15,  (*a*·*f* + *b*)·(*L*/*L*_ref) ),  &nbsp; *a* = −2.375·*d* + 11.9375,  *b* = −14.375·*d* + 65.9374

with *d* the internal diameter (mm), *L* the length (mm, reference *L*_ref = 110), *f* the gas flow,
and a floor of 15 (mmHg·s·L⁻¹). The flow-dependent term makes the tube a Rohrer-type (non-ohmic)
resistance; the coefficients *a*, *b* decrease with diameter, so a wider tube offers less resistance.

**Pressure control and pressure-regulated volume control (PC/PRVC).** In inspiration the expiratory
valve is closed and the inspiratory valve is opened with a resistance set so that the delivered flow
drives the circuit toward the target peak inspiratory pressure (PIP):

> **Eq. 3** &nbsp; *R*_insp = (*P*_gasin + PIP − *P*_atm − PEEP) / (*Q*_insp/60)

(with *Q*_insp the set inspiratory flow, L·min⁻¹); the inspiratory valve is shut once the circuit
pressure reaches PIP, so the breath is pressure-limited. In expiration the expiratory valve opens and
the expiratory reservoir volume is pinned so that the circuit floats at PEEP,

> **Eq. 4** &nbsp; *V*_gasout = PEEP / *E*_base + *V*ᵤ

Breaths are time-cycled: the expiratory time follows from the set rate and inspiratory time,

> **Eq. 5** &nbsp; *T*_exp = 60/RR − *T*_insp

and inspiration and expiration alternate as their timers elapse. At end-expiration the dynamic
compliance is measured from the achieved tidal volume and the driving pressure,

> **Eq. 6** &nbsp; *C*_dyn = *V*_T / (PIP − PEEP)  &nbsp;[mL·cmH₂O⁻¹]

In pressure-regulated volume control the peak pressure is adjusted breath-to-breath by a servo that
drives the measured expiratory tidal volume to the set target *V*_T\*, within bounds:

> **Eq. 7** &nbsp; PIP ← PIP ± 1 cmH₂O per breath,  clamped to [PEEP + 2, PIP_max],  toward *V*_T = *V*_T\*

so PRVC delivers a targeted volume at the lowest sufficient pressure — the volume-targeting behaviour
of the clinical mode.

**Pressure support (PS).** A supported breath is patient-initiated and flow-cycled: once triggered,
inspiration continues while the endotracheal-tube flow rises, and the ventilator cycles to expiration
when the flow falls below a fraction of its peak,

> **Eq. 8** &nbsp; cycle to expiration when *f*_ETT < 0.3·*f*_peak

reproducing the flow-termination criterion of clinical pressure support.

**Continuous positive airway pressure (CPAP).** Both valves remain open and the circuit is held at the
CPAP level (= PEEP); the patient breathes spontaneously through the endotracheal tube (respiratory
paper, the spontaneous-drive model). With spontaneous breathing off, CPAP holds airway pressure but
delivers no tidal volume, as in reality. The reported minute ventilation is the patient's own:

> **Eq. 9** &nbsp; *V̇*_E = *V*_T · RR_spont

**Patient triggering (synchronized ventilation).** When synchronized, a mechanical breath is triggered
by the patient's own inspiratory effort: the tube flow drawn during a spontaneous inspiration is
integrated, and a breath is delivered once it exceeds a trigger volume set as a fraction of the tidal
volume,

> **Eq. 10** &nbsp; trigger when ∫ *f*_ETT d*t* > *V*_trig = *V*_T · (trigger% / 100)

so that assisted breaths are phase-locked to the patient's drive. This coupling to the spontaneous
respiratory model (which reads the active airway inlet, whether the natural mouth or the endotracheal
tube) is what lets the same lung be ventilated mechanically, supported, or left spontaneous, with the
tidal-volume bookkeeping consistent across all three.

**Reported quantities.** Airway pressure is reported as (circuit pressure − atmospheric) in cmH₂O,
the endotracheal-tube flow as *f*_ETT·60 (L·min⁻¹), and end-tidal CO₂ as the dead-space PCO₂ sampled
at end-expiration. Crucially, the ventilator sets only the airway gas composition (inspired oxygen
fraction) and the ventilation pattern; **arterial oxygenation and carbon-dioxide clearance are not
prescribed by the device** but emerge from the alveolar gas exchange of the respiratory model
(respiratory paper, Fick flux) under the delivered ventilation.

### 2.2 Extracorporeal membrane oxygenation (ECMO)

*Source: `explain/device_models/Ecls.js`.*

**Conceptual model.** ECMO is modelled as an extracorporeal blood circuit wired in series between two
named patient compartments: blood is drained from a drainage site, driven by a pump through a membrane
oxygenator, and returned to a return site. The model is a coordinator that owns a chain of
sub-compartments — drainage cannula (a resistor) → inflow tubing → pump → oxygenator → outflow tubing
→ return cannula (a resistor) — together with a parallel sweep-gas limb (a gas source, an inlet valve,
the oxygenator gas side, and an outlet) coupled to the blood by a membrane gas-exchanger. The
**veno-arterial** (circulatory + respiratory support) and **veno-venous** (respiratory support only)
configurations differ only in the choice of drainage and return sites (e.g. VA: drain the right atrium,
return the aortic root; VV: drain and return on the venous side); there is no separate code path.

**Pump.** The pump generates a head that is a linear function of its speed, imposed as an external
pressure on the node it drives (the downstream node for a centrifugal pump, the upstream node for a
roller pump):

> **Eq. 11** &nbsp; *p*_pump = −RPM / 25  &nbsp;[mmHg]

(so 1500 rpm ≈ −60 mmHg). This is a deliberate surrogate rather than a physical centrifugal head–flow
curve. Every circuit segment is a resistor with a prescribed resistance (the cannulae use measured
resistances from a library of real devices — e.g. Bio-Medicus and Medtronic arterial/venous cannulae
of stated French size — scaled by a per-segment multiplier), so the circuit flow through each segment
is linear in its pressure drop:

> **Eq. 12** &nbsp; *Q*_i = Δ*p*_i / *R*_i,  &nbsp; *R*_i = *R*_{0,i}·*k*_i

with *R*_{0,i} the base/library resistance and *k*_i the segment's resistance factor; the pump head of
Eq. 11 sets the pressure drop across the driven segment. The reported circuit flow is the return-cannula
flow, 60·*Q*_return (L·min⁻¹).

**Membrane oxygenator.** Gas transfer across the membrane reuses the *same* partial-pressure-driven
Fick flux as the native alveolar–capillary barrier (respiratory paper, Eqs. 13–14), applied between the
oxygenator's blood compartment and its sweep-gas compartment:

> **Eq. 13** &nbsp; Φ_X = (*P*_X,blood − *P*_X,gas)·*D*_X·Δt  &nbsp;(X ∈ {O₂, CO₂})

with membrane diffusion constants *D*_O₂ and *D*_CO₂; because the sweep gas is oxygen-rich and
carbon-dioxide-free, the gradients drive O₂ into the blood and CO₂ out. The sweep-gas fraction of
oxygen and the sweep-gas flow set the gas-side partial pressures (the inlet valve is sized to deliver
the requested sweep flow), so oxygenation and decarboxylation across the membrane are governed by the
same physics as the lung, differing only in the compartments and the diffusion constants.

**Coupling to the patient.** The circuit exchanges volume — and, with it, the dissolved gases, solutes,
drugs, temperature and viscosity — with the patient at the drainage and return sites by the same
advective mixing rule as the rest of the circulation (respiratory/shared Methods, Eq. S2): oxygenated
blood returned to the return site and deoxygenated blood drained from the drainage site propagate their
gas contents into the systemic circuit by fractional mixing. When the circuit is clamped, its
sub-compartments carry no flow and the membrane exchange is disabled, so a primed but clamped circuit is
inert until opened. The partition of gas exchange between the membrane and the native lung — and the
haemodynamic effect of returning flow to the arterial side in the veno-arterial configuration — are
therefore emergent consequences of the coupled circuit and patient, not prescribed device outputs.

### 2.3 Cardiopulmonary resuscitation and the patient monitor

*Source: `explain/device_models/Resuscitation.js`, `explain/device_models/Monitor.js`.*

**Resuscitation.** Chest compressions are modelled as a rhythmic external pressure applied to a
weighted set of intrathoracic compartments (heart chambers, great vessels, lungs), following a
half-rectified sinusoid:

> **Eq. 14** &nbsp; *p*_cc(*t*) = *A*·sin(2π*f*·*t* − π/2) + *A*,  &nbsp; *A* = *p*_max/2,  *f* = *f*_comp/60

(so *p*_cc ramps 0 → *p*_max → 0 each compression). The pressure is added to each target compartment's
external pressure with a per-compartment weight, *p*_ext^(k) ← *p*_ext^(k) + *w*_k·*p*_cc; because the
compartment pressures then rise, the interconnecting resistors generate forward flow (*Q* = Δ*p*/*R*) —
this is how compressions drive a circulation. Interposed ventilations are delivered through the
ventilator (pressure control) with spontaneous breathing suppressed, at a set compression:ventilation
pattern (`switch_cpr`).

**Monitor.** The monitor is a read-only observer that derives the displayed bedside vitals from the
model state each step, writing to nothing. Heart rate is the mean of the last twelve beat-to-beat rates
(60/interval); respiratory rate is the breath count over a moving window; end-tidal CO₂ is the
end-expiratory dead-space PCO₂ (from the ventilator when ventilated, or the spontaneous breath peak);
pre- and post-ductal saturations are read from the ascending and descending aorta and mixed-venous
saturation from the venous return. Chamber and vessel pressures are reported as **true integral means
over the beat**, *p̄* = (1/n)Σ*p*, rather than the arterial estimate (2*p*_min + *p*_max)/3, which is
valid only for arterial waveforms and underestimates atrial/venous means; flows are beat-averaged, and
oxygen-delivery indices are formed as flow × oxygen content. This is the block that produces the numbers
the calibration pipeline (parameterization companion paper) reads as its measured targets.

### 2.4 Software implementation and AI-assisted parameterization

See shared Methods (respiratory paper §S5) for the engine implementation; the interactive model is
freely available at https://explain-modeling.com and the complete, annotated engine source code is
publicly available at https://github.com/Dobutamine/explain-engine and archived with a persistent identifier at https://doi.org/10.5281/zenodo.21389097.
See the parameterization companion paper [P6] for how device settings and patient parameters are set by
the AI-assisted calibration pipeline. The devices run in the same insertion-ordered step loop as the patient models, sharing the
gas and blood compartments so that support and physiology are solved together.

---

## 3. Results — illustrative simulations

Each experiment drives a device on a calibrated patient headlessly (shared Methods §S7) and reports
the emergent response; all blood gases are produced by the engine's gas-exchange and acid–base
solvers, not prescribed by the device. Scripts: `scripts/probe_ventilator.mjs` (§3.1),
`scripts/probe_ecls.mjs` (§3.2).

### 3.1 Mechanical ventilation of the surfactant-deficient lung

A preterm 28-week RDS scenario (`preterm_28wk.json`, ≈1 kg) was intubated and ventilated in
pressure-regulated volume control with the spontaneous drive suppressed. With the tidal-volume target
held at 5 mL·kg⁻¹, raising the inspired oxygen fraction raised arterial oxygenation monotonically
while the tidal volume and arterial CO₂ were unchanged (Table 1a) — the device's oxygen and
ventilation controls act independently, and the volume-targeting servo held the delivered volume
constant. Raising the ventilator rate raised minute ventilation and lowered arterial CO₂ across the
range from hypercapnia to normocapnia (Table 1b). Raising PEEP raised the mean airway pressure and
produced a smaller, monotonic improvement in oxygenation through recruitment (Table 1c). Oxygenation
and CO₂ clearance are emergent from the alveolar gas exchange of the respiratory model under the
ventilation the device delivers, not device outputs.

**Table 1a. Oxygenation vs inspired oxygen** (PRVC, target 5 mL, PEEP 5 cmH₂O, rate 40).

| FiO₂ | PaO₂ (mmHg) | SpO₂ (%) | PaCO₂ (mmHg) | V_T (mL) |
|---|---|---|---|---|
| 0.3 | 59.4 | 92.4 | 48.9 | 5.0 |
| 0.5 | 68.1 | 94.5 | 49.4 | 5.0 |
| 0.7 | 79.7 | 96.3 | 49.9 | 5.0 |
| 0.9 | 99.7 | 97.9 | 50.3 | 5.0 |

*Reference: the delivered tidal volume (5 mL·kg⁻¹) sits within the neonatal lung-protective target of 4–6 mL·kg⁻¹ (Keszler 2005; Schulzke 2021), and the volume-targeting servo holds it there across the FiO₂ sweep.*

**Table 1b. CO₂ clearance vs ventilator rate** (PRVC, target 5 mL, FiO₂ 0.5, PEEP 5 cmH₂O).

| Rate (min⁻¹) | Minute vol. (mL·min⁻¹) | PaCO₂ (mmHg) |
|---|---|---|
| 20 | 100 | 72.5 |
| 30 | 149 | 58.7 |
| 40 | 198 | 49.4 |
| 60 | 291 | 38.3 |

**Table 1c. Oxygenation vs PEEP** (PRVC, target 5 mL, FiO₂ 0.4).

| PEEP (cmH₂O) | Mean airway P (cmH₂O) | PaO₂ (mmHg) | SpO₂ (%) |
|---|---|---|---|
| 2 | 2.6 | 62.9 | 93.8 |
| 4 | 4.6 | 63.5 | 93.7 |
| 6 | 6.6 | 63.9 | 93.4 |
| 8 | 8.6 | 64.4 | 93.3 |

### 3.2 ECMO support of systemic gas exchange

Severe respiratory failure was induced on a term neonate (`term_neonate.json`) by near-abolishing
alveolar oxygen diffusion, giving profound hypoxaemia with the native lung alone (PaO₂ 11 mmHg,
SpO₂ 14 %). Veno-arterial ECMO (drainage from the superior caval/right-atrial inlet, return to the
aortic root) was then started. Increasing the pump speed raised the extracorporeal circuit flow and,
with it, systemic oxygenation, saturating once the circuit flow plateaued at ≈ 0.47 L·min⁻¹
(≈ 130 mL·kg⁻¹·min⁻¹, a clinical neonatal flow); the post-oxygenator blood was fully saturated and
mixed-venous saturation rose from 24 % to > 80 % (Table 2a). At a fixed pump speed, increasing the
sweep-gas flow progressively lowered arterial CO₂ (Table 2b) — the membrane clearing carbon dioxide
exactly as the sweep gradient dictates. Both effects arise from the membrane gas-exchanger (the same
Fick law as the native lung) and the return of oxygenated blood to the circulation, not from prescribed
device outputs.

**Table 2a. ECMO rescue vs pump speed** (sweep gas 0.5 L·min⁻¹, sweep FiO₂ 1.0; native lung failed).

| Pump (rpm) | Circuit flow (L·min⁻¹) | PaO₂ (mmHg) | SpO₂ (%) | SvO₂ (%) | Post-oxygenator SO₂ (%) |
|---|---|---|---|---|---|
| off | 0 | 11.0 | 14.2 | — | — |
| 1500 | 0.05 | 16.3 | 35.0 | 24 | 85 |
| 2500 | 0.43 | 85.3 | 98.4 | 81 | 100 |
| 3500 | 0.47 | 95.5 | 98.8 | 83 | 100 |
| 4500 | 0.47 | 98.3 | 98.9 | 83 | 100 |

*Reference: the plateau circuit flow (≈130 mL·kg⁻¹·min⁻¹) sits within the 100–150 mL·kg⁻¹·min⁻¹ target-flow range for neonatal respiratory ECMO (Wild et al. 2020, ELSO Guidelines for Neonatal Respiratory Failure; Fletcher et al. 2018).*

**Table 2b. CO₂ removal vs sweep-gas flow** (pump 3500 rpm, sweep FiO₂ 1.0).

| Sweep gas (L·min⁻¹) | PaCO₂ (mmHg) | PaO₂ (mmHg) |
|---|---|---|
| 0.2 | 36.7 | 97.4 |
| 0.5 | 30.5 | 94.7 |
| 1.0 | 27.0 | 90.8 |
| 2.0 | 24.6 | 87.6 |

---

## 4. Discussion

### 4.1 Model originality

The device layer completes the EXPLAIN series by adding the machines that neonatal intensive care uses
to support the physiology the other papers describe, and it does so in a way that keeps the whole
simulator internally consistent. Rather than modelling a ventilator or an ECMO circuit as a source of
prescribed outputs — a set tidal volume, a set arterial oxygen tension — each device is modelled as a
physical source wired into the same compartments as the native physiology: the ventilator as a gas
circuit coupled to the airway through an endotracheal tube, ECMO as a blood circuit coupled between two
circulatory compartments. The consequences the clinician cares about then emerge from the same
equations that govern the unsupported patient. The delivered tidal volume is whatever the set pressure
produces given the lung's compliance and the tube's resistance; the arterial blood gas on either device
is computed by the same gas-exchange and acid–base solvers used everywhere else. A particularly direct
expression of this economy is that the ECMO membrane oxygenator reuses the identical partial-pressure-
driven flux law as the native alveolar–capillary barrier — the artificial lung and the real lung are
the same equation applied to different compartments. Because the devices act through shared
compartments, their interactions with the patient — a synchronized breath augmenting the infant's own
effort, veno-arterial ECMO flow interacting with native cardiac output — are represented without any
special-case machinery, and remain interpretable.

### 4.2 Model validity

The simulations of Section 3 show the devices reproducing the expected clinical dependencies. Under
mechanical ventilation of a surfactant-deficient lung, arterial oxygenation rose monotonically with the
inspired oxygen fraction while the volume-targeting servo held the tidal volume fixed and arterial
carbon dioxide constant (Table 1a), demonstrating that the device's oxygen and ventilation controls act
independently; raising the ventilator rate lowered arterial carbon dioxide across the clinical range
(Table 1b); and raising PEEP produced the expected, smaller, recruitment-driven improvement in
oxygenation (Table 1c). Under ECMO, a lung failed to profound hypoxaemia was rescued as pump speed
raised circuit flow and systemic oxygenation, saturating at a circuit flow (≈ 130 mL·kg⁻¹·min⁻¹) in the
clinical neonatal range, with the post-oxygenator blood fully saturated; and sweep-gas flow controlled
carbon-dioxide removal (Tables 2a–b). In every case the blood gas is an emergent output of the coupled
device–patient system rather than a device setting. As with the other companion papers, these are
demonstrations of mechanistic behaviour across the operating range, not a formal clinical validation
against device-specific performance data, which is future work.

**Validation strategy (series).** This paper validates the device physiology — mechanical ventilation and
ECMO gas exchange — in depth, in the directions and magnitudes its account is built on, against the cited
literature and device values. Consistent with the series' two-altitude design, comprehensive quantitative
validation of the AI-parameterized cohort as a whole, against published reference ranges and disease
signatures, is centralized in the integrated flagship [P5], and the identifiability and one-lever-per-target
basis of the parameterization is validated by the formal sensitivity analysis of [P6]. Validation throughout
the series is to literature ranges and pattern, not to prospective individual-patient data.

### 4.3 Reproducibility and model expansion

Every quantitative result is reproduced from the engine by a named script — the ventilator sweeps by
`probe_ventilator.mjs` and the ECMO sweeps by `probe_ecls.mjs` — so each table can be regenerated and
audited. Each ventilator mode and each part of the ECMO circuit is a self-contained module operating on
the shared gas and blood compartments, so additional support modalities can be added without modifying
the engine, in the same way the ventilator and ECMO were added on top of the respiratory and
circulatory models.

### 4.4 Limitations. The devices share the lumped, real-time simplifications of the rest of the
engine. The ventilator uses single-compartment lung mechanics and an empirical, flow- and
bore-dependent endotracheal-tube resistance law rather than a resolved tube geometry. For ECMO, the
pump is represented by a linear speed-to-pressure surrogate (Eq. 11) rather than a physical
centrifugal head–flow curve, and the circuit and cannula resistances are prescribed constants (taken
from measured device values) rather than computed from geometry; consequently the model captures the
*dependence* of circuit flow on pump drive and resistance but not the detailed pressure–flow
characteristic of a specific pump. The membrane oxygenator is a single lumped exchanger with fixed
diffusion constants, so it does not resolve diffusion-limitation or recirculation effects. Both devices
inherit the respiratory model's lumped gas exchange (no continuous ventilation/perfusion
distribution).

**4.5 Future work.** High-frequency oscillatory ventilation; a physical pump head–flow characteristic
and geometry-derived cannula resistances; closed-loop device control (weaning, oxygen and ventilation
servo-targeting) driven by the parameterization pipeline; and the interaction of veno-arterial ECMO
with native cardiac recovery and differential (north–south) oxygenation.

---

## Conclusion

The device layer of EXPLAIN provides a transparent, real-time, mechanistic account of neonatal
mechanical ventilation and extracorporeal membrane oxygenation, together with cardiopulmonary
resuscitation and the derivation of the bedside monitor. By modelling each device as a physical source
of gas pressure or blood flow wired into the same compartments as the native physiology — the ECMO
oxygenator reusing the very gas-exchange law of the native lung — it makes the delivered volumes, blood
gases and haemodynamics emergent consequences of the coupled device–patient system rather than
prescribed device outputs. Together with its cardiovascular, respiratory, other-systems and
parameterization companions, it completes an integrated, interpretable and freely available platform
for teaching and investigating the whole of neonatal cardiorespiratory intensive care, from the
unsupported patient to full mechanical and extracorporeal support.

---

## References

See `thesis/_references.md` (device sources verified against PubMed, 2026-07-12; renumber in citation
order at assembly). Endotracheal-tube resistance for Eq. 2: Jarreau et al. 1999 (PMID 10409556) and
Spaeth et al. 2015 (PMID 25491944). Ventilator modes (PC/PRVC/PS/CPAP) and volume targeting: Keszler
2005 (PMID 15861164) and Schulzke & Stoecklin 2021 (PMID 34878697). ECMO circuit/oxygenator: Butt et
al. 2013 (PMID 23735980) and Cortesi et al. 2022 (PMID 36090551). The ECMO membrane oxygenator reuses
the respiratory paper's partial-pressure gas-exchange law, so its citations are shared; the series'
shared software/AI citations apply for the engine and the parameterization pipeline.
