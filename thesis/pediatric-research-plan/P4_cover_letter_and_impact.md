# P4 (Mechanical support devices) — cover letter + Impact Statement for Pediatric Research

*Wave-2 paper. Manuscript: "An integrated model for simulation of neonatal physiology: mechanical support devices — ventilation and ECMO" (Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP). Article type: **Basic Science Article**. Drafted 2026-07-12 from `thesis/devices-paper.md`. Series decisions applied: Antonius corresponding; public code deposit; no ECI; compact AI-param highlight (full method in P6).*

> **Note on PR fit (lighter than feared).** The programme flagged devices as a potential "engineering/methods" fit risk, but the manuscript is **already framed mechanism-first**: each device is a physical source wired into shared compartments so that tidal volume and the arterial blood gas are *emergent, not prescribed*, and the ECMO membrane oxygenator literally reuses the native lung's gas-exchange law. The letter below leans into that framing (device–patient coupling, teaching value) — this reads as physiology, not device engineering, so no reframe is needed. If a reviewer still pushes on device specificity, the limitations section already concedes the lumped pump/resistance surrogates honestly.

> **✅ Manuscript consistency edits DONE 2026-07-12** (in `devices-paper.md`): **(1)** header "Fifth paper" → "**Fourth paper**"; §2.4 parameterization reference now cites the companion **[P6]**. **(2)** **public-deposit** statement added to §2.4 (replacing the shared-Methods-S5 "available upon request" reliance). **(3)** references resolved — the stub now lists the PubMed-verified sources (ETT resistance Jarreau 1999 / Spaeth 2015; vent modes Keszler 2005 / Schulzke 2021; ECMO Butt 2013 / Cortesi 2022). *Remaining at final assembly:* fill the deposit URL/DOI.

---

## Structured abstract (192 words; applied to `devices-paper.md` 2026-07-12)

**Background:** Sick newborns are frequently supported by devices that act on the physiology — the mechanical ventilator, which drives gas into the lungs, and extracorporeal membrane oxygenation (ECMO), which takes over gas exchange and circulation. We model these devices in the EXPLAIN neonatal simulator.

**Methods:** Each device is a physical source wired into the same compartments as the native physiology, so its effects emerge rather than being prescribed. The ventilator is a gas circuit connected through a resistive endotracheal tube, implementing the clinical modes (pressure control, PRVC, pressure support, CPAP) with triggering and volume-targeting, composing with spontaneous breathing. ECMO is a blood pump and a membrane oxygenator that reuses the native lung's gas-exchange law, with cannulae to named compartments (veno-arterial or veno-venous).

**Results:** In a surfactant-deficient lung, ventilation restored oxygenation with inspired oxygen and pressure and cleared carbon dioxide with rate, the servo holding tidal volume fixed. Veno-arterial ECMO rescued profound hypoxaemia (arterial PO₂ 11→95 mmHg) as pump flow rose, with carbon-dioxide removal set by sweep-gas flow. All blood gases were emergent, not prescribed.

**Conclusion:** Because the devices act through shared compartments, delivered volumes, blood gases and device–patient interactions are emergent and interpretable, completing the simulator.

---

## Impact Statement (≤100 words — PR's current cap)

We present EXPLAIN's mechanical-support layer — a neonatal ventilator (pressure/volume modes, CPAP), extracorporeal membrane oxygenation (veno-arterial and veno-venous), the bedside monitor — modelled as physical sources of gas pressure and blood flow wired into the same compartments as the native physiology, so delivered volumes and blood gases are emergent, not prescribed. The ECMO oxygenator reuses the native lung's partial-pressure-driven gas-exchange law, so device–patient interactions fall out of the same equations. It gives clinicians and trainees a transparent, real-time account of how tidal volume, blood gas and oxygen delivery emerge from ventilator and ECMO settings meeting a lung and circulation.

*(99 words.)*

---

## Cover letter

‹Date›

Cynthia Bearer, MD, PhD
Editor-in-Chief, *Pediatric Research*
c/o Editorial Office, info@pedres.org

Dear Dr. Bearer and Editors,

We are pleased to submit our manuscript, **"An integrated model for simulation of neonatal physiology: mechanical support devices — ventilation and ECMO,"** for consideration as a **Basic Science Article** in *Pediatric Research*.

Much of neonatal intensive care consists of supporting, or temporarily replacing, cardiorespiratory function with machines — the mechanical ventilator when an infant cannot breathe adequately alone, and extracorporeal membrane oxygenation (ECMO) when the native lung or heart cannot sustain gas exchange or the circulation at all. These are among the most consequential interventions in the newborn intensive-care unit, and among the hardest to teach, precisely because their effect on the patient is never the setting itself but the interaction between the machine and a particular physiology: a set peak pressure produces a tidal volume that depends on lung compliance and tube resistance; a synchronized breath is meaningful only in relation to the infant's own effort; on ECMO, pump flow and sweep-gas flow partition oxygenation and carbon-dioxide clearance between the artificial and the native lung. In this manuscript we model the device layer of EXPLAIN, a real-time mechanistic neonatal simulator, so that these interactions are represented explicitly. Each device is modelled not as a generator of prescribed outputs but as a physical source — of gas pressure, or of blood flow — wired into the same compartments as the native physiology described in our companion papers; the resulting mechanics, gas exchange and haemodynamics then fall out of the same equations that govern the unsupported patient. A particularly direct expression of this economy is that the ECMO membrane oxygenator reuses the identical partial-pressure-driven gas-exchange law as the native alveolar–capillary barrier. We demonstrate that mechanical ventilation restores oxygenation and carbon-dioxide clearance in a surfactant-deficient lung as a function of inspired oxygen, airway pressure and rate, and that veno-arterial ECMO rescues a lung failed to profound hypoxaemia as a function of pump flow and sweep gas — in every case as an emergent property of the coupled device–patient system, not a device setting.

We believe this work fits the translational, mechanism-oriented scope of *Pediatric Research*. Neonatal mechanical ventilation and ECMO are core to the journal's readership, and the contribution here is to represent them not as black boxes but as physical devices coupled to an interpretable, openly available whole-body model, in which the clinically decisive quantities emerge from — and can be reasoned about through — the same mechanisms a clinician uses at the bedside.

In the interest of full transparency, this manuscript is one of a **planned series** describing the EXPLAIN model; it completes the model by adding the mechanical-support devices to the cardiovascular, respiratory and regulatory-organ subsystems of the companion papers. The cardiovascular and respiratory papers are being submitted to *Pediatric Research* ‹state submitted/in-press status and cite once available›; further companion papers on an AI-assisted patient-parameterization method, an integrated-model validation across a library of virtual patients, and duct-dependent congenital heart disease are in preparation. Each paper addresses a distinct part of the model and carries its own validation; shared methodological machinery is described in full only in the lead paper and cross-referenced thereafter. We are happy to discuss the sequencing of the series with the editorial office. A large language model (Claude, Anthropic) is used as a component of the patient-parameterization *method* (not as an author, and not to generate scientific content or text); this is disclosed in the Methods.

The manuscript is original, has not been published previously, and is not under consideration elsewhere. All authors have approved the submission and meet ICMJE authorship criteria. We have no competing financial interests to declare ‹confirm›. In line with the journal's data-availability policy, the interactive model is freely available at https://explain-modeling.com, and the complete, annotated engine source code is publicly available at https://github.com/Dobutamine/explain-engine and archived with a persistent identifier at https://doi.org/10.5281/zenodo.21389097; every quantitative result is reproduced by the named probe scripts reported in the manuscript.

Thank you for considering our work. We look forward to your response.

Yours sincerely,

T.A.J. Antonius, ‹degrees› (corresponding author)
on behalf of the co-authors (W.L. van Meurs, B.E. Westerhof, W.P. de Boode)
‹Affiliation, full postal address, phone, email›

---

## Slots / decisions to close before sending

1. **Corresponding author** — T.A.J. Antonius (series-wide). Fill degrees + address.
2. **Manuscript consistency edits** (see banner): map "fifth paper"/"Paper 4" labels to final numbering; add public-deposit availability statement.
3. **Reference verification** — resolve the [VERIFY] entries (ETT resistance law, ventilator modes, ECMO circuit/oxygenator) against PubMed.
4. **Data/Code deposit** — DONE: engine repo public + Zenodo DOI minted (2026-07-16); filled `https://github.com/Dobutamine/explain-engine` and `https://doi.org/10.5281/zenodo.21389097`.
5. **Lead-paper status line** — state P1/P2 submitted/in-press and cite once available.
6. **Competing-interests line** — confirm "none," or state them.
7. **Optional: suggested/excluded reviewers** — neonatal mechanical-ventilation and ECMO experts, plus the modelling competitor groups.
8. **Optional scope note** — CPR and the bedside monitor are covered briefly (§2.3); confirm keeping them in this paper vs a short online supplement.
