# P3a (Cerebral haemodynamics & intracranial pressure) — cover letter + Impact Statement for Pediatric Research

*Wave-2 paper; the marquee clinical thread refocused out of the former regulatory-organ omnibus (P3 split into P3a + P3b, 2026-07-13). Manuscript: `thesis/cerebral-paper.md` — "An integrated model for simulation of neonatal physiology — cerebral haemodynamics and intracranial pressure" (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP). Article type: **Basic Science Article**. Series decisions applied: Antonius corresponding; public code deposit; no ECI; compact AI-param highlight (Box 1); full method in P6.*

> **Why this is its own paper.** The former P3 was a seven-controller omnibus at desk-reject risk (organs coupled only by an abstract pattern, not shared physiology). Cerebral autoregulation → intraventricular haemorrhage / hypoxic–ischaemic encephalopathy is a marquee neonatal-neurology topic and stands alone with a sharp clinical hook; the other five homeostatic controllers are the companion paper [P3b]. Numbering uses sub-labels P3a/P3b; P4–P8 unchanged.

> **Remaining before sending:** deposit URL/DOI filled 2026-07-16; the three cerebral references (Alderliesten 2012, Massaro 2015, Mokri 2001) are PubMed-verified; wire inline [N] citations at assembly.

---

## Structured abstract (200 words; in `cerebral-paper.md`)

**Background:** The immature and asphyxiated newborn brain is injured when cerebral blood flow is not defended against changes in perfusion pressure: a pressure-passive circulation underlies intraventricular haemorrhage in the preterm and hypoxic–ischaemic injury after asphyxia. We model neonatal cerebral autoregulation coupled to intracranial pressure in EXPLAIN.

**Methods:** The cerebral bed is made an autoregulating organ: a leaky myogenic integrator adjusts arteriolar resistance to hold cerebral blood flow near its set-point across a range of perfusion pressure, with a maturity gain grading autoregulatory authority from intact (term) to fully pressure-passive; intracranial pressure rises with intracranial volume (Monro–Kellie) and acts on cerebral venous outflow. The controller is neutral at baseline and verified with a reproducible headless harness.

**Results:** With autoregulation intact a 15 % haemorrhage lowered cerebral blood flow only 10 %, preserving oxygen content; with the circulation pressure-passive the same insult collapsed flow 46 % and cerebral oxygen content almost three-fold — the substrate of ischaemic injury. Intracranial oedema raised intracranial pressure 5→55 mmHg and collapsed perfusion pressure; autoregulation still defended flow, but with autoregulation also lost (hypoxic–ischaemic) flow and oxygen content fell together.

**Conclusion:** A compact autoregulation-plus-intracranial-pressure controller reproduces, in real time, the pressure-passive cerebral physiology that underlies neonatal brain injury.

---

## Impact Statement (≤100 words — PR's current cap)

We model neonatal cerebral autoregulation coupled to intracranial pressure (Monro–Kellie) in the real-time EXPLAIN simulator, with a single maturity gain grading autoregulatory authority from the intact term brain to the fully pressure-passive circulation. It reproduces the pressure-passive cerebral perfusion that underlies intraventricular haemorrhage and hypoxic–ischaemic injury, on a whole-body substrate where cerebral blood flow and oxygen content interact with the systemic circulation, and is fitted per patient by an AI-assisted calibration pipeline. It gives clinicians and trainees a transparent, manipulable account of the cerebral haemodynamic failures central to neonatal neurology, for teaching and physiological hypothesis-testing.

*(95 words.)*

---

## Cover letter

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We are pleased to submit our manuscript, **"An integrated model for simulation of neonatal physiology — cerebral haemodynamics and intracranial pressure,"** for consideration as a **Basic Science Article** in *Pediatric Research*.

Much of the neurological morbidity of the newborn intensive-care unit originates in a single physiology: the cerebral circulation's ability — or failure — to hold its blood flow roughly constant as perfusion pressure changes. In the preterm infant a blood-pressure-passive cerebral perfusion precedes germinal-matrix and intraventricular haemorrhage; in the asphyxiated term infant impaired autoregulation after hypoxia–ischaemia tracks the severity of encephalopathy. This is hard to reason about at the bedside because cerebral blood flow is not directly measured, cerebral perfusion pressure is the difference of arterial and intracranial pressure, and autoregulatory reserve varies with maturity and injury. In this manuscript we model neonatal cerebral autoregulation coupled to intracranial pressure through the Monro–Kellie doctrine in EXPLAIN, a real-time whole-body neonatal model, and show that on the shared circulation it reproduces the two clinically decisive behaviours — an intact autoregulation that defends cerebral blood flow and oxygen delivery against hypotension, and a pressure-passive circulation that does not — together with the effect of raised intracranial pressure on perfusion, all governed by a single, physiologically interpretable maturity lever that places a patient between the intact term brain and the fully pressure-passive preterm or asphyxiated brain.

We believe this work fits the translational, mechanism-oriented scope of *Pediatric Research*. Its subject — cerebral autoregulation and its link to intraventricular haemorrhage and hypoxic–ischaemic injury — is central to the journal's readership, and its contribution is to represent that physiology as an interpretable, openly available real-time model on a whole-body substrate, fitted to individual patients rather than run with generic parameters.

In the interest of full transparency, this manuscript is one of a **planned series** describing the EXPLAIN model. It is the cerebral-haemodynamics paper of a two-part treatment of the neonate's regulatory organs; the companion paper describes homeostatic regulation (renal, endocrine, thermal, glucose and pharmacological control). The cardiovascular and respiratory subsystems on which this rests, an AI-assisted patient-parameterization method, an integrated-model validation across a library of virtual patients, and duct-dependent congenital heart disease are described in further companion papers, being submitted to *Pediatric Research* ‹state submitted/in-press status and cite once available›. Each paper addresses a distinct part of the model and carries its own validation; shared methodological machinery is described in full only in the lead paper and cross-referenced thereafter. We are happy to discuss the sequencing of the series with the editorial office. A large language model (Claude, Anthropic) is used as a component of the patient-parameterization *method* (not as an author, and not to generate scientific content or text); this is disclosed in the Methods.

The manuscript is original, has not been published previously, and is not under consideration elsewhere. All authors have approved the submission and meet ICMJE authorship criteria. We have no competing financial interests to declare ‹confirm›. In line with the journal's data-availability policy, the interactive model is freely available at https://explain-modeling.com, and the complete, annotated engine source code is publicly available at https://github.com/Dobutamine/explain-engine and archived with a persistent identifier at https://doi.org/10.5281/zenodo.21389097; every quantitative result is reproduced by the named probe script (`scripts/probe_brain.mjs`) reported in the manuscript.

Thank you for considering our work. We look forward to your response.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Slots / decisions to close before sending

1. **Corresponding author** — T.A.J. Antonius (series-wide). Fill degrees + address.
2. **Data/Code deposit** — DONE: engine repo public + Zenodo DOI minted (2026-07-16); filled `https://github.com/Dobutamine/explain-engine`/`https://doi.org/10.5281/zenodo.21389097`.
3. **Lead-paper status line** — state P1/P2 submitted/in-press; cite P6 as preprint.
4. **Competing-interests line** — confirm "none," or state them.
5. **Optional: suggested/excluded reviewers** — neonatal cerebral-haemodynamics / neuro-monitoring experts, plus the modelling competitor groups (Delhaas/Munneke, van de Vosse/van Willigen).
6. **Inline [N] citation wiring** at final assembly (manuscript cites by author-name in prose).
