# An integrated model for simulation of neonatal physiology — whole-body integration and a validated library of virtual patients

*Paper P5 of the EXPLAIN series (the integrative flagship; companion to the cardiovascular [P1], respiratory [P2], regulatory-organ [P3a, P3b], mechanical-support-device [P4], AI-parameterization [P6] and congenital-heart-disease [P7] papers). Target journal: Pediatric Research; article type: Basic Science Article. Markdown working draft assembled 2026-07-13 from the virtual-patient-library validation (`thesis-ch7-virtual-patient-library.md`). Every simulated value is produced by the engine and reproduced by a named probe script (the reproducibility convention of the series; see P1 §2.3), not asserted. Two-altitude design: the subsystem papers validate their own physiology in depth against a few patients; this paper validates the integrated whole across the library as a breadth. Tables/figures to be finalized as native Word objects at assembly; citation numbering is in order of appearance.*

---

## Abstract

**Background:** Much of what decides the care of a sick newborn — the arterial blood gas, shunt-flow direction, differential cyanosis — is not any single organ's output but an emergent property of coupled cardiovascular, respiratory and regulatory systems. A whole-body model earns trust only if, once integrated, it reproduces this range.

**Methods:** We integrate the cardiovascular, respiratory, regulatory-organ and mechanical-support subsystems of EXPLAIN onto one shared blood-and-gas substrate and validate the whole across a library of 34 virtual patients — the normal fetus and neonate, a preterm surfactant-deficiency series, congenital diaphragmatic hernia, persistent pulmonary hypertension, twelve duct-/foramen-ovale-dependent heart lesions, and the ductal Doppler spectrum. Each patient is built by one AI-assisted closed-loop pipeline; every value is engine-produced and probe-reproduced.

**Results:** Normal patients fell within body-size-appropriate reference ranges; disease patients reproduced their literature signatures — suprasystemic pulmonary pressure and differential cyanosis in pulmonary hypertension and severe hernia, the pre- versus post-capillary hernia split, the duct-/foramen-ovale-dependent shunt directions of critical heart disease, and the continuous-to-bidirectional ductal Doppler spectrum — all from the single calibration method.

**Conclusion:** Integrated on a shared substrate and parameterized by one reproducible pipeline, the model reproduces the breadth of neonatal cardiopulmonary physiology and disease as emergent behaviour.

---

## 1. Introduction

The quantities on which neonatal intensive care turns — the arterial blood gas, the direction and volume of shunt flow, the pre- to post-ductal saturation difference, the balance of pulmonary and systemic blood flow — are almost never the output of a single organ. They are emergent properties of a cardiovascular, respiratory and regulatory physiology coupled through one circulating blood volume, and it is this coupling that a bedside clinician must reason about and that makes the sick newborn hard to teach and to model. Mechanistic, lumped-parameter models represent that physiology as networks of compartments whose parameters are individually interpretable, and they have an established place in this journal: an educational simulator of the haemodynamic transition at birth (Sá-Couto et al. 2010) and, more recently, closed-loop in-silico models of the fetal-to-neonatal transition and of congenital heart disease across that transition (Munneke et al. 2021; van Willigen et al. 2026), alongside identifiable "digital-twin" formulations developed elsewhere (May et al. 2025).

These models validate realistically against literature and animal data, but they share two limits that bound their reach. First, they are largely confined to the circulation with lumped gas exchange; they do not couple, in one model, a spontaneously breathing respiratory system, blood-gas and acid–base chemistry, the slower regulatory organs and mechanical support. Second, they are typically run with generic rather than patient-specific parameters — the most recent congenital-heart-disease transition model is evaluated explicitly "without patient-specific parameters" (van Willigen et al. 2026) — because fitting a lumped-parameter model to an individual newborn has required slow, expert hand-tuning.

EXPLAIN addresses both: it is a whole-body, real-time, openly available model whose subsystems are described individually in the companion papers [P1–P4] and whose patients are instantiated by an AI-assisted closed-loop calibration pipeline [P6] rather than by hand. In our companion papers each subsystem is developed and validated in isolation. In this paper we do what those papers cannot do individually: we integrate the subsystems onto a single shared blood-and-gas substrate and ask whether the *coupled whole* behaves like the range of real newborns it is meant to represent. We answer that question with a library of 34 virtual patients spanning the normal fetus and neonate, the preterm surfactant-deficiency continuum, and a broad range of neonatal cardiopulmonary disease, every one of them built by the same parameterization pipeline.

This division of labour is deliberate and defines the paper. Validation in EXPLAIN happens at two altitudes. The subsystem papers validate their *own* physiology in depth against a few directly relevant patients; the congenital-heart-disease paper [P7] validates the twelve duct-/foramen-ovale-dependent lesions lesion-by-lesion. This paper validates the integrated model across the *library as a whole* — its breadth, its gestational and severity trends, and the cross-cutting signatures that appear only when the subsystems are coupled — and it demonstrates that a single automated pipeline generates the entire cohort. It is a different cut of the evidence, not a re-presentation of the subsystem results, and it is what shows that the model is one integrated organism rather than a set of separately validated parts.

## 2. Methods

### 2.1 Integrated architecture

EXPLAIN is a network of compartment models solved together, each step, in insertion order. The unifying substrate is a single advective blood volume: blood capacitances carry not only volume and pressure but oxygen, carbon dioxide, the strong-ion species of the acid–base solver, solutes and drugs, and every resistor that moves volume between compartments moves those quantities with it in proportion to the transferred fraction. The cardiovascular circuit [P1], the respiratory system and its gas exchange and acid–base chemistry [P2], the regulatory organs [P3a, P3b] and the mechanical-support devices [P4] all read from and write to this one substrate; none maintains a private copy of the blood state. Consequently the arterial blood gas the model reports is not prescribed anywhere but falls out of the interaction of ventilation, perfusion, diffusion, metabolism and buffering across the whole network.

Every physical parameter is used through a three-layer *effective value* — a base value plus a non-persistent interventional layer, a persistent user/scenario layer and a scaling layer — so that an autonomic, an allometric, a pathophysiological and a calibration adjustment to the same vessel compose additively rather than overwriting one another (shared Methods; [P1]). This composability is what lets a patient carry body-size scaling, a disease modifier and a calibration fit simultaneously, and it is the mechanism by which the library is built from one baseline (§2.2). The architecture and the shared substrate are shown in Figure 1; the subsystem equations are given in full in the companion papers and are not repeated here.

### 2.2 The virtual-patient library

The library comprises 34 scenarios (`public/model_definitions/index.json`) in six families: normal and transitional (term fetus, term neonate, and an adult reference); the preterm surfactant-deficiency/respiratory-distress series (seven gestational ages plus a literature-calibrated cohort patient); congenital diaphragmatic hernia in three haemodynamic phenotypes; persistent pulmonary hypertension of the newborn; the duct- and foramen-ovale-dependent congenital-heart-disease lesions in four dependency categories; and the patent-ductus-arteriosus Doppler-pattern demonstrations (Figure 2). Every patient is built from a single calibrated term-neonate baseline by a documented structural transformation (`scripts/_make_*.mjs`), warmed to its steady-state operating point (`scripts/reseed_*.mjs`), and measured by a headless probe (`scripts/probe_*.mjs`).

Two references anchor the validation. **Normal-range tables** (`scripts/_probe.mjs`) define resting reference ranges for every reported vital and blood-gas quantity in ten body-size/gestation profiles; for the normal patients an all-in-range panel *is* the validation. **Per-patient literature targets** — recorded in each construction-script header and, for the congenital-heart-disease family, in the clinical monograph underlying [P7] — anchor the disease patients, for which the point is the opposite: the model must reproduce the disease's signature, so out-of-range values (a suprasystemic pulmonary pressure, a low saturation) are the intended, correct result and the validation is that the pattern and magnitude match the literature.

### 2.3 AI-assisted parameterization at library scale

The 34 patients were not tuned by hand.

> **Box 1 · How the virtual patients in this paper were parameterized.** EXPLAIN instantiates a patient with a two-layer, AI-assisted pipeline. An *interpretation layer* — a large language model — reads the available clinical description and emits a validated, bounded specification (a baseline, target values and named pathophysiology), expressed only through the same allowlisted, schema-checked commands as the interactive parameter editor. A *calibration layer* — a deterministic root-finder — then fits the model by assigning one physiologically interpretable lever to each target and driving that target to a clinician-meaningful tolerance, after allometric and gestational-age seeding and baroreflex set-point alignment so the model's own control loops defend rather than oppose the fit. The language model performs no numerical fitting and never edits equations or state. The full method — the full lever set, convergence behaviour, and the sensitivity-analysis justification for the one-lever-per-target design — is given in the companion paper [P6]; the use of a language model as a *method component*, not an author, is disclosed below.

The library is the substantive demonstration of that method (Figure 3). Where the method paper [P6] shows the pipeline converging on a single construction, and the congenital-heart-disease paper [P7] shows it applied per-lesion, here it is shown at cohort scale: every one of the 34 patients — normal and diseased, term and extremely preterm, structurally normal and structurally malformed — is produced by the same interpretation-plus-calibration pipeline, differing only in its structural specification and target values. The breadth of physiology the library reproduces is therefore direct evidence that the parameterization method generalizes.

*AI-use disclosure.* A large language model (Claude, Anthropic) is used as a component of the parameterization method: it interprets clinical inputs and emits validated, allowlisted specifications. It performs no numerical fitting, does not modify the model's equations or state, and is not used to generate the scientific content or text of this study; no authorship is attributed to it.

### 2.4 Reproducibility

All values reported below are steady-state, cycle-averaged over a measurement window after warm-up, with the autonomic control loops active; each is regenerated by re-running the named probe script against the deposited scenario definition, per the reproducibility convention of the series [P1 §2.3]. The library, its construction and reseeding scripts, and the probes are part of the public code deposit.

## 3. Results — library-wide validation

We validate the integrated model across the library at four altitudes: the normal cohort in range (§3.1), the preterm continuum as a trend (§3.2), the disease cohort against its literature signatures (§3.3), and the cross-cutting emergent signatures that appear only under integration (§3.4); we close with the parameterization-generality result (§3.5).

### 3.1 Normal and transitional cohort

The calibrated term neonate — the baseline from which every other scenario is derived — sits with its entire resting panel inside the neonatal reference ranges (Table 1): heart rate 131 /min, arterial pressure 72/47 (mean 59) mmHg, central venous pressure 3.1 mmHg, pulmonary artery pressure 40/27 mmHg, cardiac output 0.69 L/min, pre-ductal SpO₂ 97 %, respiratory rate 41 /min, and a normal acid–base state (pH 7.36, PaCO₂ 40 mmHg, PaO₂ 75 mmHg, base excess −3.0). This all-"ok" panel is the reference against which the disease deviations are read.

**Table 1.** Term-neonate resting panel (`probe_vitals.mjs --profile neonate`).

| Quantity | Simulated | Neonatal range | Flag |
|---|---|---|---|
| Heart rate (/min) | 131 | 100–160 | ok |
| ABP sys/dia; mean (mmHg) | 72/47; 59 | 55–90 / 30–55; 40–60 | ok |
| Central venous pressure (mmHg) | 3.1 | 2–8 | ok |
| PAP sys/mean (mmHg) | 40/27 | 18–40 / 12–30 | ok |
| Cardiac output (L/min) | 0.69 | ~0.5–0.8 | ok |
| SpO₂ pre-ductal (%) | 97 | 93–100 | ok |
| Respiratory rate (/min) | 41 | 30–60 | ok |
| pH; PaCO₂; PaO₂ (mmHg) | 7.36; 40; 75 | 7.30–7.42; 35–45; 50–85 | ok |
| HCO₃⁻ (mmol/L); base excess | 22; −3.0 | 18–24; −6…+2 | ok |

The term fetus is the most stringent single test of the integration, because it is topologically a different circulation: the placenta, not the lung, is the gas exchanger; the ductus arteriosus and foramen ovale are widely open and carry the dominant flows; pulmonary vascular resistance is high and the fluid-filled lungs are nearly excluded. With only these structural changes applied and the same engine, the model reproduces the qualitative and near-quantitative fetal signature (Table 2): a parallel circulation with pulmonary artery pressure at or above aortic (63 vs 50 mmHg mean), right-to-left ductal and foramen-ovale flows that together carry ~80 % of combined ventricular output away from the lungs, placental flow at ~45 % of output, and — the integration payoff — the characteristic oxygen cascade in which the umbilical vein is the best-oxygenated blood and the pre-ductal ascending aorta is better oxygenated than the post-ductal descending aorta (saturations 88 > 71 > 66 > 61 %). Combined output (315 mL/kg/min) sits modestly below the classic reference (~400–450 mL/kg/min), a noted calibration target; the flow *partition* and the *oxygen cascade* are reproduced faithfully. That one model spans both the fetal and the neonatal circulation by structural reconfiguration alone is the strongest single piece of evidence that the coupled whole holds together.

**Table 2.** Fetal circulation — flow partition and oxygen cascade (`probe_fetus.mjs`, `term_fetus`).

| Quantity | Simulated | Expected (fetal physiology) |
|---|---|---|
| Heart rate (/min) | 149 | ~140–150 |
| Aortic pressure sys/dia/mean (mmHg) | 59/41/50 | mean ~45–50 |
| PA pressure, mean (mmHg) | 63 (PA ≥ Ao) | PA ≈ or > systemic |
| Combined ventricular output | 315 mL/kg/min | ~400–450 mL/kg/min |
| Ductus arteriosus flow | 39 % of CVO, R→L | ~30–46 %, R→L |
| Foramen ovale flow | 43 % of CVO, R→L | obligate R→L, ~30–40 % |
| Placental flow | ~45 % of CVO | ~40–45 % |
| Oxygen cascade (SpO₂) | UV 88 > IVC 71 > AA 66 > AD 61 % | UV > IVC > AA (pre-ductal) > AD (post-ductal) |
| Umbilical-artery gas | pH 7.27, PCO₂ 50, PO₂ 27, BE −5 | pH ~7.25–7.30, PCO₂ ~45–55, BE ~−3…−6 |

### 3.2 The preterm continuum as a gestational trend

The seven preterm patients (24–36 weeks) are validated not as seven isolated cases but as a *trend*: each is built by allometric scaling to its gestational weight plus a gestation-graded surfactant-deficiency lung phenotype, with the baroreflex set-point lowered to the preterm's normal mean arterial pressure, and each is checked against its own gestational reference profile (Table 3). The cohort reproduces the expected monotone gestational trends — mean arterial pressure rising with gestation (≈ gestational age in mmHg, 22 mmHg at 24 weeks to 51 mmHg at 36 weeks), oxygenation improving as respiratory-distress severity falls (SpO₂ 84→96 %, PaO₂ 47→69 mmHg), and the mild respiratory acidosis of surfactant deficiency resolving toward term (PaCO₂ 56→41 mmHg, pH 7.22→7.35) — with every value inside its gestation-specific range. A separately literature-calibrated preterm patient (`bischoff_cohort`; ~25.5 weeks, 720 g, spontaneously breathing on CPAP) reproduces a published cohort to its reported targets (heart rate 159 /min, left/right ventricular output 187/151 mL/kg/min — a net left-to-right ductal steal — pH 7.34, PaCO₂ 44 mmHg, ductus ~1.3 mm) and is the clearest example of direct calibration to a published dataset. That the same construction, re-run across gestational ages, produces the correct continuum is a validation the individual subsystem papers cannot provide.

**Table 3.** The preterm continuum (`probe_vitals.mjs --profile preterm_NN`); all values within each gestation-specific range.

| GA (wk) | Weight (kg) | HR (/min) | MAP (mmHg) | SpO₂ (%) | PaO₂ (mmHg) | pH | PaCO₂ (mmHg) | Flags |
|---|---|---|---|---|---|---|---|---|
| 24 | 0.64 | 150 | 22 | 84 | 47 | 7.22 | 56 | ok |
| 26 | 0.85 | 170 | 28 | 89 | 52 | 7.26 | 51 | ok |
| 28 | 1.0 | 178 | 28 | 91 | 55 | 7.28 | 49 | ok |
| 30 | 1.35 | 159 | 32 | 92 | 57 | 7.30 | 46 | ok |
| 32 | 1.7 | 151 | 38 | 93 | 59 | 7.32 | 44 | ok |
| 34 | 2.2 | 144 | 45 | 95 | 66 | 7.34 | 42 | ok |
| 36 | 2.7 | 137 | 51 | 96 | 69 | 7.35 | 41 | ok |

### 3.3 Disease cohort — literature signatures reproduced

The disease families are validated against the single quantity that defines each; Table 4 gives that cross-family summary, with subsystem and per-lesion depth deferred to the companion papers [P2, P4, P7]. Congenital diaphragmatic hernia is reproduced not as one "CDH-pulmonary-hypertension" state but as three haemodynamic phenotypes separated in exactly the dimension the literature uses — a pre-capillary (pulmonary-vascular-resistance-dominant) picture with suprasystemic pulmonary pressure, right-to-left ductal shunt and marked differential cyanosis (pre/post SpO₂ 76/63 %); a weanable sub-systemic contrast case; and a post-capillary (left-ventricular) phenotype distinguished by the highest left-atrial (6.3 mmHg) and left-ventricular end-diastolic (3.7 mmHg) pressures and a large left-to-right atrial shunt — the phenotype in which pulmonary vasodilators may worsen oedema. Persistent pulmonary hypertension is reproduced as suprasystemic pulmonary pressure with right-to-left shunting at *both* the ductus and the foramen ovale, normal left-heart filling pressures (a structurally normal heart), differential cyanosis (pre/post 86/81 %) and hypoxaemia resistant to an inspired oxygen fraction of 1.0 (PaO₂ 41 mmHg). The twelve duct- and foramen-ovale-dependent congenital-heart lesions reproduce, across the four dependency categories, the direction and volume of the ductal and atrial shunts, the pulmonary-to-systemic flow ratio and the closure-driven decompensation that define them [P7]. The six patent-ductus-arteriosus scenarios reproduce the full clinical Doppler spectrum — from the high-velocity continuous "sawtooth" of a restrictive left-to-right duct (peak 3.5 m/s), through the true bidirectional signature of pulmonary hypertension, to a high-velocity restrictive or a low-velocity unrestrictive right-to-left jet — by changing only duct geometry and the pulmonary/aortic pressure relationship.

**Table 4.** Disease-family summary — the single discriminating quantity per family (one row per phenotype/category, not per lesion); subsystem and per-lesion depth in the companion papers.

| Family / phenotype | Scenario(s) | Key discriminating quantity (simulated) | Signature reproduced |
|---|---|---|---|
| CDH, pre-capillary | `cdh_severe` | PAP 55 ≥ MAP 50; ductal R→L; pre/post SpO₂ 76/63 | ✓ suprasystemic PVR + differential cyanosis |
| CDH, sub-systemic | `cdh_moderate` | PAP 48 < MAP; small L→R duct; SpO₂ 92/92 | ✓ weanable contrast |
| CDH, post-capillary | `cdh_lv_dysfunction` | LA 6.3 / LVEDP 3.7 mmHg; large L→R atrial shunt | ✓ pre- vs post-capillary split |
| PPHN | `pphn` | PAP 56 ≥ MAP 55; R→L at duct **and** FO; normal LA; PaO₂ 41 on FiO₂ 1.0 | ✓ suprasystemic, structurally normal heart |
| CHD cat A (duct-dep. pulmonary) | `pa_ivs` `pa_vsd` `critical_ps` `tricuspid_atresia` | L→R ductal (duct feeds lungs); SpO₂ 74–80; PAP < MAP | ✓ (depth → [P7]) |
| CHD cat B (duct-dep. systemic) | `hlhs`(+restrictive) `critical_as` `coarctation` `iaa` | R→L ductal (duct feeds body); differential cyanosis; HLHS-restrictive LA 21 | ✓ (depth → [P7]) |
| CHD cat C (mixing) | `dtga` | parallel circulation; SpO₂ 58; Qp:Qs ≈ 1 | ✓ (depth → [P7]) |
| CHD cat D (FO-dependent) | `tapvc`(+obstructed) | obligate R→L atrial; obstructed PV pressure ~37 mmHg | ✓ (depth → [P7]) |
| PDA Doppler spectrum | six `pda_*` | peak velocity/direction across restrictive L→R → bidirectional → R→L | ✓ full spectrum |

### 3.4 Cross-cutting emergent signatures

The distinct value of an integrated model is visible in signatures that are not properties of any one lesion or subsystem but recur across the library because they emerge from the coupling. Three are worth drawing out. First, **differential cyanosis** — a pre- versus post-ductal saturation difference — appears as one readout across otherwise unrelated diseases (severe hernia 13 %, persistent pulmonary hypertension 5 %, critical aortic stenosis 12 %, coarctation 10 %, interrupted arch 13 %), in every case because a right-to-left ductal shunt delivers desaturated blood selectively to the lower body; a circulation-only or a single-lesion model does not surface this as one phenomenon. Second, the **shunt-direction spectrum**: across the duct/FO-dependent family the same two channels carry flow in opposite directions depending on which side is obstructed (left-to-right ductal flow feeding the lungs in duct-dependent pulmonary lesions; right-to-left ductal flow feeding the body in duct-dependent systemic lesions; obligate right-to-left atrial flow filling the left heart in the foramen-ovale-dependent lesions), all produced by the one bidirectional shunt physics. Third, and most fundamentally, the **arterial blood gas is emergent throughout**: in no scenario is a PaO₂, PaCO₂ or saturation prescribed — each falls out of the interaction of ventilation, diffusion, shunt and metabolism on the shared substrate, which is why the same model can produce a normal term gas, the resolving respiratory acidosis of the preterm continuum, and the oxygen-resistant hypoxaemia of pulmonary hypertension without any special-case machinery.

### 3.5 Parameterization generality

Every value in §§3.1–3.4 belongs to a patient produced by the single AI-assisted pipeline of Box 1 (worked convergence example and lever table in [P6]). The cohort spans body weights from 0.64 to ~3.5 kg, structurally normal and malformed hearts, series and parallel circulations, and gas exchange by lung and by placenta — and one interpretation-plus-calibration method instantiated all of it. That breadth is the paper's central evidence that the method generalizes beyond the single constructions demonstrated in the method paper.

## 4. Discussion

### 4.1 Model originality

Three features distinguish this work from the existing in-silico neonatal literature (Sá-Couto et al. 2010; Munneke et al. 2021; van Willigen et al. 2026; May et al. 2025). It is a *whole-body* model: because respiration, gas transport, acid–base chemistry, the regulatory organs and mechanical support share one blood substrate with the circulation, the blood gas and the cross-cutting signatures of §3.4 are emergent rather than prescribed. It is *validated at cohort breadth*: 34 patients across six families, not a single subsystem in a handful of cases. And its patients are *parameterized automatically and reproducibly* by one audited pipeline rather than run with generic parameters — the gap the incumbent models explicitly leave open. The library breadth is itself the evidence that both the integration and the parameterization generalize.

### 4.2 Model validity

Across the library the normal patients fall within their body-size-appropriate ranges and the disease patients reproduce their defining literature signatures — the pre-/post-capillary hernia split, the suprasystemic pressures and differential cyanosis of pulmonary hypertension and severe hernia, the duct-/foramen-ovale-dependent shunt patterns of critical congenital heart disease, and the ductal Doppler spectrum. The validation is to pattern and magnitude against the cited literature; out-of-range vitals in the disease scenarios are the intended signatures. The two-altitude design means the depth behind each family lives in the companion papers, and the value here is that all of it is reproduced by *one* integrated, one-pipeline-parameterized model.

### 4.3 Reproducibility and model expansion

Every value is regenerated by re-running its named probe against the deposited scenario, and each patient's structural provenance and clinical targets are recorded in its construction-script header. Because the library is defined by JSON transformations of one baseline, extending it — new phenotypes, additional gestational ages, graded severities — is a matter of scripted construction plus a probe, not new engine code.

### 4.4 Limitations

The model shares the lumped, real-time simplifications of its subsystems, documented in the companion papers, and the specific structural limits of the congenital-heart-disease family (no major aortopulmonary collaterals, no aortic override, no separately atrialized right ventricle) are set out in [P7]. As with all the in-silico neonatal models cited, validation here is against literature ranges and pattern rather than prospective individual-patient data; two known calibration gaps (fetal combined output modestly below the classic reference; the fetal right-to-left ventricular ratio closer to unity than the classic fetal dominance) are reported as measured rather than adjusted. Prospective comparison of pipeline-parameterized patients against individual clinical data is the natural next step and is enabled by the parameterization method [P6].

## Conclusion

Integrated on one shared blood-and-gas substrate and parameterized patient-by-patient by a single reproducible AI-assisted pipeline, the EXPLAIN neonate reproduces — as emergent behaviour, with every value engine-produced and probe-reproduced — the breadth of neonatal cardiopulmonary physiology and disease: the normal fetus and neonate, the preterm surfactant-deficiency continuum, and a wide range of cardiopulmonary disease across a library of 34 virtual patients. This flagship completes the whole model in print, and its library-wide validation is at once the evidence that the subsystems compose into one organism and the demonstration that the parameterization method generalizes across the cohort.

## References

*In order of appearance; reuse the series' verified pool (`thesis/_references.md`) and the companion-paper references [P1]–[P7] (fill with real refs/DOIs at assembly; cite [P6] as its bioRxiv preprint). Author-name prose style as in the other series drafts; numbered wiring at final assembly. Fetal/normal-neonate/preterm anchors marked [VERIFY] await the PubMed pass.*

1. Sá-Couto CD, Andriessen P, van Meurs WL, Ayres-de-Campos D, Sá-Couto PM. A model for educational simulation of hemodynamic transitions at birth. *Pediatr Res.* 2010;67(2):158–165.
2. Munneke AG, Lumens J, Delhaas T. Cardiovascular fetal-to-neonatal transition: an in silico model. *Pediatr Res.* 2021;91(1):116–128. doi:10.1038/s41390-021-01401-0.
3. van Willigen BG, Krabben BC, van der Hout-van der Jagt MB, Huberts W, van de Vosse FN. The hemodynamic impact of congenital heart diseases during fetal-to-neonatal transition: an in-silico investigation. *Pediatr Res.* 2026 (advance online). doi:10.1038/s41390-025-04565-1.
4. May RW, Gentles TL, Bloomfield FH, Maso Talou G, Safaei S, Argus F. Newborn cardiovascular digital twins. *Maternal and Children's Health* (Karger). 2025;1(1):26–36. doi:10.1159/000546724.
5. Rudolph AM. *Congenital Diseases of the Heart: Clinical–Physiological Considerations.* (fetal circulation reference values). **[VERIFY edition/year]**
6. Kiserud T, Acharya G. The fetal circulation. *Prenat Diagn.* 2004;24(13):1049–59. **[VERIFY]**
7. Nuntnarumit P, Yang W, Bada-Ellzey HS. Blood pressure measurements in the newborn. *Clin Perinatol.* 1999;26(4):981–96. **[VERIFY]** (MAP ≈ gestational age in mmHg).
8. Versmold HT, et al. Aortic blood pressure during the first 12 hours of life in infants 610–4220 g. *Pediatrics.* 1981;67(5):607–13. **[VERIFY]**
9. Bischoff AR, et al. Ductus arteriosus and PDA-associated hemodynamics in preterm infants (cohort). *Echocardiography.* 2021;38(9):1524–33. **[VERIFY]**
10. Singh Y, Lakshminrusimha S. Pathophysiology and management of persistent pulmonary hypertension of the newborn. *Clin Perinatol.* 2021;48(3):595–618. doi:10.1016/j.clp.2021.05.009. (PMID 34353582)
11. Sharma V, Berkelhamer S, Lakshminrusimha S. Persistent pulmonary hypertension of the newborn. *Matern Health Neonatol Perinatol.* 2015;1:14. doi:10.1186/s40748-015-0015-4. (PMID 27057331)
12. Bhombal S, Patel N. Diagnosis and management of pulmonary hypertension and cardiac dysfunction in CDH. *Semin Fetal Neonatal Med.* 2022. doi:10.1016/j.siny.2022.101383. **[VERIFY]**
13. Khalil M, … Schranz D. Ductal-dependent congenital heart disease: classification and balanced parallel circulation. *Transl Pediatr.* 2019. PMID 31161078.

*Companion papers (series): [P1] Cardiovascular · [P2] Respiratory, gas exchange and metabolism · [P3a] Cerebral haemodynamics and intracranial pressure · [P3b] Homeostatic regulation · [P4] Mechanical support devices · [P6] AI-assisted parameterization method · [P7] duct-/foramen-ovale-dependent congenital heart disease. Full citations/DOIs at assembly.*

---

## Display-item budget (assembly note)

**Figures (≤6 — three existing assets used).** Fig 1 integrated architecture / shared blood-and-gas substrate (`thesis_fig_building_blocks`); Fig 2 the 34-patient library overview by family (`thesis_fig_patient_library`); Fig 3 the AI-parameterization pipeline (`Fig6_AI_parameterization`). Two optional new panels — a preterm gestational-trend plot (from Table 3) and a cross-lesion differential-cyanosis/shunt-direction plot (§3.4) — can be added within the ≤6 budget or left as text/table.

**Tables (inline above).** Table 1 term-neonate panel; Table 2 fetal flow partition + oxygen cascade; Table 3 preterm continuum; Table 4 disease-family summary matrix. All four are the library-wide cut — Table 4 is one row per family/category (not per lesion), deferring per-lesion depth to [P7] and subsystem depth to [P2, P4]. Confirm PR's figure/table policy at assembly (figures and tables are counted separately at most Nature journals).
