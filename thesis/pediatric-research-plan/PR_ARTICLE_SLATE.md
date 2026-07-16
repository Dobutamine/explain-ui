# Publishing Explain in *Pediatric Research* — a combined submission programme

*Publication-strategy proposal. Companion to `thesis/THESIS_BLUEPRINT.md`. Created 2026-07-12; revised to a single combined programme.*

## Context

The Explain thesis (compilation / "thesis by publication") has five drafted subsystem papers plus a virtual-patient-library chapter, all targeting *Pediatric Research* (PR). Two candidate slates were considered — **Slate B** (one paper per subsystem — maximum coverage, the whole model reaches the literature) and **Slate A** (a tighter, higher-impact set — Review + integrated-validation flagship + AI-parameterization headline + CHD application).

**Resolution: publish the union, sequenced.** Slate A and Slate B are not alternatives — the AI-parameterization paper is the *same paper* in both (A2 ≡ B4), and Slate A's flagship simply sits at a higher altitude that the subsystem papers feed. The programme below is the combined set: full subsystem coverage (Slate B) delivered as a staged, novelty-forward series (Slate A). The original two-slate mapping is kept as an appendix.

**Decisions locked in:** PR-only; Review anchor; validation lives **both** in a dedicated flagship **and** per-subsystem; **Cardiovascular leads**; **publish the whole model first**, with the dedicated AI-parameterization paper moved to just before CHD; **every paper carries a compact AI-parameterization highlight**, and the flagship + CHD papers **showcase** it substantively.

## Journal fit brief (the constraint on every paper)

PR (Springer Nature, IF ≈ 3, official journal of ESPR/SPR/ASP) publishes **translational** research; it is **not** a computational-methods journal. Every Explain primary paper must be a **Basic Science Article** (structured abstract ≤200 w, 5000 words, ≤6 figs) that leads with a (patho)physiologic mechanism + literature-anchored validation. The concept anchor is a **Review Article** (4500 w). Cross-cutting requirements: structured Impact Statement (key message / what it adds / impact); Data & Code availability (`explain-modeling.com`); single AI-use disclosure (LLM = method, not author); Early-Career-Investigator angle if the lead author qualifies. *(Author-guidelines PDF is dated May 2020 — re-verify limits against the live pages before submitting.)*

## Scope-precedent finding (drives differentiation — verified 2026-07-12)

*Source: PubMed + web. DOIs below.*

PR *does* publish closed-loop in-silico neonatal cardiovascular models (genre confirmed; literature/animal validation suffices — no prospective data required), but the niche is **narrow and contested**:

| Precedent | What it is | Relevance |
|---|---|---|
| Sá-Couto / **van Meurs** et al., *Pediatr Res* **2010**;67:158–165 | Educational simulation of hemodynamic transitions at birth | **Explain's own lineage**, in PR |
| **Munneke, Lumens & Delhaas**, *Pediatr Res* **2021**;91:116–128 — [DOI](https://doi.org/10.1038/s41390-021-01401-0) | Closed-loop in-silico fetal-to-neonatal transition; time-varying elastance, O₂ sat, homeostatic control; validated vs human/animal data | Near-identical genre to Explain **P1/P5** |
| **van Willigen … van de Vosse**, *Pediatr Res* **2026** — [DOI](https://doi.org/10.1038/s41390-025-04565-1) | Closed-loop 0D–1D CV + O₂/CO₂; VSD & TGA; validated vs literature; explicitly **"without patient-specific parameters"** | Directly overlaps Explain **P7** (CHD) |

Outside PR: **May et al., "Newborn cardiovascular digital twins: personalised identifiable computational models of the neonatal circulation," *Matern Child Health* 2025;1(1):26–36 ([DOI](https://doi.org/10.1159/000546724))** — identifiable 0D bond-graph models fitted to ultrasound data (the personalisation angle Explain must out-differentiate). **Every Explain paper must foreground the delta:** (i) whole-body breadth (vs circulation-only), (ii) patient-specific AI-parameterization (the gap the incumbents name), (iii) real-time interactive open platform. Cite Munneke 2021 + van Willigen 2026 + Karger throughout.

## The programme — 9 papers in 3 waves *(P3 split into P3a + P3b, 2026-07-13)*

| # | Paper | Role | From | Wave | Set |
|---|---|---|---|:--:|:--:|
| **P1** | **Cardiovascular** (time-varying elastance, ANS; PDA + pulmonary-HTN validation) | **LEAD**; carries full shared Methods S1–S7 | B1 | 1 | model |
| **P2** | Respiratory / gas-exchange / acid–base (Stewart solver, RDS) | completes the cardiorespiratory model in print | B2 | 1 | model |
| **P3a** | Cerebral haemodynamics & intracranial pressure (autoregulation → IVH/HIE, Monro–Kellie) — the marquee thread | subsystem coverage | B3 | 2 | model |
| **P3b** | Homeostatic regulation (renal, endocrine/RAAS-ADH, thermal, glucose, pharmacology) | subsystem coverage | B3 | 2 | model |
| **P4** | Mechanical support devices — *reframed around a physiological question* (e.g. ventilation-induced haemodynamics, ECMO gas exchange) | subsystem coverage | B5 | 2 | model |
| **P5** | **Integrated model + virtual-patient-library flagship** | Whole-body integration; validation showcase **is** the AI-parameterization demonstrated across the library | A1 | 2 | model |
| **P6** | **AI-parameterization pipeline** (incl. the variance-based **sensitivity-analysis validation** of the one-lever design + Supplement) | **Headline method** — full treatment | A2 ≡ B4 | 3 | method |
| **P7** | Duct-/FO-dependent CHD in silico (12-lesion family) | clinical application; **lesion cases parameterized via the AI pipeline** | A3 | 3 | application |
| **P8** | **Review** — explanatory, AI-parameterized whole-body simulation in neonatology | concept anchor / synthesis | A0 | 3 | synthesis |

**Wave logic.** Publish the **whole model first**, then the headline method, its application, and the synthesis. Wave 1 leads with the mature cardiorespiratory pair — **P1 Cardiovascular** (near-submission, lowest risk, gets the series accepted) then **P2 Respiratory** — putting the full cardiorespiratory model in print. Wave 2 completes the model: **P3a Cerebral**, **P3b Homeostasis**, **P4 Devices**, the **P5 flagship**. Wave 3 delivers the **P6 AI-parameterization method paper**, its **P7 CHD application**, and the **P8 Review last, ideally invited** (editor pre-inquiry) — which also lets the Review cite the whole published series.

**Keeping the differentiator visible despite the late method paper.** Because the whole model is in print before its parameterization method is formally published, two devices carry the "patient-specific parameterization" differentiator through Waves 1–2: the **compact per-paper highlight** (next section) and an **early bioRxiv preprint of P6** (PR does not count preprints as prior publication) so every earlier paper can cite the method.

*Preprint server — decided 2026-07-16: **bioRxiv**, not medRxiv.* P6 is an in-silico physiological-modelling *method* paper with no patient data, which is bioRxiv's remit (and where the comparator in-silico neonatal models live); medRxiv's health/clinical-data scope is a weaker fit and its "algorithm-announcement" screening could delay or redirect it, defeating the goal of a fast citable DOI. Posting to both is prohibited, so the choice is bioRxiv. (*Pediatric Research* accepts preprints from either.)

## AI-parameterization threaded through every paper

AI-parameterization is the headline innovation of the whole Explain project, so — even though its full method gets one dedicated paper (P6) — **every paper carries a compact, standardized AI-parameterization highlight**: a short boxed callout (≈½ column + one figure-or-cross-reference) stating that the paper's virtual patients were instantiated by the AI-assisted closed-loop calibrator, with the full method deferred to P6. Author it **once** and reuse it near-verbatim so it reads as a deliberate series signature, not padding.

Two papers **showcase** the method substantively:
- **P5 (flagship):** its library-wide validation *is* the AI-parameterization showcase — the whole virtual-patient cohort was built by the pipeline.
- **P7 (CHD):** each of the 12 lesion cases was parameterized via the pipeline, shown per-lesion.

## Validation at two altitudes (the "both" decision, made non-redundant)

- **Subsystem papers (P1, P2, P3a, P3b, P4):** validate their *own* physiology **in depth** against a few directly relevant virtual patients — mechanism-focused tables.
- **Flagship (P5):** validates the **library as a whole** — breadth across the AI-parameterized cohort, presented as the integrated-system + AI-parameterization showcase. A *different data cut*, not a re-print of the subsystem tables.

## Anti-redundancy spine (mandatory for an 8-paper single-journal series)

1. **Shared Methods S1–S7 in full only in P1**; every later paper cites it.
2. **AI-parameterization method in full only in P6**; every other paper carries the *standardized compact highlight* (authored once, reused near-verbatim), and P5/P7 add a substantive *showcase* rather than re-deriving the method.
3. **Integration / whole-body narrative** told exactly twice by design — as *concept* in the Review (P8) and as *primary research with data* in the Flagship (P5); subsystem papers stay in their subsystem.
4. **Distinct disease-validation payload per paper** (each owns its slice of the library).
5. **Disclose the series to the editor** in every cover letter; **cross-cite** published series papers; **space submissions** so each cites its predecessors as published.

## Recommendation

Run the full programme, waves 1 → 3: publish the whole model first (P1 → P2 → P3a → P3b → P4 → P5), then P6 AI-parameterization, P7 CHD, P8 Review (invited, last). Thread the compact AI-parameterization highlight through every paper, showcase it in P5 and P7, and preprint P6 early. This is a multi-year, ~9-manuscript program in one IF-3 journal — the anti-redundancy spine and the *author-once, reuse* rule for the AI-param callout are what keep it defensible rather than salami-sliced.

## Verification / next steps

1. **Confirm current PR article-type limits** — May-2020 PDF; re-check limits and the unsolicited-Review policy (pre-inquiry for P8) against the live pages.
2. **Scope-precedent check** — ✅ done 2026-07-12.
3. **Draft the two reusable series blocks once** — (a) the differentiated positioning paragraph (vs Munneke 2021 / van Willigen 2026 / Karger), (b) the standardized compact AI-parameterization highlight callout.
4. **Confirm the P5-flagship vs subsystem validation data cuts are genuinely distinct** before drafting P5.
5. **Dry-run one Impact Statement + cover letter** for the lead paper (P1), plus a series-disclosure paragraph.
6. **Confirm ECI eligibility** for the lead author.

## Deliverable files in this folder

- `PR_ARTICLE_SLATE.md` — this programme.
- `A2_ai-parameterization_frontmatter.md` — drafted title/abstract/Impact Statement for **P6** (labelled A2/B4 by slate).
- *(to come)* the two reusable series blocks, per-paper front-matter, cover letters.

## Out of scope / deferred

Obstetric/maternal-fetal ("Paper 6"/uterus-placenta) remains deferred. Full thesis assembly (OMML equation re-keying, EN+NL summaries, consolidated bibliography) is a separate workstream.

---

## Appendix — the original two-slate mapping (for traceability)

Before consolidation, the programme was framed as two candidate slates. Retained here so the P-numbers trace back to their source drafts.

**Shared anchor — A0:** Review Article ("Explanatory, AI-parameterized whole-body simulation of the newborn"). → **P8**.

**Slate A (tight flagship):**
- **A1** — Integrated cardiorespiratory model, validated across virtual newborns (circ master + `thesis-ch7`). → **P5**.
- **A2** — AI-parameterization pipeline (`ai-parameterization-paper.md`). → **P6**. *(2026-07-13: the sensitivity analysis, formerly a bundled source `thesis-ch6-sensitivity-analysis.md`, is now **incorporated into P6** — Methods §2.6 + Results §3.3 with the one-lever validation matrix and two figures (`FigSA_*`), full treatment as Supplement `P6_supplement_sensitivity-analysis.md`. The SA doubles as a **field differentiator**: none of Munneke 2021 / van Willigen 2026 / May 2025 report an identifiability or sensitivity analysis of their parameterization, and the oxygenation finding is independently reproduced by Messmore et al. 2026.)*
- **A3** — Duct-/FO-dependent CHD in silico (`thesis-ch7` §7.6 + `chd_duct_fo_dependent.md`). → **P7**.

**Slate B (full subsystem map):**
- **B1** — Cardiovascular (circ master). → **P1**.
- **B2** — Respiratory / gas-exchange / acid–base (`respiratory-paper.md`). → **P2**.
- **B3** — Regulatory organs, **split 2026-07-13** → **P3a** Cerebral haemodynamics (`cerebral-paper.md`, new) + **P3b** Homeostatic regulation (`other-systems-paper.md`, transformed).
- **B4** — AI-parameterization (= A2). → **P6**.
- **B5** — Mechanical support devices (`devices-paper.md`), reframed. → **P4**.

Overlaps that collapsed the two slates into one programme: **A2 ≡ B4** (same paper, P6); **A1 ≈ B1 at flagship altitude** (B1 → focused cardiovascular paper P1; A1 → whole-body validation flagship P5).
