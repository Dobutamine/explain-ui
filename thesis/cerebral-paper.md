# An integrated model for simulation of neonatal physiology — cerebral haemodynamics and intracranial pressure

*Paper P3a of the EXPLAIN series (companion to the cardiovascular [P1], respiratory [P2], homeostatic-regulation [P3b], mechanical-support-device [P4], integrated-model [P5], AI-parameterization [P6] and congenital-heart-disease [P7] papers). Target journal: Pediatric Research; article type: Basic Science Article. Markdown working draft 2026-07-13. This is the cerebral thread refocused out of the former regulatory-organ omnibus; the other regulatory controllers (renal, endocrine, thermoregulation, glucose, pharmacology) and the general "process-controller" architecture are described in the companion homeostatic-regulation paper [P3b]. Every simulated value is produced by the engine and reproduced by the named probe script (`scripts/probe_brain.mjs`; reproducibility convention of the series, P1 §2.3), not asserted. Equations to be re-keyed as native Word (OMML) objects at assembly; citations in order of appearance.*

---

## Abstract

**Background:** The immature and asphyxiated newborn brain is injured when cerebral blood flow is not defended against changes in perfusion pressure: a pressure-passive circulation underlies intraventricular haemorrhage in the preterm and hypoxic–ischaemic injury after asphyxia. We model neonatal cerebral autoregulation coupled to intracranial pressure in EXPLAIN.

**Methods:** The cerebral bed is made an autoregulating organ: a leaky myogenic integrator adjusts arteriolar resistance to hold cerebral blood flow near its set-point across a range of perfusion pressure, with a maturity gain grading autoregulatory authority from intact (term) to fully pressure-passive; intracranial pressure rises with intracranial volume (Monro–Kellie) and acts on cerebral venous outflow. The controller is neutral at baseline and verified with a reproducible headless harness.

**Results:** With autoregulation intact a 15 % haemorrhage lowered cerebral blood flow only 10 %, preserving oxygen content; with the circulation pressure-passive the same insult collapsed flow 46 % and cerebral oxygen content almost three-fold — the substrate of ischaemic injury. Intracranial oedema raised intracranial pressure 5→55 mmHg and collapsed perfusion pressure; autoregulation still defended flow, but with autoregulation also lost (hypoxic–ischaemic) flow and oxygen content fell together.

**Conclusion:** A compact autoregulation-plus-intracranial-pressure controller reproduces, in real time, the pressure-passive cerebral physiology that underlies neonatal brain injury.

---

## 1. Introduction

Much of the neurological morbidity of the newborn intensive-care unit originates in the cerebral circulation. In the preterm infant, a blood-pressure-passive cerebral perfusion — flow that follows arterial pressure because autoregulation is immature or lost — precedes germinal-matrix and intraventricular haemorrhage (Alderliesten et al. 2012); in the asphyxiated term infant, impaired autoregulation after hypoxia–ischaemia is associated with the severity of hypoxic–ischaemic encephalopathy (Massaro et al. 2015). Both are failures of the same physiology: the normal ability of the cerebral bed to hold its blood flow roughly constant across a range of perfusion pressure, and the way that ability is bounded by intracranial pressure through the Monro–Kellie doctrine. Reasoning about this at the bedside is hard because cerebral blood flow is not directly measured, cerebral perfusion pressure is the difference of two quantities (arterial and intracranial pressure), and the autoregulatory reserve varies with maturity and injury.

In this paper we model neonatal cerebral autoregulation coupled to intracranial pressure in EXPLAIN, a real-time, whole-body mechanistic neonatal model whose cardiovascular and respiratory subsystems are described in companion papers [P1, P2]. The cerebral controller is one of a family of regulatory models built as compact "process controllers" that own no blood compartment of their own and instead sense the shared physiological state and write onto other models' composable effector layers; that general architecture, and the other regulatory organs (renal, endocrine, thermal, glucose and pharmacological), are described in the companion homeostatic-regulation paper [P3b]. Here we develop the cerebral thread in full and show that, on the shared circulation, it reproduces the two clinically decisive behaviours: an intact autoregulation that defends cerebral blood flow and oxygen delivery against systemic hypotension, and a pressure-passive circulation that does not — the modelled substrate of intraventricular haemorrhage and hypoxic–ischaemic injury — together with the effect of raised intracranial pressure on cerebral perfusion.

## 2. Methods

### 2.1 Conceptual model

The cerebral vascular bed (ascending aorta → feeding arteriole → cerebral artery → capillary → vein → jugular return) is, in the cardiovascular and respiratory papers [P1, P2], a passive resistive–capacitive network carried on the shared advective blood substrate. The cerebral model turns it into an autoregulating organ with an intracranial-pressure compartment, without giving it any private blood volume: cerebral blood flow (CBF) is the flow through the feeding resistor, cerebral perfusion pressure (CPP) is mean arterial pressure minus intracranial pressure (ICP), autoregulation adjusts the cerebral arteriolar resistance to hold CBF near its set-point across a range of CPP, and ICP rises with intracranial volume through a Monro–Kellie exponential. The controller writes only onto persistent resistance-factor layers of the feeding arteriole and the venous outflow, and is constructed to be neutral at the calibrated baseline (its factors are unity there), so enabling or disabling it does not move the steady state. This is the general "process-controller" design of the regulatory family [P3b], instantiated for the cerebral circulation.

### 2.2 Mathematical model

Notation and units follow shared Methods S1 [P1]; **AA** is the ascending-aorta (systemic arterial) sample and **AA_BR_ART** the resistor feeding the cerebral bed. Instantaneous aortic pressure and cerebral flow are low-pass filtered so the loop tracks *mean* values (τ = 3 s):

> **(1)**  *P̄*_MAP ← lag(*P*_AA; τ_pres),  *Q̄*_CBF ← lag(60·Φ_{AA_BR_ART}; τ_cbf)   [L·min⁻¹]

where Φ is the feeding-resistor flow (L·s⁻¹) and 60 converts to L·min⁻¹.

**Intracranial pressure (Monro–Kellie).** Cerebral blood volume is the summed volume of the three intracranial vascular compartments, CBV = 10³·Σ*V*_c (mL). The excess of intracranial volume over its seeded baseline, plus any added oedema volume *V*_edema, raises ICP through an exponential compliance:

> **(2)**  Δ*V* = (CBV − CBV₀) + *V*_edema   [mL]

> **(3)**  ICP = ICP_base + clamp( *e*₀·[exp(*k*Δ*V*) − 1], 0, ICP_excess,max )   [mmHg]

with ICP_base = 5 mmHg, compliance scale *e*₀ = 4 mmHg, stiffness *k* = 0.18 mL⁻¹ and a 70 mmHg ceiling; the lower clamp encodes that a smaller-than-baseline cranium generates no negative pressure. Rather than imposing ICP as an external pressure on a series of compartments — which would not change their steady-state throughflow — the model applies it as a **venous outflow resistance** (the bridging-vein "vascular waterfall"): raised ICP compresses cerebral venous outflow, raising its resistance and lowering CBF,

> **(4)**  *r*^{ps}_{BR_VEN_VUB} = clamp( 1 + *g*_out·ICP_excess, 1, 8 ),   *g*_out = 0.03 mmHg⁻¹.

Cerebral perfusion pressure closes the loop: **(5)** CPP = *P̄*_MAP − ICP.

**Autoregulation.** A leaky (myogenic-style) integrator drives the cerebral arteriolar resistance factor to hold CBF at its seeded set-point *Q*^set. With fractional flow error ε = (*Q̄*_CBF − *Q*^set)/*Q*^set, the integrator *I* (a resistance multiplier) obeys

> **(6)**  *İ* = *g*_c·ε − λ·(*I* − 1),   *I* ← clamp(*I* + *İ*·*u*, *f*_min, *f*_max)

> **(7)**  *a* = clamp( 1 + *g*_ar·(*I* − 1), *f*_min, *f*_max ),   *r*^{ps}_{AA_BR_ART} ← lag(*a*; τ_ar)

with control gain *g*_c = 5.0 s⁻¹ per fractional error, leak λ = 0.05 s⁻¹, integrator window [*f*_min, *f*_max] = [0.15, 6.0] (maximal vasodilation to maximal vasoconstriction), application time constant τ_ar = 4 s, and a **maturity gain** *g*_ar ∈ [0, 1] that scales the entire autoregulatory authority: *g*_ar = 1 is an intact term brain, *g*_ar = 0 is a fully pressure-passive circulation (the sick preterm or hypoxic–ischaemic brain, in which CBF simply tracks perfusion pressure). The high control-gain-to-leak ratio (≈100) produces strong regulation with a small residual droop; the outflow-resistance loop gain is kept below unity so the ICP → venous-congestion → CBV → ICP feedback cannot run away. The pressure–volume exponential and the Monro–Kellie framing are standard in the neurocritical-care literature (Mokri 2001); the autoregulation plateau and its maturational grading follow the neonatal cerebral-haemodynamics literature (Alderliesten et al. 2012; Massaro et al. 2015).

### 2.3 Software implementation and reproducibility

EXPLAIN is a framework-agnostic JavaScript/TypeScript engine running in a Web Worker, with scenarios defined declaratively as JSON [P1 §2.3]. The cerebral controller is an ordinary model module that participates in the same step loop, data collection and task scheduling as the plant. The interactive model is freely available at https://explain-modeling.com; the complete, annotated engine source code is publicly available at https://github.com/Dobutamine/explain-engine and archived with a persistent identifier at https://doi.org/10.5281/zenodo.21389097. Every value below is steady-state, cycle-averaged over a measurement window after warm-up, and regenerated by re-running `scripts/probe_brain.mjs`.

### 2.4 AI-assisted patient-specific parameterization (pointer)

Patient-specific parameters are not tuned by hand but set by the AI-assisted, closed-loop calibration pipeline described in full in the companion parameterization paper [P6] (and summarized as a compact highlight, Box 1, in the cardiovascular paper [P1]): a large language model interprets the available clinical targets into a validated, allowlisted specification, and a deterministic calibrator drives one physiologically interpretable lever per target to a clinician-meaningful tolerance. For the cerebral model the individualising levers are the **autoregulation maturity gain** *g*_ar (set by gestational age and injury state) and the **cerebral-blood-flow set-point** *Q*^set; the intracranial compliance and the oedema volume *V*_edema are the pathophysiological modifiers. *AI-use disclosure:* a large language model (Claude, Anthropic) is used as a component of the parameterization method — it interprets clinical inputs and emits validated, allowlisted specifications, performs no numerical fitting, does not modify the model's equations or state, and is not used to generate the scientific content or text of this study; no authorship is attributed to it.

## 3. Results

All simulations use the calibrated `term_neonate` scenario unless noted, run headless (`scripts/probe_brain.mjs`); where the cerebral controller interacts with the autonomic baroreflex, the baroreflex was disabled to isolate the system under study. At baseline the model is neutral: the arteriolar resistance factor sits at ≈0.98 and cerebral blood flow is the committed value (Table 1, row 1).

### 3.1 Autoregulation defends cerebral blood flow against hypotension — the pressure-passive contrast

A 15 % haemorrhage lowers mean arterial pressure from 59 to ~42 mmHg. With autoregulation **intact** (*g*_ar = 1) the arteriole dilates toward its floor and cerebral blood flow falls only 10 % (143 → 128 mL·min⁻¹), preserving cerebral capillary oxygen content (4.89 → 4.37 mmol·L⁻¹). With the circulation **pressure-passive** (*g*_ar = 0) the same haemorrhage collapses cerebral blood flow by 46 % (143 → 77 mL·min⁻¹) and cerebral capillary oxygen content almost three-fold (4.89 → 1.78 mmol·L⁻¹) — the modelled substrate of ischaemic injury in the immature or asphyxiated brain, and the physiology that precedes intraventricular haemorrhage when a pressure-passive preterm circulation is exposed to swings in arterial pressure (Table 1).

### 3.2 Raised intracranial pressure and the Monro–Kellie limit

Intracranial oedema (12 mL) raises intracranial pressure from 5 to 55 mmHg and lowers cerebral perfusion pressure from 54 to 3 mmHg (Table 1). With autoregulation intact, cerebral blood flow is still substantially defended (to ~116 mL·min⁻¹) because the arteriole dilates to offset the fall in perfusion pressure — the reserve that a healthy term brain brings to a rise in intracranial pressure. The venous-outflow mechanism by which ICP acts (Eq. 4) reproduces the clinical observation that a rise in intracranial pressure lowers flow by congesting cerebral venous drainage rather than by simply opposing arterial inflow.

### 3.3 The hypoxic–ischaemic combination

The dangerous state is the conjunction of raised intracranial pressure and lost autoregulation, the picture after severe hypoxia–ischaemia. Combining oedema with a pressure-passive circulation drops cerebral blood flow and oxygen content together (to 100 mL·min⁻¹ and 3.40 mmol·L⁻¹; Table 1, last row), because the arteriole no longer dilates to defend flow against the reduced perfusion pressure. That the model separates the defended (autoregulation-intact) from the undefended (pressure-passive) response to the *same* intracranial insult is the specific validation that it captures the autoregulatory reserve, not merely a pressure–flow relationship.

**Table 1.** Cerebral response (means over a 6 s window; `probe_brain.mjs`, `term_neonate`, baroreflex off; 15 % haemorrhage; 12 mL oedema).

| Condition | MAP (mmHg) | CPP (mmHg) | ICP (mmHg) | CBF (mL·min⁻¹) | autoreg factor | brain *t*O₂ (mmol·L⁻¹) |
|---|---|---|---|---|---|---|
| baseline (neutral) | 59.0 | 54.2 | 5.1 | 142.6 | 0.98 | 4.889 |
| haemorrhage, autoregulation intact | 41.1 | 36.0 | 5.0 | 128.2 | 0.15 | 4.367 |
| haemorrhage, pressure-passive | 43.1 | 38.1 | 5.0 | 77.4 | 1.00 | 1.784 |
| oedema (ICP↑, autoregulation intact) | 58.8 | 3.4 | 55.4 | 115.6 | 0.15 | 4.018 |
| oedema + lost autoregulation (HIE) | 59.8 | 16.6 | 43.1 | 100.0 | 1.00 | 3.402 |

*Reference (literature): the validated quantity is the contrast, not an absolute value. With autoregulation intact the same hypotensive insult produces only a ~10 % fall in cerebral blood flow versus a ~46 % fall when the circulation is pressure-passive — the direction and relative magnitude reported for the intact versus impaired neonatal cerebral autoregulation of prematurity and IVH (Alderliesten et al. 2012) and of hypoxic–ischaemic encephalopathy (Massaro et al. 2015); absolute cerebral blood flow is model-scaled and reported here as an internal contrast rather than benchmarked against a measured band.*

### 3.4 Maturity grading

The single maturity gain *g*_ar (Eq. 7) places a patient on a continuum between the two extremes of Table 1: *g*_ar = 1 for the intact term brain, graded downward with prematurity toward *g*_ar = 0 for the fully pressure-passive circulation of the sick extreme-preterm or asphyxiated infant. Because the same term-neonate baseline is scaled to each gestational age with the maturity gain set accordingly, the model expresses the clinically observed loss of autoregulatory reserve with decreasing gestation as a single interpretable lever, individualised by the parameterization pipeline (§2.4).

## 4. Discussion

### 4.1 Model originality

Compared with the in-silico neonatal literature, which is largely confined to the systemic circulation (Munneke et al. 2021; van Willigen et al. 2026), this represents the cerebral circulation as an autoregulating organ coupled to intracranial pressure on a whole-body substrate, so that cerebral blood flow and oxygen content interact with the systemic haemodynamics and blood gases rather than being computed in isolation. The autoregulatory authority is a single maturity-graded lever, which lets the same model span the intact term brain and the pressure-passive preterm or asphyxiated brain — the two ends of the clinically important spectrum — and be fitted to an individual patient by the series' parameterization pipeline [P6].

### 4.2 Model validity

The model reproduces the defining neonatal cerebral behaviours: an intact autoregulation that defends flow and oxygen delivery against hypotension versus a pressure-passive circulation that does not (the substrate of intraventricular haemorrhage; Alderliesten et al. 2012), the effect of raised intracranial pressure on perfusion pressure and flow through the Monro–Kellie relation (Mokri 2001), and the compounding of oedema with lost autoregulation that characterises hypoxic–ischaemic encephalopathy (Massaro et al. 2015). Validation is to the pattern and direction reported in that literature; the out-of-range values under insult are the intended signatures.

**Validation strategy (series).** This paper validates cerebral autoregulation and intracranial-pressure physiology in depth — the mechanisms, directions and magnitudes its account is built on — against the cited literature. Consistent with the series' two-altitude design, comprehensive quantitative validation of the AI-parameterized cohort as a whole, against published reference ranges and disease signatures, is centralized in the integrated flagship [P5], and the identifiability and one-lever-per-target basis of the parameterization is validated by the formal sensitivity analysis of [P6]. Validation throughout the series is to literature ranges and pattern, not to prospective individual-patient data.

### 4.3 Limitations

The cerebral bed is lumped into a small number of compartments, and intracranial pressure is a single-compartment Monro–Kellie surrogate rather than a spatially resolved model; the autoregulation curve is a plateau with a maturity-graded authority rather than an explicit lower/upper-limit sigmoid, and carbon-dioxide and oxygen reactivity of the cerebral vessels are not separately modelled here. As with the other in-silico neonatal models, validation is against literature ranges and pattern rather than prospective individual-patient data. These are natural extensions within the same controller framework [P3b].

## Conclusion

Cerebral autoregulation and its failure underlie much of the neurological morbidity of the newborn intensive-care unit. Represented on the whole-body EXPLAIN model as a compact autoregulation-plus-intracranial-pressure controller with a single maturity-graded lever, the cerebral circulation reproduces — in real time and patient-specifically parameterized — the defended and the pressure-passive responses to hypotension and to raised intracranial pressure that separate the protected from the injured neonatal brain, providing a transparent platform for teaching and hypothesis-testing about intraventricular haemorrhage and hypoxic–ischaemic injury.

## References

*In order of appearance; PMIDs PubMed-verified (`thesis/_references.md`). Companion-paper citations [P1]–[P7] to be replaced with the series references/DOIs at assembly (cite [P6] as its bioRxiv preprint).*

1. Alderliesten T, Lemmers PMA, Smarius JJM, van de Vosse RE, Baerts W, van Bel F. Cerebral oxygenation, extraction, and autoregulation in very preterm infants who develop peri-intraventricular hemorrhage. *J Pediatr.* 2012;162(4):698–704.e2. PMID 23140883.
2. Massaro AN, Govindan RB, Vezina G, Chang T, Andescavage NN, Wang Y, et al. Impaired cerebral autoregulation and brain injury in newborns with hypoxic-ischemic encephalopathy treated with hypothermia. *J Neurophysiol.* 2015;114(2):818–24. PMID 26063779.
3. Mokri B. The Monro-Kellie hypothesis: applications in CSF volume depletion. *Neurology.* 2001;56(12):1746–8. PMID 11425944.
4. Munneke AG, Lumens J, Delhaas T. Cardiovascular fetal-to-neonatal transition: an in silico model. *Pediatr Res.* 2021;91(1):116–128. doi:10.1038/s41390-021-01401-0.
5. van Willigen BG, Krabben BC, van der Hout-van der Jagt MB, Huberts W, van de Vosse FN. The hemodynamic impact of congenital heart diseases during fetal-to-neonatal transition: an in-silico investigation. *Pediatr Res.* 2026 (advance online). doi:10.1038/s41390-025-04565-1.

*Companion papers (series): [P1] Cardiovascular · [P2] Respiratory, gas exchange and metabolism · [P3b] Homeostatic regulation · [P4] Mechanical support devices · [P5] Integrated model and virtual-patient library · [P6] AI-assisted parameterization method · [P7] duct-/foramen-ovale-dependent congenital heart disease. Full citations/DOIs at assembly.*
