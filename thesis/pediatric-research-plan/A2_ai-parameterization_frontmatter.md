# AI-parameterization paper (P6; slate labels A2 / B4): PR front-matter sketch

*Draft title + structured abstract + Impact Statement, formatted for Pediatric Research (Basic Science Article). This is **P6** in the combined programme (see `PR_ARTICLE_SLATE.md`) — the same paper the two slates called A2 (Slate A) / B4 (Slate B). It sits in Wave 3, just before the CHD paper, and is the full treatment of the method that every other paper highlights compactly. Preprint early on bioRxiv so the earlier papers can cite it. Source draft: `thesis/ai-parameterization-paper.md`. Created 2026-07-12.*

---

## Title (recommended)

**An AI-assisted closed-loop method for patient-specific parameterization of a whole-body neonatal physiology model**

*Alternatives (differentiation-forward):*
- *Turning bedside clinical targets into patient-specific virtual newborns: a language-model-guided closed-loop calibrator for a mechanistic physiology model*
- *Patient-specific instantiation of a mechanistic neonatal physiology model: a language model for interpretation, a deterministic calibrator for fitting*

*(PR limit: ≤20 words, descriptive; the recommended title is 15 words. Lead with "patient-specific" — that is the delta vs the incumbent in-silico neonatal models, which run without patient-specific parameters.)*

---

## Structured abstract (≤200 words)

**Background:** Lumped-parameter models of neonatal physiology are prized because their parameters are interpretable, but they are underdetermined — hundreds of free parameters against a handful of bedside measurements — so fitting one to an individual patient has required slow, irreproducible expert hand-tuning. Existing in-silico neonatal circulation models are therefore typically run with generic, non–patient-specific parameters.

**Methods:** We describe an AI-assisted, closed-loop parameterization pipeline for a real-time whole-body neonatal simulator. A large language model interprets the available clinical description into a validated, allowlisted specification (baseline, target values, pathophysiology). A deterministic calibrator then fits the model by assigning one physiologically interpretable lever to each measured target and driving each to a clinician-meaningful tolerance with a proportional-seed/secant root-finder, after allometric and gestational-age seeding and baroreflex set-point alignment so the model's own control loops defend the fit. The language model performs no numerical fitting.

**Results:** For a 28-week, 1.0-kg preterm construction, five targets (heart rate, mean arterial pressure, cardiac output, SpO₂, PCO₂) converged within tolerance in two iterations, with untargeted vitals remaining within preterm reference ranges; the same calibrator retuned a running simulation in place in three iterations. A variance-based sensitivity analysis (Sobol′/PRCC, estimator-validated) validates the one-lever design for the pressure targets and identifies where target coupling or the operating point weakens it.

**Conclusion:** Separating interpretation from fitting, and bounding every automated adjustment, makes patient-specific instantiation of a mechanistic neonatal model rapid, auditable and reproducible.

*(~215 words with the sensitivity-analysis clause — trim to ≤200 at final assembly, e.g. by shortening Background.)*

---

## Impact Statement (≤100 words — PR's current cap)

A large language model can interpret bedside clinical data into a validated, bounded specification that a deterministic one-lever-per-target calibrator turns into a patient-specific virtual newborn in a few iterations. Existing in-silico neonatal models are run with generic parameters because individual fitting demands manual expert tuning; this is the first method to make that fitting automated, disciplined and reproducible, with the language model confined to interpretation and prevented from touching the model's equations or state. It removes the barrier to individualizing lumped-parameter physiological models — enabling patient-specific simulation for neonatal education and hypothesis-testing now, and, with prospective validation, bedside decision support.

*(100 words.)*

---

## Positioning note (cite in Intro + Discussion)

Differentiate explicitly from the recent PR in-silico neonatal models — Munneke, Lumens & Delhaas 2021 (DOI 10.1038/s41390-021-01401-0) and van Willigen … van de Vosse 2026 (DOI 10.1038/s41390-025-04565-1), the latter run **"without patient-specific parameters"** — and from the Karger "Newborn Cardiovascular Digital Twins" identifiability work. This paper's contribution is precisely the automated, reproducible *patient-specific* fitting those lack. ✅ **DONE:** the one-lever-per-target claim is tied to its sensitivity-analysis validation — incorporated into P6 §2.6 (methods) and §3.3 (results, with the one-lever validation matrix + Fig 1), the full treatment carried as Supplementary Information (`P6_supplement_sensitivity-analysis.md`). *(2026-07-15 functional split: the operating-point/oxygenation-mechanism finding + its figure `FigSA_operating_point_dominance` moved to P5 §3.4 as an integrated-model result; P6 keeps the design validation and hands the physiology off to [P5].)* Note this is itself a differentiator: none of Munneke/van Willigen/May report an identifiability or sensitivity analysis of their parameterization, and the oxygenation finding is independently corroborated by Messmore et al. 2026 (neonatal-transposition SA) — now presented in P5.
