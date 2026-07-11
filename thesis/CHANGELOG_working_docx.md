# Changelog — `ExplainCircPaper_WORKING_with_AIparam.docx`

Auto-generated working copy of the master `ExplainCircPaper(27012026)_WPdB_TA_WvM.docx`.
All figures, embedded charts, tracked comments (4) and native equations (41) from the
master are preserved untouched. This lists every content change.

**Highlighted (yellow) = newly inserted.** Inline wording replacements are *not*
highlighted (they sit mid-paragraph); they are listed below so nothing is missed.

## Inserted (highlighted)
- **Methods §2.4 "AI-assisted patient-specific parameterization"** — new subsection before RESULTS: problem framing, interpretation layer (LLM), calibration layer, Eq. 13–15 (plain-text placeholders — **re-key as native Word equations**), tolerance bands, levers, body-size/seed pass, two entry points.
- **Table X** — Calibration levers (real Word table, inserted in §2.4).
- **Fig. 6** — the AI-parameterization pipeline diagram (`thesis/Fig6_AI_parameterization.png`, editable source `.svg`) is now embedded in §2.4 with its caption.
- **"Use of AI in this study."** — formal AI-disclosure paragraph, end of §2.4 (Methods).
- **Abstract** — one sentence on the AI-assisted parameterization pipeline (before "We demonstrate…").
- **Introduction** — one sentence naming patient-specific parameterization as a second contribution (before the respiratory-model sentence).
- **§3.1.3 (PH)** — appended sentence attributing the PH baseline to the §2.4 pipeline.
- **§4.1 (Originality)** — appended sentences on the parameterization method.
- **References 24–26** — Claude (LLM), Claude Agent SDK, Burden & Faires (secant method).

## Inline replacements (NOT highlighted)
- **Abstract:** "annotated **Python** source code **is provided** for researchers…" → "annotated source code **is available** for researchers…".
- **Introduction:** "The complete source code **in Python** is available upon request." → "The complete source code is available upon request."
- **§2.3 (intro paragraph):** "The source code of the **Python implementation of** EXPLAIN is available upon request." → "The EXPLAIN source code is available upon request."; removed the clause "and basic knowledge of the programming language **Python**,".
- **§2.3 (developer-environment paragraph):** the "interactive **Python notebook**…" paragraph replaced with the actual JS/TS ES-module engine + Web Worker + Vue web-app description (Block E). *(This paragraph is highlighted since it is effectively new text.)*
- **§3.1.2 (PDA):** "EXPLAIN's model parameters were rescaled … with minor additional tuning of arterial resistances." → reframed as the §2.4 AI-driven closed-loop pipeline (allometric scaling + secant lever calibration to the Bischoff targets). **No reported numbers changed.**
- **§4.5 (Future work):** the "…parameter-optimization pipelines … using machine-learning and other artificial-intelligence–based approaches." sentence → refocused on sensitivity analysis, joint multi-target optimization, and prospective validation (the pipeline is now described as implemented in §2.4).

## Author to-do before submission
1. **Re-key Eq. 13–15** as native OMML equations (currently plain-text placeholders prefixed "[re-key as native equation]").
2. **Fig. 6** is embedded (auto-generated). If you want it in the OmniGraffle house style, redraw from `thesis/Fig6_AI_parameterization.svg` as a `.umdx`.
3. **Refs 24–25**: set exact Claude model/version + access date; format per the journal's software/AI-citation style. If van Meurs [10] is preferred for the secant method, drop ref 26 and cite [10] at Eq. 13–14.
4. Springer Nature / ICMJE: the AI-disclosure paragraph in §2.4 covers method use; confirm placement (Methods vs a dedicated declarations section) against the journal's current policy. No AI authorship is claimed.
5. Optionally convert the highlighted insertions into tracked changes if you want a reviewable diff against the master.
