# P1 (Cardiovascular) — cover letter + Impact Statement for Pediatric Research

*Lead paper of the EXPLAIN series. Manuscript: "An integrated model for simulation of neonatal physiology: the cardiovascular system" (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP). Article type: **Basic Science Article**. Drafted 2026-07-12 from the circ master `.docx`. `‹slots›` to finalize before sending.*

> **✅ Python→JavaScript fix applied to the manuscript (2026-07-12).** The circ `.docx` previously said the source code was **Python** (abstract, intro, §2.3). All five occurrences were corrected to **JavaScript/TypeScript in a Web Worker** per `circ-paper-additions.md` Block E; the manuscript now matches this cover letter and Impact Statement. (Original recoverable from git.) The broader Block E §2.3 rewrite and the AI-parameterization additions (Blocks A–D, F–G) remain to be merged separately.

---

## Impact Statement (≤100 words — PR's current cap)

We present EXPLAIN, an integrated, real-time, lumped-parameter model of neonatal cardiovascular physiology — including the ductus arteriosus, foramen ovale and a closed-loop sympatho-vagal baroreflex — validated against published targets for normal haemodynamics, patent ductus arteriosus and acute pulmonary hypertension. Existing in-silico neonatal cardiovascular models are closed-circulation formulations run with generic parameters; EXPLAIN couples a pulsatile circuit with autonomic control and the neonatal shunts, and is freely inspectable in real time as an interactive explanatory model. It gives clinicians, trainees and researchers a transparent mechanistic tool for reasoning, teaching and hypothesis-testing, and founds a whole-body simulator extended in companion papers.

*(99 words.)*

---

## Cover letter

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We are pleased to submit our manuscript, **"An integrated model for simulation of neonatal physiology: the cardiovascular system,"** for consideration as a **Basic Science Article** in *Pediatric Research*.

Critically ill neonates present complex, rapidly shifting physiology, and diagnostic reasoning and team communication often occur under time pressure with only partial information. *Explanatory models* — interactive, animated representations of the underlying physiology, coupled to interventions and clinical monitors — can help bridge these cognitive gaps. In this paper we describe the conceptual and mathematical basis of EXPLAIN, a pulsatile, lumped-parameter model of the neonatal heart and vascular system that incorporates neonatal-specific features (foramen ovale, ductus arteriosus, separate left/right lung circulations, differential shunt-dependent oxygen delivery) and a closed-loop autonomic baroreflex expressed as a sympatho-vagal balance. We demonstrate that the model reproduces both normal neonatal haemodynamics and two clinically important pathological conditions — patent ductus arteriosus and acute pulmonary hypertension — with close agreement to published target data for cardiac output, blood pressures, and ductal Doppler flow patterns across a range of shunt magnitudes. The model runs in real time and is freely available as an interactive web application at https://explain-modeling.com.

We believe this work fits the translational, mechanism-oriented scope of *Pediatric Research*. Mechanistic in-silico models of the neonatal circulation have an established place in the journal, from the educational birth-transition simulator of Sá-Couto et al. (2010) to the recent closed-loop fetal-to-neonatal models of Munneke et al. (2021) and van Willigen et al. (2026). Our contribution differs in two respects: EXPLAIN is designed as the cardiovascular core of an *integrated whole-body* model rather than a circulation-only formulation, and it is openly and interactively available for clinical teaching and research rather than existing solely as a computational description. These features position it as a practical explanatory tool for the neonatal community, consistent with the journal's readership.

In the interest of full transparency, we wish to disclose that this manuscript is the **first of a planned series** describing the EXPLAIN model, with companion papers on the respiratory/gas-exchange and acid–base subsystems, the regulatory organ systems, an AI-assisted patient-parameterization method, an integrated-model validation across a library of virtual patients, and duct-dependent congenital heart disease **in preparation**. Each paper addresses a distinct physiological subsystem and carries its own validation; shared methodological machinery is described in full only in this lead paper and cross-referenced thereafter. We are happy to discuss the sequencing of the series with the editorial office. A large language model (Claude, Anthropic) is used elsewhere in the series as a component of the patient-parameterization *method* (not as an author and not to generate scientific content or text); this is noted where relevant and disclosed in the Methods of the paper concerned.

The manuscript is original, has not been published previously, and is not under consideration elsewhere. All authors have approved the submission and meet ICMJE authorship criteria. We have no competing financial interests to declare ‹confirm›. In line with the journal's data-availability policy, the interactive model is freely available at https://explain-modeling.com, and the complete, annotated engine source code is publicly available at ‹public repository URL› and archived with a persistent identifier at ‹Zenodo/archive DOI›; the numerical parameter values are given in the manuscript.

Thank you for considering our work. We look forward to your response.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Slots / decisions to close before sending

1. ~~Corresponding author~~ — ✅ **T.A.J. Antonius** (first author). Fill his degrees + full postal address/phone/email in the signature block.
2. ~~Apply the Python → JavaScript/TypeScript fix~~ — ✅ **done 2026-07-12** (see banner).
3. ~~Data/Code-availability stance~~ — ✅ **public code deposit** chosen. **Action required:** make the engine repo public and mint a persistent DOI (e.g. GitHub → Zenodo release), then fill `‹repository URL›` and `‹DOI›` in both the letter and the manuscript's Data Availability statement.
4. ~~ECI paragraph~~ — ✅ **removed** (not applicable).
5. **Competing-interests line** — confirm "none," or state them.
6. **Optional: suggested/excluded reviewers** — the closest-competing groups (Delhaas/Munneke, van de Vosse/van Willigen, May/Argus) are natural expert reviewers but also competitors; decide whether to suggest or request exclusion.
7. **Series-disclosure paragraph** — keep it (transparency defuses salami-slicing concerns); trim if the editor prefers brevity.
8. **Fill signature block** — Antonius's degrees and full postal address, phone, email.
