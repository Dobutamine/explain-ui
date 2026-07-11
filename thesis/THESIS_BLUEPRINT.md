# Explain — PhD Thesis Blueprint

**Working title:** *Explain: an integrated, AI-parameterized simulation model of neonatal and perinatal physiology*
**Format:** compilation thesis ("thesis by publication") — existing papers become chapters; new bridging chapters carry the spine.
**Target for constituent papers:** *Pediatric Research*.
**This document** is the master structuring/planning artifact for the thesis. It is not a chapter itself. It maps every existing asset to its place, lists what is still missing, and gives the order of work. Nothing in the existing papers, scripts, scenarios, or docs is rewritten by this file.

---

## 1. Reading order (the spine)

The thesis is built to read in the deliberate order the work demands:

> **purpose / background → building blocks (conceptual + mathematical) → how the models integrate → the AI parameterization pipeline → validation across a range of virtual patients → synthesis.**

In a compilation thesis this spine is delivered by two *new* connective chapters (General Introduction, General Discussion) plus the ordering of the existing papers as chapters, with one *new* consolidation chapter for the virtual-patient validation.

---

## 2. Thesis outline

### Front matter
- Title page, table of contents.
- **English summary** and **Nederlandse samenvatting** *(new; write last, from the finished chapters).*

### Chapter 1 — General Introduction *(NEW connective writing)*
Delivers "purpose/background" **and** "how the models work together" — the two pieces with no home in any current paper.
- **1.1** Neonatal and perinatal physiology and the case for *explanatory* simulation — why interactive, mechanistic models, and why existing neonatal models fall short. *(source: circ paper Introduction refs 2–9.)*
- **1.2** What Explain is — purpose, the explanatory-model philosophy, and the design lineage from van Meurs [ref 10]. *(source: circ paper Introduction + `docs/engine/README.md`.)*
- **1.3** Conceptual overview of the building blocks and their integration — the whole-engine block diagram, the two-thread engine, the factor/effective-value composition substrate, advective composition transport ("composition rides the flow"), and the cardiac/breathing cycle counters. This is the "how it all fits together" section. *(source: `docs/engine/ARCHITECTURE.md` + shared-methods S1–S7.)*
- **1.4** The parameterization problem — patient definitions are an ill-posed, under-determined inverse problem; hand-tuning does not scale. Motivates Chapter 6. *(source: `ai-parameterization-paper.md` Introduction.)*
- **1.5** Aims and outline of the thesis.

### Part I — The Explain model: building blocks (conceptual & mathematical)

#### Chapter 2 — Cardiovascular system  ← Paper 1 (master)
Conceptual model (block diagram), mathematical model (time-varying elastance, fluid-circuit R/C/valve/container elements, ANS afferent/efferent with sympatho-vagal balance), software & code verification; baseline + PDA + pulmonary-hypertension validation. *Most mature chapter; near submission.*

#### Chapter 3 — Respiratory system, gas exchange & acid–base  ← Paper 2 (`respiratory-paper`)
Gas compartments and thoracic mechanics, spontaneous-breathing drive, alveolar diffusion, the blood-gas transport & Stewart acid–base solver ("keystone"), metabolism/lactate, surfactant/dynamic recruitment (RDS).

#### Chapter 4 — Regulatory organ systems  ← Paper 3 (`other-systems-paper`)
The slower closed-loop controllers: cerebral haemodynamics/autoregulation + ICP (Monro–Kellie), renal GFR/autoregulation, RAAS/ADH endocrine volume control, thermoregulation, glucose/insulin, PK/PD pharmacology, IV-fluid scheduling.

#### Chapter 5 — Mechanical support devices  ← Paper 5 (`devices-paper`)
Mechanical ventilator (PC/PRVC/PS/CPAP, triggering, ETT resistance), ECMO/ECLS (pump, membrane oxygenator reusing the alveolar Fick law, cannulae), CPR, and the bedside monitor (which produces the numbers the parameterization pipeline reads as targets).

### Part II — Patient-specific parameterization

#### Chapter 6 — AI-assisted parameterization pipeline  ← Paper 4 (`ai-parameterization-paper`) *(HEADLINE; dedicated chapter)*
The methodological centerpiece, placed between the model-description chapters and the validation chapter. Two-layer pipeline: an LLM interpretation layer (allowlisted, schema-validated commands) over a deterministic secant-based calibration layer, with one physiologically-interpretable lever per target and baroreflex set-point alignment so control loops defend rather than oppose the fit. Two entry points: offline patient construction and live in-place tuning. **This chapter is declared the canonical home of all AI-parameterization content** (see gap list §5).

### Part III — Virtual patients & clinical validation

#### Chapter 7 — A library of validated neonatal virtual patients *(NEW consolidation)*
The "range of patients," each with a literature-comparison table and, per the AI-pipeline decision, a short "how this patient was parameterized" note tying it back to Chapter 6:
- **7.1** Normal term fetus — fetal circulation (placental gas exchange, open DA/FO, high PVR, inert lungs).
- **7.2** Normal term neonate — the calibrated baseline; vitals + ABG vs literature normal ranges.
- **7.3** Preterm series & surfactant deficiency — 24–36 wk, gestation-graded RDS.
- **7.4** Congenital diaphragmatic hernia — severe / moderate / LV-dysfunction phenotypes.
- **7.5** Persistent pulmonary hypertension (PPHN) — **the dedicated `pphn` virtual patient** (built 2026-07-10, §5 item 3: idiopathic/vascular PPHN — normal heart & lungs, symmetric suprasystemic PVR, R→L ductal + atrial shunting, differential cyanosis), presented alongside the R→L-shunt physiology it shares with `pda_*_rtl` and `cdh_severe`.
- **7.6** Duct- and foramen-ovale-dependent congenital heart disease — the 12-lesion family (d-TGA, HLHS ±restrictive septum, critical PS/AS, PA-IVS, PA-VSD, tricuspid atresia, IAA, TAPVC ±obstruction, coarctation), organized by the 4-category taxonomy in `chd_duct_fo_dependent.md`.
- **7.7** (optional) PDA Doppler-pattern gallery — the 6 restrictive/unrestrictive × L→R/R→L/bidirectional patterns as a methods-of-validation showcase.

> **Resolved:** **one consolidated chapter** (confirmed). Structure each section so it could later be spun out as its own paper (the CHD family in particular is a strong standalone-paper candidate).

### General Discussion *(NEW connective writing)*
Synthesis across chapters; model originality; validity and its limits; reproducibility; limitations; future perspectives (incl. obstetric/maternal-fetal extension, prospective clinical validation); clinical and educational implications. *(seed material: each paper's §4 Discussion, especially circ 4.1–4.5.)*

### Back matter
Consolidated references · data & code availability statement · PhD portfolio · list of publications · acknowledgements (dankwoord) · curriculum vitae.

---

## 3. Asset map (existing → chapter)

Marks: **reuse** = drops in largely as-is · **adapt** = light edit/reframe for chapter role · **new** = must be written/produced.

### Chapter 1 — General Introduction
| Source | Role | Mark |
|---|---|---|
| `articles/ExplainCircPaper(27012026)_WPdB_TA_WvM.docx` (Introduction) | 1.1–1.2 background/purpose seed | adapt |
| `docs/engine/README.md`, `docs/engine/ARCHITECTURE.md` | 1.2–1.3 purpose + integration story | adapt |
| `articles/_shared-methods.md` (S1 notation, S2 factor composition, S3 advective transport, S4 cycle counters) | 1.3 integration substrate | adapt |
| `articles/ai-parameterization-paper.md` (Introduction) | 1.4 parameterization problem | adapt |
| *Whole-engine building-blocks overview figure* | 1.3 diagram | **new** (see §4) |
| Ch 1 body prose, 1.5 aims & outline | connective narrative | **new** |

### Chapter 2 — Cardiovascular  (Paper 1)
| Source | Role | Mark |
|---|---|---|
| `ExplainCircPaper(27012026)_WPdB_TA_WvM.docx` (the clean master: 41 native eqs, Figs 1–5, Tables 1–4) | entire chapter | reuse |
| `docs/engine/HeartChamber.md`, `BloodVessel.md`, `Capacitance.md`, `Resistor.md`, `TimeVaryingElastance.md`, `Heart.md`, `Ans.md`/`AnsAfferent.md`/`AnsEfferent.md`, `Circulation.md`, `Shunts.md`, `Pda.md` | equation/provenance cross-check for Methods | reuse (reference) |
| `articles/_shared-methods.md` (S5 software, S7 reproducibility) | §2.3 software text | reuse |

### Chapter 3 — Respiratory  (Paper 2)
| Source | Role | Mark |
|---|---|---|
| `articles/respiratory-paper.{md,docx}` | entire chapter | reuse |
| `docs/engine/BloodComposition.md` (Stewart/Hill/Haldane solver — publication-grade math), `GasExchanger.md`, `GasDiffusor.md`, `BloodDiffusor.md`, `GasCapacitance.md`, `GasComposition.md`, `Breathing.md`, `Respiration.md`, `Surfactant.md`, `Metabolism.md`, `Lactate.md` | equation source of truth | reuse (reference) |
| `articles/Fig1_respiratory_subsystem.{png,svg}` | chapter figure | reuse |

### Chapter 4 — Regulatory organ systems  (Paper 3)
| Source | Role | Mark |
|---|---|---|
| `articles/other-systems-paper.{md,docx}` | entire chapter | reuse |
| `docs/engine/Brain.md`, `Kidneys.md`, `Hormones.md`, `Thermoregulation.md`, `Glucose.md`, `Drugs.md`, `Fluids.md` | equation/provenance source | reuse (reference) |
| `articles/Fig1_regulatory_systems.{png,svg}` | chapter figure | reuse |

### Chapter 5 — Devices  (Paper 5)
| Source | Role | Mark |
|---|---|---|
| `articles/devices-paper.{md,docx}` | entire chapter | reuse |
| `docs/engine/Ventilator.md`, `Ecls.md`, `Resuscitation.md`, `Monitor.md` | equation source | reuse (reference) |
| Device schematic figure(s) | currently none numbered | **new** (optional; see §4) |

### Chapter 6 — AI parameterization  (Paper 4)
| Source | Role | Mark |
|---|---|---|
| `articles/ai-parameterization-paper.{md,docx}` (Tables 1–3, worked convergence trace) | entire chapter | reuse |
| `articles/circ-paper-figure-AIparam.md` + `articles/Fig6_AI_parameterization.{png,svg}` | chapter figure + caption | reuse |
| `explain/helpers/Calibrator.js`, `scripts/build_patient.mjs`, `explain/ModelEngine.js` (tune_model) | method provenance / equations | reuse (reference) |
| `docs/engine/Calibrator.md` | narrative cross-check | reuse (reference) |
| `articles/circ-paper-additions.md` (blocks A, G) | source of the condensed §2.4 that stays in Ch 2 as a pointer | adapt |

### Chapter 7 — Virtual patient library & validation  (NEW)
| Source | Role | Mark |
|---|---|---|
| `public/model_definitions/index.json` + the 34 scenario JSONs | the patients themselves | reuse (data) |
| `scripts/_make_*.mjs` header comments (literature targets + PubMed/DOI + lever→physiology map) | per-patient construction & citations | reuse (source) |
| `scripts/probe_*.mjs` outputs + `scripts/_probe.mjs` `RANGES` (10-profile normal ranges) | validation tables | reuse (produces data) |
| `docs/engine/chd_duct_fo_dependent.md` (4-cat taxonomy, 46 PubMed refs, per-lesion calibrated results) | §7.6 structure + citations | reuse (source) |
| Per-patient literature-comparison tables, chapter prose | validation write-up | **new** |
| Virtual-patient-library summary figure | overview diagram | **new** (see §4) |

### General Discussion  (NEW)
| Source | Role | Mark |
|---|---|---|
| Each paper's §4 Discussion (esp. circ 4.1–4.5) | synthesis seed | adapt |
| Ch 7 validation outcomes | validity/limitations evidence | **new** |
| Discussion prose | connective narrative | **new** |

### Shared infrastructure (spans all chapters)
| Source | Role | Mark |
|---|---|---|
| `articles/_shared-methods.md` (S1–S7) | one consistent description of notation/composition/software/reproducibility, reused verbatim across chapters | reuse |
| `articles/_references.md` | consolidated bibliography (needs verification — §5) | adapt |
| `articles/CHANGELOG_working_docx.md` | record of circ master vs working-copy edits; drives the consistency cleanup | reference |
| `articles/ExplainCircPaper_WORKING_with_AIparam.docx` | shows the merged-in AI-param version of Paper 1 | reference (do not use as canonical) |

---

## 4. Figure inventory

### Existing (reuse)
| Figure | File / location | Lands in |
|---|---|---|
| Block diagram of the integrated cardiorespiratory model (adapted from van Meurs) | circ master Fig. 1 | Ch 1 (§1.3) + Ch 2 |
| Hydraulic circuit of neonatal hemodynamics (all compartments/shunts) | circ master Fig. 2 | Ch 2 |
| Time-varying elastances, left heart | circ master Fig. 3 | Ch 2 |
| ANS afferent activation function | circ master Fig. 4 | Ch 2 |
| PDA Doppler target vs simulation (van Laere) | circ master Fig. 5 | Ch 2 (+ referenced Ch 7.7) |
| Respiratory subsystem schematic | `articles/Fig1_respiratory_subsystem.{png,svg}` | Ch 3 |
| Regulatory-controller layer | `articles/Fig1_regulatory_systems.{png,svg}` | Ch 4 |
| AI-parameterization pipeline (closed loop) | `articles/Fig6_AI_parameterization.{png,svg}` | Ch 6 (+ pointer in Ch 2) |

### New (Fig 1.2 & Fig 7.1 produced 2026-07-10 — house-style SVG masters + 2800×2160 PNGs in `articles/`)
| Figure | File | For | Status |
|---|---|---|---|
| Whole-engine building-blocks overview (Fig 1.2) | `thesis_fig_building_blocks.{svg,png}` | Ch 1 §1.3 | **DONE** — 3 tiers (primitives → system models → devices) + 4-mechanism integration substrate; embedded in Ch 1 with caption |
| Virtual-patient library map (Fig 7.1) | `thesis_fig_patient_library.{svg,png}` | Ch 7 | **DONE** — 34 patients in 6 family bands incl. CHD 4-category sub-columns; embedded in Ch 7 with caption |
| (optional) Ventilator & ECMO circuit schematic | — | Ch 5 | not started (optional) |

*Rendering note: figures authored as SVG (house style matching `Fig1_regulatory_systems.svg` — Helvetica Neue, slate palette, accent bars) via `scratchpad/gen_figs.py`; rasterized with headless Chrome (`--force-device-scale-factor=2 --window-size=1400,1080`). `qlmanage` center-crops landscape SVGs to a square — do NOT use it; use headless Chrome.*

> Style note (from CHANGELOG): existing figures use a two-tone house style; new figures should match. Equations in the Markdown drafts are plain-text placeholders and must be re-keyed as native OMML in the Word masters at assembly time.

---

## 5. Gap & consistency list (actionable, pre-submission)

Each item names the concrete next step / owner-decision.

1. **Missing connective chapters** — *General Introduction (Ch 1), General Discussion, consolidated validation (Ch 7)* do not exist in any current paper. → Draft in the order given in §6. **This is the core of the restructuring.**
2. **AI-parameterization exists in 4 forms** — the clean circ master (no AI content), `ExplainCircPaper_WORKING_with_AIparam.docx` (merged in), `circ-paper-additions.md` (paste-in blocks A–G), and the standalone `ai-parameterization-paper.md`. → **Decision: Chapter 6 (the standalone paper) is canonical.** In Chapter 2, keep only the *brief pointer* form (additions block A condensed + block F future-work reframe); do not duplicate the full method. Retire the WORKING copy from the canonical set (keep as reference only).
3. **PPHN standalone virtual patient — DONE (2026-07-10).** Built `scripts/_make_pphn.mjs` (idiopathic/vascular PPHN: structurally normal heart + near-normal lungs, symmetric suprasystemic PVR, R→L ductal + atrial shunting; 4 PubMed refs in the header — Singh & Lakshminrusimha 2021, Sharma 2015, Sankaran 2022, Fuloria 2017), warmed via `reseed_preterm.mjs --file pphn`, registered `pphn` in `index.json` (now 34 scenarios). Validated (`probe_vitals.mjs pphn --profile neonate` + `probe_cdh.mjs pphn`): suprasystemic PAP mean 55.7 ≥ MAP 55.1, differential cyanosis SpO₂ pre 86 / post 81, PaO₂ 41 on FiO₂ 1.0, both shunts R→L, structurally normal heart (LVEDP 2). PAP-HIGH / SpO₂-LOW flags are the expected disease signature. Goes into Ch 7.5.
4. **References need verification & consolidation** — `_references.md` is Vancouver but carries many `[VERIFY]` entries (acid–base, gas-exchange, surfactant, metabolism sources). → Mine engine source-file header comments and `chd_duct_fo_dependent.md` (46 verified refs) first, then resolve remaining `[VERIFY]` against PubMed; produce one consolidated, renumbered Vancouver bibliography for the thesis (each constituent paper keeps its own subset for its journal submission).
5. **Legacy inconsistencies in the circ master** — residual "Python" implementation language (the engine is JavaScript/TypeScript in a Web Worker + Vue) and a URL mismatch (`explain-modeling.com` vs `explain-user.com`). → Apply the `circ-paper-additions.md` block E rewrite + CHANGELOG edits; pick one canonical URL.
6. **Equation formatting** — all Markdown drafts hold equations as plain text; only the two circ Word masters have native OMML. → Re-key equations as native OMML during Word assembly of each chapter (per CHANGELOG to-do).
7. **Obstetric / maternal-fetal (Paper 6) scope** — uterus/placenta/maternal-placenta models exist (`Uterus.md`, `Placenta.md`, `MaternalPlacenta.md`, `adult_female_uterus` scenario) but no paper is drafted. → **Deferred: revisit later** (user to decide chapter vs Ch 7 fold-in vs future-work). Not on the critical path for the current thesis assembly; the fetal side is already covered via `term_fetus` in Ch 7.
8. **Author list / affiliations / AI-disclosure placement** — several drafts mark author order "to be finalised" and AI-disclosure placement "confirm per Springer Nature/ICMJE." → Finalize once chapter set is fixed; ensure a single consistent AI-use disclosure (Claude as a method component, not an author).

---

## 6. Execution roadmap (after this blueprint)

Ordered so each step unblocks the next; connective chapters first because they are the actual gap.

1. **Open decisions resolved:** Ch 7 stays one consolidated chapter; a dedicated PPHN patient will be built (§5 item 3); obstetric/maternal-fetal is deferred. Remaining decisions live in §5 (AI-param canonicalization, references, cleanup).
2. **Draft Chapter 1 (General Introduction) — DONE (2026-07-10, first draft):** `articles/thesis-ch1-general-introduction.md` (~3060 words, §1.1–1.5 + Ch-local reference list). Reuses circ Introduction (explanatory-models framing, target-scenario list, van Meurs lineage, Fig 1 block diagram), shared-methods S2–S5 (composability substrate, advective transport, single clock, step loop) for §1.3, and the AI-param Introduction for §1.4. Open items: references still `[VERIFY]` (§5 item 4); the §1.3 whole-engine overview figure (Fig 1.2) is still to be produced (§4 new figures); used `explain-user.com` (§5 item 5 URL decision).
3. **Assemble Chapters 2–5** from the existing papers with the consistency cleanup (§5 items 5–6) and the Ch 2 AI-pointer trim (§5 item 2).
4. **Finalize Chapter 6** as the canonical AI-parameterization chapter (already substantially drafted).
5. **Draft Chapter 7 (virtual patient library & validation) — DONE (2026-07-10, first draft):** `articles/thesis-ch7-virtual-patient-library.md` (~4620 words, §7.0 validation approach → 7.1 fetus / 7.2 term neonate / 7.3 preterm series+Bischoff / 7.4 CDH / 7.5 PPHN / 7.6 duct-FO CHD in 4 categories / 7.7 PDA Doppler / 7.8 summary + Ch-local refs). All tables use REAL probe outputs (probe_vitals/probe_cdh/probe_fetus/probe_pda run across all 34 scenarios) against literature targets from `_make_*` headers + `chd_duct_fo_dependent.md`. Each section carries a "how this patient was parameterized" note tying back to Ch 6. Open items: references still mostly `[VERIFY]` (§5 item 4, though PPHN + CHD-taxonomy PMIDs are confirmed); the §7 virtual-patient-library figure (§4 new figures) still to be produced.
6. **Draft the General Discussion — DONE (2026-07-10, first draft):** `articles/thesis-general-discussion.md` (~2400 words: Synthesis → Originality → Validity → Reproducibility → Limitations → Future perspectives → Clinical/educational implications → Conclusion + Ch-local refs). Extends circ §4.1–4.5 to thesis level across all chapters; frames the AI-parameterization method + the validated library breadth as the two novel contributions; limitations reported thesis-wide (lumped idealization, sparse data, fixed chamber set / no MAPCAs / no override / no atrialized RV, fetal-CVO calibration gap, literature-not-prospective validation, LLM-interpretation failure modes). **Uses the CONFIRMED circ bibliography** (van Meurs & Antonius 2018 [1], van Meurs 2011 [10], Antonius 2023 acid–base [11], Beneken 1965 [12], Burkhoff & Tyberg 1993 [16], Jhaveri 2023 [17], Groves 2011 [18], Kluckow & Evans 2014 [19], van Zadelhoff 2023 [20], Bischoff 2021 [21], van Laere 2018 [22], Jones & Crossland 2022 [23]).
7. **Reference verification pass** (§5 item 4) and consolidated bibliography. **NOTE: the circ paper's full bibliography is now extracted** (in scratchpad `circ.txt` lines 446–471) — it resolves most of the `[VERIFY]` tags in Ch 1 and Ch 7 (the explanatory-models ref, van Meurs, Beneken, Suga, Bazett, the neonatal-normative and PDA/PH validation refs, the fetal-modelling refs [2–9]). This pass is now largely mechanical: propagate those confirmed citations into Ch 1 / Ch 7 and consolidate.
8. **Word assembly**: OMML equations, house-style figures, front/back matter, summaries (EN + NL).
9. **Sensitivity-analysis workstream (Chapter 6 §6.X) — IN PROGRESS (2026-07-10):** fulfils the circ paper's §4.5 promise of "a systematic sensitivity analysis" and supplies the formal justification for the one-lever-per-target calibration. Pure-JavaScript, in-repo, reproducible-from-seed SA harness under `scripts/sa/`: `_sa_params.mjs` (11-lever reduced + ~25-lever expanded set mirroring the calibrator levers; 17-output clinical vector), `_sa_sampling.mjs` (mulberry32 PRNG, LHS, Morris trajectories, Saltelli cross-sample), `_sa_analysis.mjs` (OAT elasticities, Morris μ*/σ, Sobol′ Sᵢ/S_Tᵢ Jansen + bootstrap CIs, PRCC, FIM eigen-spectrum + column-pivoted-QR identifiability), `run_sa.mjs` (parallel fork-per-shard orchestrator), `campaign.mjs` (staged driver), `summarize.mjs` (consolidated tables), `smoke.mjs` + `validate_estimators.mjs`. **Estimators validated against the Ishigami function** (Sobol within 0.011 of analytic); **evaluation map deterministic**; **9/9 lever signs match the calibrator**. Staged campaign (OAT→Morris→Sobol′→PRCC). **BASELINE (`term_neonate`) COMPLETE 2026-07-11:** OAT (5 pts) + Morris expanded r=20 (540 evals) + PRCC N=768 + **Sobol′ N=512 (6 656 evals, all converged)**. Disease-state (`pphn`, `cdh_severe`) Morris/Sobol/PRCC tiers **DEFERRED at user request** (laptop thermal); their OAT screens are on disk. `dtga`/`hlhs`/`preterm_28wk`/`bischoff_cohort` OAT-only. **KEY FINDINGS (baseline, quantitative):** (1) PRCC (partials out size) confirms clean one-lever control for the pressure/rate targets — MAP←systemic_R 0.89, PAP←pulmonary_R 0.91, HR←HRref 0.84, CVP←venous_uvol −0.80. (2) **Weight (body size) dominates absolute-magnitude VARIANCE** of MAP/CO/CVP (Sᵢ 0.41/0.55/0.29) — but weight is a MEASURED input, not a calibration lever, so PRCC (size-controlled) is the calibration-relevant metric. (3) CO is NOT one-lever — size-dominated + baroreflex buffers contractility (PRCC 0.48). (4) BE/pH←uma dominant (Sᵢ 0.79/0.67) but INTERACTING (Stewart SID↔CO2↔lactate coupling); PaCO₂←vent_drive nearly inert (Sᵢ 0.03, uma carries 0.32 via chemoreflex). (5) **Oxygenation: O2_diffusion explains ~0 SpO₂/PaO₂ variance (Sᵢ 0.00/0.02)** at saturated baseline — inert; and OAT at all hypoxaemic points shows oxygenation is pulmonary_R/shunt-governed. Diffusing-capacity lever selected LAST by column-pivoted-QR (least identifiable). FIM condition ≈3.6e3. Corroborated by Messmore et al. 2026 (TGA LPM: SpO₂ most sensitive to SVR + PDA diameter). Draft `articles/thesis-ch6-sensitivity-analysis.md` — methods + OAT + **baseline Sobol/PRCC validation matrix (Table 6.X)** + interpretation all COMPLETE. **WEIGHT-AS-CONTEXT FIX APPLIED 2026-07-11 (methodological):** weight is a MEASURED input (birth weight), not a tunable lever, so its wide 0.6–4 kg sampling range spuriously dominated the population variance and masked the calibration structure. Fixed by flagging weight `context:true` in `_sa_params.mjs` + `getLeverSet()`; `run_sa.mjs` now samples the 10 tunable levers only by default (`--include-context` reproduces the population run; passes `paramNames` to workers for row alignment). Re-ran baseline **weight-fixed Sobol′ N=512 (6144 evals)**; population Sobol preserved as `_withweight.json`. **RESULT: the three mechanical pressure targets FLIPPED to one-lever dominance** — MAP←systemic_R Sᵢ 0.31→**0.56** (was "dominated by weight"), CVP←venous_uvol 0.31→**0.67**, PAP←pulmonary_R 0.51→**0.67**, all with dominant correctly-signed PRCC (0.89/−0.80/0.91). HR + BE/pH dominant-but-coupled (baroreflex/Stewart, S_Tᵢ≈1); CO preload/afterload-governed (contractility PRCC 0.48); **O2_diffusion inert for SpO₂/PaO₂ (Sᵢ~0) — weight-independent, QR-selected LAST**. FIM condition improved 3.6e3→1.4e3. Population (weight-included) result kept as secondary allometric-validity check. Remaining: run the disease-state Sobol/PRCC tiers later (now inherit weight-fixed default) + a short General-Discussion identifiability note.

---

## 7. Verification of this blueprint

- Asset map cross-checked against `ls articles/` (26 items), `ls docs/engine/*.md` (63 files), and `public/model_definitions/index.json` (34 scenarios) — every existing asset referenced here exists; none invented.
- Outline walked top-to-bottom reproduces the requested order: **purpose → building blocks (conceptual + mathematical) → integration → parameterization pipeline → validation across patients → synthesis.**
- Every gap-list item has a concrete next step or a flagged decision, not a bare TODO.
