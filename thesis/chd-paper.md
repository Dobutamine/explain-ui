# An integrated model for simulation of neonatal physiology — duct- and foramen-ovale-dependent congenital heart disease

*Paper P7 of the EXPLAIN series (clinical-application paper; companion to the cardiovascular [P1], respiratory [P2], regulatory-organ [P3a, P3b], mechanical-support-device [P4], integrated-model [P5] and AI-parameterization [P6] papers). Target journal: Pediatric Research; article type: Basic Science Article. Markdown working draft assembled 2026-07-12 from the virtual-patient-library validation (§7.6 of the library chapter) and the engine monograph `docs/engine/chd_duct_fo_dependent.md`. Every simulated value is produced by the engine and reproduced by a named probe script (the reproducibility convention of the series; see P1 §2.3), not asserted. Tables to be finalized as native Word objects at assembly; citation numbering is in order of appearance and will be merged into the consolidated bibliography.*

---

## Abstract

**Background:** A group of critical congenital heart lesions share one physiology: the newborn survives only while the ductus arteriosus and/or the foramen ovale stays patent, and decompensates — with profound cyanosis or cardiogenic shock — as the channel closes. Their stability is governed by the balanced parallel circulation.

**Methods:** We model twelve duct- and foramen-ovale-dependent lesions in the whole-body EXPLAIN simulator, spanning the four dependency categories (duct-dependent pulmonary flow, duct-dependent systemic flow, duct/foramen-ovale-dependent mixing, and atrial-septum-dependent lesions). Each is a term neonate built from a calibrated baseline by structural levers — valve atresia or stenosis, shunt geometry, chamber hypoplasia, arch obstruction, anomalous venous drainage — and parameterized by the series' AI-assisted pipeline. Every value is engine-produced and probe-reproduced.

**Results:** Each lesion reproduces its literature signature — the direction and volume of the ductal and atrial shunts, the pulmonary-to-systemic flow ratio, the pre- versus post-ductal saturation split, and closure-driven decompensation confirmed by in-silico duct-closure tests. The restrictive-atrial-septum emergency and the standard rescues — prostaglandin patency and balloon atrial septostomy — are demonstrable in real time.

**Conclusion:** One whole-body model reproduces the parallel-circulation physiology, decompensation and rescue of the duct- and foramen-ovale-dependent lesions as an interpretable teaching and hypothesis-testing platform.

---

## 1. Introduction

A distinct group of critical congenital heart lesions dominates the neonatal intensive-care unit for a single physiological reason: the newborn survives only while the ductus arteriosus and/or the foramen ovale (the atrial septum) remains patent, and then decompensates over the hours to days in which that channel physiologically closes [1]. Depending on what the patent channel is keeping alive, closure presents either as profound, oxygen-resistant cyanosis or as cardiogenic shock that mimics neonatal sepsis [2,3]. Because the presentation is delayed until the channel closes — often after discharge — these lesions are the physiological rationale for universal pre- and post-ductal pulse-oximetry screening [4], and their pharmacological rescue, prostaglandin E1 (alprostadil) to maintain or reopen ductal patency, is one of the highest-stakes interventions in newborn medicine [5].

What unites these otherwise disparate lesions is the concept of the **balanced parallel circulation**. In a duct-dependent lesion the systemic and pulmonary circuits run in parallel rather than in series, sharing output across the patent channel; the infant's stability is set by the pulmonary-to-systemic flow ratio (Qp:Qs), which is in turn governed by the relative resistances of the two vascular beds (pulmonary versus systemic vascular resistance) [1,6]. This makes the physiology both decisive and dangerous to reason about at the bedside: lowering pulmonary vascular resistance with supplemental oxygen or alkalosis relieves a duct-dependent *pulmonary* lesion but can flood the lungs and starve the systemic circulation in a duct-dependent *systemic* one. It is exactly this resistance-balance lever, and its consequences for shunt direction and oxygenation, that a mechanistic simulator is positioned to make explicit.

Mechanistic, closed-loop models of the neonatal circulation have an established place in this journal — an educational simulator of the haemodynamic transition at birth [7] and, more recently, closed-loop in-silico models of the fetal-to-neonatal transition and of congenital heart disease across that transition [8,9], alongside identifiable "digital-twin" formulations developed elsewhere [10]. These models validate realistically against literature and animal data and are valuable for teaching and research, but they share two limits that bound their reach for the lesions considered here. First, they are largely confined to the circulation with lumped gas exchange, whereas the defining findings of duct-dependent disease — cyanosis, the pre-/post-ductal saturation split, the interaction of pulmonary blood flow with oxygenation — are properties of the coupled circulation *and* gas exchange. Second, and more fundamentally, they are typically run with generic rather than patient-specific parameters; the most recent in-silico congenital-heart-disease transition model is evaluated explicitly "without patient-specific parameters" [9], because fitting a lumped-parameter model to an individual newborn has required slow, expert hand-tuning.

In this paper we represent the duct- and foramen-ovale-dependent lesions in EXPLAIN, a real-time whole-body neonatal physiology model whose subsystems and integration are described in the companion papers [P1–P5], as a family of twelve virtual patients across the four dependency categories. Each lesion is built from a single calibrated term-neonate baseline by explicit structural changes and is parameterized for its targets by the series' AI-assisted, closed-loop pipeline [P6], so that the twelve cases are produced by one auditable method rather than by twelve separate hand-fits. Because the lesions live on a whole-body substrate with real gas exchange and one circulating blood volume, their hallmark findings — shunt direction and volume, Qp:Qs, the pre-/post-ductal saturation split, and the decompensation that follows ductal closure — are emergent rather than prescribed. We show that the model reproduces the literature signature of each lesion, that in-silico ductal-closure tests confirm dependency, and that the two standard rescues, prostaglandin-maintained patency and balloon atrial septostomy, can be demonstrated in real time.

## 2. Methods

### 2.1 The four dependency categories (conceptual model)

The clinical organizing principle is *what the patent channel is keeping alive* [1]. We adopt the four-category taxonomy summarized in Table 1.

**Table 1.** Dependency taxonomy of the modelled lesions.

| Category | What the duct/FO supplies | Closure event → presentation | Lesions modelled |
|---|---|---|---|
| **A. Duct-dependent pulmonary blood flow** | Lungs (systemic→pulmonary flow via the duct) | Duct closes → profound, O₂-resistant **cyanosis** | PA-IVS, PA+VSD, critical PS, tricuspid atresia |
| **B. Duct-dependent systemic blood flow** | Body (right→left flow via the duct) | Duct closes → **cardiogenic shock** | HLHS (+ restrictive-septum variant), critical AS, coarctation, interrupted aortic arch |
| **C. Duct- *and* FO-dependent mixing** | Inter-circulatory mixing (parallel circuits) | Inadequate mixing → cyanosis | d-transposition of the great arteries |
| **D. FO / atrial-septum-dependent** | Obligatory atrial-level shunt | Restrictive/intact atrial septum → emergency | TAPVC (+ obstructed variant) |

The unifying teaching concept across all four is the balanced parallel circulation and its governance by Qp:Qs and the pulmonary/systemic resistance balance [1,6]. Two rescues recur and are represented in the model: prostaglandin E1 maintains or reopens ductal patency across categories A, B and C [5], and balloon atrial septostomy (the Rashkind procedure [11]) enlarges the atrial communication in category C and in the restrictive-septum emergencies of categories B and D.

### 2.2 Engine representation of structural lesions

Every lesion is a term neonate built from the single calibrated baseline of the cardiovascular model [P1] by a documented structural transformation applied at the level of the model definition; no lesion required a change to the engine's equations beyond the two generalizations noted below. The structural levers, verified against the current engine, are:

- **Ductus arteriosus** — the `Pda` model (a single resistive element wired ascending-aorta→pulmonary-artery, bidirectional), with geometric levers `diameter_relative`, `length` and `discharge_coeff`; ductal closure is simulated by driving `diameter_relative → 0`.
- **Foramen ovale** — the atrial communication (`Shunts.diameter_fo`, with fetal flap-valve asymmetry `fo_lr_factor`); a restrictive or intact septum is `diameter_fo → small/0`.
- **Ventricular septal defect** and **intrapulmonary shunt** — `Shunts.diameter_vsd` and `Shunts.ips_res`.
- **Valves** — heart valves are resistive elements; **atresia** is `no_flow`, **stenosis** is a raised forward resistance `r_for`. The tricuspid valve is represented as two parallel inflow resistors, set together.
- **Transposition** — the transposed outflow tracts (right-ventricle→aorta and left-ventricle→pulmonary-artery) are pre-wired but disabled in the baseline and enabled for d-TGA.
- **Chamber hypoplasia**, **aortic-arch obstruction** and **anomalous venous drainage** — chamber elastance/unstressed-volume factors, and re-pointed or resistance-raised connecting resistors.

Two engine generalizations were required and are identity for a normal heart. First, the cardiac-cycle timing is derived from the ventricular activation window when a ventricle has no patent outflow (aortic atresia disables both left-ventricular outflows), so single-ventricle physiology retains a valid cycle. Second, a restrictive tricuspid-regurgitation back-resistance allows a blind, hypertensive right ventricle to pressurize to suprasystemic levels while remaining volume-stable. Both changes are documented in the engine monograph and leave the normal, transposition, tricuspid-atresia and pulmonary-atresia-with-intact-septum hearts unchanged.

The composability substrate that makes a structural lesion coexist with body-size scaling and calibration — the three-layer effective-value decomposition of every physical parameter — is shared with the rest of the series and described in full in the lead paper [P1].

### 2.3 Software implementation and reproducibility

EXPLAIN is implemented as framework-agnostic JavaScript/TypeScript ES modules running in a Web Worker; the model is defined by JSON scenario files. Each lesion is generated from the baseline by a documented construction script (`_make_*.mjs`), warmed to its steady-state operating point (`reseed_*.mjs`), and measured by a headless probe (`probe_*.mjs`, extending the shared `probe_cdh.mjs`/`probe_chd.mjs` pattern to report ductal and atrial shunt direction and volume, atrial pressures, the pre-/post-ductal SpO₂ split, and Qp:Qs). All values reported below are steady-state, cycle-averaged over a measurement window after warm-up, with the autonomic control loops active; each is regenerated by re-running the named probe, per the reproducibility convention of the series [P1 §2.3].

### 2.4 AI-assisted patient-specific parameterization

The virtual patients in this paper were not tuned by hand.

> **Box 1 · How the virtual patients in this paper were parameterized.** EXPLAIN instantiates a patient with a two-layer, AI-assisted pipeline. An *interpretation layer* — a large language model — reads the available clinical description and emits a validated, bounded specification (a baseline, target values and named pathophysiology), expressed only through the same allowlisted, schema-checked commands as the interactive parameter editor. A *calibration layer* — a deterministic root-finder — then fits the model by assigning one physiologically interpretable lever to each target and driving that target to a clinician-meaningful tolerance, after allometric and gestational-age seeding and baroreflex set-point alignment so the model's own control loops defend rather than oppose the fit. The language model performs no numerical fitting and never edits equations or state. For the lesions of this paper the calibration targets are the systemic and pulmonary pressures and the arterial saturation (mean arterial pressure ← systemic vascular resistance; mean pulmonary artery pressure ← pulmonary vascular resistance; SpO₂ ← alveolar diffusion/shunt), on top of which the per-lesion *structural* modifiers of §2.2 (duct diameter, septal geometry, valve atresia/stenosis, chamber hypoplasia) are applied. The full method — convergence behaviour, the **variance-based sensitivity analysis that validates the one-lever-per-target design** (and identifies where it is weakest — notably that oxygenation is governed by pulmonary resistance and shunt geometry, not diffusion, in these lesions), and the offline-construction and live-tuning entry points — is given in the companion paper [P6]; the use of a language model as a *method component*, not an author, is disclosed below.

This paper is, with the integrated-model flagship [P5], one of the two substantive demonstrations of that method: where the flagship shows it operating across the whole virtual-patient library, here it is shown per-lesion, as the pipeline applied to twelve instances of structured congenital pathophysiology. Each lesion below notes briefly how it was parameterized (its structural levers and calibration targets).

*AI-use disclosure.* A large language model (Claude, Anthropic) is used as a component of the parameterization method: it interprets clinical inputs and emits validated, allowlisted specifications. It performs no numerical fitting, does not modify the model's equations or state, and is not used to generate the scientific content or text of this study; no authorship is attributed to it.

## 3. Results

We report the twelve lesions by dependency category. In every table, out-of-range vitals are the *intended* physiological signature of the lesion, not calibration error; the validation is that the pattern and magnitude match the cited literature. Shunt sign convention: for the duct, positive = left-to-right (aorta→pulmonary artery); for the foramen ovale, positive = left-to-right (left atrium→right atrium).

### 3.1 Category A — duct-dependent pulmonary blood flow

In these lesions the right-heart outflow to the lungs is obstructed or absent, so pulmonary blood flow arrives *backwards* through the duct (aorta → duct → pulmonary artery). *Parameterization (Box 1):* each is a term neonate with a structurally normal left heart; the levers are the atretic/stenotic right outflow, the duct as (part of) the pulmonary supply, and — in the FO-dependent members — an obligate right-to-left atrial shunt.

**Table 2.** Category A — duct-dependent pulmonary blood flow.

| Lesion | Ductal shunt | Atrial (FO) shunt | SpO₂ (%) | PAP vs MAP | Key marker |
|---|---|---|---|---|---|
| PA-IVS (`pa_ivs`) | +592 mL/min L→R (duct = sole lung supply) | −503 R→L (obligate) | 74 | < MAP | blind hypertensive RV; duct- **and** FO-dependent |
| PA+VSD (`pa_vsd`) | +750 mL/min L→R (sole lung supply) | ~0 (septum intact) | 79 | < MAP | RV decompresses via VSD (RV/LV pressures equilibrated) |
| Critical PS (`critical_ps`) | +310 mL/min L→R (majority of lung flow) | −339 R→L pop-off | 77 | < MAP | suprasystemic pressure-loaded RV; atrial pop-off |
| Tricuspid atresia (`tricuspid_atresia`) | +298 mL/min L→R | −491 R→L (obligate) | 80 | < MAP | single-LV; lung flow via VSD→RV→PA + duct |

In every Category-A lesion pulmonary blood flow arrives through a large left-to-right ductal shunt, cyanosis is present (SpO₂ 74–80%), and pulmonary pressure is sub-systemic. Pulmonary atresia with intact septum reproduces the blind, suprasystemic hypertensive right ventricle that can decompress only through a restrictive tricuspid-regurgitation jet, together with the obligate right-to-left atrial shunt (≈ the whole systemic venous return) that must cross the septum to fill the left heart, marking it as both duct- and foramen-ovale-dependent [12]. Pulmonary atresia with a ventricular septal defect is distinguished by right-ventricular decompression through the VSD (right- and left-ventricular peak pressures equilibrated, septum intact, *not* FO-dependent). Critical pulmonary stenosis retains a trickle of antegrade flow across a suprasystemic, pressure-loaded right ventricle, with the duct supplying the majority of pulmonary flow and a right-to-left atrial "pop-off" [13]. Tricuspid atresia is a functionally single left ventricle in which the entire systemic venous return is obligated right-to-left across the foramen ovale, pulmonary flow reaching the lungs via a restrictive VSD→right-ventricle→pulmonary-artery route supplemented duct-dependently [14].

### 3.2 Category B — duct-dependent systemic blood flow

Here the left-heart outflow to the body is obstructed or absent, so systemic perfusion arrives right-to-left through the duct (pulmonary artery → duct → descending aorta). *Parameterization (Box 1):* the levers are the atretic/stenotic left outflow or arch, left-heart hypoplasia where present, and the duct carrying systemic flow; the restrictive-septum variant differs only in the atrial lever.

**Table 3.** Category B — duct-dependent systemic blood flow.

| Lesion | Ductal shunt | Atrial (FO) shunt | SpO₂ pre/post (%) | MAP / PAP (mmHg) | Key marker |
|---|---|---|---|---|---|
| HLHS (`hlhs`) | −455 mL/min R→L (systemic supply) | +751 L→R (obligate) | 78 / 78 | 46 / 54 (PAP ≥ MAP) | single RV; retrograde arch/coronary perfusion |
| HLHS, restrictive septum (`hlhs_restrictive`) | −384 mL/min R→L | +416 L→R (choked) | 64 / 64 | 41 / 46 | **LA pressure 21 mmHg** (pulmonary venous HTN) — lethal |
| Critical AS (`critical_as`) | −127 mL/min R→L (~40% systemic) | +689 L→R | 96 / 85 (**diff 12**) | 39 / 44 | pressure-loaded failing LV; differential cyanosis |
| Coarctation (`coarctation`) | −15 mL/min R→L | ~0 | 97 / 87 (**diff 10**) | 78 / 24 | pre/post-ductal gradient (upper-body hypertension) |
| Interrupted aortic arch (`iaa`) | −207 mL/min R→L (lower body) | ~0 | 97 / 84 (**diff 13**) | 57 / 42 | lower body entirely duct-dependent; VSD |

In the single-ventricle lesion (hypoplastic left heart syndrome) the right ventricle is the systemic pump, giving suprasystemic pulmonary pressure, an obligate left-to-right atrial shunt, and retrograde aortic-arch and coronary perfusion [15]. The restrictive-septum variant reproduces the lethal emergency: the atrial communication cannot decompress the left atrium, so left-atrial pressure rises to 21 mmHg (a ≈ 19 mmHg trans-septal gradient = severe pulmonary venous hypertension) and hypoxaemia deepens to SpO₂ 64% — the state requiring immediate atrial decompression [16,17]. In the outflow-obstruction lesions (critical aortic stenosis [18], coarctation [19], interrupted aortic arch [20]) the model produces the diagnostic differential cyanosis (pre-ductal 96–97% from the left-ventricle-fed upper body versus post-ductal 84–87% from the duct-fed lower body; differential 10–13%) and, in coarctation, the pre-/post-ductal pressure gradient (upper-body mean 78 mmHg versus a duct-dependent lower body).

### 3.3 Category C — duct- and foramen-ovale-dependent mixing

**Table 4.** Category C — duct/FO-dependent mixing.

| Lesion | Ductal shunt | Atrial (FO) shunt | SpO₂ (%) | Qp:Qs | Key marker |
|---|---|---|---|---|---|
| d-TGA (`dtga`, intact septum) | +305 mL/min L→R | +304 mL/min L→R | 58 | ≈ 1 | parallel circulations; cyanosis inversely ∝ mixing |

In d-transposition the aorta arises from the right ventricle and the pulmonary artery from the left, so the two circulations run in parallel and survival depends entirely on mixing [6]. The model (with the pre-wired outflow tracts swapped) settles to a stable parallel circulation with balanced ~0.8 L/min outputs and profound cyanosis (SpO₂ 58%); mixing across the foramen ovale and duct is what oxygenates the systemic circuit, and a balloon atrial septostomy is demonstrable by ramping the foramen-ovale diameter (§3.5) [11].

### 3.4 Category D — foramen-ovale / atrial-septum-dependent

**Table 5.** Category D — FO/atrial-septum-dependent.

| Lesion | Ductal shunt | Atrial (FO) shunt | PV pressure | SpO₂ (%) | MAP / PAP (mmHg) | Key marker |
|---|---|---|---|---|---|---|
| TAPVC (`tapvc`, unobstructed) | 0 (not duct-dependent) | −592 mL/min R→L (fills left heart) | ~10 mmHg | 87 | 53 / 32 | complete mixing; mild cyanosis; PGE1-unresponsive |
| TAPVC, obstructed (`tapvc_obstructed`) | 0 | −431 mL/min R→L | ~37 mmHg | 73 | 44 / 51 (PAP ≥ MAP) | pulmonary venous hypertension; surgical emergency |

In total anomalous pulmonary venous connection the pulmonary veins drain to the systemic venous side, so an obligatory right-to-left atrial shunt is the only route to fill the left heart — and the model shows exactly this obligate R→L foramen-ovale flow with a closed duct, confirming that these lesions are FO-dependent rather than duct-dependent and therefore unresponsive to prostaglandin [21]. The obstructed variant reproduces the defining upstream pathology — pulmonary venous hypertension (pulmonary-venous pressure ~37 mmHg), secondary suprasystemic pulmonary pressure, and severe cyanosis (SpO₂ 73%) — the true neonatal surgical emergency [21].

### 3.5 Decompensation and rescue

Because the patency of the duct and the atrial septum are explicit geometric levers, the events that define these lesions clinically can be reproduced directly. Driving the ductal `diameter_relative → 0` in a Category-A lesion crashes oxygenation (in pulmonary atresia with VSD, SpO₂ falls to ~14% as the sole pulmonary supply is removed), confirming duct-dependence; the same test in a Category-D lesion leaves oxygenation unchanged, confirming FO-dependence. Reopening the duct (prostaglandin E1) restores the pre-closure steady state. In d-transposition, ramping the foramen-ovale diameter (balloon atrial septostomy) raises systemic saturation by increasing inter-circulatory mixing. In hypoplastic left heart syndrome, the contrast between the open- and restrictive-septum steady states (Table 3) *is* the atrial-septostomy decision made visible: enlarging the restrictive communication decompresses the left atrium from 21 mmHg and relieves the pulmonary venous hypertension. These maneuvers run at real-time speed and can be scheduled as timed events, so decompensation and rescue can be watched as they would unfold clinically.

## 4. Discussion

### 4.1 Model originality

Three features distinguish this representation of duct- and foramen-ovale-dependent disease from the existing in-silico neonatal literature [7–10]. First, it is built on a *whole-body* substrate: because the lesions share one circulating blood volume with a spontaneously exchanging lung, cyanosis, the pre-/post-ductal saturation split and the interaction of pulmonary blood flow with oxygenation are emergent consequences of the coupled circulation and gas exchange [P2], not prescribed outputs. This is the axis on which the most directly comparable model — an in-silico study of congenital heart disease across the fetal-to-neonatal transition, run "without patient-specific parameters" [9] — is complementary rather than overlapping: that work models the transition haemodynamics of a smaller set of lesions in the circulation, whereas this represents a broader duct/FO-dependent family with emergent oxygenation and per-patient parameterization. Second, the twelve lesions are instantiated by a single automated, auditable parameterization pipeline [P6] rather than by twelve hand-fits, which is what makes a lesion family — rather than a single showcase case — tractable to build and to reproduce. Third, the model runs in real time in a browser, so the decompensation and rescue maneuvers of §3.5 are directly manipulable at the point of teaching.

### 4.2 Model validity

Across all four categories the model reproduces the physiology the taxonomy is built on: the direction and volume of the ductal and atrial shunts, the Qp:Qs balance, the pre-/post-ductal saturation split, and closure-driven decompensation. The lesion-defining discriminators are captured, not merely the gross picture — the blind hypertensive right ventricle of pulmonary atresia with intact septum versus the VSD-decompressed ventricle of pulmonary atresia with VSD; the obligate right-to-left atrial return of the FO-dependent members; the 21-mmHg left-atrial pressure that separates restrictive- from open-septum hypoplastic left heart syndrome; the graded differential cyanosis of the arch-obstruction lesions; and the pulmonary-venous hypertension that makes obstructed anomalous pulmonary venous connection an emergency. Each lesion's simulated signature was compared against its cited clinical literature [11–21]; the out-of-range vitals are the intended signatures, and the comparison is to pattern and magnitude rather than to a normal reference band.

**Validation strategy (series).** This paper validates duct- and foramen-ovale-dependent congenital heart disease in depth — the per-lesion shunt directions, pressures and saturation signatures its taxonomy is built on — against the cited clinical literature. Consistent with the series' two-altitude design, comprehensive quantitative validation of the AI-parameterized cohort as a whole, against published reference ranges and disease signatures, is centralized in the integrated flagship [P5], and the identifiability and one-lever-per-target basis of the parameterization is validated by the formal sensitivity analysis of [P6]. Validation throughout the series is to literature ranges and pattern, not to prospective individual-patient data.

### 4.3 Reproducibility and model expansion

Every value in §3 is regenerated by re-running its named probe against the deposited lesion definition, and the structural provenance and clinical targets of each lesion are recorded in the corresponding construction-script header and in the engine monograph. The lesion set is defined by JSON transformations of one baseline, so extending the family — additional variants, or graded severities of an existing lesion — is a matter of scripted construction plus a probe, not new engine code, within the structural vocabulary of §2.2.

### 4.4 Limitations

The lesions share the lumped, real-time simplifications of the rest of the engine, and three structural limitations bound which defects can be represented and are stated per lesion in the monograph. The engine has **no model of major aortopulmonary collateral arteries (MAPCAs)**, so pulmonary atresia is represented as purely duct-supplied and its ductal-closure test is correspondingly more catastrophic than in a collateral-supplied patient. It has **no aortic override**, so tetralogy of Fallot with pulmonary atresia can only be approximated by right-to-left streaming through the VSD. It has **no separately atrialized right ventricle**, so severe neonatal Ebstein anomaly can only be approximated by tricuspid regurgitation plus a weak right ventricle; these two lesions are therefore noted as approximations and are not among the twelve validated cases. More broadly, and in common with the other in-silico neonatal models [7–10], validation here is against literature ranges and pattern, not prospective individual-patient data; the linear-resistance valve elements trade peak pressure against antegrade flow, so a realistic suprasystemic ventricular pressure is sometimes reached via a mildly failing rather than a hypercontractile ventricle. Prospective comparison against echocardiographic shunt and pressure measurements in real patients is the natural next validation step and is enabled by the patient-specific parameterization method [P6].

## Conclusion

The duct- and foramen-ovale-dependent congenital heart lesions are unified by a single physiology — the balanced parallel circulation and its collapse as the patent channel closes — that is decisive at the bedside and hard to teach. Represented on a whole-body, real-time model and parameterized per-lesion by one auditable AI-assisted pipeline, twelve of these lesions across all four dependency categories reproduce their literature signatures as emergent behaviour, and their defining decompensation and rescue can be demonstrated interactively. This completes the series' clinical-application layer and provides a transparent platform for teaching, for the physiological rationale of critical-CHD screening, and for hypothesis-testing.

## References

*In order of appearance; PMIDs retrieved and confirmed via PubMed (carried over from the engine monograph's verified bibliography). Companion-paper citations [P1]–[P6] to be replaced with the series references/DOIs at assembly; cite [P6] as its bioRxiv preprint.*

1. Khalil M, … Schranz D. Ductal-dependent congenital heart disease: classification and balanced parallel circulation. *Transl Pediatr.* 2019. PMID 31161078.
2. Strobel AM, Lu le N. The critically ill infant with congenital heart disease. *Emerg Med Clin North Am.* 2015. PMID 26226862.
3. Barata IA. Cardiac emergencies in the neonate. *Emerg Med Clin North Am.* 2013. PMID 23915599.
4. Mahle WT, et al. Role of pulse oximetry in examining newborns for critical congenital heart disease (AHA/AAP statement). *Pediatrics.* 2009. PMID 19581259.
5. Akkinapally S, et al. Prostaglandin E1 for maintaining ductal patency in neonates with ductal-dependent cardiac lesions. *Cochrane Database Syst Rev.* 2018. PMID 29486048.
6. Martins P, Castela E. Transposition of the great arteries: parallel circulations and mixing. *Orphanet J Rare Dis.* 2008. PMID 18851735.
7. Sá-Couto CD, Andriessen P, van Meurs WL, Ayres-de-Campos D, Sá-Couto PM. A model for educational simulation of hemodynamic transitions at birth. *Pediatr Res.* 2010;67(2):158–165.
8. Munneke AG, Lumens J, Delhaas T. Cardiovascular fetal-to-neonatal transition: an in silico model. *Pediatr Res.* 2021;91(1):116–128. doi:10.1038/s41390-021-01401-0.
9. van Willigen BG, Krabben BC, van der Hout-van der Jagt MB, Huberts W, van de Vosse FN. The hemodynamic impact of congenital heart diseases during fetal-to-neonatal transition: an in-silico investigation. *Pediatr Res.* 2026 (advance online). doi:10.1038/s41390-025-04565-1.
10. May RW, Gentles TL, Bloomfield FH, Maso Talou G, Safaei S, Argus F. Newborn cardiovascular digital twins. *Maternal and Children's Health* (Karger). 2025;1(1):26–36. doi:10.1159/000546724.
11. Rashkind WJ, Miller WW. Creation of an atrial septal defect without thoracotomy (balloon atrial septostomy). *JAMA.* 1966;196(11):991–2. PMID 4160716.
12. Chikkabyrappa SM, et al. Pulmonary atresia with intact ventricular septum: physiology and management. *Semin Cardiothorac Vasc Anesth.* 2018. PMID 29411679.
13. Latson LA. Critical pulmonary stenosis. *J Interv Cardiol.* 2001. PMID 12053395.
14. Sumal AS, et al. Tricuspid atresia: a review. *J Card Surg.* 2020. PMID 32484582.
15. Connor JA, Thiagarajan R. Hypoplastic left heart syndrome. *Orphanet J Rare Dis.* 2007. PMID 17498282.
16. Vlahos AP, et al. Hypoplastic left heart syndrome with intact or restrictive atrial septum. *Circulation.* 2004. PMID 15136496.
17. Generali T, et al. HLHS with restrictive/intact atrial septum: left-atrial decompression. *World J Pediatr Congenit Heart Surg.* 2022. PMID 35446214.
18. Affolter JT, Ghanayem NS. Preoperative management of critical aortic stenosis. *Cardiol Young.* 2014. PMID 25647388.
19. Ganigara M, et al. Preoperative physiology of coarctation of the aorta. *Semin Cardiothorac Vasc Anesth.* 2019. PMID 31535945.
20. Jonas RA. Management of interrupted aortic arch. *Semin Thorac Cardiovasc Surg.* 2015. PMID 26686446.
21. Ross FJ, et al. Total anomalous pulmonary venous connection: physiology and the obstructed emergency. *Semin Cardiothorac Vasc Anesth.* 2017. PMID 27694572.

*Companion papers (series): [P1] Cardiovascular; [P2] Respiratory, gas exchange and metabolism; [P3a] Cerebral haemodynamics and intracranial pressure; [P3b] Homeostatic regulation; [P4] Mechanical support devices; [P5] Integrated model and virtual-patient library; [P6] AI-assisted parameterization method. Full citations/DOIs at assembly.*
