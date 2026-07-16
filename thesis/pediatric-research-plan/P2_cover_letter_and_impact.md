# P2 (Respiratory) — cover letter + Impact Statement for Pediatric Research

*Wave-1 companion to P1. Manuscript: "An integrated model for simulation of neonatal physiology: the respiratory system, gas exchange and metabolism" (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP). Article type: **Basic Science Article**. Drafted 2026-07-12 from `thesis/respiratory-paper.md`. Series-wide decisions applied: corresponding author = Antonius; public code deposit; no ECI framing; compact AI-param highlight (full method in P6). `‹slots›` to finalize before sending.*

> **✅ Two P2 manuscript consistency edits DONE 2026-07-12** (in `respiratory-paper.md`): **(1)** §2.3 source-availability updated from "available upon request" to the **public-deposit** statement (deposit slots filled 2026-07-16). **(2)** §2.4 (and the intro pointer) repointed from "Section 2.4 of the cardiovascular paper" to the **companion parameterization paper [P6]** and P1's **Box 1**. Nothing further needed in the manuscript ; the deposit URL/DOI are now filled (2026-07-16).

---

## Structured abstract (193 words; applied to `respiratory-paper.md` 2026-07-12)

**Background:** Respiratory care of the newborn requires inferring a tightly coupled system — alveolar ventilation, inspired oxygen, the diffusing capacity of an immature lung, perfusion, metabolism and buffering — from few monitored outputs. Real-time models can make these couplings explicit.

**Methods:** We describe the respiratory subsystem of EXPLAIN, an integrated neonatal simulator: elastic gas compartments and thoracic mechanics, a spontaneous respiratory drive, partial-pressure-driven alveolar gas exchange, a physicochemical (Stewart strong-ion) acid–base and oxygen-transport solver, whole-body metabolism with hypoxia-driven lactate, and a dynamic surfactant/alveolar-recruitment model, all solved together on the blood substrate shared with the circulation; patient-specific parameters are set by an AI-assisted closed-loop calibration pipeline.

**Results:** The model reproduces a normal term-neonate blood gas within reference ranges; arterial oxygenation rises with inspired oxygen and alveolar diffusion while carbon dioxide tracks ventilatory drive; added unmeasured anions produce a graded metabolic acidosis separated from the respiratory axis; and surfactant in preterm respiratory distress recruits the lung over minutes, raising PaO₂ from 55 to 74 mmHg and SpO₂ from 91 to 96%.

**Conclusion:** Solving ventilation, gas exchange, transport, acid–base and metabolism together makes the arterial blood gas an emergent, patient-specific property, providing a transparent real-time platform for neonatal respiratory physiology.

## Impact Statement (≤100 words — PR's current cap)

We present the respiratory subsystem of EXPLAIN — ventilation, partial-pressure-driven gas exchange, Stewart acid–base chemistry, metabolism, and surfactant-dependent recruitment — solved on the blood substrate shared with the circulation, so the arterial blood gas is emergent, not prescribed. Existing in-silico neonatal models are circulation-centred with lumped gas exchange; this couples respiratory, acid–base and metabolism to the circulation on one blood chemistry, reproduces the surfactant response in respiratory distress syndrome, and is fitted per patient by AI-assisted calibration. It gives clinicians and trainees a transparent account of the coupled failures of oxygenation, carbon-dioxide clearance and acid–base balance in neonatal respiratory care.

*(100 words.)*

---

## Cover letter

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We are pleased to submit our manuscript, **"An integrated model for simulation of neonatal physiology: the respiratory system, gas exchange and metabolism,"** for consideration as a **Basic Science Article** in *Pediatric Research*.

Respiratory care of the sick newborn requires reasoning about quantities that cannot be directly seen: from a pulse-oximeter saturation, an end-tidal CO₂ trace and an intermittent blood gas, the clinician must infer the state of a tightly coupled system of alveolar ventilation, inspired oxygen, the diffusing capacity of an immature lung, the distribution of pulmonary blood flow, tissue oxygen consumption and blood buffering chemistry. In this paper we describe the respiratory subsystem of EXPLAIN — a real-time, mechanistic neonatal physiology model whose cardiovascular system is presented in a companion paper — comprising elastic gas compartments and thoracic mechanics, a spontaneous respiratory-drive model, partial-pressure-driven alveolar gas exchange, a physicochemical (Stewart strong-ion) acid–base and oxygen-transport solver, whole-body metabolism with hypoxia-driven lactate production, and a dynamic surfactant/alveolar-recruitment model with hysteresis. Because these processes are solved together on the same blood compartments that the circulation uses, the arterial blood gas the model reports is an emergent property rather than a prescribed number. We demonstrate that the model reproduces a normal neonatal blood gas within reference ranges, the expected dependence of oxygenation on inspired oxygen and alveolar diffusion, of carbon dioxide on ventilatory drive, and of pH and base excess on metabolic and respiratory perturbations, and the coupled improvement in compliance, diffusion, shunt and oxygenation that follows surfactant administration in a preterm respiratory-distress-syndrome scenario — all in real time in a standard web browser.

We believe this work fits the translational, mechanism-oriented scope of *Pediatric Research*. Its subject matter — surfactant deficiency and its treatment, permissive hypercapnia, neonatal acid–base management and the oxygen economy of the preterm infant — is central to the journal's readership, and its approach extends the small existing literature of in-silico neonatal models (e.g. Sá-Couto et al. 2010; Munneke et al. 2021; van Willigen et al. 2026) beyond the circulation into the coupled respiratory, gas-transport, acid–base and metabolic physiology those models do not represent, fitted to individual patients rather than run with generic parameters.

In the interest of full transparency, this manuscript is the **second paper of a planned series** describing the EXPLAIN model. The cardiovascular subsystem (the companion paper referenced throughout) is being submitted to *Pediatric Research* as the lead paper of the series ‹state "submitted"/"in press"/co-submission and cite once available›; further companion papers on the regulatory organ systems, an AI-assisted patient-parameterization method, an integrated-model validation across a library of virtual patients, and duct-dependent congenital heart disease are in preparation. Each paper addresses a distinct physiological subsystem and carries its own validation; shared methodological machinery is described in full only in the lead paper and cross-referenced thereafter. We are happy to discuss the sequencing of the series with the editorial office. A large language model (Claude, Anthropic) is used as a component of the patient-parameterization *method* (not as an author, and not to generate scientific content or text); this is disclosed in the Methods.

The manuscript is original, has not been published previously, and is not under consideration elsewhere. All authors have approved the submission and meet ICMJE authorship criteria. We have no competing financial interests to declare ‹confirm›. In line with the journal's data-availability policy, the interactive model is freely available at https://explain-modeling.com, and the complete, annotated engine source code is publicly available at https://github.com/Dobutamine/explain-engine and archived with a persistent identifier at https://doi.org/10.5281/zenodo.21389097; every quantitative result is reproduced by the named probe scripts reported in the manuscript.

Thank you for considering our work. We look forward to your response.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Slots / decisions to close before sending

1. **Corresponding author** — T.A.J. Antonius (series-wide decision). Fill degrees + full postal address/phone/email.
2. **Two P2 manuscript consistency edits** (see banner): public-deposit availability wording; repoint §2.4 to the P6 companion paper + P1 Box 1.
3. **Data/Code deposit** — same action as P1: DONE: engine repo public + persistent Zenodo DOI minted (2026-07-16); filled `https://github.com/Dobutamine/explain-engine` and `https://doi.org/10.5281/zenodo.21389097`.
4. **Lead-paper status line** — state whether P1 is "submitted," "in press," or co-submitted, and cite it once it has a reference/DOI (P2 leans on it as the companion).
5. **Competing-interests line** — confirm "none," or state them.
6. **Optional: suggested/excluded reviewers** — the competitor groups (Delhaas/Munneke, van de Vosse/van Willigen, May/Argus) plus acid–base/respiratory-physiology experts; decide whether to suggest or exclude.
7. ~~Tighten the abstract~~ — ✅ **done 2026-07-12**: structured 193-word abstract (Background/Methods/Results/Conclusion) written and applied to `respiratory-paper.md`; copy above.
