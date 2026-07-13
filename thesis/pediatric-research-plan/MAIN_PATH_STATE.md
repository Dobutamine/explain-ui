# MAIN PATH TO PUBLICATION — state checkpoint

*Saved 2026-07-13. This is the durable snapshot of the **main path**: publishing the EXPLAIN model as an 8-paper programme in **Pediatric Research** (PR). Work on this path is **paused** here so an alternative path can be explored; this file is the resume point. Nothing on the main path is committed to git — all changes are working-tree edits. Programme rationale lives in `PR_ARTICLE_SLATE.md` and the plan `~/.claude/plans/next-big-task-is-abundant-possum.md`; competitive/fit context in memory `pediatric-research-target.md`.*

---

## 1. What the main path is (one paragraph)

Publish the whole EXPLAIN neonatal simulator as **9 papers in 3 waves** (P3 split into P3a+P3b, 2026-07-13) in PR (Basic Science Articles + one Review), sequenced so the model is fully in print before the headline AI-parameterization method, with a compact AI-parameterization highlight threaded through every paper and substantive showcases in P5 (library-wide) and P7 (per-lesion). Differentiate throughout on **whole-body breadth + patient-specific AI-parameterization + real-time open platform** vs the incumbents (Munneke 2021, van Willigen 2026, May 2025).

**The 9 papers (final numbering):**
P1 Cardiovascular (lead) · P2 Respiratory · **P3a Cerebral haemodynamics & ICP · P3b Homeostatic regulation** · P4 Devices (ventilation+ECMO) · P5 Integrated-model + virtual-patient-library flagship · P6 AI-parameterization method (headline) · P7 duct/FO-dependent CHD (application) · P8 Review (invited, last). *(Numbering: P3a/P3b sub-labels; P4–P8 unchanged so their cross-refs stay valid.)*

---

## 2. Per-paper status matrix

Legend: ✅ done · ◐ partial · ✗ not started · 🔒 blocked (dependency).

| Paper | Front-matter (title/abstract/impact) | Cover letter | Manuscript draft | Key remaining work |
|---|---|---|---|---|
| **P1** Cardiovascular | ✅ | ✅ `P1_cover_letter_and_impact.md` | ◐ `ExplainCircPaper(27012026)_WPdB_TA_WvM.docx` | Python→JS fix **STAGED, uncommitted**; AI-param insertions (`P1_ai-param_insertions.md`) paste-ready but **NOT injected** (needs Word pass: Box 1 + refs [24–26]) |
| **P2** Respiratory | ✅ | ✅ `P2_cover_letter_and_impact.md` | ✅ `respiratory-paper.md` | consistency edits ✅ DONE; fill deposit URL/DOI; wire inline [N] cites at assembly |
| **P3a** Cerebral | ✅ | ✅ `P3a_cover_letter_and_impact.md` | ✅ `cerebral-paper.md` (new 2026-07-13) | refocused-out marquee paper (autoregulation→IVH/HIE, Monro–Kellie); 200-w abstract, ≤100-w Impact, probe_brain-verified; fill deposit URL/DOI; wire inline [N] cites |
| **P3b** Homeostasis | ✅ | ✅ `P3b_cover_letter_and_impact.md` | ✅ `other-systems-paper.md` (transformed) | renal/endocrine/thermal/glucose/pharma + fluids; cerebral removed, renumbered; 189-w abstract, ≤100-w Impact; **main text 4764 w (little headroom vs 5000)**; deposit URL/DOI; inline [N] cites |
| **P4** Devices | ✅ | ✅ `P4_cover_letter_and_impact.md` | ✅ `devices-paper.md` | consistency edits ✅ DONE; fill deposit URL/DOI; wire inline [N] cites |
| **P5** Flagship | ✅ `P5_cover_letter_and_impact.md` | ✅ (same file) | ✅ `integrated-model-paper.md` (drafted 2026-07-13) | manuscript done: 3110w main text, 4 library-wide tables (Table 4 = disease summary matrix, per-family not per-lesion → cites P7), 3 existing figs; anti-redundancy verified (no §7.6/subsystem-table reprint); remaining = fill deposit URL/DOI, fetal/neonate/preterm refs [1]–[9] still [VERIFY], wire inline [N] cites |
| **P6** AI-param method | ✅ `A2_ai-parameterization_frontmatter.md` | ✅ `P6_cover_letter_and_impact.md` | ◐ `ai-parameterization-paper.md` | 🔒 **author list undecided → gates bioRxiv preprint**; remap "Fourth paper"/"§2.4 Eqs.13–15" self-refs; OMML equations; deposit stmt |
| **P7** CHD | ✅ `P7_cover_letter_and_impact.md` | ✅ (same file) | ✅ `chd-paper.md` (assembled 2026-07-12) | fill real `[P1]`–`[P6]` companion refs/DOIs; deposit URL/DOI; Word tables; confirm 12-lesion set (monograph has ~14) |
| **P8** Review | ✅ (pre-inquiry+outline) `P8_review_preinquiry.md` | n/a — **editor pre-inquiry** instead | ✗ (outline only) | 🔒 send inquiry only AFTER P1/P2 (ideally P5/P6) submitted/in-press; write full Review last if invited |

---

## 3. Cross-cutting open actions (each unblocks several papers)

1. **Make the engine repo PUBLIC + mint a Zenodo DOI.** Fills every `‹repository URL›` / `‹Zenodo/archive DOI›` slot — present in all 8 cover letters and in the P2/P3/P4/P7 manuscript availability statements. Highest-leverage single action. *(Decision already taken: public deposit, not "on request".)*
2. **Post the P6 bioRxiv preprint** — gated on the **P6 author list** (may add AI/engineering ICMJE contributors beyond Antonius/van Meurs/Westerhof/de Boode; must match the preprint). Unblocks the `[P6]`/`‹P6›` citations that P1–P5 and P7 all rely on.
3. **Fill Antonius author block** (series-wide): degrees, full postal address, phone, email, competing-interests line.
4. **Re-verify PR's live article limits** — the cached guidelines PDF is dated May 2020 (word/figure/reference caps, unsolicited-Review policy).
5. **Wire inline numeric [N] citations** at final assembly — the manuscripts cite by author-name in prose; the numbered reference lists are pools until wired.
6. **P1 docx**: decide whether to inject the AI-param insertions (Word pass) and whether to commit the staged Python→JS fix.

---

## 4. Open decisions (need the user)

- ~~**P3 omnibus vs refocus/split**~~ — ✅ RESOLVED 2026-07-13: **split** into P3a (cerebral) + P3b (homeostasis). Both manuscripts + cover letters done. Programme now 9 papers.
- **P7 final lesion count** — 12 (library §7.6) vs ~14 (monograph catalog; TOF/PA + neonatal Ebstein are "partially buildable" approximations, currently excluded → lands at 12).
- **P8** — proceed only if editors welcome it (fallback: fold its argument into P5 Discussion, drop P8).

---

## 5. Completed workstreams (done, not to redo)

- ✅ **Combined 8-paper programme** designed & written (`PR_ARTICLE_SLATE.md`), two-slate merge resolved.
- ✅ **Scope-precedent / competitive check** (Munneke/van Willigen/May) — genre confirmed, differentiation mandated.
- ✅ **Reusable series blocks** (`series_blocks.md`): Block A positioning (Karger ref verified = May et al. 2025) + Block B AI-param callout.
- ✅ **Front-matter for P1–P7**; **cover letters P1–P7**; **P8 pre-inquiry + outline**.
- ✅ **P7 manuscript assembled** (`chd-paper.md`).
- ✅ **Reference-verification pass** (Paper 2/3/4 pools) → `_references.md` carries confirmed PMIDs/DOIs; pre-MEDLINE/textbook items flagged.
- ✅ **P2/P3/P4 manuscript consistency edits** (public-deposit wording, label remaps, §2.4→P6 repoints, [VERIFY]→verified refs). Verified: 0 [VERIFY], 0 "upon request", deposit stmt in all three.
- ✅ **P1 Python→JS fix** applied to the docx (staged, uncommitted).
- ✅ **Impact Statements trimmed to PR's ≤100-word cap, series-wide** (2026-07-13). All eight (P1/P2/P4/P5/P6/P7, plus P3a/P3b done at the split) rewritten from the old 3-bullet ~150–210-word form into a single ≤100-word paragraph in the P3a/P3b register (message → what-it-adds → impact); heading normalized to "Impact Statement (≤100 words — PR's current cap)". Verified ≤100 under both a strict word count **and** the stricter MS-Word style (spaced em-dashes counted); each `*(N words.)*` tag reconciled to the Word-style count (P1 99, P2 100, P3a 95, P3b 100, P4 99, P5 100, P6 100, P7 100). The stale pre-split `P3_cover_letter_and_impact.md` was deleted.

---

## 6. File inventory (where everything lives)

**Plan folder `thesis/pediatric-research-plan/`:**
`PR_ARTICLE_SLATE.md` (programme) · `series_blocks.md` (reusable blocks) · `A2_ai-parameterization_frontmatter.md` (P6 front-matter) · `P1_cover_letter_and_impact.md` · `P1_ai-param_insertions.md` · `P2_…` · `P3a_…` · `P3b_…` · `P4_…` · `P5_…` · `P6_cover_letter_and_impact.md` · `P7_cover_letter_and_impact.md` · `P8_review_preinquiry.md` · **`MAIN_PATH_STATE.md` (this file)**.

**Manuscripts + shared, in `thesis/`:**
`ExplainCircPaper(27012026)_WPdB_TA_WvM.docx` (P1) · `respiratory-paper.md` (P2) · `other-systems-paper.md` (P3) · `devices-paper.md` (P4) · `ai-parameterization-paper.md` (P6) · `chd-paper.md` (P7) · `thesis-ch7-virtual-patient-library.md` (P5 source) · `_references.md` (verified pool) · `_shared-methods.md` · `circ-paper-additions.md` (P1 insert blocks).

---

## 7. How to resume the main path

Pick up at whichever is unblocked; suggested order when returning:
1. **Repo public + Zenodo DOI** (action #1) → then a single sweep filling every `‹URL›/‹DOI›` slot across all papers.
2. ~~**Decide P3 omnibus-vs-refocus**~~ ✅ done (split into P3a/P3b).
3. **Draft P5** (the flagship the earlier papers point toward) — needs the distinct library-wide data cut vs P1–P4.
4. **Settle P6 author list → post bioRxiv preprint** → backfill `[P6]` citations everywhere.
5. Finish P7 plumbing; P1 docx AI-param injection; then submit Wave 1 (P1→P2) and proceed wave by wave; send the P8 inquiry once P1/P2 are in.

**Submission order (waves):** W1 P1→P2 · W2 P3→P4→P5 · W3 P6→P7→P8(invited).
