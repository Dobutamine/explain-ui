# Skim digest — EXPLAIN @ Pediatric Research (9-paper programme)

*Orientation read of all eight papers, generated 2026-07-13. One paragraph of "what it currently says" + the concrete open TODOs per paper. Read this in numeric order to load the whole programme, then **tune in the leverage order** (Phase 0 shared spine → P1 → P6 → subsystem papers → P5/P7 → P8; see `TUNING_ORDER` note in chat). Word counts are whitespace-split, main text excluding table rows and equation blockquotes. Caps: Basic Science Article — abstract ≤200 w, main text ≤5000 w, ≤6 figures; Review (P8) ≤4500 w.*

---

## Fix-once — issues that recur across most papers (handle at the spine / assembly, not per-paper)

| Recurring issue | Papers affected | Where to fix |
|---|---|---|
| ~~**Deposit slots unfilled**~~ ✅ **filled 2026-07-16** — repo `github.com/Dobutamine/explain-engine` + Zenodo DOI `10.5281/zenodo.21389097` written into all 8 cover letters + P2/P3a/P3b/P4 manuscripts | P1 `.docx` only | inject the filled statement at the P1 Word pass |
| **Companion refs `[P1]`–`[P7]` are placeholder tokens** (cite P6 as bioRxiv preprint) | all except P8 | Final assembly, after author list + preprint |
| **Citations are author-name prose; inline `[N]` numbering not wired** | all manuscripts | Final assembly (each ref list is currently a pool) |
| **Equations are Markdown blockquotes → must be re-keyed as Word OMML** | P1 (lost in docx), P2, P3a, P6 | At Word conversion |
| **Abstract over the 200-word cap** | P1 ~210, P3a 201, P4 ~211, **P6 ~370** | Per-paper (P6 is the big one) |
| **Title artifact — stray "THE"** ("…— THE cardiovascular system", P4 doubles it) | P1, P2, P4 | Phase 0 title convention, apply to all |
| **Figure budget barely used** (≤6 allowed) | P4/P6/P7 = 0 figs; P3a = 1 table only; P2 = 1 fig | Per-paper — decide figure set |
| **Label style inconsistent** — `[Paper 4]` vs `[P4]`, bylines say "Fourth/Fifth paper" | P3b, P4, **P6 (mislabelled "Fourth paper" — it's P6 of 9)** | Phase 0 numbering convention |

---

## P1 — *An integrated model for simulation of neonatal physiology — the cardiovascular system*  ·  **Tune Phase 1 (voice-setter)**
**Says:** Lead paper introducing EXPLAIN — a pulsatile lumped-parameter neonatal cardiovascular model (Beneken-based, neonatal shunts FO/DA/IPS/VSD + an SVB baroreflex). Intro → Methods (conceptual/mathematical/software) → Results (3 validations) → Discussion. Baseline term haemodynamics match literature (LVO 181 vs 177±25; ABP 70/45 vs 67/42; SVCF 76); PDA vs Bischoff reproduces LVO/RVO 1.0→1.14→1.57 and the bidirectional-shunt LVO drop; PH vs Jones matches Qp/Qs; Doppler model shows the restrictive early-systolic dip.
**Length:** main ~4200 w (ok); abstract ~210 w (**over 200**).
**Worst edges (this is the docx — highest-effort tune):**
- **Equations are empty** — "Eq. 1"–"Eq. 12" render as bare labels; the symbol glossary under Eq. 9 lost its symbols (" = receptor activation"). Confirm the OMML survived in the actual .docx.
- **Wrong citation:** "conclusions of Bischoff et al. **[10]**" should be **[21]** ([10] = van Meurs).
- **Typos:** "is **was** presented"; "the **norm** scenarios"; Table 4 "**patienst**". Table 4 header "Severe **PPHN** with PDA" vs sim "Severe **PH**"; caption "AAP=aortic pressure" but row labelled "ABP".
- **No AI-parameterization Box 1** — only prose-mentioned in §4.5; must be injected (`P1_ai-param_insertions.md` is paste-ready).
- Leftover **draft stamps** in byline ("TA, Jun 26, 2026"; "Target journal: Pediatric Research"). Source "available upon request" ×3.
- Software wording is clean (JS/TS in a Web Worker — no lingering Python). No `[P#]` labels used yet.
**Cross-refs:** respiratory model "described in a separate paper" (unlabelled = P2); acid–base already published (ref [11], Antonius 2023).

## P2 — *An integrated model for simulation of neonatal physiology — the respiratory system, gas exchange and metabolism*  ·  **Tune Phase 3**
**Says:** Respiratory subsystem — elastic gas compartments + thoracic mechanics, spontaneous drive, Fick alveolar exchange, shared Stewart/Hill solver (`BloodComposition`), metabolism with hypoxia lactate, dynamic surfactant/recruitment RDS — all on the shared blood substrate so the ABG is emergent. Sims: term baseline (pH 7.36, PCO₂ 39.8, PO₂ 74.8, BE −3.0); PO₂ 74.9→472 as FiO₂ 0.21→0.90; graded metabolic acidosis from UMA; 28wk surfactant recruits PaO₂ 54.6→74.3, SpO₂ 90.7→96.1, elastance 558→363.
**Length:** main **~5478 w (OVER cap by ~480)**; abstract ~197 w (ok).
**Worst edges:**
- **Trim ~480 words** — Discussion 4.1/4.2 and the long Fig. 1 legend are the fat.
- Deposit slots §2.3 ✅ filled 2026-07-16 (repo + Zenodo DOI `10.5281/zenodo.21389097`). §2.4 correctly repoints method to P6 + P1 Box 1 — verify lands.
- Only **Fig. 1** present (≤6 allowed); Tables 1–5 filled. Refs are a pointer to `_references.md` "confirm via PubMed" list.
**Cross-refs:** P1 (shared Methods, blood substrate), P6 (method), P4 (devices reuse gas-exchange eqs), P3b (placenta `BloodDiffusor`).

## P3a — *An integrated model for simulation of neonatal physiology — cerebral haemodynamics and intracranial pressure*  ·  **Tune Phase 3**
**Says:** Cerebral thread split out of the old omnibus. Autoregulation (leaky myogenic integrator, maturity gain g_ar∈[0,1]) coupled to Monro–Kellie ICP via cerebral venous-outflow resistance; neutral at baseline, `probe_brain.mjs`-verified. Table 1: 15% haemorrhage intact drops CBF 10% (143→128) vs pressure-passive 46% (143→77); 12 mL oedema raises ICP 5→55 mmHg, CPP 54→3; HIE (oedema+lost autoreg) CBF→100, tO₂→3.40.
**Length:** main ~1987 w (well under — room to expand); abstract **201 w (1 over)**.
**Worst edges:**
- Abstract 201 → trim 1 word.
- **No figures** — only Table 1 (a schematic + an autoregulation-curve figure are the obvious adds; it's the shortest paper, most room).
- Table 1 "autoreg factor" column labelling looks inverted (pressure-passive rows show 1.00, intact rows 0.15) — **[VERIFY] against probe output**.
- Process-controller architecture correctly *deferred* to P3b (not re-derived); no leftover renal/endocrine content. Deposit slots blank.
**Cross-refs:** P1 (Box 1, §2.3 convention), P3b (architecture), P6 (method); P2/P4/P5/P7 in companion list.

## P3b — *…homeostatic regulation: renal function, endocrine volume control, thermoregulation, glucose homeostasis and pharmacology*  ·  **Tune Phase 3 (tightest budget)**
**Says:** Five neutral-at-baseline "process controllers" (Kidneys, Hormones RAAS-ADH, Thermoregulation, Glucose, Drugs) + an IV-fluid scheduler — each owns no compartment, senses shared state, writes `*_factor_ps` effector layers. Probes: haemorrhage GFR 4.46→~3.2 (FE_Na 1.02→0.76%, aldosterone 0.98→1.25); cold stress brown-fat 0→2.2 W; dextrose glucose→7.4; adrenaline HR 131→194.
**Length:** main ~4597 w (**~400 headroom — comfortable**); abstract 189 w (ok). §2.2.x/§3.x sequential, Tables 1–5 no gaps — clean split.
**Worst edges:**
- **Figure 1 still shows the Brain node** — caption literally says "*(Figure to be updated to remove the Brain node, now in [P3a].)*". Redraw the asset.
- **Label style mixed** — "[Paper 1]"/"[Paper 4]"/"[Paper 6]" alongside "[P3a]"; normalize to P-notation.
- Renal *autoregulation* (§2.2.1) legitimately retained — do **not** mistake it for the cerebral content that moved. Deposit slots blank. No `[VERIFY]` tokens.
**Cross-refs:** P1, P2, P3a (companion), P4, P6 (§3.2 lever table).

## P4 — *An integrated model for simulation of neonatal physiology — the mechanical support devices: ventilation and ECMO*  ·  **Tune Phase 3**
**Says:** Devices as physical sources wired into native compartments → emergent effects. Ventilator (gas circuit + ETT resistance, PC/PRVC/PS/CPAP, triggering/volume-targeting), ECMO (pump + membrane reusing the native lung's Fick flux, VA/VV by cannula site), + resuscitation and read-only monitor. Sims: 28wk RDS, PRVC holds V_T 5 mL/kg while FiO₂ 0.3→0.9 raises PaO₂ 59→100 and rate 20→60 drops PaCO₂ 72.5→38.3; VA-ECMO rescues PaO₂ 11→95, SvO₂ 24→83%.
**Length:** main ~3328 w (ok); abstract **~211 w (over)**.
**Worst edges:**
- Abstract → trim ~11 words. **Title has stray "THE" and the header doubles it** ("devices: THE mechanical support devices").
- Byline "**Fourth paper** in the EXPLAIN series" — confirm final numbering (series is now 9). Companions named generically, not `[P1]`/`[P2]` tokens; "§S1/§S5/§S7, Eqs. 13–14" point to the respiratory companion — confirm P1 vs P2 attribution.
- **Zero figures** (all Tables 1a–c, 2a–b). §4.4 Limitations heading is malformed (prose on the heading line). Deposit slot blank.
**Cross-refs:** respiratory companion (shared Methods §S1/S5/S7), P6 (`[P6]`); cardiovascular + other-systems named generically.

## P5 — *An integrated model for simulation of neonatal physiology — whole-body integration and a validated library of virtual patients*  ·  **Tune Phase 4**
**Says:** Integrative flagship — couples CV/respiratory/regulatory/device subsystems on one shared blood-and-gas substrate, validates the *coupled whole* across a **34-patient library** (normal fetus/neonate + adult ref; 7-GA preterm + bischoff; 3-phenotype CDH; PPHN; 12 duct-/FO CHD; 6 PDA-Doppler). One AI pipeline built all 34. Deliberately a breadth cut. Tables: T1 term panel, T2 fetal cascade, T3 preterm continuum, **T4 disease summary matrix (one row per family → defers to P7)**. Figs: architecture, library overview, AI pipeline (3 of ≤6).
**Length:** main ~2932 w (ample headroom); abstract **200 w (exactly at cap — brittle)**.
**Worst edges:**
- Refs **[5]–[9]** (Rudolph, Kiserud, Nuntnarumit, Versmold, Bischoff) still `[VERIFY]`; [12] Bhombal `[VERIFY]`. No deposit URL/DOI anywhere.
- Anti-redundancy **holds** (T4 per-family not per-lesion; no subsystem tables reprinted) — protect this when editing.
- Self-flagged calibration gaps *reported not fixed*: fetal combined output 315 vs ~400–450 mL/kg/min; fetal RV:LV ≈ unity vs classic RV dominance. Decide whether to address or keep as stated limitations.
- 2 optional figures (preterm trend, cross-lesion cyanosis/shunt) addable within budget.
**Cross-refs:** P1–P4, P6 (Box 1), P7 (per-lesion depth + structural limits).

## P6 — *AI-assisted parameterization of a mechanistic neonatal physiology model*  ·  **Tune Phase 2 (method everything cites)**
**Says:** Full method for the two-layer pipeline: an LLM interpretation layer (allowlisted, schema-checked; no numerical fitting, never touches equations/state) + a deterministic one-lever-per-target calibrator (proportional seed → secant root-find in a Gauss–Seidel loop). Offline 28wk/1.0kg build converges 5 targets in **2 iterations**; live retune of a running term neonate in **3**. Lever choice respects the model's own loops (baroreflex set-point alignment; PCO₂ via drive not diffusion); honestly documents non-convergence for infeasible/coupled targets. **SA incorporated 2026-07-13:** §2.6 Methods + §3.3 Results (one-lever validation matrix Table 4; Figs 1–2 `FigSA_*`) sensitivity-validate the design; §4.4 rewritten future-work→done with the honest "SpO₂ controller should be phenotype-aware" critique; full treatment in Supplement `P6_supplement_sensitivity-analysis.md`.
**Length:** main **~4798 w** (ok, under 5000 after SA); abstract **~397 w (must be halved — fold the SA clause in when doing it)**.
**Worst edges (BLOCKER lives here):**
- **No author block exists in the file at all** — this gates the bioRxiv preprint that P1–P5/P7 all cite. Decide the author list (physiology set vs adding AI/engineering ICMJE contributors) first.
- Mislabelled "**Fourth paper in the EXPLAIN series**" (it's P6 of 9). "§2.4 of the cardiovascular paper (Eqs. 13–15, **Table X**)" — `Table X` placeholder + the Eqs.13–15 map appears twice, verify.
- No formal code-availability statement though the calibrator/pipeline **is** the method (`Calibrator.js`, `build_patient.mjs`, `tune_model`, allowlist files named inline). AI-use disclosure is deliberately longer than standard — check against journal policy.
- ~~gestures at SA / frames it as future work~~ ✅ **RESOLVED** — SA now substantively in-text + Supplement + 2 figures; the §4.4 contradiction is gone.
**Cross-refs:** cardiovascular companion (its Box/Eqs.13–15 defer here), respiratory, other-systems; shared Methods S2/S5; **Supplement** `P6_supplement_sensitivity-analysis.md`; Messmore 2026 (SA precedent). Canonical method that every Box 1 + P5/P7 showcases defer to.

## P7 — *An integrated model for simulation of neonatal physiology — duct- and foramen-ovale-dependent congenital heart disease*  ·  **Tune Phase 4**
**Says:** 12 duct-/FO-dependent critical CHD lesions across 4 categories (A duct-dep pulmonary, B duct-dep systemic, C duct/FO mixing, D atrial-septum-dep), built from one baseline by structural levers, parameterized per-lesion by the P6 pipeline (per-lesion showcase; P5 = library-wide). Numbers: Cat-A SpO₂ 74–80%; d-TGA SpO₂ 58% at Qp:Qs≈1; arch-obstruction differential cyanosis (pre 96–97% vs post 84–87%); HLHS restrictive septum **LA 21 mmHg**, SpO₂ 64%; PGE1 reopening + balloon septostomy demonstrated; duct-closure crashes PA+VSD to ~14%. Sharpest van Willigen 2026 contrast.
**Length:** main ~2894 w (well under); abstract 198 w (ok). Tables 1 (taxonomy) + 2–5 (category results).
**Worst edges:**
- **Zero figures** (5 tables only) — a shunt-direction/circuit or waveform figure is the obvious add.
- Companion refs [P1]–[P6] unfilled placeholders; cite P6 as preprint. **[P3]→[P3a,P3b] split has landed** (good). No deposit link; tables need Word conversion.
- 12-lesion set confirmed (TOF/PA, neonatal Ebstein excluded in §4.4; no MAPCA/aortic-override/atrialized-RV). Clean — no `[VERIFY]`/`‹slots›`. Refs [1–21] all carry PMIDs/DOIs.
**Cross-refs:** P1 (baseline, §2.3), P2, P3a/P3b (companion list), P4, P5 (paired demonstration), P6 (method).

## P8 — *In-silico neonatal physiology: from circulation models to explanatory, patient-specific whole-body simulation*  ·  **Tune Phase 4 (LAST — and only if invited)**
**Says:** **Not a manuscript** — a pre-inquiry package: a presubmission letter to EiC Cynthia Bearer asking whether a full Review is welcome, + an unstructured abstract sketch (~160 w) + a 7-section outline with word budgets. Proposed Review surveys the field neutrally against 4 criteria (breadth · individualization · real-time/openness · validation basis) around 2 gaps (whole-body breadth; automated patient-specific parameterization incl. bounded LLM layer), with EXPLAIN as the worked instantiation. Surveys Sá-Couto 2010, Munneke 2021, van Willigen 2026, May 2025.
**Length:** **outline only — full Review UNWRITTEN.** Inquiry letter ≈380 w; planned Review ~4500 w, ~60 refs, 1–2 figures.
**Worst edges:**
- **Timing gate** — send the inquiry only after P1/P2 (ideally P5/P6) are submitted/in-press; fill the ‹which are submitted/in press› slot truthfully.
- Letter ‹slots›: ‹Date›, corresponding-author degrees/address/phone/email. Author list must align with P6.
- Self-promotion is the main rejection risk for an unsolicited Review — keep the criteria table neutral. **Documented fallback: if not invited, fold the argument into P5 Discussion and drop P8.**
**Cross-refs:** cites the whole series P1–P7 as published/in-press; positioned as concept-telling vs P5's data-telling.
