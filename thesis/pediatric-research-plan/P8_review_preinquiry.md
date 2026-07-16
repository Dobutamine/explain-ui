# P8 (Review) — presubmission inquiry + proposed outline for Pediatric Research

*Wave-3 paper; the **concept anchor / synthesis** (slate label A0). Proposed article type: **Review Article** (PR: ~4500 words, **unstructured** abstract). This is the one paper that should **not** be submitted cold: PR Reviews are frequently commissioned, and an unsolicited Review lands far better after a **presubmission inquiry** to the Editor-in-Chief. Drafted 2026-07-12. Series decisions applied: Antonius corresponding; public code deposit; no ECI. Per the series plan, the Review carries **no AI-param Box** — it describes the parameterization pipeline in prose in its own section.*

> **Role in the series (read first).** P8 is submitted **last, ideally invited**, so it can cite the whole published series as it appears. It is the second and final telling of the whole-body integration narrative — as **concept** here, versus as **primary research with data** in the P5 flagship; the subsystem papers do not re-tell it. The Review's job is to expand the series' standard positioning paragraph (Block A-Intro, `series_blocks.md`) into a full field survey with a forward argument, using EXPLAIN as the worked instantiation rather than as the subject. Frame it as a **review of the in-silico neonatal-physiology field**, not an eighth EXPLAIN paper — that is what makes it reviewer- and editor-attractive and keeps it inside the anti-redundancy spine.

> **Timing & sequencing.** Send the inquiry below only once P1/P2 (and ideally P5/P6) are submitted or in press, so the letter can state that the underlying primary work exists and is under review at PR. If the editors welcome it, the full Review is written last of all, citing the series as published/in-press.

---

## Presubmission inquiry letter (≈380 words)

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We write to ask whether the editors would welcome a full submission of a **Review Article** on **explanatory, patient-specific whole-body simulation of neonatal physiology** — where the field of in-silico neonatal modelling now stands, and where two recent developments are taking it.

Mechanistic, closed-loop models of the neonatal circulation have an established place in *Pediatric Research*: an educational simulator of the haemodynamic transition at birth (Sá-Couto et al., 2010) and, more recently, closed-loop in-silico models of the fetal-to-neonatal transition and of congenital heart disease across that transition (Munneke et al., 2021; van Willigen et al., 2026), alongside identifiable "digital-twin" formulations developed elsewhere (May et al., 2025). These models validate realistically against literature and animal data and are valuable for teaching and research, but they share two limits that bound their clinical reach: they are largely confined to the circulation with lumped gas exchange, and they are typically run with generic rather than patient-specific parameters, because fitting a lumped-parameter model to an individual newborn has required slow, expert hand-tuning. We propose a Review that synthesises this literature and argues that the field's next step is defined by closing exactly those two gaps — whole-body mechanistic breadth (coupling respiration, blood-gas and acid–base chemistry, the regulatory organs and mechanical support to the circulation on one substrate) and automated, reproducible patient-specific parameterization, including the emerging use of large language models as a safely-bounded interpretation layer.

We are well placed to write this synthesis: we have recently completed a series of primary papers describing such a whole-body neonatal model (EXPLAIN) and its AI-assisted parameterization, submitted to this journal ‹state which are submitted/in press›. The Review would treat the field even-handedly — situating our own and the competing groups' work against the same criteria — and would use concrete worked examples only to illustrate the general argument. We anticipate ~4500 words, an unstructured abstract, one or two schematic figures, and ~60 references, within the journal's Review format.

Would a Review on this topic be of interest? We would be glad to send a full outline or adjust the scope to the editors' preference. Thank you for considering it.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Proposed title (for the inquiry and, if invited, the manuscript)

**Recommended:** *In-silico neonatal physiology: from circulation models to explanatory, patient-specific whole-body simulation*

*Alternatives:*
- *Explanatory simulation of the newborn: whole-body mechanistic models and patient-specific parameterization*
- *The individualized virtual newborn: mechanistic whole-body simulation and AI-assisted parameterization in neonatology*

*(Field-review framing, not "EXPLAIN: …" — the review surveys the field and argues a direction; EXPLAIN is the worked instantiation.)*

---

## Unstructured abstract sketch (~160 words; PR Reviews use an unstructured abstract)

> Computational models of neonatal physiology have moved from teaching aids to closed-loop simulators of the fetal-to-neonatal transition, yet their clinical reach is still bounded by two limits: they model the circulation largely in isolation, with lumped gas exchange, and they are run with generic rather than patient-specific parameters, because individualizing a lumped-parameter model has demanded slow, irreproducible expert tuning. This review surveys the small but growing in-silico neonatal literature and argues that the field's next step is the joint resolution of those two limits. We discuss what is gained by coupling respiration, blood-gas and acid–base chemistry, the regulatory organs and mechanical support to the circulation on one shared substrate, so that the arterial blood gas and shunt physiology become emergent; and how automated, physiologically disciplined parameterization — including large language models confined to a safely-bounded interpretation role — can make an individualized virtual newborn rapid, auditable and reproducible. We close with implications for education, screening, hypothesis-testing and, with prospective validation, decision support.

---

## Proposed Review outline (~4500 words)

1. **Introduction — why simulate the newborn (≈500 w).** The bedside inference problem (few monitored outputs, tightly coupled physiology); the promise of mechanistic, interpretable models; the two gaps this review is organized around.
2. **The in-silico neonatal lineage (≈900 w).** Sá-Couto 2010 (transition teaching), Munneke 2021 (closed-loop fetal-to-neonatal), van Willigen 2026 (CHD across the transition, explicitly non–patient-specific), May 2025 (identifiable digital twins, outside PR). What each validates and where each stops. A parallel *methods* precedent — a finite-difference sensitivity analysis of a neonatal transposition model (Messmore 2026) — is the closest identifiability work in the field and is surveyed here as such. Even-handed criteria table (breadth · individualization · real-time/openness · validation basis · **identifiability / sensitivity analysis reported**), the last row being one on which only EXPLAIN currently reports.
3. **Gap 1 — whole-body breadth (≈900 w).** What coupling respiration, gas transport and Stewart acid–base, the regulatory organs (cerebral/renal/endocrine/thermal/glucose), pharmacology and mechanical support onto one advective substrate buys: emergent blood gas, shunt direction, differential cyanosis, device–patient interaction. The composability substrate (effective-value layering) as the enabling idea. *(Worked illustration: the series' subsystem + integrated results — cite P1–P5.)*
4. **Gap 2 — patient-specific parameterization (≈1000 w).** Why fitting is ill-posed; hand-tuning and its costs; the one-lever-per-target reduction and its **formal, variance-based sensitivity-analysis validation** — a rigor/identifiability beat that is itself a field differentiator: EXPLAIN's calibration design is *tested* (Sobol′/PRCC, estimator-validated, identifiability characterized) and its weak points (operating-point-dependent oxygenation control) reported, a step none of the surveyed whole-model papers take, and one that independently reproduces a neonatal-transposition sensitivity result (Messmore 2026); then the large-language-model interpretation layer and — critically — the safety architecture that confines it to bounded, allowlisted specification and bars it from equations and state. The distinction between interpretation and fitting as the general design principle. *(Cite P6 for the SA one-lever design validation and P5 for the operating-point oxygenation finding + Messmore corroboration — split across the two papers 2026-07-15; discuss AI-in-medicine safety framing.)*
5. **What it enables (≈700 w).** Education (the hardest-to-teach physiology: duct-dependent lesions, PPHN, RDS); the physiological rationale of pulse-oximetry screening; hypothesis-testing and in-silico trials; the path to decision support and what prospective validation would require. *(Cite P7 as the clinical-application exemplar.)*
6. **Limitations & open problems (≈400 w).** Validation against literature ranges vs prospective individual-patient data (shared by all these models); coupled-target convergence; un-modellable structures; generalization beyond the neonate.
7. **Conclusion (≈200 w).** The individualized, explanatory, openly available virtual newborn as the field's near-term horizon.

---

## Slots / decisions to close

1. **Gate on series status** — send the inquiry only after P1/P2 (ideally P5/P6) are submitted/in press; fill the `‹which are submitted/in press›` slot with the true state.
2. **Corresponding author** — T.A.J. Antonius (series-wide). Fill degrees + address.
3. **Confirm the PR Review format** against the live guidelines (word limit ~4500, unstructured abstract, figure/reference caps) — the May-2020 PDF is the only cached copy; re-verify before sending.
4. **Author list for the Review** — same physiology-paper set, or add the AI/engineering contributors if the parameterization section warrants (align with the P6 decision).
5. **Even-handedness** — the Review cites our own series alongside Munneke/van Willigen/May; keep the criteria table neutral (a self-promotional review is the main rejection risk for an unsolicited Review). State the series authorship as a transparency note.
6. **If not invited** — the Review can still be submitted unsolicited, but expect a higher bar; alternatively fold its argument into the P5 flagship Discussion and drop P8. Decide based on the editors' reply.
7. **Figures** — one schematic (the two gaps / the whole-body substrate) and possibly the criteria table as a display item; keep within the Review figure cap.
