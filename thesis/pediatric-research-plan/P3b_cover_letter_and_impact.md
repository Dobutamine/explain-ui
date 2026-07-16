# P3b (Homeostatic regulation) — cover letter + Impact Statement for Pediatric Research

*Wave-2 paper; the homeostatic-regulation thread of the former regulatory-organ omnibus (P3 split into P3a + P3b, 2026-07-13). Manuscript: `thesis/other-systems-paper.md` — "An integrated model for simulation of neonatal physiology — homeostatic regulation: renal function, endocrine volume control, thermoregulation, glucose homeostasis and pharmacology" (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP). Article type: **Basic Science Article**. Series decisions applied: Antonius corresponding; public code deposit; no ECI; compact AI-param highlight; full method in P6.*

> **What this is after the split.** The cerebral thread moved to the companion paper [P3a]; this paper is the five slow homeostatic controllers — renal, endocrine (RAAS/ADH), thermoregulation, glucose and pharmacology — plus the intravenous-fluid scheduler. Removing the cerebral outlier makes the paper *more* coherent: these five defend the newborn's internal volumetric, chemical and thermal milieu and share the "process-controller" architecture that is the paper's spine. Numbering uses sub-labels P3a/P3b; P4–P8 unchanged.

> **Remaining before sending:** deposit URL/DOI filled 2026-07-16; references are PubMed-verified (10-entry list in the manuscript); wire inline [N] citations at assembly. **Main-text length is 4,764 words (excl. display equations/tables) — under PR's 5,000 but with little headroom; trim if the final equation/legend accounting pushes it over.**

---

## Structured abstract (189 words; in `other-systems-paper.md`)

**Background:** Beyond the cardiovascular and respiratory plant described in companion papers, whole-body neonatal physiology is governed by slower homeostatic organ systems that defend extracellular volume, temperature, glucose and the response to drugs. We model these systems in the EXPLAIN simulator.

**Methods:** Five process controllers — renal glomerular filtration, a renin–angiotensin–aldosterone/antidiuretic-hormone volume controller, thermoregulation, glucose/insulin homeostasis, and pharmacokinetic/pharmacodynamic drug action — plus an intravenous-fluid scheduler are derived from first principles. Each owns no compartment; it senses the shared state and writes onto other models' composable effective-value layers, is neutral at baseline, and localises each intervention to one interpretable lever. Behaviour was verified with a reproducible headless harness.

**Results:** Every model reproduces the expected physiology under perturbation: haemorrhage activates renin–angiotensin–aldosterone and antidiuretic hormone with avid sodium retention; cold stress engages non-shivering thermogenesis; dextrose raises glucose and insulin; and an adrenaline bolus transiently raises heart rate, contractility and pressure before first-order washout.

**Conclusion:** These composable, auto-neutral controllers close the homeostatic loops that make the EXPLAIN neonate behave as an integrated organism; patient-specific parameters are set by the series' AI-assisted calibration. Cerebral autoregulation and intracranial pressure are described in the companion paper [P3a].

---

## Impact Statement (≤100 words — PR's current cap)

We present the homeostatic-regulation layer of EXPLAIN — renal filtration, endocrine (renin–angiotensin–aldosterone/antidiuretic-hormone) volume control, thermoregulation, glucose homeostasis and pharmacokinetic/pharmacodynamic drug action — built as composable, auto-neutral "process controllers" that defend the newborn's volumetric, chemical and thermal milieu. Existing in-silico neonatal models represent the circulation but not these slower homeostatic organs; this adds them as one controller architecture on a shared substrate, so hormonal, autonomic, allometric and AI-calibration adjustments compose additively rather than overwrite. It gives a transparent account of the homeostatic failures of neonatal intensive care — prerenal oliguria and volume defence, cold stress, dysglycaemia, and drug distribution and clearance.

*(100 words.)*

---

## Cover letter

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We are pleased to submit our manuscript, **"An integrated model for simulation of neonatal physiology — homeostatic regulation: renal function, endocrine volume control, thermoregulation, glucose homeostasis and pharmacology,"** for consideration as a **Basic Science Article** in *Pediatric Research*.

An intact newborn holds its extracellular volume, plasma electrolytes, temperature and blood glucose within narrow limits; a sick newborn fails to. What defends these variables — and whose failure underlies much of neonatal intensive care — is a set of slower homeostatic organ systems layered on top of the cardiovascular and respiratory plant described in our companion papers. In this manuscript we present those systems in EXPLAIN, a real-time mechanistic neonatal model, and show that they can be built as a single coherent architecture: each regulator is a compact "process controller" that owns no blood or gas compartment of its own, senses a few variables of the shared physiological state, and writes its output onto the other models' composable parameter layers, so that a hormonal, an autonomic, an allometric and a calibration adjustment to the same vessel coexist additively rather than overwriting one another. Because every controller is neutral at the calibrated baseline, any subset can be enabled for a given patient without disturbing the operating point the plant was calibrated to. We derive five such controllers — renal glomerular filtration with tubular mass balance, a renin–angiotensin–aldosterone and antidiuretic-hormone volume controller, thermoregulation with non-shivering thermogenesis, glucose/insulin homeostasis, and a pharmacokinetic/pharmacodynamic drug model — together with an intravenous-fluid scheduler, and demonstrate that each reproduces the expected physiology under perturbation, including the neuro-hormonal defence of volume against haemorrhage and the emergence of drug pharmacokinetics from the shared circulation.

We believe this work fits the translational, mechanism-oriented scope of *Pediatric Research*. Its subject matter — neonatal renal function and volume regulation, thermoregulation, glucose control and neonatal pharmacology — spans the homeostatic physiology that dominates the neonatal intensive-care unit, and its contribution is to represent these systems together, on one shared substrate, as an interpretable and openly available real-time model. (The cerebral haemodynamics of the neonate — autoregulation and intracranial pressure — are treated in a dedicated companion paper.)

In the interest of full transparency, this manuscript is one of a **planned series** describing the EXPLAIN model; it is the homeostatic-regulation paper of a two-part treatment of the neonate's regulatory organs, the companion being the cerebral-haemodynamics paper. The cardiovascular and respiratory subsystems on which this rests, an AI-assisted patient-parameterization method, an integrated-model validation across a library of virtual patients, and duct-dependent congenital heart disease are described in further companion papers, being submitted to *Pediatric Research* ‹state submitted/in-press status and cite once available›. Each paper addresses a distinct part of the model and carries its own validation; shared methodological machinery is described in full only in the lead paper and cross-referenced thereafter. We are happy to discuss the sequencing of the series with the editorial office. A large language model (Claude, Anthropic) is used as a component of the patient-parameterization *method* (not as an author, and not to generate scientific content or text); this is disclosed in the Methods.

The manuscript is original, has not been published previously, and is not under consideration elsewhere. All authors have approved the submission and meet ICMJE authorship criteria. We have no competing financial interests to declare ‹confirm›. In line with the journal's data-availability policy, the interactive model is freely available at https://explain-modeling.com, and the complete, annotated engine source code is publicly available at https://github.com/Dobutamine/explain-engine and archived with a persistent identifier at https://doi.org/10.5281/zenodo.21389097; every quantitative result is reproduced by the named probe scripts reported in the manuscript.

Thank you for considering our work. We look forward to your response.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Slots / decisions to close before sending

1. **Corresponding author** — T.A.J. Antonius (series-wide). Fill degrees + address.
2. **Main-text length** — 4,764 words (excl. equations/tables); confirm within PR's 5,000 after final equation/legend accounting, trim a methods subsection if needed.
3. **Data/Code deposit** — DONE: engine repo public + Zenodo DOI minted (2026-07-16); filled `https://github.com/Dobutamine/explain-engine`/`https://doi.org/10.5281/zenodo.21389097`.
4. **Lead-paper status line** — state P1/P2 submitted/in-press; cite P6 as preprint.
5. **Competing-interests line** — confirm "none," or state them.
6. **Optional: suggested/excluded reviewers** — neonatal renal / clinical-pharmacology experts, plus the modelling competitor groups.
7. **Inline [N] citation wiring** at final assembly.
