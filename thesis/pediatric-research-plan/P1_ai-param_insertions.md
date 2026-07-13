# P1 (Cardiovascular) — AI-parameterization *compact-highlight* insertion set

*Paste-ready. Adds the standardized AI-parameterization highlight to the P1 manuscript per the combined-programme decision: **compact highlight only — the full method lives in P6**. Deliberately OMITS circ-paper-additions.md **Block A (full §2.4 method)** and **Table X** (those belong to P6). All anchor sentences below were verified present in `ExplainCircPaper(27012026)_WPdB_TA_WvM.docx` on 2026-07-12. Reference numbers assume the manuscript's list currently ends at [23]. Created 2026-07-12.*

> **Why paste-ready, not auto-applied:** these insertions add a formatted callout box and three new references and must go in **together** (the Results/Discussion edits reference *Box 1* and *[24]*); injecting them piecemeal into the `.docx` would create dangling references. Placement, box styling, and reference formatting are best done in your Word pass. The earlier Python→JS fix was applied in-place because it was a pure text correction with no new content. *(Say the word if you'd like me to inject these into the `.docx` anyway.)*

---

### 1. Abstract — INSERT after "…(e.g. foramen ovale and ductus arteriosus)."

> The model is instantiated for individual patients not by hand but by an AI-assisted, closed-loop calibration pipeline in which a large language model interprets the available clinical targets and a deterministic calibrator fits the model to within clinician-meaningful tolerances; this pipeline generated the patient-specific configurations validated here.

### 2. Introduction — INSERT after "It is validated at baseline, and for the PDA and aPH conditions."

> The patient-specific configurations used in these validations were produced not by manual tuning but by an AI-assisted, closed-loop calibration pipeline that maps a small set of measured clinical targets onto the model's parameters; the pipeline is outlined in Box 1 and described in full in a companion paper [24].

### 3. Methods — INSERT the standardized callout (Box 1), placed with §2.3 (software/implementation)

> **Box 1 · How the virtual patients in this paper were parameterized.**
> The patient profiles used here were not tuned by hand. EXPLAIN instantiates a patient with a two-layer, AI-assisted pipeline. An *interpretation layer* — a large language model — reads the available clinical description (free text, monitor values or a report) and emits a validated, bounded specification: a baseline, target values and named pathophysiology, expressed only through the same allowlisted, schema-checked commands as the interactive parameter editor. A *calibration layer* — a deterministic root-finder — then fits the model by assigning one physiologically interpretable lever to each target and driving that target to a clinician-meaningful tolerance, after allometric and gestational-age seeding and baroreflex set-point alignment so the model's own control loops defend rather than oppose the fit. The language model performs no numerical fitting and never edits equations or state. For the cardiovascular targets of this paper the pairings are: mean arterial pressure ← systemic (arteriolar) resistance; cardiac output ← ventricular contractility (E_max); heart rate ← heart-rate reference; central venous pressure ← systemic venous unstressed volume; mean pulmonary artery pressure ← pulmonary vascular resistance. The full method — convergence behaviour, the sensitivity-analysis justification for the one-lever-per-target design, and the offline-construction and live-tuning entry points — is given in the companion paper [24]; the use of a language model as a *method component*, not an author, is disclosed in the Methods.

*(This is the series-signature box; keep it near-verbatim across P1–P7 — see `series_blocks.md`.)*

### 4. Results §3.1.2 (PDA) — REPLACE this exact sentence

> ~~EXPLAIN's model parameters were rescaled to match the baseline premature infant physiology reported by Bischoff et al. by adjusting blood volume, unstressed volumes, elastances, and resistances proportional to weight, with minor additional tuning of arterial resistances.~~

with

> The baseline premature-infant configuration reported by Bischoff et al. was produced with the AI-assisted calibration pipeline (Box 1): blood volumes, unstressed volumes, elastances and resistances were first scaled allometrically to the reported weight, after which the calibrator fitted the model to the reported baseline hemodynamic targets.

*(Everything after this sentence — the 2.2 mm bidirectional shunt, the LVO/RVO 1.55 left-to-right case — stays unchanged; those are the pathophysiological modifiers applied on top of the calibrated baseline.)*

### 5. Results §3.1.3 (PH) — INSERT after "…to represent varying degrees of severity."

> As in the PDA case, the underlying patient baseline was established with the calibration pipeline of Box 1; the pulmonary-resistance and pulmonary-artery-elastance changes representing each stage were then applied on top of that calibrated baseline.

### 6. Discussion §4.1 (originality) — APPEND

> A further element of originality is that EXPLAIN is fitted to a patient not by hand but by an AI-assisted, closed-loop pipeline (Box 1; companion paper [24]), which makes patient-specific instantiation reproducible and keeps every automated adjustment within the same bounds as a manual edit.

### 7. Discussion §4.5 (future work) — REPLACE this exact sentence

> ~~Following a systematic sensitivity analysis, future work will focus on the development of parameter-optimization pipelines for patient-specific model fitting, using machine-learning and other artificial-intelligence–based approaches.~~

with

> Building on the AI-assisted parameterization pipeline used here (Box 1; companion paper [24]), future work will pursue a systematic sensitivity analysis to identify the most informative parameters, extend calibration from the present one-lever-per-target scheme to joint multi-target optimization for strongly coupled configurations, and undertake prospective validation of patient-specific fits against clinical data.

*(The following sentence on ventilation strategies, pulmonary vasodilators and transitional failure stays as written.)*

### 8. Methods — AI-use disclosure (required by PR; place in the software/methods section)

> A large language model (Claude, Anthropic) is used as a component of the parameterization method: it interprets clinical inputs and emits validated, allowlisted specifications. It performs no numerical fitting, does not modify the model's equations or state, and is not used to generate the scientific content or text of this study; no authorship is attributed to it.

### 9. New references — APPEND after [23]

> **[24]** Antonius TAJ, ‹co-authors›. ‹AI-parameterization paper title — see `A2_ai-parameterization_frontmatter.md`›. Pediatr Res. ‹year; in press / bioRxiv preprint DOI›. *(the P6 companion paper — preprint it early so P1 can cite it)*
> **[25]** Anthropic. Claude [large language model]. Anthropic PBC; 2025. Available from: https://claude.com.
> **[26]** Anthropic. Claude Agent SDK [software]; 2025. Available from: https://platform.claude.com/docs/en/api/agent-sdk.

*(Confirm the exact Claude model/version and access date, and the software-citation format PR/Springer Nature requires. No secant/numerical-methods citation is needed in the compact version — it carries no equations; that citation lives in P6.)*

---

## What is intentionally NOT here (lives in P6)

- The full **§2.4 AI-assisted parameterization** Methods subsection with Eqs. 13–15 (circ-paper-additions.md Block A).
- **Table X** (the full lever table) — its content appears only as the inline lever list inside Box 1.
- The **worked convergence example** and the secant/relaxation-loop detail.

## Data & Availability (decided: public code deposit)

Update the manuscript's availability statement to: the interactive model is freely available at https://explain-modeling.com; the complete annotated engine source code is publicly available at ‹repository URL› and archived at ‹Zenodo/archive DOI›. **Action:** make the repo public + mint the DOI, then fill both here and in the cover letter.
