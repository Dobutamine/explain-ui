# P5 (Integrated model + virtual-patient-library flagship) — cover letter + Impact Statement for Pediatric Research

*Wave-2 paper; the **flagship** (slate label A1). Manuscript: "An integrated model for simulation of neonatal physiology: whole-body integration and a validated library of virtual patients" (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP). Article type: **Basic Science Article**. Drafted 2026-07-12 from `thesis/thesis-ch7-virtual-patient-library.md`. Series decisions applied: Antonius corresponding; public code deposit; no ECI; compact AI-param highlight (Box 1) **plus a substantive library-wide showcase** — see the anti-redundancy note below. Full parameterization method stays in P6.*

> **Role in the series (read first — this is what makes P5 non-redundant).** P5 is the *integration* paper: where P1–P4 each validate one subsystem in depth against a few directly relevant patients, P5 validates the **integrated whole-body model across the library as a whole** — a deliberately *different data cut* (cohort breadth, cross-patient, 34 scenarios in six families), not a reprint of the subsystem tables. It is also the series' **substantive AI-parameterization showcase**: every one of the 34 patients was instantiated by the single pipeline of P6, so the breadth of the library *is* the evidence that the method generalizes. The whole-body integration narrative is told exactly twice by design — here as primary research with data, and as concept in the P8 Review; the subsystem papers do not re-tell it.

> **Manuscript consistency edits before sending** (not Python — the engine is JS/TS): **(1)** the source chapter uses thesis cross-references ("Chapter 2 §2.3" for the reproducibility convention, "Chapter 6" for the parameterization method) — remap to the **series numbering** (reproducibility convention → P1 Methods; parameterization method → the **P6 companion**). **(2)** add the **public-deposit** Data & Code Availability statement. **(3)** references: the CHD family ([18]–[27], from `docs/engine/chd_duct_fo_dependent.md`) and the PPHN ([14]–[17]) and CDH ([10]–[13]) sets are **PubMed-verified**; the **fetal / normal-neonate / preterm anchors ([1]–[9]) are still [VERIFY]** — run these through the PubMed pass (Rudolph and Kiserud fetal circulation; the term-neonate normal-range sources reused from P1's Table 2; Nuntnarumit and Versmold preterm blood-pressure; Bischoff 2021 preterm PDA cohort) before submission.

---

## Structured abstract (199 words; ready to apply to the P5 manuscript)

**Background:** Much of what decides the care of a sick newborn — the arterial blood gas, shunt-flow direction, differential cyanosis — is not any single organ's output but an emergent property of coupled cardiovascular, respiratory and regulatory systems. A whole-body model earns trust only if, once integrated, it reproduces this range.

**Methods:** We integrate the cardiovascular, respiratory, regulatory-organ and mechanical-support subsystems of EXPLAIN onto one shared blood-and-gas substrate and validate the whole across a library of 34 virtual patients — the normal fetus and neonate, a preterm surfactant-deficiency series, congenital diaphragmatic hernia, persistent pulmonary hypertension, twelve duct-/foramen-ovale-dependent heart lesions, and the ductal Doppler spectrum. Each patient is built by one AI-assisted closed-loop pipeline; every value is engine-produced and probe-reproduced.

**Results:** Normal patients fell within body-size-appropriate reference ranges; disease patients reproduced their literature signatures — suprasystemic pulmonary pressure and differential cyanosis in pulmonary hypertension and severe hernia, the pre- versus post-capillary hernia split, the duct-/foramen-ovale-dependent shunt directions of critical heart disease, and the continuous-to-bidirectional ductal Doppler spectrum — all from the single calibration method.

**Conclusion:** Integrated on a shared substrate and parameterized by one reproducible pipeline, the model reproduces the breadth of neonatal cardiopulmonary physiology and disease as emergent behaviour.

---

## Impact Statement (≤100 words — PR's current cap)

We present the whole-body EXPLAIN model and validate it across a library of 34 patients — from the normal fetus and neonate, through preterm surfactant deficiency, to diaphragmatic hernia, pulmonary hypertension and the duct- and foramen-ovale-dependent critical lesions — every value engine-produced and probe-reproduced, each patient built by one AI-assisted pipeline. Where existing in-silico neonatal models validate one subsystem in a few cases, this validates a coupled whole-body model at cohort breadth on one shared substrate. It gives one openly available, real-time platform on which the failures of the sick newborn are reproduced, taught and hypothesis-tested across the disease range.

*(100 words.)*

---

## Cover letter

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We are pleased to submit our manuscript, **"An integrated model for simulation of neonatal physiology: whole-body integration and a validated library of virtual patients,"** for consideration as a **Basic Science Article** in *Pediatric Research*.

The quantities on which neonatal intensive care turns — the arterial blood gas, the direction and volume of shunt flow across the ductus and foramen ovale, the pre- to post-ductal saturation difference, the balance of pulmonary to systemic blood flow — are almost never the output of a single organ. They are emergent properties of a cardiovascular, respiratory and regulatory physiology that is tightly coupled through one circulating blood volume, and it is precisely this coupling that a bedside clinician must reason about and that makes the sick newborn hard to teach. In our companion papers we describe each subsystem of EXPLAIN — a real-time, mechanistic neonatal model — in isolation. In this manuscript we do the thing those papers cannot do individually: we integrate the subsystems onto a single shared blood-and-gas substrate and ask whether the *coupled whole* behaves like the range of real newborns it is meant to represent. We answer that question with a library of 34 virtual patients spanning the normal term fetus and neonate, a 24-to-36-week preterm surfactant-deficiency series, congenital diaphragmatic hernia in its pre- and post-capillary phenotypes, persistent pulmonary hypertension, twelve duct- and foramen-ovale-dependent congenital heart lesions organized by dependency category, and the full spectrum of ductal Doppler flow patterns. For the normal patients, validation is that the resting panel falls within body-size-appropriate reference ranges; for the disease patients, it is that the model reproduces the *pattern and magnitude* of each condition's published signature — suprasystemic pulmonary pressure and differential cyanosis, the pre- versus post-capillary hernia distinction, the duct- and foramen-ovale-dependent shunt directions and pulmonary-to-systemic flow ratios of critical congenital heart disease, and the continuous-to-bidirectional ductal Doppler spectrum. Every value we report is produced by the engine and independently reproduced by a named probe script, not asserted. A formal, variance-based sensitivity analysis of the integrated model further shows that, across every hypoxaemic phenotype in the library, modelled oxygenation is governed by pulmonary vascular resistance and shunt geometry rather than by alveolar diffusion — the mechanism the diseases themselves require, and one independently corroborated by an in-silico transposition model (Messmore et al. 2026).

A second contribution is methodological and, we believe, central to the journal's interest in reproducible science. Every one of these 34 patients is instantiated not by hand but by a single AI-assisted, closed-loop parameterization pipeline — an interpretation layer that sets each patient's structural specification and a deterministic calibrator that fits the measured targets one physiologically interpretable lever at a time — described in full in a companion paper and summarized here in Box 1. Because the whole library is built by that one audited method, the breadth of patients it reproduces is direct evidence that the method generalizes across the range of neonatal cardiopulmonary physiology and disease.

We believe this work fits the translational, mechanism-oriented scope of *Pediatric Research*. Its subject matter — the fetal-to-neonatal transition, respiratory distress syndrome, diaphragmatic hernia, persistent pulmonary hypertension and the duct-dependent congenital heart lesions that dominate the neonatal intensive-care unit — is central to the journal's readership, and its contribution is to represent them together, as emergent behaviour of one interpretable, openly available whole-body model rather than one subsystem or one lesion at a time. It extends the small existing literature of in-silico neonatal models (e.g. Sá-Couto et al. 2010; Munneke et al. 2021; van Willigen et al. 2026), which are largely confined to the circulation and are typically run without patient-specific parameters, along the two axes those models leave open: whole-body breadth, and automated, reproducible patient-specific parameterization.

In the interest of full transparency, this manuscript is the **integrative flagship of a planned series** describing the EXPLAIN model. The cardiovascular and respiratory subsystems (the lead papers of the series) and the regulatory-organ and mechanical-support-device subsystems are being submitted to *Pediatric Research* ‹state submitted/in-press status and cite once available›; a companion paper describes the AI-assisted parameterization method in full, and a further paper applies it to duct- and foramen-ovale-dependent congenital heart disease. Each paper addresses a distinct part of the model and carries its own validation; the subsystem papers validate their own physiology in depth, whereas this paper validates the integrated model across the library as a whole — a distinct data cut, not a re-presentation of the subsystem results. Shared methodological machinery is described in full only in the lead paper and cross-referenced thereafter. We are happy to discuss the sequencing of the series with the editorial office. A large language model (Claude, Anthropic) is used as a component of the patient-parameterization *method* (not as an author, and not to generate scientific content or text); this is disclosed in the Methods.

The manuscript is original, has not been published previously, and is not under consideration elsewhere. All authors have approved the submission and meet ICMJE authorship criteria. We have no competing financial interests to declare ‹confirm›. In line with the journal's data-availability policy, the interactive model is freely available at https://explain-modeling.com, and the complete, annotated engine source code is publicly available at ‹public repository URL› and archived with a persistent identifier at ‹Zenodo/archive DOI›; every quantitative result is reproduced by the named probe scripts reported in the manuscript, and the full virtual-patient library (the JSON model definitions, the `_make_*`/`reseed_*`/`probe_*` scripts) is included in that deposit.

Thank you for considering our work. We look forward to your response.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Slots / decisions to close before sending

1. **Corresponding author** — T.A.J. Antonius (series-wide). Fill degrees + address.
2. **Manuscript consistency edits** (see banner): remap thesis "Chapter" cross-references to series numbering (reproducibility convention → P1; parameterization → P6); add public-deposit availability statement.
3. **Reference verification** — the fetal/normal-neonate/preterm anchors [1]–[9] are still [VERIFY]; the CHD, PPHN and CDH sets are already PubMed-verified. Run the remaining nine through PubMed.
4. **Data/Code deposit** — make the engine repo public + mint DOI; fill `‹repository URL›` and `‹DOI›`. This is the paper whose value most depends on the deposit (the library + probe scripts *are* the reproducibility claim), so prioritize it here.
5. **Lead-paper status line** — state P1–P4 submitted/in-press and cite once available; cite P6 as preprint (bioRxiv DOI) so the AI-param showcase points to a citable method.
6. ~~**Figure budget**~~ — resolved in the draft: 3 existing figure assets (`thesis_fig_building_blocks`, `thesis_fig_patient_library`, `Fig6_AI_parameterization`) + 4 inline tables; 2 optional new panels available within the ≤6 budget. **Manuscript now drafted → `thesis/integrated-model-paper.md`** (3110w main text; the disease results are a per-family summary matrix + gestational trend + fetal integration test = the library-wide cut, not a reprint of §7.6/subsystem tables). Remaining: deposit URL/DOI; refs [1]–[9] [VERIFY]; inline [N] wiring.
7. **Anti-redundancy check with P1–P4** — confirm the cohort-level tables here do not duplicate the subsystem-depth tables in P1–P4 (they should be the library-wide cut); trim any overlap at assembly.
8. **Competing-interests line** — confirm "none," or state them.
9. **Optional: suggested/excluded reviewers** — whole-body-modelling and neonatal-cardiology experts, plus the modelling competitor groups (Delhaas/Munneke, van de Vosse/van Willigen, May/Argus).
