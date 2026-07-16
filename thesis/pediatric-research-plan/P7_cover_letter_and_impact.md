# P7 (Duct-/FO-dependent CHD application) — cover letter + Impact Statement for Pediatric Research

*Wave-3 paper; the **clinical application** (slate label A3). Manuscript: "An integrated model for simulation of neonatal physiology: duct- and foramen-ovale-dependent congenital heart disease" (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP). Article type: **Basic Science Article**. Cover letter drafted 2026-07-12 from `thesis/thesis-ch7-virtual-patient-library.md` §7.6 + the engine monograph `docs/engine/chd_duct_fo_dependent.md`. Series decisions applied: Antonius corresponding; public code deposit; no ECI; compact AI-param highlight (Box 1) **plus a per-lesion showcase** — see role note. Full parameterization method stays in P6.*

> **Role in the series (read first).** P7 is the second **substantive AI-parameterization showcase** (with P5): each of the 12 lesion cases was instantiated by the P6 pipeline, shown *per-lesion* as the method applied to structured congenital pathophysiology — beyond the compact Box 1 that P1–P4 carry. It is likely the series' **strongest raw PR fit** (a named, high-stakes clinical disease family — cyanosis, shock, prostaglandin, pulse-oximetry screening), so the letter can lead harder on clinical physiology and lighter on "model." It is also where the **van Willigen et al. 2026** contrast is most pointed: that PR paper is an in-silico CHD transition model run *without patient-specific parameters* and confined to the circulation — P7 differentiates on a broader duct/FO-dependent lesion family, a whole-body substrate, and per-lesion patient-specific parameterization.

> **✅ P7 manuscript ASSEMBLED 2026-07-12 → `thesis/chd-paper.md`.** Full Basic Science Article draft (~3,150 words excl. tables, well under the 5,000 limit; 198-w structured abstract; 21 references in order of appearance, PMIDs carried from the monograph). Structure matches the series shell: Intro (parallel-circulation concept + positioning vs refs 7–10) → Methods (2.1 four-category taxonomy, 2.2 structural-lever engine mapping, 2.3 reproducibility, 2.4 AI-param Box 1 + per-lesion-showcase note + AI-use disclosure) → Results (3.1–3.4 the four category tables lifted from §7.6, 3.5 decompensation/rescue: duct-closure tests + restrictive-septum + PGE1 + septostomy) → Discussion (4.1 originality, 4.2 validity, 4.3 reproducibility, 4.4 limitations: MAPCA/aortic-override/atrialized-RV) → Conclusion. Built from §7.6 (engine-produced tables) + engine monograph `docs/engine/chd_duct_fo_dependent.md`. **Remaining on the manuscript:** fill `[P1]`–`[P6]` companion citations with real refs/DOIs (cite P6 as preprint); deposit URL/DOI filled 2026-07-16; convert tables to Word objects; confirm the twelve-lesion set (below).

> **Manuscript consistency edits (at assembly):** **(1)** remap thesis "Chapter" cross-references to series numbering (the `Pda`/`Shunts` mechanics → P1; the reproducibility convention → P1 Methods; the parameterization pipeline → **P6**). **(2)** add the **public-deposit** Data & Code Availability statement (the per-lesion `_make_*`/`reseed_*`/`probe_*` scripts and the lesion JSONs are the reproducibility claim). **(3)** references: the CHD bibliography in the engine monograph is already largely **PubMed-verified** ([#1]–[#48]; e.g. Khalil/Schranz 2019, Martins 2008, Akkinapally 2018 Cochrane, Rashkind 1966, Mahle 2009 AHA/AAP) — carry it over and renumber to order of appearance; verify the handful still flagged. **(4)** state the engine's documented CHD limitations explicitly in the manuscript (no MAPCA model, no aortic override, no separately atrialized RV) — they bound which lesions are represented and are already written up in the monograph.

---

## Structured abstract (197 words; ready to apply once the manuscript is assembled)

**Background:** A group of critical congenital heart lesions share one physiology: the newborn survives only while the ductus arteriosus and/or the foramen ovale stays patent, and decompensates — with profound cyanosis or cardiogenic shock — as the channel closes. Their stability is governed by the balanced parallel circulation.

**Methods:** We model twelve duct- and foramen-ovale-dependent lesions in the whole-body EXPLAIN simulator, spanning the four dependency categories (duct-dependent pulmonary flow, duct-dependent systemic flow, duct/foramen-ovale-dependent mixing, and atrial-septum-dependent lesions). Each is a term neonate built from a calibrated baseline by structural levers — valve atresia or stenosis, shunt geometry, chamber hypoplasia, arch obstruction, anomalous venous drainage — and parameterized by the series' AI-assisted pipeline. Every value is engine-produced and probe-reproduced.

**Results:** Each lesion reproduces its literature signature — the direction and volume of the ductal and atrial shunts, the pulmonary-to-systemic flow ratio, the pre- versus post-ductal saturation split, and closure-driven decompensation confirmed by in-silico duct-closure tests. The restrictive-atrial-septum emergency and the standard rescues — prostaglandin patency and balloon atrial septostomy — are demonstrable in real time.

**Conclusion:** One whole-body model reproduces the parallel-circulation physiology, decompensation and rescue of the duct- and foramen-ovale-dependent lesions as an interpretable teaching and hypothesis-testing platform.

---

## Impact Statement (≤100 words — PR's current cap)

We model the duct- and foramen-ovale-dependent critical congenital heart lesions as a family of twelve virtual patients across four dependency categories in the whole-body EXPLAIN model, each instantiated by the series' AI-assisted pipeline, reproducing shunt direction, differential cyanosis and closure-driven decompensation. Where the recent in-silico neonatal CHD model is circulation-only and run without patient-specific parameters, this represents a broader lesion family on a whole-body substrate, so cyanosis and shock emerge from real gas exchange and shunting, not prescription. It gives a transparent account of why a duct-dependent newborn crashes as the duct closes — for education, pulse-oximetry-screening rationale and hypothesis-testing.

*(100 words.)*

---

## Cover letter

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We are pleased to submit our manuscript, **"An integrated model for simulation of neonatal physiology: duct- and foramen-ovale-dependent congenital heart disease,"** for consideration as a **Basic Science Article** in *Pediatric Research*.

A distinct group of critical congenital heart lesions dominates the neonatal intensive-care unit for one physiological reason: the newborn survives only while the ductus arteriosus and/or the foramen ovale remains patent, and then decompensates — with profound, oxygen-resistant cyanosis, or with cardiogenic shock that mimics sepsis — over the hours to days in which that channel physiologically closes. What unites these otherwise disparate lesions is the *balanced parallel circulation*: the systemic and pulmonary circuits run in parallel rather than in series, sharing output across the patent channel, so the infant's stability is set by the pulmonary-to-systemic flow ratio and, through it, by the balance of pulmonary and systemic vascular resistance. This is precisely a physiology that is decisive at the bedside, dangerous to get wrong — lowering pulmonary vascular resistance with oxygen or alkalosis helps a duct-dependent *pulmonary* lesion but can flood the lungs and starve the body in a duct-dependent *systemic* one — and notoriously hard to teach. In this manuscript we represent it in EXPLAIN, a real-time whole-body neonatal model, as a family of twelve virtual patients spanning the four dependency categories: duct-dependent pulmonary blood flow, duct-dependent systemic blood flow, duct- and foramen-ovale-dependent mixing (transposition of the great arteries), and foramen-ovale/atrial-septum-dependent lesions.

Each lesion is built from a single calibrated term-neonate baseline by explicit structural changes — valve atresia or stenosis, shunt geometry, chamber hypoplasia, aortic-arch obstruction, anomalous venous drainage — and is then parameterized for its targets by the series' AI-assisted, closed-loop pipeline, so that the twelve cases are produced by one auditable method rather than twelve separate hand-fits. Because the lesions live on a whole-body substrate with real gas exchange and one circulating blood volume, their hallmark findings are emergent rather than prescribed: the direction and volume of the ductal and atrial shunts, the pulmonary-to-systemic flow ratio, the pre- versus post-ductal saturation difference, and the decompensation that follows ductal closure — which we confirm directly with in-silico duct-closure tests. The model reproduces the lethal restrictive-atrial-septum emergency (left-atrial pressure rising toward 21 mmHg with deepening hypoxaemia in hypoplastic left heart syndrome) and lets the two standard rescues be demonstrated in real time — prostaglandin-maintained ductal patency, and balloon atrial septostomy simulated by widening the foramen ovale. Every value we report is produced by the engine and reproduced by a named probe script, and the physiological mapping and limitations of each lesion are documented against a verified clinical bibliography.

We believe this work fits the translational, mechanism-oriented scope of *Pediatric Research* particularly well, its subject being a core, high-stakes domain of neonatal cardiology — critical congenital heart disease, prostaglandin therapy, and the pulse-oximetry screening whose rationale is exactly the pre-/post-ductal physiology the model makes explicit. It extends the recent in-silico neonatal congenital-heart-disease literature (notably van Willigen et al. 2026, an in-silico model of congenital heart disease across the fetal-to-neonatal transition) along the axes that literature leaves open: a broader duct- and foramen-ovale-dependent lesion family, a whole-body rather than circulation-only substrate, and per-lesion patient-specific parameterization rather than generic parameters. We are candid about what the engine cannot yet represent — major aortopulmonary collaterals, aortic override, and a separately atrialized right ventricle — and state, per lesion, which findings this bounds.

In the interest of full transparency, this manuscript is a **clinical-application paper within a planned series** describing the EXPLAIN model. The cardiovascular, respiratory, regulatory-organ, mechanical-support-device and integrated-model papers describe the physiology and whole-body integration on which this application rests, and the parameterization method used here is given in full in a companion paper; all are being submitted to *Pediatric Research* ‹state submitted/in-press/published status and cite once available›. Each paper addresses a distinct part of the model and carries its own validation; shared methodological machinery is described in full only in the lead and method papers and cross-referenced here. We are happy to discuss the sequencing of the series with the editorial office. A large language model (Claude, Anthropic) is used as a component of the patient-parameterization *method* (not as an author, and not to generate scientific content or text); this is disclosed in the Methods.

The manuscript is original, has not been published previously, and is not under consideration elsewhere. All authors have approved the submission and meet ICMJE authorship criteria. We have no competing financial interests to declare ‹confirm›. In line with the journal's data-availability policy, the interactive model is freely available at https://explain-modeling.com, and the complete, annotated engine source code — including the per-lesion construction and probe scripts and the lesion model definitions — is publicly available at https://github.com/Dobutamine/explain-engine and archived with a persistent identifier at https://doi.org/10.5281/zenodo.21389097; every quantitative result is reproduced by the named probe scripts reported in the manuscript.

Thank you for considering our work. We look forward to your response.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Slots / decisions to close before sending

1. ~~**Assemble the manuscript**~~ — ✅ **done 2026-07-12** → `thesis/chd-paper.md` (see banner). Remaining on it: real `[P1]`–`[P6]` companion citations, deposit URL/DOI, Word-table conversion.
2. **Corresponding author** — T.A.J. Antonius (series-wide). Fill degrees + address.
3. **Manuscript consistency edits** (see banner): remap "Chapter" cross-references to series numbering; add public-deposit availability statement; state the CHD limitations (MAPCA/aortic-override/atrialized-RV) explicitly.
4. **Reference verification** — carry over the engine monograph's 48-entry, largely PubMed-verified CHD bibliography; renumber to order of appearance; confirm the few still flagged.
5. **Lesion count** — the library §7.6 lists twelve lesions; the monograph catalogs ~14 (some Category-A variants — TOF/PA, neonatal Ebstein — are noted "partially buildable"). Confirm the final twelve vs. whether any partially-buildable lesion is included with caveats or deferred.
6. **Data/Code deposit** — DONE: engine repo public + Zenodo DOI minted (2026-07-16); filled `https://github.com/Dobutamine/explain-engine` and `https://doi.org/10.5281/zenodo.21389097`.
7. **Cite P6 as preprint** — the per-lesion AI-param showcase must point to the method paper's bioRxiv DOI.
8. **Figure budget (≤6)** — the four category tables plus a duct-closure/septostomy demonstration figure; decide table-vs-figure and what moves to a supplement.
9. **Competing-interests line** — confirm "none," or state them.
10. **Optional: suggested/excluded reviewers** — neonatal/paediatric cardiology and critical-CHD experts, plus the modelling competitor groups (especially van de Vosse/van Willigen, the direct in-silico-CHD comparator).
